// ============ Admin: Steadfast Auto Status Sync — manual trigger + dashboard stats ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog, notify } from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'
import { syncOneOrder } from '../lib/courier-sync'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()
r.use('*', requireAuth('orders'))

// Manual "Sync Now" — admin clicks a button, we ask Steadfast for the latest status of
// THIS order right now. This is a refresh/check only: the admin cannot type/select a
// status here, the value always comes straight from the courier API.
r.post('/sync-now/:orderId', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('orderId'))

  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found', message: 'অর্ডার পাওয়া যায়নি' }, 404)
  if (!order.courier_id) return c.json({ error: 'no_courier', message: 'এই অর্ডারে কোনো কুরিয়ার অ্যাসাইন করা নেই' }, 400)

  const courier = await db.prepare('SELECT * FROM couriers WHERE id = ?').bind(order.courier_id).first<any>()
  if (!courier) return c.json({ error: 'no_courier', message: 'কুরিয়ার পাওয়া যায়নি' }, 400)

  const result = await syncOneOrder(db, order, courier, c)
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, 502)
  }

  if (result.changed) {
    await auditLog(db, user.id, user.username, 'courier_status_sync', 'order', order.order_number, `Manual sync: ${order.courier_status || '—'} → ${result.status}`)
    await notify(db, 'courier_status_changed', '🚚 কুরিয়ার স্ট্যাটাস পরিবর্তন হয়েছে', `${order.order_number} — নতুন স্ট্যাটাস: ${result.status}`, `/admin#/orders/${id}`)
  }

  const fresh = await db.prepare('SELECT courier_status, courier_status_label, courier_last_synced_at, courier_sync_error FROM orders WHERE id = ?').bind(id).first<any>()
  return c.json({ success: true, changed: result.changed, ...fresh })
})

// Small dashboard widget data — real counts from the DB, not hard-coded (spec section 15).
r.get('/dashboard-stats', async (c) => {
  const db = c.env.DB
  const [active, byStatus, lastRun] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN courier_sync_error != '' AND courier_sync_error IS NOT NULL THEN 1 ELSE 0 END) as with_error,
        SUM(CASE WHEN courier_last_synced_at IS NOT NULL THEN 1 ELSE 0 END) as synced_ok
      FROM orders o JOIN couriers c ON c.id = o.courier_id
      WHERE o.is_deleted = 0 AND (o.consignment_id != '' OR o.tracking_id != '') AND (c.name LIKE '%Steadfast%' OR c.name LIKE '%স্টেডফাস্ট%')
    `).first<any>(),
    db.prepare(`
      SELECT COALESCE(courier_status, '') as status, COUNT(*) as cnt
      FROM orders o JOIN couriers c ON c.id = o.courier_id
      WHERE o.is_deleted = 0 AND (o.consignment_id != '' OR o.tracking_id != '') AND (c.name LIKE '%Steadfast%' OR c.name LIKE '%স্টেডফাস্ট%')
      GROUP BY courier_status
    `).all(),
    db.prepare('SELECT last_run_at, last_run_stats FROM courier_sync_lock WHERE id = 1').first<any>()
  ])

  const statusCounts: Record<string, number> = {}
  for (const row of (byStatus.results || []) as any[]) statusCounts[row.status || 'unsynced'] = row.cnt

  return c.json({
    active_orders: active?.total || 0,
    synced_ok: active?.synced_ok || 0,
    sync_errors: active?.with_error || 0,
    last_global_sync: lastRun?.last_run_at || null,
    last_run_stats: lastRun?.last_run_stats ? JSON.parse(lastRun.last_run_stats) : null,
    status_counts: statusCounts
  })
})

export default r
