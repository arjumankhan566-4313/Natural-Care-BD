// ============ Shared helpers ============
import type { Context } from 'hono'

export type Bindings = {
  DB: D1Database
}

const SALT = 'ncb_salt_2026'

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateToken(len = 32): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateOrderNumber(): string {
  const n = Math.floor(10000 + Math.random() * 90000)
  return `NCB-${Date.now().toString(36).toUpperCase().slice(-4)}${n}`
}

export function validBDPhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test((phone || '').replace(/[\s-]/g, '').replace(/^\+?880?/, '0').replace(/^00/, '0'))
}

export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/[\s-]/g, '')
  if (p.startsWith('+880')) p = '0' + p.slice(4)
  else if (p.startsWith('880')) p = '0' + p.slice(3)
  return p
}

// ============ Order form field validation (shared source of truth) ============
// Mirrored in public/static/landing.js (client-side, for instant feedback) — but the
// server here is the REAL gate: a customer/bot can bypass or tamper with the browser
// JS, so nothing is trusted unless it also passes these exact same rules server-side.

// The 64 official districts of Bangladesh — kept in sync with the `DISTRICTS` array in
// public/static/landing.js (used there for the <datalist> autocomplete). The landing
// page's district field is free-text (no forced dropdown selection), but the value
// typed must still match one of these 64 real district names — random/garbage text
// must be rejected.
export const BD_DISTRICTS: string[] = [
  'ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'মুন্সিগঞ্জ', 'মানিকগঞ্জ', 'নরসিংদী', 'টাঙ্গাইল', 'কিশোরগঞ্জ', 'ফরিদপুর', 'গোপালগঞ্জ',
  'মাদারীপুর', 'রাজবাড়ী', 'শরীয়তপুর', 'চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'ব্রাহ্মণবাড়িয়া', 'চাঁদপুর', 'লক্ষ্মীপুর', 'নোয়াখালী',
  'ফেনী', 'খাগড়াছড়ি', 'রাঙ্গামাটি', 'বান্দরবান', 'রাজশাহী', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ', 'নওগাঁ', 'নাটোর',
  'জয়পুরহাট', 'চাঁপাইনবাবগঞ্জ', 'খুলনা', 'যশোর', 'সাতক্ষীরা', 'বাগেরহাট', 'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'কুষ্টিয়া',
  'চুয়াডাঙ্গা', 'মেহেরপুর', 'বরিশাল', 'পটুয়াখালী', 'ভোলা', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি', 'সিলেট', 'মৌলভীবাজার',
  'হবিগঞ্জ', 'সুনামগঞ্জ', 'রংপুর', 'দিনাজপুর', 'গাইবান্ধা', 'কুড়িগ্রাম', 'লালমনিরহাট', 'নীলফামারী', 'পঞ্চগড়', 'ঠাকুরগাঁও',
  'ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'শেরপুর'
]

// Case/space-insensitive lookup so "ঢাকা", " ঢাকা ", "dhaka", "DHAKA" etc. all resolve
// to the same canonical district name. Returns '' if no real district matches.
export function resolveDistrict(input: string): string {
  const norm = (input || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!norm) return ''
  const ENGLISH_ALIASES: Record<string, string> = {
    dhaka: 'ঢাকা', chittagong: 'চট্টগ্রাম', chattogram: 'চট্টগ্রাম', khulna: 'খুলনা', rajshahi: 'রাজশাহী',
    sylhet: 'সিলেট', barisal: 'বরিশাল', barishal: 'বরিশাল', rangpur: 'রংপুর', mymensingh: 'ময়মনসিংহ',
    comilla: 'কুমিল্লা', cumilla: 'কুমিল্লা', coxsbazar: 'কক্সবাজার', jessore: 'যশোর', jashore: 'যশোর'
  }
  if (ENGLISH_ALIASES[norm]) return ENGLISH_ALIASES[norm]
  for (const d of BD_DISTRICTS) {
    if (d.trim().toLowerCase().replace(/\s+/g, '') === norm) return d
  }
  return ''
}

// Bengali + English letters, spaces, dots, hyphens and apostrophes only (covers
// legitimate human names in both scripts). Digits and other symbols are rejected.
const NAME_CHARS_RE = /^[\u0980-\u09FFa-zA-Z\s.'-]+$/
// Any single character repeated 4+ times in a row (e.g. "aaaa", "কককক", "....") —
// a strong signal of junk/placeholder input rather than a real name/address/area.
const REPEATED_CHAR_RE = /(.)\1{3,}/

export function validCustomerName(name: string): boolean {
  const v = (name || '').trim()
  if (v.length < 3 || v.length > 100) return false
  if (!NAME_CHARS_RE.test(v)) return false
  if (REPEATED_CHAR_RE.test(v)) return false
  // Require at least two "words" (first + last name) so a single stray letter/word
  // like "k" or "test" can't pass.
  const words = v.split(/\s+/).filter(w => w.replace(/[.'-]/g, '').length > 0)
  if (words.length < 2) return false
  // Every word must have at least one real letter (not just dots/hyphens).
  if (words.some(w => w.replace(/[.'-]/g, '').length === 0)) return false
  return true
}

export function validAddress(address: string): boolean {
  const v = (address || '').trim()
  if (v.length < 15 || v.length > 500) return false
  if (REPEATED_CHAR_RE.test(v)) return false
  // A real address normally combines letters with at least one digit (house/road/
  // holding number) OR at least 3 distinct words — this filters out junk like
  // "asdfasdfasdfasdf" or "................" while still allowing addresses that
  // spell numbers out in words.
  const hasDigit = /\d/.test(v)
  const wordCount = v.split(/\s+/).filter(Boolean).length
  if (!hasDigit && wordCount < 3) return false
  // Reject if it's dominated by a tiny alphabet of repeating characters (e.g.
  // "abcabcabcabcabcabc") — require a reasonable variety of distinct characters.
  const distinctChars = new Set(v.replace(/\s/g, '').toLowerCase()).size
  if (distinctChars < 5) return false
  return true
}

export function validUpazila(upazila: string): boolean {
  const v = (upazila || '').trim()
  if (v.length < 2 || v.length > 100) return false
  if (!NAME_CHARS_RE.test(v)) return false
  if (REPEATED_CHAR_RE.test(v)) return false
  const distinctChars = new Set(v.replace(/\s/g, '').toLowerCase()).size
  if (distinctChars < 2) return false
  return true
}

// Meta (Facebook) requires phone numbers WITH the country code, digits only,
// no leading zero after the country code — e.g. "01711000111" -> "8801711000111".
// This is the OPPOSITE of normalizePhone() above (which is for local BD storage/
// display in the 01XXXXXXXXX format). Never send the local-format number to Meta.
export function toMetaPhone(phone: string): string {
  let p = (phone || '').replace(/[^\d+]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  if (p.startsWith('880')) p = p.slice(3)
  else if (p.startsWith('00880')) p = p.slice(5)
  p = p.replace(/^0+/, '') // strip local leading 0 (and any leftover 0s)
  return p ? `880${p}` : ''
}

// Plain SHA-256 hex digest (no salt) — used for Meta CAPI's required hashing of
// user_data fields (ph, fn, ...). Per Meta spec: https://developers.facebook.com/
// documentation/ads-commerce/conversions-api/parameters/customer-information-parameters
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Normalize + hash a first name for Meta's `fn` field: lowercase letters only,
// per spec ("Using Roman alphabet a-z characters is recommended. Lowercase only
// with no punctuation."). We keep UTF-8 (e.g. Bengali) characters as-is since
// Meta explicitly supports UTF-8-encoded non-Roman text for fn/ln.
export async function hashMetaFirstName(fullName: string): Promise<string | undefined> {
  const first = (fullName || '').trim().split(/\s+/)[0]
  if (!first) return undefined
  return sha256Hex(first.toLowerCase())
}

// Normalize + hash the LAST name for Meta's `ln` field. Same rules as fn.
// Meta's Event Match Quality scoring rewards having BOTH fn AND ln present —
// previously only fn was ever sent, which caps the achievable match score.
// If the customer only typed a single-word name, there is no last name to
// send (returns undefined) — this is expected and fine, not an error.
export async function hashMetaLastName(fullName: string): Promise<string | undefined> {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length < 2) return undefined
  const last = parts[parts.length - 1]
  if (!last) return undefined
  return sha256Hex(last.toLowerCase())
}

// Normalize + hash a BD phone (any input format) for Meta's `ph` field:
// digits only, WITH country code (880), no leading zero.
export async function hashMetaPhone(phone: string): Promise<string | undefined> {
  const p = toMetaPhone(phone)
  if (!p) return undefined
  return sha256Hex(p)
}

export async function getSetting(db: D1Database, key: string): Promise<string> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? ''
}

export async function getSettings(db: D1Database, keys?: string[]): Promise<Record<string, string>> {
  let rows
  if (keys && keys.length) {
    const placeholders = keys.map(() => '?').join(',')
    rows = await db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all<{ key: string; value: string }>()
  } else {
    rows = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  }
  const out: Record<string, string> = {}
  for (const r of rows.results || []) out[r.key] = r.value
  return out
}

export async function setSetting(db: D1Database, key: string, value: string, category = 'general') {
  await db.prepare(
    `INSERT INTO settings (key, value, category, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).bind(key, value, category).run()
}

export async function auditLog(db: D1Database, userId: number | null, username: string, action: string, entityType: string, entityId: string, details: string, ip = '') {
  await db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, username, action, entityType, entityId, details, ip).run()
}

export async function notify(db: D1Database, type: string, title: string, message: string, link = '') {
  await db.prepare('INSERT INTO notifications (type, title, message, link) VALUES (?, ?, ?, ?)').bind(type, title, message, link).run()
}

// Run a task (e.g. the CAPI network call) without blocking the HTTP response.
// Uses Cloudflare's executionCtx.waitUntil so the request returns to the customer
// immediately (landing page needs to feel instant) while the worker stays alive
// in the background until the CAPI call to Meta actually completes. Falls back to
// a plain (non-blocking) promise if executionCtx isn't available for some reason.
export function runBackground(c: Context<any>, task: Promise<any>) {
  const safe = task.catch(() => {})
  try {
    c.executionCtx.waitUntil(safe)
  } catch {
    // no executionCtx in this environment — task still runs, just not guaranteed
    // to finish before the isolate is recycled. This should not happen on
    // Cloudflare Pages/Workers in production or in `wrangler pages dev`.
  }
}

// Forward a tracking event to Meta Conversions API directly from the server.
// Used both for the guaranteed server-side Purchase send (at order-creation time,
// independent of whether the customer's browser ever calls /api/public/events)
// and for the client-triggered /events endpoint (PageView, ViewContent, etc).
export async function forwardToCapi(
  db: D1Database,
  params: {
    eventName: string
    eventId: string
    sourceUrl?: string
    ip?: string
    ua?: string
    fbclid?: string
    fbclidTs?: string
    fbp?: string
    fbc?: string
    customerName?: string
    customerPhone?: string
    externalId?: string
    customData?: Record<string, any>
  }
): Promise<void> {
  const s = await getSettings(db, ['meta_capi_enabled', 'meta_capi_token', 'meta_pixel_id', 'meta_test_event_code', 'meta_advanced_matching'])
  if (s.meta_capi_enabled !== '1' || !s.meta_capi_token || !s.meta_pixel_id) return
  try {
    const userData: Record<string, any> = {
      client_ip_address: params.ip || undefined,
      client_user_agent: params.ua || undefined
    }
    // fbp = Facebook Browser ID cookie (_fbp), set automatically by the Pixel SDK. This is
    // one of the strongest matching signals (identity anchor) — send it exactly as read
    // from the browser cookie, never modify/reconstruct it.
    if (params.fbp) userData.fbp = params.fbp
    // fbc = Facebook Click ID. Prefer the REAL _fbc cookie value the Pixel SDK itself set
    // (already correctly formatted with a millisecond timestamp) — it is authoritative.
    // Only reconstruct fbc manually from fbclid+fbclidTs as a fallback, for sessions where
    // the _fbc cookie wasn't available (e.g. cookie blocked) but we still captured the
    // fbclid URL param ourselves. Per Meta's spec the format is
    // fb.<subdomain_index>.<creationTime_in_MILLISECONDS>.<fbclid> — using seconds here
    // (the previous bug) breaks fbc-based matching entirely.
    if (params.fbc) {
      userData.fbc = params.fbc
    } else if (params.fbclid) {
      userData.fbc = `fb.1.${params.fbclidTs || Date.now()}.${params.fbclid}`
    }
    // external_id — the landing page's own per-visitor session_id (sessionStorage,
    // generated once per browser session, sent on EVERY event: PageView, ViewContent,
    // InitiateCheckout, Lead, Purchase). Per Meta's docs this is a "Hashing recommended"
    // match key that works even before the customer has typed name/phone, and — crucially —
    // it is the SAME value across the whole funnel for one visitor. This lets Meta link an
    // anonymous PageView/InitiateCheckout to the same person's later Purchase, which raises
    // Event Match Quality for the EARLY, high-volume events (PageView/ViewContent/
    // InitiateCheckout) that otherwise carry only IP + user-agent — exactly the gap that was
    // showing as "শুধু fn/ln আর IP আসছে, ph আসছে না" for those events in Events Manager.
    if (params.externalId) userData.external_id = await sha256Hex(params.externalId)
    // Advanced Matching (ph/fn) — required by Meta ads booster for higher match quality.
    // Both fields must be SHA-256 hashed per Meta CAPI spec (unlike the browser Pixel,
    // which auto-hashes plain text passed to fbq('init', ..., {ph, fn})).
    // ph must include the 880 country code, digits only, no leading zero.
    if (s.meta_advanced_matching === '1') {
      if (params.customerPhone) {
        const hashedPh = await hashMetaPhone(params.customerPhone)
        if (hashedPh) userData.ph = hashedPh
      }
      if (params.customerName) {
        const hashedFn = await hashMetaFirstName(params.customerName)
        if (hashedFn) userData.fn = hashedFn
        // ln (last name) — previously never sent. Meta's EMQ scoring specifically
        // checks for fn+ln together; sending fn alone caps the achievable score.
        const hashedLn = await hashMetaLastName(params.customerName)
        if (hashedLn) userData.ln = hashedLn
      }
    }
    const payload: any = {
      data: [{
        event_name: params.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: 'website',
        event_source_url: params.sourceUrl || '',
        user_data: userData,
        custom_data: params.customData || {}
      }],
      access_token: s.meta_capi_token
    }
    if (s.meta_test_event_code) payload.test_event_code = s.meta_test_event_code
    const pixelId = s.meta_pixel_id.replace(/[^0-9]/g, '')
    const resp = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const txt = await resp.text()
    await db.prepare('UPDATE tracking_events SET sent_to_capi = ?, capi_response = ? WHERE event_id = ?')
      .bind(resp.ok ? 1 : 0, txt.slice(0, 500), params.eventId).run()
  } catch (e: any) {
    await db.prepare('UPDATE tracking_events SET capi_response = ? WHERE event_id = ?')
      .bind(`error: ${e.message}`.slice(0, 500), params.eventId).run()
  }
}

// ============ SMS ============
// Generic SMS sender that works with ANY BD SMS gateway that exposes a simple
// GET-based "send SMS" API (the vast majority do — bulksmsbd.net, smsq, ADN
// Telecom, Alpha SMS, Mimsms, etc). The admin pastes their gateway's endpoint
// URL as a TEMPLATE containing the placeholders {phone}, {message}, {api_key},
// {sender_id} — exactly as documented by their provider — into Settings →
// SMS গেটওয়ে. This function fills those placeholders and fires the request.
// Mirrors forwardToCapi()'s gated try/catch/fetch/DB-log pattern.
export async function sendSms(
  db: D1Database,
  params: { phone: string; message: string; orderId?: number; eventType?: string }
): Promise<void> {
  const s = await getSettings(db, ['sms_enabled', 'sms_api_url_template', 'sms_api_key', 'sms_sender_id'])
  // Not configured yet — silently skip. This is expected until the user adds
  // their own SMS gateway credentials via Admin → Settings.
  if (s.sms_enabled !== '1' || !s.sms_api_url_template || !s.sms_api_key) return
  const phoneForSms = normalizePhone(params.phone)
  try {
    const url = s.sms_api_url_template
      .replace('{phone}', encodeURIComponent(phoneForSms))
      .replace('{message}', encodeURIComponent(params.message))
      .replace('{api_key}', encodeURIComponent(s.sms_api_key))
      .replace('{sender_id}', encodeURIComponent(s.sms_sender_id || ''))
    const resp = await fetch(url, { method: 'GET' })
    const txt = await resp.text()
    await db.prepare('INSERT INTO sms_logs (order_id, phone, message, event_type, success, response) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(params.orderId || null, phoneForSms, params.message, params.eventType || '', resp.ok ? 1 : 0, txt.slice(0, 500)).run()
  } catch (e: any) {
    await db.prepare('INSERT INTO sms_logs (order_id, phone, message, event_type, success, response) VALUES (?, ?, ?, ?, 0, ?)')
      .bind(params.orderId || null, phoneForSms, params.message, params.eventType || '', `error: ${e.message}`.slice(0, 500)).run().catch(() => {})
  }
}

// Fill a SMS template string like "প্রিয় {name}, আপনার অর্ডার #{order_number}..."
// with the given variables. Unknown placeholders are left as-is.
export function fillSmsTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
}

// Recalculate order profit and persist
export async function recalcOrderProfit(db: D1Database, orderId: number) {
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<any>()
  if (!o) return
  const netSales = (o.subtotal || 0) - (o.discount || 0) + (o.delivery_charge || 0)
  const totalCost = (o.product_cost || 0) + (o.packaging_cost || 0) + (o.courier_cost || 0) + (o.cod_charge || 0) + (o.ad_cost || 0) + (o.other_cost || 0)
  const netProfit = netSales - totalCost
  await db.prepare('UPDATE orders SET net_profit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(netProfit, orderId).run()
  return netProfit
}

// Update customer aggregate stats
export async function refreshCustomerStats(db: D1Database, customerId: number) {
  await db.prepare(`
    UPDATE customers SET
      total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = ? AND is_deleted = 0),
      delivered_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = ? AND status = 'delivered' AND is_deleted = 0),
      cancelled_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = ? AND status = 'cancelled' AND is_deleted = 0),
      returned_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = ? AND status = 'returned' AND is_deleted = 0),
      total_spent = COALESCE((SELECT SUM(grand_total) FROM orders WHERE customer_id = ? AND status = 'delivered' AND is_deleted = 0), 0),
      last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = ? AND is_deleted = 0)
    WHERE id = ?
  `).bind(customerId, customerId, customerId, customerId, customerId, customerId, customerId).run()
}

// Change an order's main lifecycle status and run every side effect the manual admin
// "স্ট্যাটাস পরিবর্তন" action performs (history log, stock adjust, profit recalc,
// customer stats, audit log, notification, delivered-SMS). Used both by the manual
// PUT /:id/status endpoint AND by the automatic courier-status sync engine, so the two
// paths can never drift out of sync with each other.
//
// `ctx` is optional: when called from inside an HTTP request handler, pass the Hono
// Context so the delivered-SMS send can run via runBackground() (non-blocking). When
// called from a background/waitUntil task (no live request to return early from), omit
// it — sendSms is just awaited directly since there's no latency concern to avoid.
export async function applyOrderStatusChange(
  db: D1Database,
  order: any,
  newStatus: string,
  changedBy: string,
  note = '',
  ctx?: Context<any>,
  changedByUserId: number | null = null
): Promise<{ ok: boolean; oldStatus?: string; message?: string }> {
  if (!ORDER_STATUSES.includes(newStatus as any)) return { ok: false, message: 'invalid_status' }
  const oldStatus = order.status
  if (oldStatus === newStatus) return { ok: false, message: 'same_status' }

  const extra: string[] = []
  if (newStatus === 'shipped') extra.push('shipped_at = CURRENT_TIMESTAMP')
  if (newStatus === 'delivered') { extra.push('delivered_at = CURRENT_TIMESTAMP'); extra.push('paid_amount = grand_total') }

  // Atomic conditional UPDATE: only actually change the row (and therefore only run the
  // side effects below) if the order's status still matches what the caller read as
  // `oldStatus`. Without this guard, two callers racing on the same order (e.g. the
  // courier auto-sync engine calling this from two overlapping requests) could both pass
  // their own stale "current status" check and both apply stock/profit/SMS/history side
  // effects for the same transition — this bit us once already for courier_status_logs,
  // so the same pattern is applied here pre-emptively for order.status.
  const upd = await db.prepare(
    `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP${extra.length ? ', ' + extra.join(', ') : ''} WHERE id = ? AND status = ?`
  ).bind(newStatus, order.id, oldStatus).run()
  if ((upd.meta?.changes || 0) === 0) return { ok: false, message: 'status_changed_concurrently' }

  await db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')
    .bind(order.id, oldStatus, newStatus, note || '', changedBy).run()

  const confirmedStatuses = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered']
  const wasConfirmed = confirmedStatuses.includes(oldStatus)
  const nowConfirmed = confirmedStatuses.includes(newStatus)
  const items = await db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').bind(order.id).all()
  if (!wasConfirmed && nowConfirmed) {
    for (const it of (items.results || []) as any[]) {
      await db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), stock_status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' WHEN stock - ? <= low_stock_threshold THEN 'low_stock' ELSE 'in_stock' END WHERE id = ?`)
        .bind(it.quantity, it.quantity, it.quantity, it.product_id).run()
    }
  }
  if (wasConfirmed && (newStatus === 'cancelled' || newStatus === 'returned')) {
    for (const it of (items.results || []) as any[]) {
      await db.prepare(`UPDATE products SET stock = stock + ?, stock_status = CASE WHEN stock + ? > low_stock_threshold THEN 'in_stock' WHEN stock + ? > 0 THEN 'low_stock' ELSE 'out_of_stock' END WHERE id = ?`)
        .bind(it.quantity, it.quantity, it.quantity, it.product_id).run()
    }
    if (newStatus === 'returned' && order.courier_id) {
      const courier = await db.prepare('SELECT return_charge FROM couriers WHERE id = ?').bind(order.courier_id).first<any>()
      if (courier?.return_charge) {
        await db.prepare('UPDATE orders SET courier_cost = courier_cost + ? WHERE id = ?').bind(courier.return_charge, order.id).run()
      }
    }
  }

  await recalcOrderProfit(db, order.id)
  if (order.customer_id) await refreshCustomerStats(db, order.customer_id)
  await auditLog(db, changedByUserId, changedBy, 'status_change', 'order', String(order.order_number), `${oldStatus} → ${newStatus}${note ? ' | ' + note : ''}`)
  await notify(db, 'status_change', 'অর্ডার স্ট্যাটাস পরিবর্তন', `${order.order_number}: ${oldStatus} → ${newStatus} (${changedBy})`, `/admin#/orders/${order.id}`)

  if (newStatus === 'delivered') {
    const s = await getSettings(db, ['sms_on_delivered_enabled', 'sms_on_delivered_template', 'brand_name'])
    if (s.sms_on_delivered_enabled !== '0') {
      const smsTask = sendSms(db, {
        phone: order.phone,
        orderId: order.id,
        eventType: 'delivered',
        message: fillSmsTemplate(s.sms_on_delivered_template || 'প্রিয় {name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ — {brand}', {
          name: order.customer_name, order_number: order.order_number, brand: s.brand_name || 'Nature Care Bangladesh'
        })
      })
      if (ctx) runBackground(ctx, smsTask); else smsTask.catch(() => {})
    }
  }

  return { ok: true, oldStatus }
}

export const ORDER_STATUSES = ['new', 'pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'fake', 'manual_review'] as const

export const STATUS_LABELS_BN: Record<string, string> = {
  new: 'নতুন অর্ডার', pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং',
  ready_to_ship: 'শিপমেন্টের জন্য প্রস্তুত', shipped: 'শিপড', out_for_delivery: 'ডেলিভারির পথে',
  delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'রিটার্নড', fake: 'ফেক/সন্দেহজনক', manual_review: 'ম্যানুয়াল রিভিউ'
}
