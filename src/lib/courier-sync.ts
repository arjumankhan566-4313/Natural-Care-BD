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
import { applyOrderStatusChange } from './helpers'
import type { Context } from 'hono'

export const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes, per spec section 4
const LOCK_STALE_MINUTES = 2                    // if a lock is older than this, assume the previous run crashed and allow a new one
const MAX_ORDERS_PER_BATCH = 40                 // Workers have a CPU/time budget — cap how many orders one batch checks

export function courierStatusLabel(status: string): string {
  return STEADFAST_STATUS_BN[status] || status || '—'
}

// Try to acquire the single global lock row. Returns true if acquired (caller must run
// the batch and then call releaseLock()). Returns false if another run is already active
// and not stale.
//
// IMPORTANT: this must be a single atomic UPDATE, not a SELECT-then-UPDATE. Two concurrent
// admin requests (e.g. someone browsing the order-detail page, which itself triggers both
// the 20s courier-poll AND the shared lazy-cron middleware on every /api/admin/* call) can
// each independently run this function within the same D1 write-serialization window. If we
// SELECT first, both requests can see "not locked" before either one commits its UPDATE —
// this was the root cause of the duplicate courier_status_logs rows seen in production
// (4x identical "in_review" entries at the same timestamp). A conditional UPDATE is atomic:
// D1 serializes writes to a database, so only the request whose UPDATE actually matches the
// WHERE clause will report changes > 0 — the other one is guaranteed to see changes = 0.
async function tryAcquireLock(db: D1Database): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE courier_sync_lock SET locked_at = datetime('now')
     WHERE id = 1 AND (locked_at IS NULL OR locked_at < datetime('now', '-${LOCK_STALE_MINUTES} minutes'))`
  ).run()
  return (result.meta?.changes || 0) > 0
}

// ---- Auto-advance the main order.status from the courier's real progress ----
// Per the user's explicit requirement ("যখন কুরিয়ার সার্ভারে আপডেট হবে তখনই আমার
// ওয়েবসাইটেও সাথে সাথে আপডেট হতে হবে, ম্যানুয়ালি পরিবর্তন না করা লাগে"), Steadfast status
// changes must also move the order forward in its own lifecycle — not just populate the
// separate courier_status display field. We map only the courier statuses that have an
// unambiguous, safe equivalent in ORDER_STATUSES, and we NEVER move an order backwards or
// override a status the admin explicitly set to something outside the normal delivery flow
// (cancelled/returned/fake/manual_review) — those are left for a human to review.
const ORDER_PROGRESSION = ['new', 'pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered']
const COURIER_TO_ORDER_STATUS: Record<string, string> = {
  pending: 'shipped',                          // Steadfast has it, still moving — order is at least "shipped"
  in_review: 'shipped',                        // just accepted by Steadfast, in transit
  hold: 'shipped',                             // temporarily held by courier, still in their custody
  delivered_approval_pending: 'out_for_delivery', // driver marked delivered, awaiting back-office approval
  partial_delivered_approval_pending: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled'
  // partial_delivered / cancelled_approval_pending / unknown_approval_pending / unknown:
  // deliberately NOT auto-mapped — ambiguous/needs human judgement (e.g. partial delivery
  // COD amount differs from grand_total, so we must not blindly mark it "delivered").
}
const NON_AUTO_STATUSES = new Set(['cancelled', 'returned', 'fake', 'manual_review']) // never override these

function deriveOrderStatus(courierStatus: string, currentOrderStatus: string): string | null {
  const target = COURIER_TO_ORDER_STATUS[courierStatus]
  if (!target || target === currentOrderStatus) return null
  if (NON_AUTO_STATUSES.has(currentOrderStatus)) return null // admin already made a final manual call — don't touch it
  if (target === 'delivered') return currentOrderStatus === 'delivered' ? null : 'delivered'
  if (target === 'cancelled') return currentOrderStatus === 'cancelled' ? null : 'cancelled'
  // Progression states (shipped / out_for_delivery): only move forward, never backward
  const curIdx = ORDER_PROGRESSION.indexOf(currentOrderStatus)
  const tgtIdx = ORDER_PROGRESSION.indexOf(target)
  if (curIdx === -1 || tgtIdx === -1) return null
  return tgtIdx > curIdx ? target : null
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
//
// `ctx` is optional (see applyOrderStatusChange) — pass it when called from a live HTTP
// request (e.g. the "Sync Now" button) so the delivered-SMS send can be non-blocking;
// omit it when called from the background batch loop.
export async function syncOneOrder(db: D1Database, order: any, courier: any, ctx?: Context<any>): Promise<{ ok: boolean; changed: boolean; status?: string; message: string }> {
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

  // ATOMIC status-change detection: guard the UPDATE with "WHERE courier_status IS NOT ?"
  // instead of comparing the in-memory `order.courier_status` we read at the top of this
  // function. Two concurrent syncs of the SAME order (e.g. the 5-min lazy batch and a
  // manual "Sync Now" click landing in the same moment) can both read the same stale
  // oldStatus before either commits — that race is what produced the 4 duplicate
  // "in_review" log rows seen in production. With a conditional UPDATE, D1 serializes the
  // writes: only the first one to land actually changes the row (meta.changes = 1), so
  // only that one inserts a log row. The second one's UPDATE matches zero rows and it
  // correctly reports changed = false instead of logging a duplicate.
  const label = courierStatusLabel(newStatus)
  const upd = await db.prepare(`
    UPDATE orders SET courier_status = ?, courier_status_label = ?, courier_last_synced_at = datetime('now'),
      courier_sync_error = '', courier_sync_attempts = 0
    WHERE id = ? AND COALESCE(courier_status, '') IS NOT ?
  `).bind(newStatus, label, order.id, newStatus).run()
  const changed = (upd.meta?.changes || 0) > 0

  if (changed) {
    await db.prepare(`
      INSERT INTO courier_status_logs (order_id, courier, old_status, new_status, raw_status, source)
      VALUES (?, ?, ?, ?, ?, 'api')
    `).bind(order.id, courier.name || 'Steadfast', oldStatus || null, newStatus, newStatus).run()

    // Auto-advance the main order lifecycle status too (see deriveOrderStatus above) — this
    // is the behavior the user explicitly asked for: courier-side progress must show up on
    // the main order status without any manual admin click.
    const derived = deriveOrderStatus(newStatus, order.status)
    if (derived) {
      await applyOrderStatusChange(db, order, derived, 'Steadfast (Auto)',
        `স্বয়ংক্রিয়ভাবে আপডেট — Steadfast স্ট্যাটাস: ${label}`, ctx)
    }
  } else {
    // Unchanged (or lost the race to a concurrent sync of the same order) — still record
    // that we successfully checked: refresh last_synced_at + clear any stale error, but
    // only if we didn't just lose a genuine concurrent update (courier_sync_error/attempts
    // reset is harmless either way since the other writer already reset them to the same values).
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
      SELECT o.id, o.order_number, o.consignment_id, o.tracking_id, o.courier_status, o.courier_id,
             o.status, o.customer_id, o.phone, o.customer_name,
             c.id as c_id, c.name, c.api_key, c.secret_key, c.base_url, c.has_api
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
