// ============ Steadfast Auto Status Sync ============
// Polls Steadfast's status_by_cid / status_by_invoice / status_by_trackingcode endpoints
// for every order that has been transferred to Steadfast, and updates our local DB when
// the courier's status actually changes. Does NOT touch payment status, customer info,
// product quantity, total price, or the main order.status field (spec section 7) — it
// only writes to the dedicated courier_status* columns.
//
// Cloudflare Pages has no cron/`triggers` support on the hosted-deploy path, so instead
// of a real 5-minute cron job we use a "lazy catch-up" pattern: any admin API request
// checks how long ago the last global sync ran (courier_sync_lock.last_run_at) and, if
// it's been >= SYNC_INTERVAL_MS, kicks off a background batch via runBackground() without
// blocking that request's response. In practice the admin panel is hit constantly while
// someone is logged in, so this behaves like a real interval — just not clock-precise.

import { isSteadfast, courierApiReady, steadfastCheckStatus, isSteadfastTerminal, STEADFAST_STATUS_BN } from './steadfast'

export const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes, per spec section 4
const LOCK_STALE_MS = 2 * 60 * 1000            // if a lock is older than this, assume the previous run crashed and allow a new one
const MAX_ORDERS_PER_BATCH = 40                 // Workers have a CPU/time budget — cap how many orders one batch checks

export function courierStatusLabel(status: string): string {
  return STEADFAST_STATUS_BN[status] || status || '—'
}

// Try to acquire the single global lock row. Returns true if acquired (caller must run
// the batch and then call releaseLock()). Returns false if another run is already active
// and not stale.
async function tryAcquireLock(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT locked_at FROM courier_sync_lock WHERE id = 1').first<{ locked_at: string | null }>()
  if (row?.locked_at) {
    const lockedAgo = Date.now() - new Date(row.locked_at.replace(' ', 'T') + 'Z').getTime()
    if (lockedAgo < LOCK_STALE_MS) return false // someone else is actively syncing
  }
  await db.prepare("UPDATE courier_sync_lock SET locked_at = datetime('now') WHERE id = 1").run()
  return true
}

async function releaseLock(db: D1Database, stats: { checked: number; updated: number; errors: number }) {
  await db.prepare("UPDATE courier_sync_lock SET locked_at = NULL, last_run_at = datetime('now'), last_run_stats = ? WHERE id = 1")
    .bind(JSON.stringify(stats)).run()
}

// Should a global batch run right now? (last_run_at older than SYNC_INTERVAL_MS, or never run)
export async function isSyncDue(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT last_run_at FROM courier_sync_lock WHERE id = 1').first<{ last_run_at: string | null }>()
  if (!row?.last_run_at) return true
  const ago = Date.now() - new Date(row.last_run_at.replace(' ', 'T') + 'Z').getTime()
  return ago >= SYNC_INTERVAL_MS
}

// Sync exactly one order against Steadfast. Safe to call directly (e.g. "Sync Now" button)
// or from the batch loop. Never throws — always resolves with a result object.
export async function syncOneOrder(db: D1Database, order: any, courier: any): Promise<{ ok: boolean; changed: boolean; status?: string; message: string }> {
  if (!order.consignment_id && !order.tracking_id) {
    await db.prepare(`UPDATE orders SET courier_sync_error = ?, courier_sync_attempts = courier_sync_attempts + 1 WHERE id = ?`)
      .bind('Missing Steadfast identifier', order.id).run()
    return { ok: false, changed: false, message: 'Missing Steadfast identifier' }
  }
  if (!courierApiReady(courier)) {
    return { ok: false, changed: false, message: 'Steadfast API Key/Secret Key কনফিগার করা নেই' }
  }

  const res = await steadfastCheckStatus(courier, {
    consignmentId: order.consignment_id || undefined,
    invoice: order.order_number || undefined,
    trackingCode: order.tracking_id || undefined
  })

  if (!res.ok) {
    // Error handling per spec section 11: never overwrite a valid existing status,
    // just record the error and bump the attempt counter for visibility/backoff.
    await db.prepare(`UPDATE orders SET courier_sync_error = ?, courier_sync_attempts = courier_sync_attempts + 1 WHERE id = ?`)
      .bind(res.message.slice(0, 500), order.id).run()
    return { ok: false, changed: false, message: res.message }
  }

  const newStatus = res.delivery_status || 'unknown'
  const oldStatus = order.courier_status || ''
  const changed = newStatus !== oldStatus

  if (changed) {
    const label = courierStatusLabel(newStatus)
    await db.batch([
      db.prepare(`
        UPDATE orders SET courier_status = ?, courier_status_label = ?, courier_last_synced_at = datetime('now'),
          courier_sync_error = '', courier_sync_attempts = 0 WHERE id = ?
      `).bind(newStatus, label, order.id),
      db.prepare(`
        INSERT INTO courier_status_logs (order_id, courier, old_status, new_status, raw_status, source)
        VALUES (?, ?, ?, ?, ?, 'api')
      `).bind(order.id, courier.name || 'Steadfast', oldStatus || null, newStatus, newStatus)
    ])
  } else {
    // Unchanged — still record that we successfully checked (spec 13: "no unnecessary db update"
    // for the status itself, but last_synced_at + clearing any stale error is a lightweight touch).
    await db.prepare(`
      UPDATE orders SET courier_last_synced_at = datetime('now'), courier_sync_error = '', courier_sync_attempts = 0 WHERE id = ?
    `).bind(order.id).run()
  }

  return { ok: true, changed, status: newStatus, message: 'OK' }
}

// Batch: find every order transferred to a Steadfast courier that isn't in a terminal
// status yet, and sync each one. Continues past individual failures (spec section 4.7).
export async function syncPendingOrders(db: D1Database): Promise<{ checked: number; updated: number; errors: number; skippedLocked: boolean }> {
  const acquired = await tryAcquireLock(db)
  if (!acquired) return { checked: 0, updated: 0, errors: 0, skippedLocked: true }

  let checked = 0, updated = 0, errors = 0
  try {
    // Only orders whose current courier is Steadfast, have an identifier, and aren't
    // already in a terminal status (delivered/partial_delivered/cancelled) — matches
    // spec 4.2 "ignore orders that are already permanently completed/closed".
    const rows = await db.prepare(`
      SELECT o.id, o.order_number, o.consignment_id, o.tracking_id, o.courier_status, o.courier_id, c.id as c_id, c.name, c.api_key, c.secret_key, c.base_url, c.has_api
      FROM orders o JOIN couriers c ON c.id = o.courier_id
      WHERE o.is_deleted = 0
        AND (o.consignment_id IS NOT NULL AND o.consignment_id != '' OR o.tracking_id IS NOT NULL AND o.tracking_id != '')
        AND (o.courier_status IS NULL OR o.courier_status NOT IN ('delivered', 'partial_delivered', 'cancelled'))
      ORDER BY o.courier_last_synced_at ASC NULLS FIRST
      LIMIT ?
    `).bind(MAX_ORDERS_PER_BATCH).all()

    const orders = (rows.results || []) as any[]
    for (const row of orders) {
      if (!isSteadfast(row)) continue // only Steadfast is polled automatically for now
      checked++
      const courier = { id: row.c_id, name: row.name, api_key: row.api_key, secret_key: row.secret_key, base_url: row.base_url, has_api: row.has_api }
      const result = await syncOneOrder(db, row, courier)
      if (!result.ok) errors++
      else if (result.changed) updated++
    }
  } finally {
    await releaseLock(db, { checked, updated, errors })
  }
  return { checked, updated, errors, skippedLocked: false }
}

// Called from admin middleware — fire-and-forget via runBackground(). Cheap check first
// (isSyncDue reads one row) so it doesn't add latency to every admin request.
export async function maybeTriggerLazySync(db: D1Database): Promise<void> {
  try {
    if (await isSyncDue(db)) {
      await syncPendingOrders(db)
    }
  } catch {
    // never let a background sync failure surface to the caller
  }
}
