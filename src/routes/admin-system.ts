// ============ Admin: Settings, Users, Audit log, Notifications, Export, Demo data ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog, hashPassword, setSetting, getSettings } from '../lib/helpers'
import { requireAuth, AdminUser, ROLE_PERMISSIONS } from '../lib/auth'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()

// ---------- SETTINGS ----------
const SECRET_KEYS = ['meta_capi_token']
const settings = new Hono<Env>()
settings.use('*', requireAuth('settings'))

settings.get('/', async (c) => {
  const all = await getSettings(c.env.DB)
  // Mask secrets
  for (const k of SECRET_KEYS) {
    if (all[k]) all[k] = '••••••••'
  }
  return c.json({ settings: all })
})

settings.put('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const updated: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const v = String(value)
    if (SECRET_KEYS.includes(key) && v === '••••••••') continue // unchanged masked secret
    await setSetting(db, key, v)
    updated.push(key)
  }
  if (updated.length) {
    await auditLog(db, user.id, user.username, 'update', 'settings', updated.join(','), `Settings updated: ${updated.join(', ')}`)
  }
  return c.json({ success: true, updated })
})

r.route('/settings', settings)

// ---------- ASSET UPLOAD (logo / favicon / BSTI certificate — stored in D1 as base64) ----------
const ASSET_KEYS = ['brand_logo', 'favicon', 'bsti_certificate', 'og_image_asset']
const ASSET_SETTING_MAP: Record<string, string> = {
  brand_logo: 'brand_logo',
  favicon: 'favicon_url',
  bsti_certificate: 'bsti_certificate_image',
  og_image_asset: 'og_image'
}
r.post('/assets/:key', requireAuth('settings'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const key = c.req.param('key') as string
  if (!ASSET_KEYS.includes(key)) return c.json({ message: 'অবৈধ অ্যাসেট কী' }, 400)
  const body = await c.req.json<{ data: string; mime: string }>()
  const { data, mime } = body || ({} as any)
  if (!data || !mime) return c.json({ message: 'ইমেজ ডেটা পাওয়া যায়নি' }, 400)
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(mime)) return c.json({ message: 'শুধু ইমেজ ফাইল (PNG/JPG/WEBP) আপলোড করা যাবে' }, 400)
  // base64 size check: ~1.33x of raw. Limit raw ~1.5MB
  if (data.length > 2_000_000) return c.json({ message: 'ফাইল খুব বড়। সর্বোচ্চ ~1.5MB ইমেজ দিন (ছোট করে আবার চেষ্টা করুন)' }, 400)
  await db.prepare('INSERT INTO assets (key, mime, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = CURRENT_TIMESTAMP')
    .bind(key, mime, data).run()
  // Point the related setting to the served asset URL (cache-busted)
  const url = `/assets/${key}?v=${Date.now()}`
  await setSetting(db, ASSET_SETTING_MAP[key], url)
  await auditLog(db, user.id, user.username, 'update', 'assets', key, `Asset uploaded: ${key}`)
  return c.json({ success: true, url })
})
// Generic image upload (e.g. review screenshots) — stores in D1 `assets` table under a generated key
r.post('/upload-image', requireAuth('content'), async (c) => {
  const db = c.env.DB
  const body = await c.req.json<{ data: string; mime: string }>()
  const { data, mime } = body || ({} as any)
  if (!data || !mime) return c.json({ message: 'ইমেজ ডেটা পাওয়া যায়নি' }, 400)
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return c.json({ message: 'শুধু ইমেজ ফাইল আপলোড করা যাবে' }, 400)
  if (data.length > 2_500_000) return c.json({ message: 'ফাইল খুব বড়। ছোট করে আবার চেষ্টা করুন' }, 400)
  const key = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await db.prepare('INSERT INTO assets (key, mime, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').bind(key, mime, data).run()
  return c.json({ success: true, url: `/assets/${key}` })
})

r.delete('/assets/:key', requireAuth('settings'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const key = c.req.param('key') as string
  if (!ASSET_KEYS.includes(key)) return c.json({ message: 'অবৈধ অ্যাসেট কী' }, 400)
  await db.prepare('DELETE FROM assets WHERE key = ?').bind(key).run()
  await setSetting(db, ASSET_SETTING_MAP[key], '')
  await auditLog(db, user.id, user.username, 'delete', 'assets', key, `Asset removed: ${key}`)
  return c.json({ success: true })
})

// ---------- USERS ----------
const users = new Hono<Env>()
users.use('*', requireAuth('*')) // super_admin only via wildcard perm

users.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, username, full_name, email, role, is_active, last_login_at, created_at FROM admin_users ORDER BY id').all()
  return c.json({ users: rows.results || [], roles: Object.keys(ROLE_PERMISSIONS), permissions: ROLE_PERMISSIONS })
})

users.post('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.username || !b.password || !b.full_name) return c.json({ error: 'validation', message: 'ইউজারনেম, পাসওয়ার্ড ও নাম আবশ্যক' }, 400)
  if (String(b.password).length < 6) return c.json({ error: 'validation', message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে' }, 400)
  if (!Object.keys(ROLE_PERMISSIONS).includes(b.role)) return c.json({ error: 'validation', message: 'ভুল role' }, 400)
  const exists = await db.prepare('SELECT id FROM admin_users WHERE username = ?').bind(b.username).first()
  if (exists) return c.json({ error: 'duplicate', message: 'এই ইউজারনেম ইতিমধ্যে আছে' }, 400)
  const hash = await hashPassword(String(b.password))
  const res = await db.prepare('INSERT INTO admin_users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)')
    .bind(b.username, hash, b.full_name, b.email || '', b.role).run()
  await auditLog(db, user.id, user.username, 'create', 'admin_user', b.username, `New admin user: ${b.full_name} (${b.role})`)
  return c.json({ success: true, id: res.meta.last_row_id })
})

users.put('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const b = await c.req.json()
  const target = await db.prepare('SELECT * FROM admin_users WHERE id = ?').bind(id).first<any>()
  if (!target) return c.json({ error: 'not_found' }, 404)
  const sets: string[] = []
  const params: any[] = []
  if (b.full_name) { sets.push('full_name = ?'); params.push(b.full_name) }
  if (b.email !== undefined) { sets.push('email = ?'); params.push(b.email) }
  if (b.role && Object.keys(ROLE_PERMISSIONS).includes(b.role)) { sets.push('role = ?'); params.push(b.role) }
  if (b.is_active !== undefined) { sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0) }
  if (b.password) {
    if (String(b.password).length < 6) return c.json({ error: 'validation', message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর' }, 400)
    sets.push('password_hash = ?'); params.push(await hashPassword(String(b.password)))
  }
  if (!sets.length) return c.json({ error: 'no_changes' }, 400)
  await db.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
  // Kill sessions if deactivated
  if (b.is_active === false) await db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(id).run()
  await auditLog(db, user.id, user.username, 'update', 'admin_user', target.username, `User updated`)
  return c.json({ success: true })
})

r.route('/users', users)

// ---------- AUDIT LOG + LOGIN HISTORY ----------
r.get('/audit-logs', requireAuth('settings'), async (c) => {
  const q = c.req.query()
  const page = Math.max(1, Number(q.page || 1))
  const limit = Math.min(100, Number(q.limit || 50))
  const rows = await c.env.DB.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?').bind(limit, (page - 1) * limit).all()
  return c.json({ logs: rows.results || [], page })
})

r.get('/login-history', requireAuth('settings'), async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM login_history ORDER BY id DESC LIMIT 100').all()
  return c.json({ history: rows.results || [] })
})

// ---------- NOTIFICATIONS ----------
r.get('/notifications', requireAuth(), async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all()
  const unread = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0').first<{ cnt: number }>()
  return c.json({ notifications: rows.results || [], unread: unread?.cnt || 0 })
})

r.post('/notifications/mark-read', requireAuth(), async (c) => {
  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run()
  return c.json({ success: true })
})

// Poll for new orders (real-time monitoring)
r.get('/poll', requireAuth(), async (c) => {
  const since = Number(c.req.query('since_id') || 0)
  const rows = await c.env.DB.prepare('SELECT id, type, title, message, link, created_at FROM notifications WHERE id > ? ORDER BY id DESC LIMIT 20').bind(since).all()
  const maxId = await c.env.DB.prepare('SELECT MAX(id) as mx FROM notifications').first<{ mx: number }>()
  return c.json({ notifications: rows.results || [], max_id: maxId?.mx || 0 })
})

// ---------- EXPORT (CSV) ----------
r.get('/export/:type', requireAuth('export'), async (c) => {
  const db = c.env.DB
  const type = c.req.param('type')
  const q = c.req.query()
  let rows: any[] = []
  let filename = `${type}_${new Date().toISOString().slice(0, 10)}.csv`

  if (type === 'orders') {
    const conditions = ['o.is_deleted = 0']
    const params: any[] = []
    if (q.date_from) { conditions.push('date(o.created_at) >= ?'); params.push(q.date_from) }
    if (q.date_to) { conditions.push('date(o.created_at) <= ?'); params.push(q.date_to) }
    if (q.status) { conditions.push('o.status = ?'); params.push(q.status) }
    const res = await db.prepare(`
      SELECT o.order_number, o.created_at, o.customer_name, o.phone, o.address, o.district, o.status,
        o.subtotal, o.discount, o.delivery_charge, o.grand_total, o.product_cost, o.courier_cost, o.ad_cost, o.net_profit,
        c2.name as courier, o.tracking_id, o.utm_source, o.utm_campaign, o.risk_level
      FROM orders o LEFT JOIN couriers c2 ON c2.id = o.courier_id WHERE ${conditions.join(' AND ')} ORDER BY o.id DESC LIMIT 5000
    `).bind(...params).all()
    rows = res.results || []
  } else if (type === 'customers') {
    const res = await db.prepare('SELECT name, phone, address, district, total_orders, delivered_orders, cancelled_orders, returned_orders, total_spent, risk_score, list_status, last_order_at FROM customers ORDER BY id DESC LIMIT 10000').all()
    rows = res.results || []
  } else if (type === 'products') {
    const res = await db.prepare('SELECT name, regular_price, sale_price, product_cost, stock, stock_status, is_active FROM products WHERE is_deleted = 0').all()
    rows = res.results || []
  } else if (type === 'expenses') {
    const res = await db.prepare('SELECT name, amount, currency, amount_bdt, expense_date, category, note FROM expenses ORDER BY expense_date DESC LIMIT 5000').all()
    rows = res.results || []
  } else if (type === 'profit-loss') {
    const res = await db.prepare(`
      SELECT o.order_number, date(o.created_at) as order_date, o.status, o.grand_total as revenue,
        o.product_cost, o.packaging_cost, o.courier_cost, o.cod_charge, o.ad_cost, o.other_cost, o.net_profit
      FROM orders o WHERE o.is_deleted = 0 ORDER BY o.id DESC LIMIT 5000
    `).all()
    rows = res.results || []
  } else if (type === 'ad-spends') {
    const res = await db.prepare('SELECT campaign_name, campaign_id, spend_date, amount, currency, amount_bdt, orders_count, note FROM ad_spends ORDER BY spend_date DESC LIMIT 5000').all()
    rows = res.results || []
  } else {
    return c.json({ error: 'invalid_type' }, 400)
  }

  if (!rows.length) return c.json({ error: 'no_data', message: 'কোনো ডেটা পাওয়া যায়নি' }, 404)
  const headers = Object.keys(rows[0])
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(row => headers.map(h => esc(row[h])).join(','))].join('\n')

  const user = c.get('user')
  await auditLog(db, user.id, user.username, 'export', type, '', `Exported ${rows.length} rows`)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
})

// ---------- DEMO DATA CLEANUP ----------
r.post('/clear-demo-data', requireAuth('*'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  // Delete transactional/demo data, keep settings + admin users + structure
  await db.batch([
    db.prepare('DELETE FROM order_items'),
    db.prepare('DELETE FROM order_status_history'),
    db.prepare('DELETE FROM courier_transfers'),
    db.prepare('DELETE FROM orders'),
    db.prepare('DELETE FROM customers'),
    db.prepare('DELETE FROM ad_spends'),
    db.prepare('DELETE FROM expenses'),
    db.prepare('DELETE FROM notifications'),
    db.prepare('DELETE FROM tracking_events'),
    db.prepare('DELETE FROM otp_codes')
  ])
  await auditLog(db, user.id, user.username, 'clear_demo_data', 'system', '', 'All transactional demo data cleared')
  return c.json({ success: true, message: 'সব ডেমো/টেস্ট ডেটা মুছে ফেলা হয়েছে। প্রোডাক্ট, সেটিংস ও অ্যাডমিন ইউজার অক্ষত আছে।' })
})

export default r
