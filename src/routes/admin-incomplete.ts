// ============ Admin: Incomplete (abandoned) orders + Pixel setup ============
import { Hono } from 'hono'
import type { Bindings, MetaCapiStandardEvent } from '../lib/helpers'
import {
  auditLog, getSettings, setSetting, generateToken, validBDPhone, normalizePhone,
  forwardToCapi, runBackground, normalizeTrackingSetting, requestHost, effectiveMetaEvents,
  DEFAULT_META_EVENTS, pixelHostLockState, META_GRAPH_API_VERSION, buildMetaPurchaseDataResult,
  resolveMetaFbc, resolveMetaEventId, logTrackingDiagnostic
} from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()

// ---------- INCOMPLETE ORDERS ----------
const inc = new Hono<Env>()
inc.use('*', requireAuth('orders'))

// List with filters + counts
inc.get('/', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status') || ''
  const q = (c.req.query('q') || '').trim()
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(100, Number(c.req.query('limit') || 30))
  const offset = (page - 1) * limit

  const conds: string[] = ['1=1']
  const binds: any[] = []
  if (status) { conds.push('status = ?'); binds.push(status) }
  if (q) { conds.push('(phone LIKE ? OR customer_name LIKE ? OR district LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const where = conds.join(' AND ')

  const [rows, total, counts] = await Promise.all([
    db.prepare(`SELECT * FROM incomplete_orders WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all(),
    db.prepare(`SELECT COUNT(*) as cnt FROM incomplete_orders WHERE ${where}`).bind(...binds).first<{ cnt: number }>(),
    db.prepare(`SELECT status, COUNT(*) as cnt FROM incomplete_orders GROUP BY status`).all()
  ])

  const statusCounts: Record<string, number> = {}
  for (const x of (counts.results || []) as any[]) statusCounts[x.status] = x.cnt

  return c.json({
    incomplete_orders: rows.results || [],
    total: total?.cnt || 0, page, limit,
    status_counts: statusCounts
  })
})

// Update status / admin note
inc.put('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const b = await c.req.json()
  const allowed = ['incomplete', 'contacted', 'converted', 'discarded']
  const existing = await db.prepare('SELECT id FROM incomplete_orders WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'not_found' }, 404)
  if (b.status && !allowed.includes(b.status)) return c.json({ error: 'validation', message: 'ভুল স্ট্যাটাস' }, 400)
  if (b.phone !== undefined && b.phone && !validBDPhone(b.phone)) {
    return c.json({ error: 'validation', message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)' }, 400)
  }
  if (b.alt_phone !== undefined && b.alt_phone && !validBDPhone(b.alt_phone)) {
    return c.json({ error: 'validation', message: 'বিকল্প ফোন নম্বরটি সঠিক নয়' }, 400)
  }

  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP']
  const binds: any[] = []
  if (b.status) { sets.push('status = ?'); binds.push(b.status) }
  if (b.admin_note !== undefined) { sets.push('admin_note = ?'); binds.push(String(b.admin_note).slice(0, 500)) }
  if (b.customer_name !== undefined) { sets.push('customer_name = ?'); binds.push(String(b.customer_name).trim().slice(0, 100)) }
  if (b.phone !== undefined) { sets.push('phone = ?'); binds.push(normalizePhone(b.phone)) }
  if (b.alt_phone !== undefined) { sets.push('alt_phone = ?'); binds.push(b.alt_phone ? normalizePhone(b.alt_phone) : '') }
  if (b.address !== undefined) { sets.push('address = ?'); binds.push(String(b.address).trim().slice(0, 500)) }
  if (b.district !== undefined) { sets.push('district = ?'); binds.push(String(b.district).trim().slice(0, 100)) }
  if (b.upazila !== undefined) { sets.push('upazila = ?'); binds.push(String(b.upazila).trim().slice(0, 100)) }
  await db.prepare(`UPDATE incomplete_orders SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run()
  await auditLog(db, user.id, user.username, 'update', 'incomplete_order', String(id), `Incomplete order updated: ${b.status || 'note'}`)
  return c.json({ success: true })
})

// Delete permanently
inc.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM incomplete_orders WHERE id = ?').bind(id).run()
  await auditLog(c.env.DB, user.id, user.username, 'delete', 'incomplete_order', String(id), 'Incomplete order deleted')
  return c.json({ success: true })
})

// Convert to real order (admin confirms over phone then converts)
inc.post('/:id/convert', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const io = await db.prepare('SELECT * FROM incomplete_orders WHERE id = ?').bind(id).first<any>()
  if (!io) return c.json({ error: 'not_found' }, 404)
  if (io.status === 'converted' && io.order_id) return c.json({ error: 'already_converted', message: 'ইতিমধ্যে অর্ডারে কনভার্ট হয়েছে' }, 400)
  if (!io.phone || !io.customer_name || !io.product_id) {
    return c.json({ error: 'insufficient_data', message: 'কনভার্ট করতে নাম, ফোন ও প্রোডাক্ট থাকা আবশ্যক। বাকি তথ্য কাস্টমারের থেকে নিয়ে ম্যানুয়ালি অর্ডার করুন।' }, 400)
  }
  const normalizedPhone = normalizePhone(io.phone)
  if (!validBDPhone(normalizedPhone)) {
    return c.json({ error: 'invalid_phone', message: `ফোন নম্বরটি সঠিক ফরম্যাটে নয় (${io.phone}) — কনভার্ট করার আগে "ইনকমপ্লিট অর্ডার" ডিটেইলে ঢুকে সঠিক নম্বর (01XXXXXXXXX) লিখে সংরক্ষণ করুন, তারপর আবার কনভার্ট করুন।` }, 400)
  }

  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_deleted = 0').bind(io.product_id).first<any>()
  if (!product) return c.json({ error: 'product_missing', message: 'প্রোডাক্টটি আর নেই' }, 400)

  let subtotal = product.sale_price, qty = 1, unitPrice = product.sale_price, pkgName = null
  if (io.package_id) {
    const pkg = await db.prepare('SELECT * FROM product_packages WHERE id = ?').bind(io.package_id).first<any>()
    if (pkg) { subtotal = pkg.price; qty = pkg.quantity; unitPrice = pkg.price / pkg.quantity; pkgName = pkg.name }
  }
  const settings = await getSettings(db, ['delivery_charge_dhaka', 'delivery_charge_outside'])
  const isDhaka = /ঢাকা|dhaka/i.test(io.district || '')
  const deliveryCharge = io.delivery_charge || (isDhaka ? Number(settings.delivery_charge_dhaka || 70) : Number(settings.delivery_charge_outside || 130))
  const grandTotal = subtotal + deliveryCharge

  const normalizedAltPhone = io.alt_phone ? normalizePhone(io.alt_phone) : ''

  // Upsert customer
  let customer = await db.prepare('SELECT id FROM customers WHERE phone = ?').bind(normalizedPhone).first<any>()
  if (!customer) {
    const cr = await db.prepare('INSERT INTO customers (name, phone, alt_phone, address, district, upazila) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(io.customer_name, normalizedPhone, normalizedAltPhone, io.address || '', io.district || '', io.upazila || '').run()
    customer = { id: cr.meta.last_row_id }
  }

  const orderNumber = `NCB-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(10000 + Math.random() * 90000)}`
  const eventId = resolveMetaEventId(`purchase_${generateToken(16)}`, 'Purchase').eventId
  const metaPurchaseBuild = buildMetaPurchaseDataResult(grandTotal, orderNumber, [{
    product_id: product.id, quantity: qty, unit_price: unitPrice
  }])
  const metaPurchase = metaPurchaseBuild.data
  if (metaPurchaseBuild.usedFallback) {
    await logTrackingDiagnostic(db, {
      severity: 'critical', code: 'PURCHASE_DATA_FALLBACK', source: 'admin_recovery',
      eventName: 'Purchase', eventId,
      details: { recovery_source: 'trusted_item_totals', issues: metaPurchaseBuild.issues }
    })
  }
  const res = await db.prepare(`
    INSERT INTO orders (order_number, customer_id, customer_name, phone, alt_phone, address, district, upazila,
      order_note, subtotal, discount, delivery_charge, grand_total, status, risk_score, risk_level, risk_reasons,
      product_cost, utm_source, utm_medium, utm_campaign, fbclid, campaign_id, adset_id, ad_id, order_source, ip_address, event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'confirmed', 0, 'low', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'incomplete_recovery', ?, ?)
  `).bind(
    orderNumber, customer.id, io.customer_name, normalizedPhone, normalizedAltPhone, io.address || '', io.district || '', io.upazila || '',
    io.order_note || '', subtotal, deliveryCharge, grandTotal,
    JSON.stringify(['Converted from incomplete order by admin']),
    product.product_cost * qty,
    io.utm_source || '', io.utm_medium || '', io.utm_campaign || '', io.fbclid || '',
    io.campaign_id || '', io.adset_id || '', io.ad_id || '', io.ip_address || '', eventId
  ).run()
  const orderId = res.meta.last_row_id as number

  await db.prepare('INSERT INTO order_items (order_id, product_id, package_id, product_name, package_name, quantity, unit_price, total_price, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(orderId, product.id, io.package_id || null, product.name, pkgName, qty, unitPrice, subtotal, product.product_cost).run()
  await db.prepare("INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES (?, NULL, 'confirmed', ?, ?)")
    .bind(orderId, `Recovered from incomplete order #${id} by ${user.username}`, user.username).run()
  await db.prepare("UPDATE incomplete_orders SET status = 'converted', order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId, id).run()
  await auditLog(db, user.id, user.username, 'convert', 'incomplete_order', String(id), `Converted to order ${orderNumber}`)

  // Send Purchase event to Meta CAPI — this order came from an incomplete-order recovery
  // (admin phoned the customer and manually confirmed), so the browser never fired a
  // fbq('track','Purchase') call for it. Without this, every recovered order was a silent
  // gap in the Facebook ad campaign's Purchase conversion count.
  await db.prepare(
    `INSERT OR IGNORE INTO tracking_events (event_id, event_name, event_data, source_url, ip_address, user_agent, fbclid)
     VALUES (?, 'Purchase', ?, '', ?, '', ?)`
  ).bind(eventId, JSON.stringify(metaPurchase), io.ip_address || '', io.fbclid || '').run()
  const firstSeenMs = Number.isFinite(Date.parse(io.created_at || '')) ? String(Date.parse(io.created_at)) : ''
  const recoveredFbc = resolveMetaFbc(null, io.fbclid || '', firstSeenMs) || null
  if (io.fbclid && !recoveredFbc) {
    await logTrackingDiagnostic(db, {
      severity: 'warning', code: 'FBC_MISSING_WITH_FBCLID', source: 'admin_recovery',
      eventName: 'Purchase', eventId,
      details: { fbc_present: false, fbclid_present: true }
    })
  }
  await forwardToCapi(db, {
    eventName: 'Purchase',
    eventId,
    sourceUrl: io.source_url || '',
    ip: io.ip_address || '',
    ua: io.user_agent || '',
    requestHost: requestHost(c),
    fbclid: io.fbclid || '',
    fbclidTs: firstSeenMs,
    fbc: recoveredFbc,
    customerName: io.customer_name || '',
    customerPhone: normalizedPhone,
    customData: metaPurchase
  })

  return c.json({ success: true, order_id: orderId, order_number: orderNumber })
})

r.route('/incomplete-orders', inc)

// ---------- PIXEL SETUP (dedicated) ----------
const PIXEL_KEYS = [
  'meta_pixel_id', 'meta_pixel_enabled', 'meta_events_enabled',
  'meta_capi_token', 'meta_capi_enabled', 'meta_test_event_code', 'meta_advanced_matching',
  'meta_pixel_host_lock', 'meta_pixel_allowed_hosts',
  'ga_id', 'gtm_id', 'tiktok_pixel_id'
]
const PIXEL_SECRET = ['meta_capi_token']

const pixel = new Hono<Env>()
pixel.use('*', requireAuth('marketing'))

// Pixel settings + health overview
pixel.get('/', async (c) => {
  const db = c.env.DB
  const s = await getSettings(db, PIXEL_KEYS)
  const out: Record<string, string> = {}
  for (const k of PIXEL_KEYS) out[k] = PIXEL_SECRET.includes(k) && s[k] ? '••••••••' : (s[k] || '')
  // Prefill the browser-event allowlist with the effective value (missing/blank row -> the
  // full standard set). Previously the input rendered empty with the list only as a grey
  // placeholder, so pressing "সংরক্ষণ" persisted '' and silently switched the whole browser
  // Pixel off while CAPI carried on sending. normalizeTrackingSetting() now also refuses to
  // store a blank list, so the two sides cannot drift apart again.
  out.meta_events_enabled = effectiveMetaEvents(s.meta_events_enabled)

  // Exactly which events the BROWSER pixel will fire, per the same rules the landing page
  // applies (pixel configured + not explicitly disabled + host allowed + this allowlist).
  // Surfaced in the health panel because "server shows events, browser shows nothing" had
  // no indicator here at all.
  const browserEvents = out.meta_events_enabled.split(',').filter(Boolean)
  // FAIL-OPEN (mirrors index.tsx + landing.js): the browser Pixel is ON whenever a Pixel ID
  // is configured, unless the admin explicitly saved meta_pixel_enabled='0'.
  const pixelOn = !!(s.meta_pixel_id || '').trim() && (s.meta_pixel_enabled || '').trim() !== '0'
  const lock = await pixelHostLockState(db, requestHost(c))
  const browserWillFire = pixelOn && lock.allowed ? browserEvents : []

  const [eventStats, recent, capiStats, diagnosticStats, recentDiagnostics] = await Promise.all([
    db.prepare(`SELECT event_name, COUNT(*) as cnt, SUM(sent_to_capi) as capi_sent FROM tracking_events WHERE created_at > datetime('now', '-7 days') GROUP BY event_name ORDER BY cnt DESC`).all(),
    db.prepare(`SELECT id, event_id, event_name, event_data, source_url, sent_to_capi, capi_response, fbclid, created_at FROM tracking_events ORDER BY id DESC LIMIT 30`).all(),
    db.prepare(`SELECT COUNT(*) as total, SUM(sent_to_capi) as sent, SUM(CASE WHEN capi_response LIKE 'error%' OR (capi_response != '' AND capi_response IS NOT NULL AND sent_to_capi = 0) THEN 1 ELSE 0 END) as failed FROM tracking_events WHERE created_at > datetime('now', '-7 days')`).first<any>(),
    db.prepare(`SELECT COUNT(*) as total_7d,
      SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as total_24h,
      SUM(CASE WHEN severity = 'critical' AND created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as critical_24h,
      SUM(CASE WHEN code = 'EVENT_ID_FALLBACK' AND created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as event_id_fallbacks_7d,
      SUM(CASE WHEN code = 'PURCHASE_DATA_FALLBACK' AND created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as purchase_fallbacks_7d
      FROM tracking_diagnostics WHERE created_at > datetime('now', '-7 days')`).first<any>().catch(() => null),
    db.prepare(`SELECT id, severity, code, source, event_name, event_id, details, created_at
      FROM tracking_diagnostics ORDER BY id DESC LIMIT 30`).all().catch(() => ({ results: [] } as any))
  ])

  return c.json({
    settings: out,
    event_stats: eventStats.results || [],
    recent_events: (recent.results || []).map((e: any) => ({ ...e, capi_response: (e.capi_response || '').slice(0, 200) })),
    capi_stats: { total: capiStats?.total || 0, sent: capiStats?.sent || 0, failed: capiStats?.failed || 0 },
    diagnostic_stats: {
      total_7d: diagnosticStats?.total_7d || 0,
      total_24h: diagnosticStats?.total_24h || 0,
      critical_24h: diagnosticStats?.critical_24h || 0,
      event_id_fallbacks_7d: diagnosticStats?.event_id_fallbacks_7d || 0,
      purchase_fallbacks_7d: diagnosticStats?.purchase_fallbacks_7d || 0
    },
    recent_diagnostics: ((recentDiagnostics as any).results || []).map((d: any) => {
      let details: Record<string, unknown> = {}
      try { details = JSON.parse(d.details || '{}') } catch {}
      return { ...d, details }
    }),
    health: {
      pixel_configured: !!(s.meta_pixel_id),
      pixel_enabled: !!(s.meta_pixel_id) && (s.meta_pixel_enabled || '').trim() !== '0',
      capi_configured: !!(s.meta_capi_token),
      capi_enabled: s.meta_capi_enabled === '1',
      // Browser-Pixel diagnostics (the half that was silently broken):
      browser_events_enabled: browserEvents,          // allowlist in effect
      browser_events_firing: browserWillFire,         // what actually fires from this host
      browser_pixel_active: browserWillFire.length > 0,
      browser_pixel_all_events: browserWillFire.length === DEFAULT_META_EVENTS.split(',').length,
      host_allowed: lock.allowed,
      host_lock_enabled: lock.lock,
      request_host: requestHost(c),
      tracking_contract_healthy: Number(diagnosticStats?.critical_24h || 0) === 0
    }
  })
})

// Save pixel settings (only pixel keys — marketing_manager can manage without full settings perm)
pixel.put('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const updated: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (!PIXEL_KEYS.includes(key)) continue
    if (typeof value !== 'string' && typeof value !== 'number') continue
    let v = String(value).trim()
    if (PIXEL_SECRET.includes(key) && v === '••••••••') continue
    v = normalizeTrackingSetting(key, v)
    await setSetting(db, key, v, 'tracking')
    updated.push(key)
  }
  if (updated.length) await auditLog(db, user.id, user.username, 'update', 'pixel_settings', updated.join(','), `Pixel settings updated: ${updated.join(', ')}`)
  return c.json({ success: true, updated })
})

// Send a server-side test event to verify CAPI connection
pixel.post('/test-event', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const s = await getSettings(db, ['meta_pixel_id', 'meta_capi_token', 'meta_test_event_code'])
  if (!s.meta_pixel_id || !s.meta_capi_token) {
    return c.json({ error: 'not_configured', message: 'Pixel ID ও CAPI Token আগে সেট করুন' }, 400)
  }
  const eventId = resolveMetaEventId('test_' + generateToken(12), 'PageView').eventId
  // The source URL must be the REAL admin URL, not a placeholder. The old code sent
  // 'https://admin-test-event', which made Meta show a phantom 4th "website" named
  // `admin-test-event` in Events Manager → Data Sources → Websites — each press of this
  // button added another fake site to the dataset. Using the real request origin keeps the
  // test event attributed to naturalcarebangladesh.shop (or wherever the admin panel runs).
  // NOTE: set a Test Event Code (meta_test_event_code) so test events land in the
  // "Test Events" tab instead of the production data entirely.
  const adminUrl = (() => { try { return new URL(c.req.url).origin + '/admin' } catch { return 'https://naturalcarebangladesh.shop/admin' } })()
  const testEvent: MetaCapiStandardEvent = {
    eventName: 'PageView', eventId,
    // Required explicit field: admin test traffic has no attributable Meta click.
    fbc: null,
    sourceUrl: adminUrl,
    customData: {}
  }
  const payload: any = {
    data: [{
      event_name: testEvent.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: testEvent.eventId,
      action_source: 'website',
      event_source_url: testEvent.sourceUrl,
      user_data: {
        client_ip_address: c.req.header('cf-connecting-ip') || '127.0.0.1',
        client_user_agent: c.req.header('user-agent') || 'admin-test'
      },
      custom_data: testEvent.customData
    }],
    access_token: s.meta_capi_token
  }
  if (s.meta_test_event_code) payload.test_event_code = s.meta_test_event_code
  try {
    const pixelId = s.meta_pixel_id.replace(/[^0-9]/g, '')
    const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pixelId}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    })
    const txt = await resp.text()
    await auditLog(db, user.id, user.username, 'test', 'pixel_capi', eventId, `CAPI test event: ${resp.ok ? 'OK' : 'FAILED'}`)
    if (!resp.ok) {
      await logTrackingDiagnostic(db, {
        severity: 'critical', code: 'CAPI_HTTP_ERROR', source: 'capi',
        eventName: 'PageView', eventId,
        details: { test_event: true, http_status: resp.status, response: txt.slice(0, 300) }
      })
    }
    return c.json({ success: resp.ok, status: resp.status, response: txt.slice(0, 500), event_id: eventId, test_event_code: s.meta_test_event_code || null })
  } catch (e: any) {
    await logTrackingDiagnostic(db, {
      severity: 'critical', code: 'CAPI_EXCEPTION', source: 'capi',
      eventName: 'PageView', eventId,
      details: { test_event: true, message: String(e?.message || e).slice(0, 300) }
    })
    return c.json({ success: false, error: e.message }, 500)
  }
})

r.route('/pixel', pixel)

// ---------- HERO BANNERS ----------
const banners = new Hono<Env>()
banners.use('*', requireAuth('content'))

banners.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM hero_banners ORDER BY sort_order, id').all()
  return c.json({ banners: rows.results || [] })
})
banners.post('/', async (c) => {
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.image_url) return c.json({ error: 'validation', message: 'ছবির URL দিন' }, 400)
  const res = await c.env.DB.prepare('INSERT INTO hero_banners (image_url, title, subtitle, link_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(b.image_url, b.title || '', b.subtitle || '', b.link_url || '', Number(b.sort_order || 0), b.is_active === false ? 0 : 1).run()
  await auditLog(c.env.DB, user.id, user.username, 'create', 'banner', String(res.meta.last_row_id), 'Banner added')
  return c.json({ success: true, id: res.meta.last_row_id })
})
banners.put('/:id', async (c) => {
  const b = await c.req.json()
  await c.env.DB.prepare('UPDATE hero_banners SET image_url=?, title=?, subtitle=?, link_url=?, sort_order=?, is_active=? WHERE id=?')
    .bind(b.image_url, b.title || '', b.subtitle || '', b.link_url || '', Number(b.sort_order || 0), b.is_active === false ? 0 : 1, Number(c.req.param('id'))).run()
  return c.json({ success: true })
})
banners.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM hero_banners WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

r.route('/banners', banners)

export default r
