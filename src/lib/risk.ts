// ============ Fake order risk scoring ============
import { normalizePhone } from './helpers'

export type RiskResult = {
  score: number
  level: 'low' | 'medium' | 'high'
  reasons: string[]
}

export async function calculateRisk(
  db: D1Database,
  data: { phone: string; address: string; ip: string; otpVerified: boolean }
): Promise<RiskResult> {
  const phone = normalizePhone(data.phone)
  let score = 0
  const reasons: string[] = []

  // Blacklist check
  const customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first<any>()
  if (customer) {
    if (customer.list_status === 'blacklist') {
      score += 80
      reasons.push('Blacklisted customer')
    }
    if (customer.list_status === 'whitelist') {
      return { score: 0, level: 'low', reasons: ['Whitelisted customer'] }
    }
    // Previous cancelled/returned history
    if (customer.cancelled_orders >= 2) { score += 25; reasons.push(`${customer.cancelled_orders} previous cancelled orders`) }
    else if (customer.cancelled_orders === 1) { score += 10; reasons.push('1 previous cancelled order') }
    if (customer.returned_orders >= 2) { score += 25; reasons.push(`${customer.returned_orders} previous returned orders`) }
    else if (customer.returned_orders === 1) { score += 10; reasons.push('1 previous returned order') }
    // Good history reduces risk
    if (customer.delivered_orders >= 2) { score -= 20; reasons.push('Repeat delivered customer (trust bonus)') }
  }

  // Orders in last 24 hours from same phone
  const recent = await db.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE phone = ? AND created_at > datetime('now', '-1 day') AND is_deleted = 0`
  ).bind(phone).first<{ cnt: number }>()
  if ((recent?.cnt || 0) >= 3) { score += 30; reasons.push('3+ orders in 24h from same phone') }
  else if ((recent?.cnt || 0) === 2) { score += 15; reasons.push('Multiple orders in 24h') }

  // Duplicate order within 30 minutes
  const dup = await db.prepare(
    `SELECT COUNT(*) as cnt FROM orders WHERE phone = ? AND created_at > datetime('now', '-30 minutes') AND is_deleted = 0`
  ).bind(phone).first<{ cnt: number }>()
  if ((dup?.cnt || 0) >= 1) { score += 20; reasons.push('Duplicate order within 30 minutes') }

  // Same IP many orders
  if (data.ip && data.ip !== 'unknown') {
    const ipOrders = await db.prepare(
      `SELECT COUNT(DISTINCT phone) as cnt FROM orders WHERE ip_address = ? AND created_at > datetime('now', '-1 day') AND is_deleted = 0`
    ).bind(data.ip).first<{ cnt: number }>()
    if ((ipOrders?.cnt || 0) >= 3) { score += 25; reasons.push('Same IP used with 3+ different phones in 24h') }
  }

  // Very short address
  if ((data.address || '').trim().length < 10) { score += 15; reasons.push('Address too short') }

  // OTP verified reduces risk
  if (data.otpVerified) { score -= 30; reasons.push('OTP verified (trust bonus)') }

  score = Math.max(0, Math.min(100, score))
  const level: RiskResult['level'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return { score, level, reasons }
}
