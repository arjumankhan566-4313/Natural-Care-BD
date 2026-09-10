// ============ Shared helpers ============
import type { Context } from 'hono'

export type Bindings = {
  DB: D1Database
  /** Workers Static Assets (wrangler.jsonc → assets.binding). Files in ./public are served
   *  directly by Cloudflare before the Worker runs; this binding lets server code fetch them
   *  too (e.g. env.ASSETS.fetch(new URL('/static/logo.png', c.req.url))). */
  ASSETS: Fetcher
}

const SALT = 'ncb_salt_2026'

// Meta Graph API version used for every server-side Conversions API (CAPI) call
// (`POST graph.facebook.com/<version>/<pixel_id>/events`). Meta deprecates each
// Graph API version ~2 years after release and recommends v22.0+ ("update your base
// URL to v22.0 or higher"); v21.0 (Jul 2024) is scheduled to deprecate Jan 2027.
// Centralizing the version here means it only ever has to be bumped in ONE place
// (both forwardToCapi() and the admin CAPI test event use it) instead of hunting
// string literals across files.
export const META_GRAPH_API_VERSION = 'v22.0'

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

// Meta customer-information normalization. Email/name/location values are lowercased
// and whitespace is removed; phone values keep digits only and are expected to include
// a country code before hashing. The helper is deliberately reusable for every supported
// PII field instead of maintaining one-off hashing rules per event.
export function normalizeMetaCustomerValue(value: unknown, field: MetaCustomerField): string {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (field === 'ph') return raw.replace(/[^0-9]/g, '')
  if (field === 'db') return raw.replace(/[^0-9]/g, '')
  return raw.replace(/\s+/g, '')
}

export type MetaCustomerField = 'em' | 'ph' | 'fn' | 'ln' | 'ct' | 'st' | 'zp' | 'db'

export async function hashMetaCustomerValue(value: unknown, field: MetaCustomerField): Promise<string | undefined> {
  const normalized = normalizeMetaCustomerValue(value, field)
  return normalized ? sha256Hex(normalized) : undefined
}

export async function hashMetaCustomerValues(values: Partial<Record<MetaCustomerField, unknown>>): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {}
  for (const field of ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'db'] as MetaCustomerField[]) {
    const hashed = await hashMetaCustomerValue(values[field], field)
    if (hashed) result[field] = [hashed]
  }
  return result
}

function firstForwardedIp(value: string | undefined): string {
  return (value || '').split(',')[0]?.trim() || ''
}

export function requestClientIp(headers: { get(name: string): string | null }): string {
  return firstForwardedIp(headers.get('cf-connecting-ip') || undefined) ||
    firstForwardedIp(headers.get('x-forwarded-for') || undefined) ||
    firstForwardedIp(headers.get('x-real-ip') || undefined) || 'unknown'
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

// ============ Meta browser-Pixel event allowlist ============
// WHY THIS EXISTS (root cause of "server events Processed, browser sends nothing"):
// `meta_events_enabled` is the ONLY gate on the browser side — public/static/landing.js
// calls window.fbq('track', ...) exclusively for event names present in this list. The
// server-side CAPI path (forwardToCapi) never consults it. So whenever this setting is
// ABSENT (it was only ever seeded by seed.sql, which the production deploy pipeline never
// runs — .github/workflows/deploy.yml applies migrations only) or saved EMPTY (the admin
// Pixel form prefilled nothing, so pressing "সংরক্ষণ" persisted ''), the browser pixel went
// completely silent for every event while CAPI kept sending all of them.
// These constants + effectiveMetaEvents() make "unset" mean "all standard events" on BOTH
// sides, so the browser and the server can never disagree again.
export const META_EVENT_NAMES = ['PageView', 'ViewContent', 'InitiateCheckout', 'Lead', 'Purchase'] as const
export type MetaEventName = typeof META_EVENT_NAMES[number]
export const DEFAULT_META_EVENTS = META_EVENT_NAMES.join(',')

export function isMetaEventName(value: unknown): value is MetaEventName {
  return typeof value === 'string' && (META_EVENT_NAMES as readonly string[]).includes(value)
}

// Normalize a raw meta_events_enabled value into a clean comma list. Falls back to the
// full standard list when the stored value is missing/blank/whitespace/garbage, and drops
// unknown event names (a typo like "Pageview" must not silently disable the real one).
// Unknown-name filtering keeps the list honest; the fallback guarantees non-empty output.
export function effectiveMetaEvents(value?: string | null): string {
  const cleaned = String(value ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const known = cleaned.filter(x => (META_EVENT_NAMES as readonly string[]).includes(x))
  return known.length ? known.join(',') : DEFAULT_META_EVENTS
}

// Normalize an on/off flag to a canonical '1' / '0' — FAIL-OPEN.
// The admin form is a free-text "1/0" box, so the realistic inputs are '1', '0', 'true',
// 'on', 'yes' … or (most commonly) blank / garbage. Anything that is NOT an explicit OFF
// is treated as ON, because the historical footgun was: migration 0009 seeded
// `meta_pixel_enabled = '0'`, the browser-Pixel gate required it to be exactly '1', so a
// shop that had set the Pixel ID + events (and had CAPI working via its own toggle) still
// fired ZERO browser events. Fail-open means the browser Pixel can never be silently
// switched off by a blank/typo'd value — only an explicit '0' (or false/off/no/disabled)
// disables it.
export function normalizeEnabledFlag(value?: string | null): string {
  const v = String(value ?? '').trim().toLowerCase()
  if (['0', 'false', 'off', 'no', 'n', 'disabled'].includes(v)) return '0'
  return '1'
}

// Normalize pixel/CAPI keys on every admin save path (Pixel page AND general Settings).
// Without this, saving Settings could re-store "https://shop/" in the allowlist and kill
// the browser Pixel, or persist "1 " so meta_pixel_enabled === '1' fails.
export function normalizeTrackingSetting(key: string, value: string): string {
  let v = String(value ?? '').trim()
  if (key === 'meta_pixel_id') v = v.replace(/[^0-9]/g, '')
  if (key === 'meta_pixel_allowed_hosts') {
    v = v.split(',').map(sanitizePixelHost).filter(Boolean).join(',')
  }
  // Fail-open the browser-Pixel toggle: only explicit OFF values store '0'; everything
  // else (blank / '1' / 'true' / 'on') stores '1'. This keeps the browser and server
  // gates in lock-step and stops a blank save from silencing the browser Pixel while
  // CAPI keeps running.
  if (key === 'meta_pixel_enabled') {
    v = normalizeEnabledFlag(v)
  }
  // Blank/typo-only input must NEVER be stored as an empty list — that is exactly the
  // state that switches the browser pixel off while CAPI keeps running. Fall back to the
  // full standard list instead (effectiveMetaEvents never returns '').
  if (key === 'meta_events_enabled') {
    v = effectiveMetaEvents(v)
  }
  return v
}

export function requestHost(c: Context<any>): string {
  return (c.req.header('host') || (() => { try { return new URL(c.req.url).host } catch { return '' } })() || '').split(',')[0].trim()
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

// ============ Meta Pixel host lock (anti-pollution guard) ============
// WHY: the same Meta Pixel (dataset) was receiving events from EVERY host that ran a copy
// of this app — the production domain, the pages.dev URL, AND old abandoned dev-sandbox
// copies (e.g. the previous AI platform's sandbox URL) still running OLDER code with the
// same Pixel ID + CAPI token in their own local DB. Those zombie copies sent un-deduplicated
// PageView/ViewContent/InitiateCheckout junk straight into the production dataset, which is
// exactly what Meta's "Event from the server are not deduplicated" diagnostics flag.
//
// HOW: a single admin setting (meta_pixel_host_lock, default ON) restricts both the browser
// Pixel base-code rendering and every server-side CAPI send to an allowlist of hosts
// (meta_pixel_allowed_hosts, with a safe default covering production + local dev). A copy of
// this app running on any OTHER host silently stops touching the production Pixel.
//
// `workers.dev` is included because the Worker's own URL is `natural-care-bd.<sub>.workers.dev`
// (the account subdomain is a random string we can't hardcode). Subdomain matching means the
// entry `workers.dev` covers ANY *.workers.dev host — which is safe here: the host lock exists
// to stop OTHER copies of this app (novita.ai sandboxes, stray preview tunnels) from polluting
// the dataset, and those never live on workers.dev.
export const DEFAULT_PIXEL_ALLOWED_HOSTS = 'naturalcarebangladesh.shop,natural-care-bd.pages.dev,localhost,127.0.0.1,workers.dev'

// Strip protocol, path, query, hash, port and surrounding whitespace/quotes so an admin
// paste like "https://naturalcarebangladesh.shop/" still matches request host
// "naturalcarebangladesh.shop". Host lock stays ON — this only makes the allowlist robust.
export function sanitizePixelHost(raw: string): string {
  let v = (raw || '').trim().toLowerCase().replace(/^["']+|["']+$/g, '')
  if (!v) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(v) || /[/?#]/.test(v)) {
    try {
      v = new URL(v.includes('://') ? v : `https://${v}`).hostname
    } catch {
      v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('?')[0].split('#')[0]
    }
  }
  return v.replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '').trim()
}

// host is allowed if it EXACTLY matches an allowlist entry OR is a SUBDOMAIN of one
// (e.g. <preview-hash>.natural-care-bd.pages.dev matches entry "natural-care-bd.pages.dev").
export function isPixelHostAllowed(host: string, allowedList: string): boolean {
  const h = sanitizePixelHost(host)
  if (!h) return false
  const entries = (allowedList || DEFAULT_PIXEL_ALLOWED_HOSTS).split(',').map(sanitizePixelHost).filter(Boolean)
  return entries.some(e => h === e || h.endsWith('.' + e))
}

// Central decision used by BOTH the pixel base-code renderer (index.tsx) and forwardToCapi().
// Returns the effective allowlist string as well, so callers can stay in sync.
export async function pixelHostLockState(db: D1Database, requestHost: string): Promise<{ allowed: boolean; lock: boolean; allowList: string }> {
  const s = await getSettings(db, ['meta_pixel_host_lock', 'meta_pixel_allowed_hosts'])
  const lock = (s.meta_pixel_host_lock || '1').trim() !== '0' // default ON (absent setting = protected)
  const allowList = (s.meta_pixel_allowed_hosts || '').trim() || DEFAULT_PIXEL_ALLOWED_HOSTS
  return { allowed: !lock || isPixelHostAllowed(requestHost, allowList), lock, allowList }
}

// ============ Meta event identity + commerce payload helpers ============
// Meta compares event name + event ID byte-for-byte. Never trim, lowercase, uppercase or
// truncate an ID on only one side of the browser/CAPI pair: even a one-character difference
// prevents deduplication. This validator rejects malformed input instead of silently changing
// it. The 512-character ceiling is an application abuse guard; IDs generated by this app are
// UUID/hex values far below it.
declare const normalizedMetaEventIdBrand: unique symbol
export type NormalizedMetaEventId = string & { readonly [normalizedMetaEventIdBrand]: true }

export function isValidMetaEventId(value: unknown): value is NormalizedMetaEventId {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
}

export type MetaEventIdResolution = Readonly<{
  eventId: NormalizedMetaEventId
  usedFallback: boolean
  reason: 'valid' | 'missing' | 'invalid'
}>

// Runtime safety net for old clients or untyped integrations. Internal TypeScript callers
// still MUST provide eventId, while this function guarantees a valid ID if runtime input is
// missing/corrupt. The normalized ID must be resolved BEFORE either Pixel or CAPI fires.
export function resolveMetaEventId(value: unknown, eventName: MetaEventName): MetaEventIdResolution {
  if (isValidMetaEventId(value)) return { eventId: value, usedFallback: false, reason: 'valid' }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const random = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    eventId: `${eventName.toLowerCase()}_recovered_${random}` as NormalizedMetaEventId,
    usedFallback: true,
    reason: value === undefined || value === null || value === '' ? 'missing' : 'invalid'
  }
}

declare const normalizedMetaFbcBrand: unique symbol
export type NormalizedMetaFbc = string & { readonly [normalizedMetaFbcBrand]: true }

export type ParsedMetaFbc = {
  raw: NormalizedMetaFbc
  subdomainIndex: string
  creationTime: string
  clickId: string
}

// ClickID is case-sensitive and is a pass-through identifier. Validate it, but never
// normalize it. In particular, do NOT call toLowerCase()/toUpperCase(), hash it, or slice it.
export function isValidMetaClickId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024 &&
    !/[\u0000-\u0020\u007f]/.test(value)
}

// Parse only Meta's documented `fb.<subdomainIndex>.<milliseconds>.<fbclid>` shape.
// Returning `raw` lets the caller forward a valid browser cookie byte-for-byte.
export function parseMetaFbc(value: unknown): ParsedMetaFbc | undefined {
  if (typeof value !== 'string' || value.length > 1200) return undefined
  const match = /^fb\.(\d+)\.(\d{13})\.(.+)$/.exec(value)
  if (!match || !isValidMetaClickId(match[3])) return undefined
  return { raw: value as NormalizedMetaFbc, subdomainIndex: match[1], creationTime: match[2], clickId: match[3] }
}

// Resolve the exact fbc value to send to CAPI.
// 1) Prefer a valid real _fbc cookie when it contains the current fbclid exactly.
// 2) If a newer URL fbclid is present, rebuild fbc with that ID unchanged (case included).
// 3) If no URL fbclid is available, pass a valid cookie through unchanged.
// Invalid values are omitted rather than "fixed" by truncating/lowercasing them.
export function resolveMetaFbc(
  cookieFbc?: string | null,
  fbclid?: string | null,
  fbclidTimestamp?: string | null,
  now = Date.now()
): NormalizedMetaFbc | undefined {
  const parsedCookie = parseMetaFbc(cookieFbc)
  const currentClickId = isValidMetaClickId(fbclid) ? fbclid : undefined

  if (!currentClickId) return parsedCookie?.raw
  if (parsedCookie?.clickId === currentClickId) return parsedCookie.raw

  const observedAt = Number(fbclidTimestamp)
  const nowMs = Math.trunc(now)
  const hasValidObservedAt = Number.isInteger(observedAt) && /^\d{13}$/.test(String(fbclidTimestamp || '')) &&
    observedAt > 0 && observedAt <= nowMs + 5 * 60_000

  // A different valid cookie may come from a newer ad click in another tab. The JSON body
  // can still contain an older sessionStorage fbclid, so compare first-seen timestamps and
  // keep the latest identifier. Without this check an old tab could overwrite a newer fbc.
  if (parsedCookie && (!hasValidObservedAt || Number(parsedCookie.creationTime) > observedAt)) {
    return parsedCookie.raw
  }

  // Meta requires milliseconds. Repair only the timestamp when needed; the case-sensitive
  // ClickID itself is copied byte-for-byte.
  const creationTime = hasValidObservedAt ? observedAt : nowMs
  return `fb.1.${creationTime}.${currentClickId}` as NormalizedMetaFbc
}

// `fbc` is a REQUIRED key in every normalized event contract, but its value is nullable.
// Organic visitors legitimately have no Meta click ID; inventing one would corrupt
// attribution. This design makes callers handle the field explicitly without fabricating it.
export type MetaAttributionIdentity = Readonly<{
  eventId: NormalizedMetaEventId
  fbc: NormalizedMetaFbc | null
}>

export type MetaPurchaseLineItem = Readonly<{
  product_id: string | number
  quantity: number
  unit_price: number
}>

// Purchase value is intentionally non-optional. Removing it from any internal CAPI call is a
// TypeScript compile error (also protected by tests/meta-contract.type-test.ts).
export type MetaPurchaseData = Readonly<{
  value: number
  currency: string
  content_ids: readonly string[]
  content_type: 'product'
  contents: ReadonlyArray<Readonly<{ id: string; quantity: number; item_price: number }>>
  order_id: string
  delivery_category: 'home_delivery'
}>

export type MetaPurchaseBuildResult = Readonly<{
  data: MetaPurchaseData
  usedFallback: boolean
  issues: readonly string[]
}>

function roundMetaMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function isMetaPurchaseData(value: unknown): value is MetaPurchaseData {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0) return false
  if (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)) return false
  if (typeof v.order_id !== 'string' || !v.order_id) return false
  if (v.delivery_category !== 'home_delivery') return false
  if (v.content_type !== 'product' || !Array.isArray(v.content_ids) || !v.content_ids.length ||
      !v.content_ids.every(id => typeof id === 'string' && id.length > 0)) return false
  const contentIds = v.content_ids as string[]
  if (!Array.isArray(v.contents) || !v.contents.length) return false
  const validContents = v.contents.every((raw) => {
    if (!raw || typeof raw !== 'object') return false
    const item = raw as Record<string, unknown>
    return typeof item.id === 'string' && item.id.length > 0 &&
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 &&
      typeof item.item_price === 'number' && Number.isFinite(item.item_price) && item.item_price >= 0
  })
  if (!validContents) return false
  const itemIds = [...new Set(v.contents.map(raw => (raw as Record<string, unknown>).id as string))]
  return itemIds.length === contentIds.length && itemIds.every((id, index) => id === contentIds[index])
}

// Build Purchase custom_data once on the trusted server, then reuse the exact object for the
// CAPI request and browser Pixel. This normalizer is deliberately non-throwing: corrupt
// runtime input falls back to valid item totals/placeholders and emits issues for monitoring.
function sameMetaPurchaseData(left: MetaPurchaseData, right: MetaPurchaseData): boolean {
  if (left.value !== right.value || left.currency !== right.currency || left.order_id !== right.order_id ||
      left.content_type !== right.content_type || left.delivery_category !== right.delivery_category) return false
  if (left.content_ids.length !== right.content_ids.length ||
      left.content_ids.some((id, index) => id !== right.content_ids[index])) return false
  if (left.contents.length !== right.contents.length) return false
  return left.contents.every((item, index) => {
    const other = right.contents[index]
    return Boolean(other) && item.id === other.id && item.quantity === other.quantity && item.item_price === other.item_price
  })
}

export function buildMetaPurchaseDataResult(
  grandTotal: number,
  orderId: string,
  items: readonly MetaPurchaseLineItem[],
  currency = 'BDT'
): MetaPurchaseBuildResult {
  const issues: string[] = []
  const contents: Array<{ id: string; quantity: number; item_price: number }> = []

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.product_id ?? '')
    const quantity = Number(item?.quantity)
    const itemPrice = Number(item?.unit_price)
    if (!id || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(itemPrice) || itemPrice < 0) {
      issues.push('invalid_item')
      continue
    }
    contents.push({ id, quantity, item_price: roundMetaMoney(itemPrice) })
  }

  if (!contents.length) {
    issues.push('missing_items')
    contents.push({ id: 'unknown', quantity: 1, item_price: 0 })
  }

  const itemTotal = contents.reduce((sum, item) => sum + item.quantity * item.item_price, 0)
  const numericGrandTotal = Number(grandTotal)
  const value = Number.isFinite(numericGrandTotal) && numericGrandTotal >= 0
    ? roundMetaMoney(numericGrandTotal)
    : roundMetaMoney(itemTotal)
  if (!Number.isFinite(numericGrandTotal) || numericGrandTotal < 0) issues.push('price_from_item_total')

  const safeOrderId = typeof orderId === 'string' && orderId.trim() ? orderId : `recovered_${Date.now()}`
  if (safeOrderId !== orderId) issues.push('missing_order_id')
  const safeCurrency = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'BDT'
  if (safeCurrency !== currency) issues.push('invalid_currency')

  return {
    data: {
      value,
      currency: safeCurrency,
      content_ids: [...new Set(contents.map(item => item.id))],
      content_type: 'product',
      contents,
      order_id: safeOrderId,
      delivery_category: 'home_delivery'
    },
    usedFallback: issues.length > 0,
    issues
  }
}

export function buildMetaPurchaseData(
  grandTotal: number,
  orderId: string,
  items: readonly MetaPurchaseLineItem[],
  currency = 'BDT'
): MetaPurchaseData {
  return buildMetaPurchaseDataResult(grandTotal, orderId, items, currency).data
}

export type MetaCapiBaseEvent<N extends MetaEventName, D extends Record<string, unknown>> =
  MetaAttributionIdentity & Readonly<{
    eventName: N
    customData: D
    sourceUrl?: string
    ip?: string
    ua?: string
    fbclid?: string
    fbclidTs?: string
    fbp?: string
    customerName?: string
    customerPhone?: string
    customerEmail?: string
    customerCity?: string
    customerState?: string
    customerZip?: string
    customerDob?: string
    externalId?: string
    requestHost?: string
  }>

export type MetaCapiPurchaseEvent = MetaCapiBaseEvent<'Purchase', MetaPurchaseData>
export type MetaCapiStandardEvent = MetaCapiBaseEvent<Exclude<MetaEventName, 'Purchase'>, Record<string, unknown>>
export type MetaCapiEvent = MetaCapiPurchaseEvent | MetaCapiStandardEvent

export type TrackingDiagnosticSeverity = 'info' | 'warning' | 'critical'
export type TrackingDiagnosticCode =
  | 'EVENT_ID_FALLBACK'
  | 'PURCHASE_DATA_FALLBACK'
  | 'FBC_MISSING_WITH_FBCLID'
  | 'FBC_INVALID'
  | 'CAPI_HTTP_ERROR'
  | 'CAPI_EXCEPTION'
  | 'HOST_LOCK_BLOCKED'

export type TrackingDiagnostic = Readonly<{
  severity: TrackingDiagnosticSeverity
  code: TrackingDiagnosticCode
  source: 'browser_report' | 'order_api' | 'capi' | 'admin_recovery'
  eventName?: MetaEventName
  eventId?: string
  details?: Record<string, unknown>
}>

let trackingDiagnosticsSchemaReady = false

// Deployment safety net: GitHub/Cloudflare can deploy Worker code before the separate D1
// migration command runs (or a repository may not have Cloudflare API secrets configured).
// Migrations 0012/0013 remain canonical, but this idempotent bootstrap guarantees the first
// warning is still persisted instead of being lost during a rolling/misconfigured deploy.
export async function ensureTrackingDiagnosticsSchema(db: D1Database): Promise<void> {
  if (trackingDiagnosticsSchemaReady) return
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tracking_diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      code TEXT NOT NULL,
      source TEXT NOT NULL,
      event_name TEXT,
      event_id TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_created
      ON tracking_diagnostics(created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_code_created
      ON tracking_diagnostics(code, created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_event_id
      ON tracking_diagnostics(event_id)`),
    db.prepare(`DELETE FROM tracking_diagnostics
      WHERE event_id IS NOT NULL AND id NOT IN (
        SELECT MAX(id) FROM tracking_diagnostics WHERE event_id IS NOT NULL
        GROUP BY source, code, event_id
      )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_diagnostics_event_code_source
      ON tracking_diagnostics(source, code, event_id) WHERE event_id IS NOT NULL`),
    db.prepare(`CREATE TRIGGER IF NOT EXISTS trg_tracking_diagnostics_retention
      AFTER INSERT ON tracking_diagnostics BEGIN
        DELETE FROM tracking_diagnostics WHERE created_at < datetime('now', '-90 days');
      END`)
  ])
  trackingDiagnosticsSchemaReady = true
}

// Persistent + real-time monitoring. Console output is visible in Cloudflare Workers Logs;
// D1 persistence powers the Admin Pixel health panel. Never pass PII or access tokens here.
export async function logTrackingDiagnostic(db: D1Database, diagnostic: TrackingDiagnostic): Promise<void> {
  const safe = {
    severity: diagnostic.severity,
    code: diagnostic.code,
    source: diagnostic.source,
    event_name: diagnostic.eventName || null,
    event_id: isValidMetaEventId(diagnostic.eventId) ? diagnostic.eventId : null,
    details: diagnostic.details || {}
  }
  let detailsJson = '{}'
  try { detailsJson = JSON.stringify(safe.details).slice(0, 2000) } catch { detailsJson = '{"serialization_error":true}' }
  // Serialization/logging must never throw and interrupt an actual customer event.
  try {
    console.warn(`[MetaTracking][${safe.severity}][${safe.code}] ${JSON.stringify({
      severity: safe.severity, code: safe.code, source: safe.source,
      event_name: safe.event_name, event_id: safe.event_id, details: detailsJson
    })}`)
  } catch {}
  try {
    await ensureTrackingDiagnosticsSchema(db)
  } catch (error: any) {
    console.warn(`[MetaTracking][DIAGNOSTIC_SCHEMA_BOOTSTRAP_FAILED] ${String(error?.message || error)}`)
  }
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO tracking_diagnostics (severity, code, source, event_name, event_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(safe.severity, safe.code, safe.source, safe.event_name, safe.event_id, detailsJson).run()
  } catch (error: any) {
    // Migration may not have run yet during a rolling deployment; monitoring itself must
    // never break or drop a customer event.
    console.warn(`[MetaTracking][DIAGNOSTIC_PERSIST_FAILED] ${String(error?.message || error)}`)
  }
}

// Recover authoritative Purchase data from the order first, then current catalog price.
// This is a runtime safety net; normal typed call sites already provide MetaPurchaseData.
export async function recoverMetaPurchaseData(
  db: D1Database,
  candidate: unknown,
  eventId: NormalizedMetaEventId
): Promise<{ data: MetaPurchaseData; source: 'provided' | 'order' | 'catalog' | 'emergency' }> {
  const provided = isMetaPurchaseData(candidate) ? candidate : null
  const raw = candidate && typeof candidate === 'object' ? candidate as Record<string, any> : {}
  const candidateOrderId = typeof raw.order_id === 'string' ? raw.order_id : ''
  try {
    const order = await db.prepare(
      `SELECT id, order_number, grand_total FROM orders
       WHERE event_id = ? OR (? != '' AND order_number = ?)
       ORDER BY CASE WHEN event_id = ? THEN 0 ELSE 1 END LIMIT 1`
    ).bind(eventId, candidateOrderId, candidateOrderId, eventId).first<any>()
    if (order) {
      const items = await db.prepare(
        'SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = ? ORDER BY id'
      ).bind(order.id).all<MetaPurchaseLineItem>()
      const authoritative = buildMetaPurchaseData(Number(order.grand_total), String(order.order_number), items.results || [])
      return provided && sameMetaPurchaseData(provided, authoritative)
        ? { data: provided, source: 'provided' }
        : { data: authoritative, source: 'order' }
    }

    // A valid third-party Purchase may not map to an order in this app. Preserve it rather
    // than substituting an unrelated catalog item; malformed/missing data continues below.
    if (provided) return { data: provided, source: 'provided' }

    const requestedId = Array.isArray(raw.content_ids) && raw.content_ids[0] != null
      ? String(raw.content_ids[0])
      : (Array.isArray(raw.contents) && raw.contents[0]?.id != null ? String(raw.contents[0].id) : '')
    const product = requestedId
      ? await db.prepare(`SELECT id, sale_price FROM products WHERE CAST(id AS TEXT) = ? AND is_active = 1 AND is_deleted = 0 LIMIT 1`).bind(requestedId).first<any>()
      : await db.prepare(`SELECT id, sale_price FROM products WHERE is_active = 1 AND is_deleted = 0 ORDER BY is_featured DESC, sort_order, id LIMIT 1`).first<any>()
    if (product) {
      const quantity = Number(raw.contents?.[0]?.quantity)
      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
      const unitPrice = Number(product.sale_price) || 0
      return {
        data: buildMetaPurchaseData(unitPrice * safeQuantity, candidateOrderId || `recovered_${eventId}`, [{
          product_id: product.id, quantity: safeQuantity, unit_price: unitPrice
        }]),
        source: 'catalog'
      }
    }
  } catch (error: any) {
    console.warn(`[MetaTracking][PURCHASE_RECOVERY_QUERY_FAILED] ${String(error?.message || error)}`)
    if (provided) return { data: provided, source: 'provided' }
  }

  const candidateValue = Number(raw.value)
  return {
    data: buildMetaPurchaseData(
      Number.isFinite(candidateValue) && candidateValue >= 0 ? candidateValue : 0,
      candidateOrderId || `recovered_${eventId}`,
      [{ product_id: raw.content_ids?.[0] || 'unknown', quantity: 1, unit_price: Number.isFinite(candidateValue) ? candidateValue : 0 }],
      typeof raw.currency === 'string' ? raw.currency : 'BDT'
    ),
    source: 'emergency'
  }
}

// Forward a tracking event to Meta Conversions API directly from the server.
// Used both for the guaranteed server-side Purchase send (at order-creation time,
// independent of whether the customer's browser ever calls /api/public/events)
// and for the client-triggered /events endpoint (PageView, ViewContent, etc).
export async function forwardToCapi(
  db: D1Database,
  params: MetaCapiEvent
): Promise<void> {
  const s = await getSettings(db, ['meta_capi_enabled', 'meta_capi_token', 'meta_pixel_id', 'meta_test_event_code', 'meta_advanced_matching'])
  if ((s.meta_capi_enabled || '').trim() !== '1' || !(s.meta_capi_token || '').trim() || !(s.meta_pixel_id || '').trim()) return

  // Runtime fallback protects calls arriving from old JS/untyped integrations. TypeScript
  // still requires eventId at build time. The effective ID below is used consistently for
  // the payload, logs and DB update.
  const idResolution = resolveMetaEventId(params.eventId, params.eventName)
  const eventId = idResolution.eventId
  if (idResolution.usedFallback) {
    await logTrackingDiagnostic(db, {
      severity: 'critical', code: 'EVENT_ID_FALLBACK', source: 'capi',
      eventName: params.eventName, eventId,
      details: { reason: idResolution.reason }
    })
  }
  // Host lock — never let a copy of this app running on a non-production host (old dev
  // sandboxes, preview/staging copies with their own DB but the same Pixel ID) pollute the
  // production Meta dataset with un-deduplicated events. requestHost comes from the server
  // request itself (not spoofable); sourceUrl is only informational.
  if (params.requestHost) {
    const lockState = await pixelHostLockState(db, params.requestHost)
    if (!lockState.allowed) {
      await db.prepare('UPDATE tracking_events SET capi_response = ? WHERE event_id = ?')
        .bind(`skipped: host "${params.requestHost}" not in meta_pixel_allowed_hosts`, eventId).run().catch(() => {})
      await logTrackingDiagnostic(db, {
        severity: 'warning', code: 'HOST_LOCK_BLOCKED', source: 'capi',
        eventName: params.eventName, eventId,
        details: { request_host: params.requestHost }
      })
      return
    }
  }
  try {
    const userData: Record<string, any> = {
      client_ip_address: params.ip || undefined,
      client_user_agent: params.ua || undefined
    }
    // fbp = Facebook Browser ID cookie (_fbp), set automatically by the Pixel SDK. This is
    // one of the strongest matching signals (identity anchor) — send it exactly as read
    // from the browser cookie, never modify/reconstruct it. Reject control characters or an
    // abusive size instead of slicing, because one-sided truncation changes an identifier.
    if (typeof params.fbp === 'string' && params.fbp.length <= 1200 &&
        !/[\u0000-\u0020\u007f]/.test(params.fbp)) {
      userData.fbp = params.fbp
    }
    // fbc = Facebook Click ID. resolveMetaFbc() validates the real _fbc cookie, checks it
    // against the latest URL fbclid using a CASE-SENSITIVE comparison, and only reconstructs
    // it as a fallback. It never hashes, lowercases, uppercases, trims or truncates fbclid.
    const resolvedFbc = resolveMetaFbc(params.fbc, params.fbclid, params.fbclidTs)
    if (resolvedFbc) userData.fbc = resolvedFbc
    if (params.fbc && !parseMetaFbc(params.fbc)) {
      await logTrackingDiagnostic(db, {
        severity: 'warning', code: 'FBC_INVALID', source: 'capi',
        eventName: params.eventName, eventId,
        details: { fbc_present: true, fbclid_present: Boolean(params.fbclid) }
      })
    }
    if (params.fbclid && !resolvedFbc) {
      await logTrackingDiagnostic(db, {
        severity: 'warning', code: 'FBC_MISSING_WITH_FBCLID', source: 'capi',
        eventName: params.eventName, eventId,
        details: { fbc_present: Boolean(params.fbc), fbclid_present: true }
      })
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
    if (params.externalId) userData.external_id = [await sha256Hex(params.externalId)]
    // Advanced Matching (ph/fn) — required by Meta ads booster for higher match quality.
    // Both fields must be SHA-256 hashed per Meta CAPI spec (unlike the browser Pixel,
    // which auto-hashes plain text passed to fbq('init', ..., {ph, fn})).
    // ph must include the 880 country code, digits only, no leading zero.
    if (s.meta_advanced_matching === '1') {
      const nameParts = (params.customerName || '').trim().split(/\s+/).filter(Boolean)
      const hashedPii = await hashMetaCustomerValues({
        em: params.customerEmail,
        ph: toMetaPhone(params.customerPhone || ''),
        fn: nameParts[0],
        ln: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
        ct: params.customerCity,
        st: params.customerState,
        zp: params.customerZip,
        db: params.customerDob
      })
      Object.assign(userData, hashedPii)
    }

    let customData: Record<string, unknown> = params.customData
    if (params.eventName === 'Purchase') {
      const recovered = await recoverMetaPurchaseData(db, params.customData, eventId)
      customData = recovered.data as unknown as Record<string, unknown>
      if (recovered.source !== 'provided') {
        await logTrackingDiagnostic(db, {
          severity: recovered.source === 'emergency' ? 'critical' : 'warning',
          code: 'PURCHASE_DATA_FALLBACK', source: 'capi',
          eventName: 'Purchase', eventId,
          details: { recovery_source: recovered.source }
        })
      }
    }

    const payload: any = {
      data: [{
        event_name: params.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: params.sourceUrl || '',
        user_data: userData,
        custom_data: customData
      }],
      access_token: s.meta_capi_token
    }
    const testCode = (s.meta_test_event_code || '').trim()
    if (testCode) payload.test_event_code = testCode
    const pixelId = s.meta_pixel_id.replace(/[^0-9]/g, '')
    const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const txt = await resp.text()
    await db.prepare('UPDATE tracking_events SET sent_to_capi = ?, capi_response = ? WHERE event_id = ?')
      .bind(resp.ok ? 1 : 0, txt.slice(0, 500), eventId).run()
    if (!resp.ok) {
      await logTrackingDiagnostic(db, {
        severity: 'critical', code: 'CAPI_HTTP_ERROR', source: 'capi',
        eventName: params.eventName, eventId,
        details: { http_status: resp.status, response: txt.slice(0, 300) }
      })
    }
  } catch (e: any) {
    await db.prepare('UPDATE tracking_events SET capi_response = ? WHERE event_id = ?')
      .bind(`error: ${e.message}`.slice(0, 500), eventId).run().catch(() => {})
    await logTrackingDiagnostic(db, {
      severity: 'critical', code: 'CAPI_EXCEPTION', source: 'capi',
      eventName: params.eventName, eventId,
      details: { message: String(e?.message || e).slice(0, 300) }
    })
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
