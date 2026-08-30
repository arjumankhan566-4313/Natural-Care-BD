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

  // CPO per campaign: total spend / attributed orders + USD spend, delivered revenue, ROAS
  const cpo = await c.env.DB.prepare(`
    SELECT a.campaign_id, a.campaign_name, SUM(a.amount_bdt) as total_spend_bdt,
      SUM(CASE WHEN a.currency = 'USD' THEN a.amount ELSE 0 END) as total_spend_usd,
      (SELECT COUNT(*) FROM orders o WHERE o.campaign_id = a.campaign_id AND o.campaign_id != '' AND o.is_deleted = 0) as attributed_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.campaign_id = a.campaign_id AND o.campaign_id != '' AND o.status = 'delivered' AND o.is_deleted = 0) as delivered_orders,
      (SELECT COALESCE(SUM(o.grand_total), 0) FROM orders o WHERE o.campaign_id = a.campaign_id AND o.campaign_id != '' AND o.status = 'delivered' AND o.is_deleted = 0) as delivered_revenue
    FROM ad_spends a WHERE a.campaign_id != '' GROUP BY a.campaign_id
  `).all()

  return c.json({
    ad_spends: rows.results || [],
    campaign_cpo: (cpo.results || []).map((x: any) => ({
      ...x,
      cost_per_order: x.attributed_orders > 0 ? Math.round(x.total_spend_bdt / x.attributed_orders * 100) / 100 : null,
      usd_per_order: x.attributed_orders > 0 && x.total_spend_usd > 0 ? Math.round(x.total_spend_usd / x.attributed_orders * 100) / 100 : null,
      roas: x.total_spend_bdt > 0 ? Math.round(x.delivered_revenue / x.total_spend_bdt * 100) / 100 : null
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
    const orders = await db.prepare(`SELECT id FROM orders WHERE campaign_id = ? AND date(created_at, '+6 hours') = ? AND is_deleted = 0`).bind(b.campaign_id, b.spend_date).all()
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

// ============ BANGLADESH TIMEZONE (UTC+6) ============
// CRITICAL FIX: orders.created_at is stored in UTC (SQLite CURRENT_TIMESTAMP).
// The dashboard previously computed "today" in UTC too, so a BD admin opening
// the panel between 12:00 AM and 6:00 AM BD time saw ALL ZEROS (BD-today hadn't
// started in UTC yet), and evening orders leaked into the wrong day. All date
// math now runs in Asia/Dhaka (+6h) and every SQL comparison converts
// created_at with the '+6 hours' modifier to match.
const BD_OFFSET_MS = 6 * 3600 * 1000
function bdDateStr(daysAgo = 0): string {
  return new Date(Date.now() + BD_OFFSET_MS - daysAgo * 86400000).toISOString().slice(0, 10)
}
function dateRange(q: Record<string, string>): { from: string; to: string } {
  const today = bdDateStr(0)
  const preset = q.range || 'today'
  const d = (n: number) => bdDateStr(n)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': return { from: d(1), to: d(1) }
    case 'last7': return { from: d(6), to: today }
    case 'last30': return { from: d(29), to: today }
    case 'this_month': return { from: today.slice(0, 8) + '01', to: today }
    case 'last_month': {
      const bdNow = new Date(Date.now() + BD_OFFSET_MS)
      const y = bdNow.getUTCFullYear(), m = bdNow.getUTCMonth()
      const first = new Date(Date.UTC(y, m - 1, 1))
      const last = new Date(Date.UTC(y, m, 0))
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
    }
    case 'custom': return { from: q.date_from || today, to: q.date_to || today }
    default: return { from: today, to: today }
  }
}
// SQL fragment: created_at (UTC) -> BD-local calendar date
const BD_DATE = "date(created_at, '+6 hours')"

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
      FROM orders WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted = 0
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

// ---------- ENTERPRISE DASHBOARD (real-time) ----------
// One endpoint returning everything the enterprise dashboard needs in a single
// round-trip: live activity, conversion funnel, hourly series, top districts,
// top products, low-stock alerts, courier snapshot, risk mix, recent events.
analytics.get('/dashboard', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())

  const [
    liveStats, funnel, hourly, topDistricts, topProducts,
    lowStock, riskMix, incompleteStats, customerStats, weekCompare
  ] = await Promise.all([
    // Live activity: last 30/60 min visitors + today's key numbers
    db.prepare(`
      SELECT
        (SELECT COUNT(DISTINCT ip_address) FROM tracking_events WHERE created_at >= datetime('now','-30 minutes')) as visitors_30m,
        (SELECT COUNT(*) FROM tracking_events WHERE event_name='PageView' AND created_at >= datetime('now','-60 minutes')) as pageviews_1h,
        (SELECT COUNT(*) FROM orders WHERE created_at >= datetime('now','-60 minutes') AND is_deleted=0) as orders_1h,
        (SELECT COUNT(*) FROM orders WHERE created_at >= datetime('now','-24 hours') AND is_deleted=0) as orders_24h,
        (SELECT COUNT(*) FROM incomplete_orders WHERE status='incomplete' AND updated_at >= datetime('now','-24 hours')) as incomplete_24h
    `).first<any>(),
    // Conversion funnel for selected range
    db.prepare(`
      SELECT
        SUM(CASE WHEN event_name='PageView' THEN 1 ELSE 0 END) as pageview,
        SUM(CASE WHEN event_name='ViewContent' THEN 1 ELSE 0 END) as viewcontent,
        SUM(CASE WHEN event_name='InitiateCheckout' THEN 1 ELSE 0 END) as checkout,
        SUM(CASE WHEN event_name='Lead' THEN 1 ELSE 0 END) as lead,
        SUM(CASE WHEN event_name='Purchase' THEN 1 ELSE 0 END) as purchase
      FROM tracking_events WHERE date(created_at, '+6 hours') BETWEEN ? AND ?
    `).bind(from, to).first<any>(),
    // Hourly orders+revenue (last 24h) for the live pulse chart — hours shown in BD time
    db.prepare(`
      SELECT strftime('%H:00', created_at, '+6 hours') as hour, COUNT(*) as orders,
        COALESCE(SUM(grand_total),0) as value
      FROM orders WHERE created_at >= datetime('now','-24 hours') AND is_deleted=0
      GROUP BY hour ORDER BY hour
    `).all(),
    // ALL districts by orders in range (geo intelligence panel builds
    // division rollup + top-district ranking from this single list)
    db.prepare(`
      SELECT COALESCE(NULLIF(district,''),'অজানা') as district, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status='delivered' THEN grand_total ELSE 0 END),0) as revenue,
        COALESCE(SUM(grand_total),0) as order_value
      FROM orders WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted=0
      GROUP BY district ORDER BY orders DESC LIMIT 64
    `).bind(from, to).all(),
    // Top products by units in range
    db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) as units, COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(oi.total_price),0) as value
      FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE date(o.created_at, '+6 hours') BETWEEN ? AND ? AND o.is_deleted=0
      GROUP BY oi.product_name ORDER BY units DESC LIMIT 5
    `).bind(from, to).all(),
    // Low stock alerts
    db.prepare(`
      SELECT id, name, stock, low_stock_threshold, stock_status FROM products
      WHERE is_deleted=0 AND is_active=1 AND (stock <= low_stock_threshold OR stock_status != 'in_stock')
      ORDER BY stock ASC LIMIT 6
    `).all(),
    // Risk mix in range
    db.prepare(`
      SELECT risk_level, COUNT(*) as cnt FROM orders
      WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted=0 GROUP BY risk_level
    `).bind(from, to).all(),
    // Incomplete order recovery stats in range
    db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN status='incomplete' THEN 1 ELSE 0 END) as open
      FROM incomplete_orders WHERE ${BD_DATE} BETWEEN ? AND ?
    `).bind(from, to).first<any>(),
    // Customer stats: new vs repeat customers in range
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM customers WHERE date(created_at, '+6 hours') BETWEEN ? AND ?) as new_customers,
        (SELECT COUNT(*) FROM customers WHERE total_orders > 1) as repeat_customers,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM customers WHERE list_status='blacklist') as blacklisted
    `).bind(from, to).first<any>(),
    // This week vs last week comparison (orders + delivered revenue)
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE created_at >= datetime('now','-7 days') AND is_deleted=0) as orders_this,
        (SELECT COUNT(*) FROM orders WHERE created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days') AND is_deleted=0) as orders_prev,
        (SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE status='delivered' AND created_at >= datetime('now','-7 days') AND is_deleted=0) as rev_this,
        (SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE status='delivered' AND created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days') AND is_deleted=0) as rev_prev
    `).first<any>()
  ])

  const pct = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : (cur > 0 ? 100 : 0)
  const risk: Record<string, number> = { low: 0, medium: 0, high: 0 }
  for (const r2 of (riskMix.results || []) as any[]) risk[r2.risk_level || 'low'] = r2.cnt

  return c.json({
    range: { from, to },
    live: {
      visitors_30m: liveStats?.visitors_30m || 0,
      pageviews_1h: liveStats?.pageviews_1h || 0,
      orders_1h: liveStats?.orders_1h || 0,
      orders_24h: liveStats?.orders_24h || 0,
      incomplete_24h: liveStats?.incomplete_24h || 0
    },
    funnel: {
      pageview: funnel?.pageview || 0,
      viewcontent: funnel?.viewcontent || 0,
      checkout: funnel?.checkout || 0,
      lead: funnel?.lead || 0,
      purchase: funnel?.purchase || 0,
      conversion_rate: (funnel?.pageview || 0) > 0 ? Math.round(((funnel?.purchase || 0) / funnel.pageview) * 1000) / 10 : 0
    },
    hourly: hourly.results || [],
    top_districts: topDistricts.results || [],
    top_products: topProducts.results || [],
    low_stock: lowStock.results || [],
    risk_mix: risk,
    incomplete: {
      total: incompleteStats?.total || 0,
      converted: incompleteStats?.converted || 0,
      open: incompleteStats?.open || 0,
      recovery_rate: (incompleteStats?.total || 0) > 0 ? Math.round(((incompleteStats?.converted || 0) / incompleteStats.total) * 1000) / 10 : 0
    },
    customers: {
      new_in_range: customerStats?.new_customers || 0,
      repeat: customerStats?.repeat_customers || 0,
      total: customerStats?.total_customers || 0,
      blacklisted: customerStats?.blacklisted || 0
    },
    week_compare: {
      orders_this: weekCompare?.orders_this || 0,
      orders_prev: weekCompare?.orders_prev || 0,
      orders_change: pct(weekCompare?.orders_this || 0, weekCompare?.orders_prev || 0),
      revenue_this: weekCompare?.rev_this || 0,
      revenue_prev: weekCompare?.rev_prev || 0,
      revenue_change: pct(weekCompare?.rev_this || 0, weekCompare?.rev_prev || 0)
    },
    server_time: new Date().toISOString()
  })
})

// Chart data: daily series
analytics.get('/charts', async (c) => {
  const db = c.env.DB
  const { from, to } = dateRange(c.req.query())
  const [daily, adDaily] = await Promise.all([
    db.prepare(`
      SELECT ${BD_DATE} as day, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN net_profit ELSE 0 END), 0) as profit
      FROM orders WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted = 0
      GROUP BY ${BD_DATE} ORDER BY day
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
    WHERE date(o.created_at, '+6 hours') BETWEEN ? AND ? AND o.is_deleted = 0
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
      FROM orders WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted = 0 GROUP BY source ORDER BY orders DESC
    `).bind(from, to).all(),
    db.prepare(`
      SELECT COALESCE(NULLIF(utm_campaign, ''), '(none)') as campaign, campaign_id, COUNT(*) as orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN grand_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(ad_cost), 0) as ad_cost
      FROM orders WHERE ${BD_DATE} BETWEEN ? AND ? AND is_deleted = 0 GROUP BY campaign, campaign_id ORDER BY orders DESC
    `).bind(from, to).all()
  ])
  const events = await db.prepare(`
    SELECT event_name, COUNT(*) as cnt FROM tracking_events WHERE date(created_at, '+6 hours') BETWEEN ? AND ? GROUP BY event_name
  `).bind(from, to).all()
  return c.json({ sources: sources.results || [], campaigns: campaigns.results || [], events: events.results || [] })
})

r.route('/analytics', analytics)

export default r
