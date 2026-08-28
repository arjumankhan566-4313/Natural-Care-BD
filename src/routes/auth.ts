// ============ Admin authentication ============
import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import type { Bindings } from '../lib/helpers'
import { hashPassword, generateToken, auditLog } from '../lib/helpers'
import { getSessionUser, rateLimit } from '../lib/auth'

const auth = new Hono<{ Bindings: Bindings }>()

auth.post('/login', rateLimit(10, 60_000), async (c) => {
  const db = c.env.DB
  const { username, password } = await c.req.json().catch(() => ({}))
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const ua = (c.req.header('user-agent') || '').slice(0, 300)

  if (!username || !password) return c.json({ error: 'validation', message: 'ইউজারনেম ও পাসওয়ার্ড দিন' }, 400)

  const user = await db.prepare('SELECT * FROM admin_users WHERE username = ? AND is_active = 1').bind(String(username).trim()).first<any>()
  const hash = await hashPassword(String(password))

  if (!user || user.password_hash !== hash) {
    await db.prepare('INSERT INTO login_history (user_id, username, success, ip_address, user_agent) VALUES (?, ?, 0, ?, ?)')
      .bind(user?.id || null, String(username).trim(), ip, ua).run()
    return c.json({ error: 'invalid_credentials', message: 'ভুল ইউজারনেম বা পাসওয়ার্ড' }, 401)
  }

  const sessionId = generateToken(32)
  await db.prepare(`INSERT INTO admin_sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, datetime('now', '+7 days'), ?, ?)`)
    .bind(sessionId, user.id, ip, ua).run()
  await db.prepare('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
  await db.prepare('INSERT INTO login_history (user_id, username, success, ip_address, user_agent) VALUES (?, ?, 1, ?, ?)')
    .bind(user.id, user.username, ip, ua).run()
  await auditLog(db, user.id, user.username, 'login', 'session', sessionId.slice(0, 8), 'Successful login', ip)

  setCookie(c, 'ncb_session', sessionId, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 7 * 24 * 3600
  })

  return c.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } })
})

auth.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'ncb_session')
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run()
  }
  deleteCookie(c, 'ncb_session', { path: '/' })
  return c.json({ success: true })
})

auth.get('/me', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ user })
})

export default auth
