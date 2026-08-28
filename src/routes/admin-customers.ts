// ============ Admin: Customers, Blacklist/Whitelist ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog, normalizePhone } from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()
r.use('*', requireAuth('customers'))

r.get('/', async (c) => {
  const q = c.req.query()
  const conditions: string[] = ['1=1']
  const params: any[] = []
  if (q.list === 'blacklist') { conditions.push(`list_status = 'blacklist'`) }
  if (q.list === 'whitelist') { conditions.push(`list_status = 'whitelist'`) }
  if (q.list === 'repeat') { conditions.push('delivered_orders >= 2') }
  if (q.search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR address LIKE ?)')
    const s = `%${q.search}%`
    params.push(s, s, s)
  }
  const page = Math.max(1, Number(q.page || 1))
  const limit = Math.min(100, Number(q.limit || 25))
  const where = conditions.join(' AND ')
  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM customers WHERE ${where} ORDER BY last_order_at DESC NULLS LAST LIMIT ? OFFSET ?`)
      .bind(...params, limit, (page - 1) * limit).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM customers WHERE ${where}`).bind(...params).first<{ total: number }>()
  ])
  return c.json({ customers: rows.results || [], total: count?.total || 0, page, limit })
})

// Customer history by phone
r.get('/by-phone/:phone', async (c) => {
  const phone = normalizePhone(c.req.param('phone'))
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first<any>()
  if (!customer) return c.json({ error: 'not_found' }, 404)
  const orders = await c.env.DB.prepare(`
    SELECT o.id, o.order_number, o.status, o.grand_total, o.risk_level, o.created_at, c2.name as courier_name,
    (SELECT GROUP_CONCAT(product_name || ' ×' || quantity, ', ') FROM order_items WHERE order_id = o.id) as items_summary
    FROM orders o LEFT JOIN couriers c2 ON c2.id = o.courier_id
    WHERE o.customer_id = ? AND o.is_deleted = 0 ORDER BY o.id DESC
  `).bind(customer.id).all()
  return c.json({ customer, orders: orders.results || [] })
})

// Blacklist / whitelist / clear
r.put('/:id/list-status', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const { list_status, reason } = await c.req.json()
  if (!['none', 'blacklist', 'whitelist'].includes(list_status)) return c.json({ error: 'invalid' }, 400)
  const customer = await db.prepare('SELECT phone, name FROM customers WHERE id = ?').bind(id).first<any>()
  if (!customer) return c.json({ error: 'not_found' }, 404)
  await db.prepare('UPDATE customers SET list_status = ?, blacklist_reason = ? WHERE id = ?')
    .bind(list_status, list_status === 'blacklist' ? (reason || '') : '', id).run()
  await auditLog(db, user.id, user.username, 'list_status', 'customer', customer.phone, `${customer.name} → ${list_status}${reason ? ' | ' + reason : ''}`)
  return c.json({ success: true })
})

export default r
