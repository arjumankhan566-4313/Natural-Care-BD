import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings } from './helpers'

export type AdminUser = {
  id: number
  username: string
  full_name: string
  role: string
}

// Role hierarchy & permissions
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  admin: ['orders', 'products', 'customers', 'couriers', 'marketing', 'finance', 'analytics', 'content', 'settings', 'export'],
  order_manager: ['orders', 'customers', 'couriers', 'export'],
  marketing_manager: ['marketing', 'analytics', 'content'],
  account_manager: ['finance', 'analytics', 'export'],
  viewer: ['view']
}

export function hasPermission(role: string, perm: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes('*') || perms.includes(perm) || perm === 'view'
}

export async function getSessionUser(c: Context<{ Bindings: Bindings }>): Promise<AdminUser | null> {
  const sessionId = getCookie(c, 'ncb_session')
  if (!sessionId) return null
  const row = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.full_name, u.role FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).bind(sessionId).first<AdminUser>()
  return row || null
}

// Middleware: requires authenticated admin (for API routes -> 401 JSON)
export function requireAuth(permission?: string) {
  return async (c: Context<{ Bindings: Bindings; Variables: { user: AdminUser } }>, next: Next) => {
    const user = await getSessionUser(c as any)
    if (!user) return c.json({ error: 'unauthorized', message: 'লগইন প্রয়োজন' }, 401)
    if (permission && !hasPermission(user.role, permission)) {
      return c.json({ error: 'forbidden', message: 'আপনার এই কাজের অনুমতি নেই' }, 403)
    }
    c.set('user', user)
    await next()
  }
}

// Simple in-memory rate limiter (per isolate)
const rateBuckets = new Map<string, { count: number; reset: number }>()
export function rateLimit(maxReq: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const key = `${c.req.path}:${ip}`
    const now = Date.now()
    let bucket = rateBuckets.get(key)
    if (!bucket || bucket.reset < now) {
      bucket = { count: 0, reset: now + windowMs }
      rateBuckets.set(key, bucket)
    }
    bucket.count++
    if (bucket.count > maxReq) {
      return c.json({ error: 'rate_limited', message: 'অনেক বেশি অনুরোধ। কিছুক্ষণ পর আবার চেষ্টা করুন।' }, 429)
    }
    await next()
  }
}
