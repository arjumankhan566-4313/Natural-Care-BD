// ============ Shared helpers ============
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
    customData?: Record<string, any>
  }
): Promise<void> {
  const s = await getSettings(db, ['meta_capi_enabled', 'meta_capi_token', 'meta_pixel_id', 'meta_test_event_code'])
  if (s.meta_capi_enabled !== '1' || !s.meta_capi_token || !s.meta_pixel_id) return
  try {
    const userData: Record<string, any> = {
      client_ip_address: params.ip || undefined,
      client_user_agent: params.ua || undefined
    }
    // fbc format per Meta spec: fb.<subdomain_index>.<click_time_seconds>.<fbclid>
    // Prefer the actual click-time captured client-side (fbclidTs); fall back to "now"
    // only if it's missing (e.g. old sessions created before this field existed).
    if (params.fbclid) userData.fbc = `fb.1.${params.fbclidTs || Math.floor(Date.now() / 1000)}.${params.fbclid}`
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
    const resp = await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events`, {
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

export const ORDER_STATUSES = ['new', 'pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'fake', 'manual_review'] as const

export const STATUS_LABELS_BN: Record<string, string> = {
  new: 'নতুন অর্ডার', pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং',
  ready_to_ship: 'শিপমেন্টের জন্য প্রস্তুত', shipped: 'শিপড', out_for_delivery: 'ডেলিভারির পথে',
  delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'রিটার্নড', fake: 'ফেক/সন্দেহজনক', manual_review: 'ম্যানুয়াল রিভিউ'
}
