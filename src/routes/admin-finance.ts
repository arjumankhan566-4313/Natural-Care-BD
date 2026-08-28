// ============ Admin: Finance (ad spend, expenses, P&L, dashboard summary, analytics) ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog, getSetting } from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()

// ---------- AD SPEND ----------
const ads = new Hono<Env>()
ads.use('*', requireAuth('marketing'))

ads.get('/', async (c) => {
  const q = c.req.query()
  const conditions = ['1=1']
  const params: any[] = []
  if (q.date_from) { conditions.push('spend_date >= ?'); params.push(q.date_from) }
  if (q.date_to) { conditions.push('spend_date <= ?'); params.push(q.date_to) }
  const rows = await c.env.DB.prepare(`SELECT * FROM ad_spends WHERE ${conditions.join(' AND ')} ORDER BY spend_date DESC, id DESC LIMIT 200`).bind(...params).all()

  // CPO per campaign: total spend / attributed orders
  const cpo = await c.env.DB.prepare(`
    SELECT a.campaign_id, a.campaign_name, SUM(a.amount_bdt) as total_spend_bdt,
      (SELECT COUNT(*) FROM orders o WHERE o.campaign_id = a.campaign_id AND o.campaign_id != '' AND o.is_deleted = 0) as attributed_orders
    FROM ad_spends a WHERE a.campaign_id != '' GROUP BY a.campaign_id
  `).all()

  return c.json({
    ad_spends: rows.results || [],
    campaign_cpo: (cpo.results || []).map((x: any) => ({
      ...x,
      cost_per_order: x.attributed_orders > 0 ? Math.round(x.total_spend_bdt / x.attributed_orders * 100) / 100 : null
    }))
  })
})

ads.post('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.campaign_name || !b.spend_date || b.amount === undefined) return c.json({ error: 'validation', message: 'ক্যাম্পেইন, তারিখ ও খরচ আবশ্যক' }, 400)
  const rate = Number(await getSetting(db, 'usd_to_bdt_rate') || 120)
  const amount = Number(b.amount)
  const currency = b.currency === 'BDT' ? 'BDT' : 'USD'
  const amountBdt = currency === 'USD' ? Math.round(amount * rate * 100) / 100 : amount
  const res = await db.prepare(`
    INSERT INTO ad_spends (campaign_name, campaign_id, adset_name, adset_id, ad_name, ad_id, spend_date, amount, currency, amount_bdt, orders_count, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(b.campaign_name, b.campaign_id || '', b.adset_name || '', b.adset_id || '', b.ad_name || '', b.ad_id || '',
    b.spend_date, amount, currency, amountBdt, Number(b.orders_count || 0), b.note || '').run()
  await auditLog(db, user.id, user.username, 'create', 'ad_spend', String(res.meta.last_row_id), `${b.campaign_name}: ${currency} ${amount} (৳${amountBdt})`)

  // Distribute estimated ad cost to attributed orders of that campaign+date
  if (b.campaign_id && b.distribute_to_orders) {
    const orders = await db.prepare(`SELECT id FROM orders WHERE campaign_id = ? AND date(created_at) = ? AND is_deleted = 0`).bind(b.campaign_id, b.spend_date).all()
    const n = (orders.results || []).length
    if (n > 0) {
      const perOrder = Math.round(amountBdt / n * 100) / 100
      for (const o of orders.results as any[]) {
        await db.prepare('UPDATE orders SET ad_cost = ? WHERE id = ?').bind(perOrder, o.id).run()
        const oo = await db.prepare('SELECT subtotal, discount, delivery_charge, product_cost, packaging_cost, courier_cost, cod_charge, ad_cost, other_cost FROM orders WHERE id = ?').bind(o.id).first<any>()
        const np = (oo.subtotal - oo.discount + oo.delivery_charge) - (oo.product_cost + oo.packaging_cost + oo.courier_cost + oo.cod_charge + oo.ad_cost + oo.other_cost)
        await db.prepare('UPDATE orders SET net_profit = ? WHERE id = ?').bind(np, o.id).run()
      }
    }
  }
  return c.json({ success: true, id: res.meta.last_row_id, amount_bdt: amountBdt })
})

ads.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM ad_spends WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

r.route('/ad-spends', ads)

// ---------- EXPENSES ----------
const expenses = new Hono<Env>()
expenses.use('*', requireAuth('finance'))

expenses.get('/', async (c) => {
  const q = c.req.query()
  const conditions = ['1=1']
  const params: any[] = []
  if (q.date_from) { conditions.push('expense_date >= ?'); params.push(q.date_from) }
  if (q.date_to) { conditions.push('expense_date <= ?'); params.push(q.date_to) }
  if (q.category) { conditions.push('category = ?'); params.push(q.category) }
  const rows = await c.env.DB.prepare(`SELECT * FROM expenses WHERE ${conditions.join(' AND ')} ORDER BY expense_date DESC, id DESC LIMIT 200`).bind(...params).all()
  return c.json({ expenses: rows.results || [] })
})

expenses.post('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.name || !b.expense_date || b.amount === undefined) return c.json({ error: 'validation', message: 'নাম, তারিখ ও পরিমাণ আবশ্যক' }, 400)
  const rate = Number(await getSetting(db, 'usd_to_bdt_rate') || 120)
  const currency = b.currency === 'USD' ? 'USD' : 'BDT'
  const amount = Number(b.amount)
  const amountBdt = currency === 'USD' ? Math.round(amount * rate * 100) / 100 : amount
  const res = await db.prepare('INSERT INTO expenses (name, amount, currency, amount_bdt, expense_date, category, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(b.name, amount, currency, amountBdt, b.expense_date, b.category || 'miscellaneous', b.note || '').run()
  await auditLog(db, user.id, user.username, 'create', 'expense', String(res.meta.last_row_id), `${b.name}: ৳${amountBdt}`)
  return c.json({ success: true, id: res.meta.last_row_id })
})

expenses.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM expenses WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

r.route('/expenses', expenses)

// ---------- DASHBOARD SUMMARY + ANALYTICS ----------
const analytics = new Hono<Env>()
analytics.use('*', requireAuth())

function dateRange(q: Record<string, string>): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10)
  const preset = q.range || 'today'
  const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': return { from: d(1), to: d(1) }
    case 'last7': return { from: d(6), to: today }
    case 'last30': return { from: d(29), to: today }
    case 'this_month': return { from: today.slice(0, 8) + '01', to: today }
    case 'last_month': {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
    }
    case 'custom': return { from: q.date_from || today, to: q.date_to || today }
    default: return { from: today, to: today }
  }
}

analytics.get('/summary', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())

  const [orderStats, adSpend, expenseSum, statusCounts] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN net_profit ELSE 0 END), 0) as delivered_profit,
        COALESCE(SUM(CASE WHEN status IN ('cancelled','returned') THEN (product_cost * 0) + courier_cost + ad_cost + packaging_cost ELSE 0 END), 0) as loss_from_failed,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN product_cost ELSE 0 END), 0) as product_cost,
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','fake') THEN courier_cost ELSE 0 END), 0) as courier_cost,
        COALESCE(SUM(ad_cost), 0) as order_ad_cost,
        COALESCE(SUM(grand_total), 0) as gross_order_value,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
        SUM(CASE WHEN status IN ('new','pending','manual_review') THEN 1 ELSE 0 END) as pending
      FROM orders WHERE date(created_at) BETWEEN ? AND ? AND is_deleted = 0
    `).bind(from, to).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(amount_bdt), 0) as total, COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END), 0) as usd FROM ad_spends WHERE spend_date BETWEEN ? AND ?`).bind(from, to).first<any>(),
    db.prepare(`SELECT COALESCE(SUM(amount_bdt), 0) as total FROM expenses WHERE expense_date BETWEEN ? AND ?`).bind(from, to).first<any>(),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM orders WHERE is_deleted = 0 GROUP BY status`).all()
  ])

  const revenue = orderStats?.revenue || 0
  const adSpendBdt = adSpend?.total || 0
  const otherExpenses = expenseSum?.total || 0
  // Ad spend not yet distributed to orders (avoid double counting: order-level ad_cost is already inside net_profit)
  const undistributedAdSpend = Math.max(0, adSpendBdt - (orderStats?.order_ad_cost || 0))
  const totalExpenses = (orderStats?.product_cost || 0) + (orderStats?.courier_cost || 0) + adSpendBdt + otherExpenses
  const netProfit = (orderStats?.delivered_profit || 0) - undistributedAdSpend - otherExpenses - (orderStats?.loss_from_failed || 0)
  const usdRate = Number(await getSetting(db, 'usd_to_bdt_rate') || 120)

  const counts: Record<string, number> = {}
  for (const row of (statusCounts.results || []) as any[]) counts[row.status] = row.cnt

  return c.json({
    range: { from, to },
    total_orders: orderStats?.total_orders || 0,
    revenue,
    gross_order_value: orderStats?.gross_order_value || 0,
    delivered_profit: orderStats?.delivered_profit || 0,
    net_profit: netProfit,
    loss: netProfit < 0 ? Math.abs(netProfit) : 0,
    ad_spend_bdt: adSpendBdt,
    ad_spend_usd: adSpend?.usd || 0,
    courier_cost: orderStats?.courier_cost || 0,
    product_cost: orderStats?.product_cost || 0,
    other_expenses: otherExpenses,
    total_expenses: totalExpenses,
    profit_margin: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
    roi: totalExpenses > 0 ? Math.round((netProfit / totalExpenses) * 1000) / 10 : 0,
    delivered: orderStats?.delivered || 0,
    cancelled: orderStats?.cancelled || 0,
    returned: orderStats?.returned || 0,
    pending: orderStats?.pending || 0,
    usd_rate: usdRate,
    status_counts: counts
  })
})

// Chart data: daily series
analytics.get('/charts', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())
  const [daily, adDaily] = await Promise.all([
    db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN net_profit ELSE 0 END), 0) as profit
      FROM orders WHERE date(created_at) BETWEEN ? AND ? AND is_deleted = 0
      GROUP BY date(created_at) ORDER BY day
    `).bind(from, to).all(),
    db.prepare(`SELECT spend_date as day, COALESCE(SUM(amount_bdt), 0) as spend FROM ad_spends WHERE spend_date BETWEEN ? AND ? GROUP BY spend_date ORDER BY day`).bind(from, to).all()
  ])
  return c.json({ daily: daily.results || [], ad_daily: adDaily.results || [] })
})

// Product profitability
analytics.get('/products', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())
  const rows = await db.prepare(`
    SELECT oi.product_id, oi.product_name,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(oi.quantity) as total_units,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.total_price ELSE 0 END), 0) as revenue,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.unit_cost * oi.quantity ELSE 0 END), 0) as product_cost,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.net_profit ELSE 0 END), 0) as net_profit
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE date(o.created_at) BETWEEN ? AND ? AND o.is_deleted = 0
    GROUP BY oi.product_id ORDER BY revenue DESC
  `).bind(from, to).all()
  return c.json({
    products: (rows.results || []).map((p: any) => ({
      ...p,
      profit_margin: p.revenue > 0 ? Math.round((p.net_profit / p.revenue) * 1000) / 10 : 0
    }))
  })
})

// Courier performance
analytics.get('/couriers', async (c) => {
  const db = c.env.DB
  const rows = await db.prepare(`
    SELECT c2.id, c2.name,
      COUNT(o.id) as total_orders,
      SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN o.status = 'returned' THEN 1 ELSE 0 END) as returned,
      COALESCE(SUM(o.courier_cost), 0) as courier_cost,
      COALESCE(SUM(o.cod_charge), 0) as cod_charge,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.grand_total ELSE 0 END), 0) as net_revenue
    FROM couriers c2 LEFT JOIN orders o ON o.courier_id = c2.id AND o.is_deleted = 0
    WHERE c2.is_deleted = 0 GROUP BY c2.id ORDER BY total_orders DESC
  `).all()
  return c.json({
    couriers: (rows.results || []).map((x: any) => ({
      ...x,
      success_rate: x.total_orders > 0 ? Math.round((x.delivered / x.total_orders) * 1000) / 10 : 0,
      return_rate: x.total_orders > 0 ? Math.round((x.returned / x.total_orders) * 1000) / 10 : 0
    }))
  })
})

// Marketing report: orders by source/campaign
analytics.get('/marketing', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())
  const [sources, campaigns] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(NULLIF(utm_source, ''), 'direct') as source, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue
      FROM orders WHERE date(created_at) BETWEEN ? AND ? AND is_deleted = 0 GROUP BY source ORDER BY orders DESC
    `).bind(from, to).all(),
    db.prepare(`
      SELECT COALESCE(NULLIF(utm_campaign, ''), '(none)') as campaign, campaign_id, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(ad_cost), 0) as ad_cost
      FROM orders WHERE date(created_at) BETWEEN ? AND ? AND is_deleted = 0 GROUP BY campaign, campaign_id ORDER BY orders DESC
    `).bind(from, to).all()
  ])
  const events = await db.prepare(`
    SELECT event_name, COUNT(*) as cnt FROM tracking_events WHERE date(created_at) BETWEEN ? AND ? GROUP BY event_name
  `).bind(from, to).all()
  return c.json({ sources: sources.results || [], campaigns: campaigns.results || [], events: events.results || [] })
})

r.route('/analytics', analytics)

export default r
