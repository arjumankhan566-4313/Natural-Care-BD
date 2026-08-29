// ============ Public APIs: landing content, order submission, tracking, pixel events ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import {
  getSettings, getSetting, generateOrderNumber, generateToken, validBDPhone, normalizePhone,
  recalcOrderProfit, refreshCustomerStats, notify, forwardToCapi, STATUS_LABELS_BN
} from '../lib/helpers'
import { calculateRisk } from '../lib/risk'
import { rateLimit } from '../lib/auth'

const pub = new Hono<{ Bindings: Bindings }>()

// ---- Landing page content (everything the page needs) ----
pub.get('/content', async (c) => {
  const db = c.env.DB
  const [settings, products, benefits, reviews, faqs, sections, banners] = await Promise.all([
    getSettings(db),
    db.prepare(`SELECT id, name, subtitle, slug, description, features, benefits, ingredients, usage_instructions, package_details, main_image, gallery_images, video_url, regular_price, sale_price, stock, stock_status, is_featured FROM products WHERE is_active = 1 AND is_deleted = 0 ORDER BY sort_order, id`).all(),
    db.prepare('SELECT icon, title, description, image FROM benefits WHERE is_visible = 1 ORDER BY sort_order').all(),
    db.prepare('SELECT customer_name, customer_image, screenshot_url, review_text, rating, is_featured FROM reviews WHERE is_published = 1 ORDER BY is_featured DESC, sort_order').all(),
    db.prepare('SELECT question, answer FROM faqs WHERE is_visible = 1 ORDER BY sort_order').all(),
    db.prepare('SELECT section_type, title, content, sort_order FROM page_sections WHERE is_visible = 1 ORDER BY sort_order').all(),
    db.prepare('SELECT id, image_url, title, subtitle, link_url FROM hero_banners WHERE is_active = 1 ORDER BY sort_order, id').all().catch(() => ({ results: [] }))
  ])

  // Packages per product
  const packages = await db.prepare('SELECT * FROM product_packages WHERE is_active = 1 ORDER BY sort_order').all()

  // Strip secret settings
  const publicSettings: Record<string, string> = {}
  const allowedKeys = ['brand_name', 'brand_tagline', 'brand_logo', 'support_phone', 'whatsapp_number', 'messenger_link',
    'hero_headline', 'hero_subheadline', 'offer_title', 'offer_description',
    'countdown_enabled', 'countdown_end', 'countdown_fallback_text',
    'delivery_charge_dhaka', 'delivery_charge_outside', 'free_delivery_enabled', 'free_delivery_min',
    'otp_enabled', 'meta_pixel_id', 'meta_pixel_enabled', 'meta_events_enabled', 'ga_id', 'gtm_id', 'tiktok_pixel_id', 'banner_autoplay_seconds',
    'bsti_enabled', 'bsti_title', 'bsti_description', 'bsti_certificate_image', 'favicon_url',
    'seo_title', 'seo_description', 'seo_keywords', 'og_image', 'canonical_url', 'robots', 'fb_share_title', 'fb_share_description',
    'trust_stats_enabled', 'trust_stats_title',
    'trust_stat1_number', 'trust_stat1_label', 'trust_stat1_icon',
    'trust_stat2_number', 'trust_stat2_label', 'trust_stat2_icon',
    'trust_stat3_number', 'trust_stat3_label', 'trust_stat3_icon',
    'trust_stat4_number', 'trust_stat4_label', 'trust_stat4_icon']
  for (const k of allowedKeys) if (settings[k] !== undefined) publicSettings[k] = settings[k]

  return c.json({
    settings: publicSettings,
    products: (products.results || []).map((p: any) => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      benefits: JSON.parse(p.benefits || '[]'),
      gallery_images: JSON.parse(p.gallery_images || '[]'),
      packages: (packages.results || []).filter((pk: any) => pk.product_id === p.id)
    })),
    benefits: benefits.results || [],
    reviews: reviews.results || [],
    faqs: faqs.results || [],
    sections: (sections.results || []).map((s: any) => ({ ...s, content: JSON.parse(s.content || '{}') })),
    banners: (banners as any).results || []
  })
})

// ---- Incomplete order autosave (partial checkout capture) ----
// The landing page calls this (debounced) whenever the customer types in the order form.
// Upsert by session_id so repeated autosaves update the same row — no order lead is ever missed.
pub.post('/incomplete', rateLimit(60, 60_000), async (c) => {
  const db = c.env.DB
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid_json' }, 400) }

  const sessionId = String(body.session_id || '').slice(0, 64)
  if (!sessionId || sessionId.length < 8) return c.json({ error: 'invalid_session' }, 400)

  const name = (body.customer_name || '').trim().slice(0, 100)
  const phone = (body.phone || '').trim().slice(0, 20)
  const altPhone = (body.alt_phone || '').trim().slice(0, 20)
  const address = (body.address || '').trim().slice(0, 500)
  const district = (body.district || '').trim().slice(0, 100)
  const upazila = (body.upazila || '').trim().slice(0, 100)
  const note = (body.order_note || '').trim().slice(0, 500)

  // Must have at least SOME useful data (name or phone) before saving
  if (!name && !phone) return c.json({ success: true, skipped: true })

  const fieldCount = [name, phone, altPhone, address, district, upazila, note].filter(Boolean).length
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  const ua = (c.req.header('user-agent') || '').slice(0, 300)

  await db.prepare(`
    INSERT INTO incomplete_orders (session_id, customer_name, phone, alt_phone, address, district, upazila, order_note,
      product_id, product_name, package_id, package_name, quantity, subtotal, delivery_charge, grand_total,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, campaign_id, adset_id, ad_id,
      ip_address, user_agent, source_url, field_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET
      customer_name = excluded.customer_name, phone = excluded.phone, alt_phone = excluded.alt_phone,
      address = excluded.address, district = excluded.district, upazila = excluded.upazila, order_note = excluded.order_note,
      product_id = excluded.product_id, product_name = excluded.product_name,
      package_id = excluded.package_id, package_name = excluded.package_name, quantity = excluded.quantity,
      subtotal = excluded.subtotal, delivery_charge = excluded.delivery_charge, grand_total = excluded.grand_total,
      field_count = excluded.field_count, updated_at = datetime('now')
    `).bind(
    sessionId, name, phone, altPhone, address, district, upazila, note,
    Number(body.product_id) || null, (body.product_name || '').slice(0, 200),
    Number(body.package_id) || null, (body.package_name || '').slice(0, 200), Number(body.quantity) || 1,
    Number(body.subtotal) || 0, Number(body.delivery_charge) || 0, Number(body.grand_total) || 0,
    (body.utm_source || '').slice(0, 200), (body.utm_medium || '').slice(0, 200), (body.utm_campaign || '').slice(0, 200),
    (body.utm_term || '').slice(0, 200), (body.utm_content || '').slice(0, 200), (body.fbclid || '').slice(0, 300),
    (body.campaign_id || '').slice(0, 100), (body.adset_id || '').slice(0, 100), (body.ad_id || '').slice(0, 100),
    ip, ua, (body.source_url || '').slice(0, 500), fieldCount
  ).run()

  return c.json({ success: true })
})

// ---- OTP request ----
pub.post('/otp/request', rateLimit(5, 60_000), async (c) => {
  const db = c.env.DB
  const otpEnabled = await getSetting(db, 'otp_enabled')
  if (otpEnabled !== '1') return c.json({ error: 'otp_disabled', message: 'OTP ভেরিফিকেশন বন্ধ আছে' }, 400)
  const { phone } = await c.req.json()
  const p = normalizePhone(phone)
  if (!validBDPhone(p)) return c.json({ error: 'invalid_phone', message: 'সঠিক মোবাইল নম্বর দিন' }, 400)
  const code = String(Math.floor(100000 + Math.random() * 900000))
  await db.prepare(`INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, datetime('now', '+5 minutes'))`).bind(p, code).run()
  // NOTE: SMS gateway integration requires credentials (configure in Admin > Settings > Notifications).
  // Without an SMS provider the OTP is logged for admin visibility only.
  await notify(db, 'info', 'OTP Requested', `Phone: ${p} | Code: ${code} (SMS gateway not configured — manual verify)`, '')
  return c.json({ success: true, message: 'OTP পাঠানো হয়েছে (SMS গেটওয়ে কনফিগার করা থাকলে)', sms_configured: false })
})

pub.post('/otp/verify', rateLimit(10, 60_000), async (c) => {
  const db = c.env.DB
  const { phone, code } = await c.req.json()
  const p = normalizePhone(phone)
  const row = await db.prepare(
    `SELECT id FROM otp_codes WHERE phone = ? AND code = ? AND is_used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`
  ).bind(p, String(code)).first<{ id: number }>()
  if (!row) return c.json({ error: 'invalid_otp', message: 'ভুল বা মেয়াদোত্তীর্ণ OTP' }, 400)
  await db.prepare('UPDATE otp_codes SET is_used = 1 WHERE id = ?').bind(row.id).run()
  return c.json({ success: true, verified: true })
})

// ---- Order submission ----
pub.post('/orders', rateLimit(10, 60_000), async (c) => {
  const db = c.env.DB
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid_json', message: 'অনুরোধটি সঠিক নয়' }, 400) }

  const name = (body.customer_name || '').trim()
  const phone = normalizePhone(body.phone || '')
  const altPhone = body.alt_phone ? normalizePhone(body.alt_phone) : ''
  const address = (body.address || '').trim()
  const district = (body.district || '').trim()
  const upazila = (body.upazila || '').trim()
  const area = (body.area || '').trim()
  const note = (body.order_note || '').trim().slice(0, 500)
  const items: any[] = Array.isArray(body.items) ? body.items : []
  const otpVerified = !!body.otp_verified

  // Validation
  const errors: string[] = []
  if (name.length < 2) errors.push('নাম দিন (কমপক্ষে ২ অক্ষর)')
  if (!validBDPhone(phone)) errors.push('সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)')
  if (altPhone && !validBDPhone(altPhone)) errors.push('বিকল্প মোবাইল নম্বরটি সঠিক নয়')
  if (address.length < 10) errors.push('সম্পূর্ণ ঠিকানা দিন (কমপক্ষে ১০ অক্ষর)')
  if (!district) errors.push('জেলা নির্বাচন করুন')
  if (!items.length) errors.push('কমপক্ষে একটি পণ্য নির্বাচন করুন')
  for (const it of items) {
    if (!it.product_id || !Number.isInteger(Number(it.quantity)) || Number(it.quantity) < 1 || Number(it.quantity) > 50) {
      errors.push('পণ্যের পরিমাণ সঠিক নয়')
      break
    }
  }
  if (errors.length) return c.json({ error: 'validation', messages: errors }, 400)

  // Server-side price calculation (never trust client)
  const settings = await getSettings(db, ['delivery_charge_dhaka', 'delivery_charge_outside', 'free_delivery_enabled', 'free_delivery_min', 'default_packaging_cost', 'default_cod_fee_percent'])
  let subtotal = 0
  let productCost = 0
  let freeDelivery = false
  const resolvedItems: any[] = []

  for (const it of items) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1 AND is_deleted = 0').bind(it.product_id).first<any>()
    if (!product) return c.json({ error: 'validation', messages: ['পণ্যটি পাওয়া যায়নি'] }, 400)
    if (product.stock_status === 'out_of_stock' || product.stock <= 0) {
      return c.json({ error: 'out_of_stock', messages: [`"${product.name}" স্টকে নেই`] }, 400)
    }
    let unitPrice = product.sale_price
    let pkgName = null
    let qty = Number(it.quantity)
    if (it.package_id) {
      const pkg = await db.prepare('SELECT * FROM product_packages WHERE id = ? AND product_id = ? AND is_active = 1').bind(it.package_id, it.product_id).first<any>()
      if (pkg) {
        // package price is total for its quantity
        subtotal += pkg.price * qty
        productCost += product.product_cost * pkg.quantity * qty
        if (pkg.free_delivery) freeDelivery = true
        resolvedItems.push({ product_id: product.id, package_id: pkg.id, product_name: product.name, package_name: pkg.name, quantity: pkg.quantity * qty, unit_price: pkg.price / pkg.quantity, total_price: pkg.price * qty, unit_cost: product.product_cost })
        continue
      }
    }
    subtotal += unitPrice * qty
    productCost += product.product_cost * qty
    resolvedItems.push({ product_id: product.id, package_id: null, product_name: product.name, package_name: pkgName, quantity: qty, unit_price: unitPrice, total_price: unitPrice * qty, unit_cost: product.product_cost })
  }

  // Delivery charge
  const isDhaka = /ঢাকা|dhaka/i.test(district)
  let deliveryCharge = isDhaka ? Number(settings.delivery_charge_dhaka || 70) : Number(settings.delivery_charge_outside || 130)
  if (freeDelivery) deliveryCharge = 0
  if (settings.free_delivery_enabled === '1' && subtotal >= Number(settings.free_delivery_min || 999999)) deliveryCharge = 0

  const grandTotal = subtotal + deliveryCharge
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  const ua = (c.req.header('user-agent') || '').slice(0, 300)

  // Risk assessment
  const risk = await calculateRisk(db, { phone, address, ip, otpVerified })

  // Upsert customer
  let customer = await db.prepare('SELECT id, list_status FROM customers WHERE phone = ?').bind(phone).first<any>()
  if (!customer) {
    const r = await db.prepare(
      'INSERT INTO customers (name, phone, alt_phone, address, district, upazila, area) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(name, phone, altPhone, address, district, upazila, area).run()
    customer = { id: r.meta.last_row_id, list_status: 'none' }
  } else {
    await db.prepare('UPDATE customers SET name = ?, address = ?, district = ?, upazila = ?, area = ? WHERE id = ?')
      .bind(name, address, district, upazila, area, customer.id).run()
  }

  // Determine initial status
  let status = 'new'
  if (risk.level === 'high') status = 'manual_review'
  if (customer.list_status === 'blacklist') status = 'fake'

  const orderNumber = generateOrderNumber()
  const eventId = generateToken(16)
  const packagingCost = Number(settings.default_packaging_cost || 0)
  const codCharge = Math.round(grandTotal * Number(settings.default_cod_fee_percent || 0) / 100)

  const orderResult = await db.prepare(`
    INSERT INTO orders (order_number, customer_id, customer_name, phone, alt_phone, address, district, upazila, area,
      delivery_method, order_note, subtotal, discount, delivery_charge, grand_total, status, is_verified,
      risk_score, risk_level, risk_reasons, product_cost, packaging_cost, cod_charge,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, campaign_id, adset_id, ad_id,
      order_source, ip_address, user_agent, event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderNumber, customer.id, name, phone, altPhone, address, district, upazila, area,
    body.delivery_method || 'home_delivery', note, subtotal, 0, deliveryCharge, grandTotal, status, otpVerified ? 1 : 0,
    risk.score, risk.level, JSON.stringify(risk.reasons), productCost, packagingCost, codCharge,
    (body.utm_source || '').slice(0, 200), (body.utm_medium || '').slice(0, 200), (body.utm_campaign || '').slice(0, 200),
    (body.utm_term || '').slice(0, 200), (body.utm_content || '').slice(0, 200), (body.fbclid || '').slice(0, 300),
    (body.campaign_id || '').slice(0, 100), (body.adset_id || '').slice(0, 100), (body.ad_id || '').slice(0, 100),
    'website', ip, ua, eventId
  ).run()

  const orderId = orderResult.meta.last_row_id as number

  // Order items
  for (const it of resolvedItems) {
    await db.prepare(
      'INSERT INTO order_items (order_id, product_id, package_id, product_name, package_name, quantity, unit_price, total_price, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(orderId, it.product_id, it.package_id, it.product_name, it.package_name, it.quantity, it.unit_price, it.total_price, it.unit_cost).run()
  }

  // Status history
  await db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES (?, NULL, ?, ?, ?)')
    .bind(orderId, status, risk.level === 'high' ? `High risk (${risk.score}): ${risk.reasons.join(', ')}` : 'Order placed from website', 'system').run()

  await recalcOrderProfit(db, orderId)
  await refreshCustomerStats(db, customer.id)
  await notify(db, 'new_order', '🔔 নতুন অর্ডার এসেছে', `${orderNumber} — ${name} (${phone}) — ৳${grandTotal}`, `/admin#/orders/${orderId}`)

  // Server-side Purchase event log (dedup by event_id) for CAPI
  await db.prepare(
    `INSERT OR IGNORE INTO tracking_events (event_id, event_name, event_data, source_url, ip_address, user_agent, fbclid)
     VALUES (?, 'Purchase', ?, ?, ?, ?, ?)`
  ).bind(eventId, JSON.stringify({ order_number: orderNumber, value: grandTotal, currency: 'BDT' }), body.source_url || '', ip, ua, body.fbclid || '').run()

  // Guaranteed server-side Purchase → Meta CAPI. This does NOT depend on the customer's
  // browser calling /api/public/events — it fires immediately here so an ad-blocker, iOS
  // tracking prevention, or the customer closing the tab right after ordering can never
  // cause a lost Purchase event. The browser-side fbq('track','Purchase', ...) call uses the
  // same event_id (returned below), so Meta automatically de-duplicates the two signals.
  await forwardToCapi(db, {
    eventName: 'Purchase',
    eventId,
    sourceUrl: body.source_url || '',
    ip, ua,
    fbclid: body.fbclid || '',
    fbclidTs: body.fbclid_ts || '',
    customData: { value: grandTotal, currency: 'BDT', content_ids: resolvedItems.map(i => String(i.product_id)), order_number: orderNumber }
  })

  // Mark matching incomplete order as converted (order was completed)
  if (body.session_id) {
    await db.prepare(`UPDATE incomplete_orders SET status = 'converted', order_id = ?, updated_at = datetime('now') WHERE session_id = ? AND status != 'converted'`)
      .bind(orderId, String(body.session_id).slice(0, 64)).run().catch(() => {})
  }

  return c.json({
    success: true,
    message: 'আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।',
    order: {
      order_number: orderNumber,
      customer_name: name,
      items: resolvedItems.map(i => ({ name: i.product_name, package: i.package_name, quantity: i.quantity, total: i.total_price })),
      subtotal, delivery_charge: deliveryCharge, grand_total: grandTotal,
      event_id: eventId,
      status
    }
  })
})

// ---- Customer order tracking ----
pub.post('/track', rateLimit(20, 60_000), async (c) => {
  const db = c.env.DB
  const { order_number, phone } = await c.req.json()
  const p = normalizePhone(phone || '')
  if (!order_number || !p) return c.json({ error: 'validation', message: 'Order ID এবং মোবাইল নম্বর দিন' }, 400)

  const order = await db.prepare(
    `SELECT o.order_number, o.status, o.created_at, o.grand_total, o.tracking_id, o.tracking_url, o.shipped_at, o.delivered_at, c2.name as courier_name
     FROM orders o LEFT JOIN couriers c2 ON c2.id = o.courier_id
     WHERE o.order_number = ? AND o.phone = ? AND o.is_deleted = 0`
  ).bind(String(order_number).trim().toUpperCase(), p).first<any>()

  if (!order) return c.json({ error: 'not_found', message: 'অর্ডার পাওয়া যায়নি। Order ID ও মোবাইল নম্বর সঠিক কিনা দেখুন।' }, 404)

  const history = await db.prepare(
    'SELECT to_status, created_at FROM order_status_history WHERE order_id = (SELECT id FROM orders WHERE order_number = ?) ORDER BY id'
  ).bind(order.order_number).all()

  // Only public-safe fields
  return c.json({
    success: true,
    order: {
      order_number: order.order_number,
      status: order.status,
      status_label: STATUS_LABELS_BN[order.status] || order.status,
      created_at: order.created_at,
      grand_total: order.grand_total,
      courier_name: order.courier_name || null,
      tracking_id: order.tracking_id || null,
      tracking_url: order.tracking_url || null,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      timeline: (history.results || []).map((h: any) => ({ status: h.to_status, label: STATUS_LABELS_BN[h.to_status] || h.to_status, at: h.created_at }))
    }
  })
})

// ---- Client pixel event logging (dedup + CAPI queue) ----
pub.post('/events', rateLimit(60, 60_000), async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))
  const eventName = String(body.event_name || '')
  const allowed = ['PageView', 'ViewContent', 'InitiateCheckout', 'Lead', 'Purchase']
  if (!allowed.includes(eventName)) return c.json({ error: 'invalid_event' }, 400)
  const eventId = String(body.event_id || generateToken(16)).slice(0, 64)
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const ua = (c.req.header('user-agent') || '').slice(0, 300)
  await db.prepare(
    `INSERT OR IGNORE INTO tracking_events (event_id, event_name, event_data, source_url, ip_address, user_agent, fbclid) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, eventName, JSON.stringify(body.data || {}), (body.source_url || '').slice(0, 500), ip, ua, (body.fbclid || '').slice(0, 300)).run()

  // Server-side CAPI forward for non-Purchase events. Purchase is already guaranteed-sent
  // server-side from the /orders route the instant the order is created — sending it again
  // here (with the same event_id, which the browser's fbq() call also uses) would just be a
  // redundant duplicate fetch to Meta since Meta already de-dupes on event_id anyway, but we
  // skip it to save the extra API call.
  if (eventName !== 'Purchase') {
    await forwardToCapi(db, {
      eventName, eventId,
      sourceUrl: body.source_url || '', ip, ua, fbclid: body.fbclid || '', fbclidTs: body.fbclid_ts || '',
      customData: body.data || {}
    })
  }
  return c.json({ success: true, event_id: eventId })
})

export default pub
