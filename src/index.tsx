import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './lib/helpers'
import { getSettings, pixelHostLockState, requestHost, effectiveMetaEvents } from './lib/helpers'
import pub from './routes/public'
import auth from './routes/auth'
import adminOrders from './routes/admin-orders'
import adminCatalog from './routes/admin-catalog'
import adminCustomers from './routes/admin-customers'
import adminFinance from './routes/admin-finance'
import adminSystem from './routes/admin-system'
import adminIncomplete from './routes/admin-incomplete'
import adminCourierSync from './routes/admin-courier-sync'
import { runBackground } from './lib/helpers'
import { maybeTriggerLazySync, syncPendingOrders } from './lib/courier-sync'

const app = new Hono<{ Bindings: Bindings }>()

// Cache-busting version for static JS/CSS — bump on every deploy of frontend assets
// Bumped to 22 for the browser-Pixel fix (landing.js event allowlist + base-code PageView).
// /static/* is served with `Cache-Control: public, max-age=31536000, immutable`
// (public/_headers), so browsers NEVER revalidate — without this bump returning visitors
// keep running the old cached landing.js and the fix would not reach them.
const ASSET_V = '22'

// CORS for API routes
app.use('/api/*', cors({ origin: (origin) => origin, credentials: true }))

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'SAMEORIGIN')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})

// Favicon — serves uploaded favicon asset, falls back to bundled logo favicon
app.get('/favicon.ico', async (c) => {
  try {
    const row = await c.env.DB.prepare('SELECT mime, data FROM assets WHERE key = ?').bind('favicon').first<{ mime: string; data: string }>()
    if (row) {
      const bin = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0))
      return new Response(bin, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=3600' } })
    }
  } catch (e) { /* assets table may not exist yet */ }
  return c.redirect('/static/favicon.png', 302)
})

// Uploaded assets (logo / favicon / BSTI certificate) served from D1
app.get('/assets/:key', async (c) => {
  const key = c.req.param('key')
  try {
    const row = await c.env.DB.prepare('SELECT mime, data FROM assets WHERE key = ?').bind(key).first<{ mime: string; data: string }>()
    if (!row) return c.notFound()
    const bin = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0))
    return new Response(bin, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=3600' } })
  } catch (e) {
    return c.notFound()
  }
})

// Steadfast Auto Status Sync — primary trigger is now the real Workers cron
// (`triggers.crons` in wrangler.jsonc → `scheduled` handler at the bottom of this file).
// This "lazy" middleware is kept as a safety net (e.g. `wrangler dev` without
// --test-scheduled, or if the cron ever misfires): every admin API request cheaply checks
// "has 5 minutes passed since the last global sync?" and, if so, kicks off a background
// batch via runBackground() (executionCtx.waitUntil) without adding latency. The atomic
// courier_sync_lock guarantees cron + lazy trigger never run two batches at once.
app.use('/api/admin/*', async (c, next) => {
  await next()
  runBackground(c, maybeTriggerLazySync(c.env.DB))
})

// ============ API ROUTES ============
app.route('/api/public', pub)
app.route('/api/auth', auth)
app.route('/api/admin/orders', adminOrders)
app.route('/api/admin', adminCatalog)     // /products, /couriers, /content
app.route('/api/admin/customers', adminCustomers)
app.route('/api/admin', adminFinance)     // /ad-spends, /expenses, /analytics
app.route('/api/admin', adminSystem)      // /settings, /users, /audit-logs, /notifications, /export, /poll
app.route('/api/admin', adminIncomplete)  // /incomplete-orders, /pixel, /banners
app.route('/api/admin/courier-sync', adminCourierSync) // /sync-now/:orderId, /dashboard-stats

// ============ LANDING PAGE ============
app.get('/', async (c) => {
  const s = await getSettings(c.env.DB, ['seo_title', 'seo_description', 'seo_keywords', 'og_image', 'canonical_url', 'robots',
    'fb_share_title', 'fb_share_description', 'brand_name', 'brand_tagline', 'brand_logo', 'meta_pixel_id', 'meta_pixel_enabled',
    'meta_events_enabled', 'ga_id', 'gtm_id', 'tiktok_pixel_id', 'favicon_url', 'custom_font_family'])
  const esc = (t: string) => (t || '').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const customFont = (s.custom_font_family || '').trim()
  const fontFamilyCss = customFont ? `'${customFont.replace(/'/g, '')}', 'Hind Siliguri', sans-serif` : `'Hind Siliguri', sans-serif`
  const customFontLink = customFont
    ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(customFont).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap" rel="stylesheet">`
    : ''

  // PIXEL HOST LOCK (anti-pollution guard): only render the browser Pixel base code when
  // the request's host is on the production allowlist (meta_pixel_allowed_hosts, default:
  // naturalcarebangladesh.shop + natural-care-bd.pages.dev + local dev). This stops old
  // abandoned dev-sandbox copies of this app (still running with the same Pixel ID in
  // their own DB) from firing un-deduplicated junk into the production Meta dataset —
  // the root cause of Meta's "events not deduplicated" diagnostics. GA/GTM/TikTok stay
  // as-is (no dedup semantics to protect there).
  const hostLock = await pixelHostLockState(c.env.DB, requestHost(c))

  // Should the base snippet itself fire PageView? Only when PageView is in the admin's
  // browser-event allowlist. effectiveMetaEvents() treats a missing/blank setting as "all
  // standard events" (it was previously unset in production, which is what silenced the
  // browser pixel entirely) so this is true unless the admin deliberately opted out.
  const basePageView = effectiveMetaEvents(s.meta_events_enabled).split(',').includes('PageView')

  const pixelScript = (s.meta_pixel_enabled || '').trim() === '1' && (s.meta_pixel_id || '').trim() && hostLock.allowed ? `
  <script>
  !function(f,b,e,v,n,t,x){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;x=b.getElementsByTagName(e)[0];x.parentNode.insertBefore(t,x)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${s.meta_pixel_id.replace(/[^0-9]/g, '')}');${basePageView ? `
  // PageView belongs in the BASE code (Meta's standard placement, and what Events Manager
  // checks when it verifies the pixel is installed). It is fired exactly ONCE per page
  // load, here — public/static/landing.js no longer fires a second browser PageView.
  // window.NCB_PV_ID is the SAME event_id landing.js sends to /api/public/events, so the
  // server-side CAPI PageView deduplicates against this browser one instead of counting
  // twice. Without a shared event_id Meta cannot pair them and flags the dataset with
  // "PageView events are not deduplicated".
  window.NCB_PV_ID = 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  fbq('track', 'PageView', {}, { eventID: window.NCB_PV_ID });` : ''}
  </script>${basePageView ? `
  <noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${s.meta_pixel_id.replace(/[^0-9]/g, '')}&ev=PageView&noscript=1"></noscript>` : ''}` : ''

  const gaScript = s.ga_id ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(s.ga_id)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${esc(s.ga_id)}');</script>` : ''

  const gtmScript = s.gtm_id ? `
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(s.gtm_id)}');</script>` : ''

  return c.html(`<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(s.seo_title || 'Nature Care Bangladesh')}</title>
<meta name="description" content="${esc(s.seo_description || '')}">
<meta name="keywords" content="${esc(s.seo_keywords || '')}">
<meta name="robots" content="${esc(s.robots || 'index, follow')}">
${s.canonical_url ? `<link rel="canonical" href="${esc(s.canonical_url)}">` : ''}
<link rel="icon" type="image/png" href="${esc(s.favicon_url || '/static/favicon.png')}">
<link rel="apple-touch-icon" href="${esc(s.favicon_url || '/static/logo-small.png')}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(s.fb_share_title || s.seo_title || '')}">
<meta property="og:description" content="${esc(s.fb_share_description || s.seo_description || '')}">
${s.og_image ? `<meta property="og:image" content="${esc(s.og_image)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="/static/tailwind.css?v=${ASSET_V}" as="style">
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
${customFontLink}
<link href="/static/tailwind.css?v=${ASSET_V}" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="/static/landing.css?v=${ASSET_V}" rel="stylesheet">
${pixelScript}${gaScript}${gtmScript}
<style>body{font-family:${fontFamilyCss}}</style>
<script>
window.applySiteFont = function (fam) {
  var styleEl = document.getElementById('dyn-font-style');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dyn-font-style'; document.head.appendChild(styleEl); }
  styleEl.textContent = fam ? "body{font-family:'" + fam + "','Hind Siliguri',sans-serif}" : "body{font-family:'Hind Siliguri',sans-serif}";
};
</script>
</head>
<body class="bg-white text-gray-800">
<div id="site-splash">
  <div class="splash-aurora"></div>
  <div class="splash-grid"></div>
  <div class="splash-particles"><span></span><span></span><span></span><span></span><span></span><span></span></div>
  <div class="splash-content">
    <div class="splash-ring-wrap">
      <div class="splash-ring splash-ring-1"></div>
      <div class="splash-ring splash-ring-2"></div>
      <div class="splash-logo-wrap">${s.brand_logo ? `<img src="${esc(s.brand_logo)}" alt="logo">` : `<i class="fas fa-leaf" style="font-size:34px;color:#059669"></i>`}<div class="splash-shine"></div></div>
    </div>
    <div class="splash-brand-mask"><div class="splash-brand-name">${esc(s.brand_name || 'Nature Care Bangladesh')}</div></div>
    <div class="splash-divider"></div>
    <div class="splash-tagline">${esc(s.brand_tagline || 'প্রাকৃতিক যত্নে সুস্থ জীবন')}</div>
    <div class="splash-progress-wrap">
      <div class="splash-progress-track"><div class="splash-progress-fill" id="splash-progress-fill"></div></div>
      <div class="splash-progress-pct" id="splash-progress-pct">0%</div>
    </div>
  </div>
</div>
<div id="app"><div class="min-h-screen flex items-center justify-center"><div class="text-center"><div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p class="text-gray-500">লোড হচ্ছে...</p></div></div></div>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/landing.js?v=${ASSET_V}"></script>
</body>
</html>`)
})

// ============ TRACK ORDER PAGE ============
app.get('/track-order', async (c) => {
  const s = await getSettings(c.env.DB, ['brand_name', 'support_phone', 'favicon_url'])
  return c.html(`<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>অর্ডার ট্র্যাক করুন — ${(s.brand_name || 'Nature Care Bangladesh').replace(/</g, '&lt;')}</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" href="${(s as any).favicon_url || '/static/favicon.png'}">
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="/static/tailwind.css?v=${ASSET_V}" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50" style="font-family:'Hind Siliguri',sans-serif">
<div id="track-app"></div>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script>window.SUPPORT_PHONE=${JSON.stringify(s.support_phone || '')};</script>
<script src="/static/track.js?v=${ASSET_V}"></script>
</body>
</html>`)
})

// ============ ADMIN PANEL ============
app.get('/admin', async (c) => {
  const s = await getSettings(c.env.DB, ['brand_logo', 'favicon_url', 'brand_name']).catch(() => ({} as Record<string, string>))
  return c.html(`<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel — ${(s.brand_name || 'Nature Care Bangladesh').replace(/</g, '&lt;')}</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="${s.favicon_url || '/static/favicon.png'}">
<script>window.BRAND_LOGO=${JSON.stringify(s.brand_logo || '/static/logo-small.png')};window.BRAND_NAME=${JSON.stringify(s.brand_name || 'Nature Care Bangladesh')};</script>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="/static/tailwind.css?v=${ASSET_V}" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
body{font-family:'Hind Siliguri',sans-serif}
.sidebar-link.active{background:#065f46;color:#fff}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
.modal-backdrop{background:rgba(0,0,0,0.5)}
table{font-size:0.875rem}
.toast-enter{animation:slideIn .3s ease}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.skeleton{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
/* ===== ADMIN SPLASH — PREMIUM ENTERPRISE INTRO (matches landing page) ===== */
#admin-splash{position:fixed;inset:0;z-index:99999;background:#052e22;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
#admin-splash.splash-hide{animation:adminIrisOut .7s cubic-bezier(.76,0,.24,1) forwards;pointer-events:none}
@keyframes adminIrisOut{0%{clip-path:circle(140% at 50% 50%)}100%{clip-path:circle(0% at 50% 50%)}}
.admin-splash-aurora{position:absolute;inset:-20%;z-index:0;background:radial-gradient(circle at 22% 25%,rgba(16,185,129,.55) 0%,transparent 45%),radial-gradient(circle at 80% 22%,rgba(5,150,105,.5) 0%,transparent 50%),radial-gradient(circle at 50% 85%,rgba(4,120,87,.6) 0%,transparent 50%);filter:blur(10px);animation:adminAuroraDrift 8s ease-in-out infinite alternate}
@keyframes adminAuroraDrift{0%{transform:translate(0,0) scale(1) rotate(0)}50%{transform:translate(-2%,2%) scale(1.1) rotate(6deg)}100%{transform:translate(2%,-2%) scale(1.04) rotate(-5deg)}}
.admin-splash-grid{position:absolute;inset:0;z-index:1;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);background-size:38px 38px;mask-image:radial-gradient(circle at 50% 42%,rgba(0,0,0,1) 0%,transparent 68%)}
.admin-splash-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center}
.admin-ring-wrap{position:relative;width:100px;height:100px;display:flex;align-items:center;justify-content:center}
.admin-ring{position:absolute;border-radius:50%;border:1.5px solid rgba(167,243,208,.55);animation:adminRingPulse 2.4s cubic-bezier(.2,.7,.3,1) infinite}
.admin-ring:nth-child(2){animation-delay:1s}
@keyframes adminRingPulse{0%{transform:scale(.72);opacity:0}25%{opacity:.8}100%{transform:scale(1.5);opacity:0}}
.admin-splash-logo{position:relative;width:78px;height:78px;border-radius:22px;background:linear-gradient(155deg,#fff 0%,#f0fdf4 100%);padding:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.15),0 16px 40px rgba(0,0,0,.35),0 0 26px rgba(16,185,129,.35);animation:adminLogoPop .95s cubic-bezier(.22,1.4,.36,1) both;transform-style:preserve-3d}
.admin-splash-logo img{width:100%;height:100%;object-fit:contain}
@keyframes adminLogoPop{0%{transform:scale(.2) rotateY(90deg);opacity:0}55%{transform:scale(1.08) rotateY(-8deg);opacity:1}100%{transform:scale(1) rotateY(0);opacity:1}}
.admin-shine{position:absolute;top:0;left:-60%;width:45%;height:100%;background:linear-gradient(115deg,transparent 0,rgba(255,255,255,.85) 50%,transparent 100%);transform:skewX(-18deg);animation:adminShineSweep 1.8s ease-in-out .9s 1}
@keyframes adminShineSweep{0%{left:-60%}35%{left:130%}100%{left:130%}}
.admin-splash-name-mask{margin-top:22px;overflow:hidden;padding:0 20px;max-width:92vw}
.admin-splash-name{display:inline-block;color:#fff;font-weight:800;font-size:1.35rem;letter-spacing:.02em;transform:translateY(115%);animation:adminNameWipe .8s cubic-bezier(.16,1,.3,1) .48s forwards;text-shadow:0 2px 16px rgba(0,0,0,.25)}
@keyframes adminNameWipe{to{transform:translateY(0)}}
.admin-splash-divider{margin-top:10px;height:2px;width:0;border-radius:2px;background:linear-gradient(90deg,transparent,#6ee7b7,#fff,#6ee7b7,transparent);box-shadow:0 0 8px rgba(110,231,183,.7);animation:adminDividerGrow .6s ease .9s forwards}
@keyframes adminDividerGrow{to{width:110px}}
.admin-splash-sub{margin-top:10px;color:#a7f3d0;font-size:.78rem;opacity:0;letter-spacing:.3em;text-transform:uppercase;animation:adminTaglineTrack .85s ease 1s forwards;text-align:center;padding:0 16px}
@keyframes adminTaglineTrack{0%{opacity:0;letter-spacing:.55em}100%{opacity:1;letter-spacing:.18em}}
.admin-splash-progress-wrap{margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:7px;opacity:0;animation:adminSubReveal .55s ease 1.15s forwards}
@keyframes adminSubReveal{to{opacity:1}}
.admin-splash-bar{width:150px;height:3px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}
.admin-splash-bar-fill{height:100%;width:0%;border-radius:3px;background:linear-gradient(90deg,#34d399,#a7f3d0);box-shadow:0 0 8px rgba(110,231,183,.8);transition:width .25s ease-out}
.admin-splash-pct{font-size:.65rem;color:rgba(255,255,255,.65);letter-spacing:.1em;font-weight:600;font-variant-numeric:tabular-nums}
.admin-view-in{animation:adminViewIn .35s ease both}
@keyframes adminViewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.count-up-num{display:inline-block}
.kpi-card-in{animation:kpiCardIn .45s ease both}
@keyframes kpiCardIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
/* ===== ENTERPRISE DASHBOARD 3D ===== */
.card3d{transform-style:preserve-3d;transition:transform .18s ease-out,box-shadow .25s ease;will-change:transform}
.card3d:hover{box-shadow:0 18px 40px -12px rgba(6,78,59,.22),0 4px 12px rgba(0,0,0,.06)}
.kpi-hero{box-shadow:0 8px 24px -8px rgba(0,0,0,.28);position:relative}
.kpi-hero .kpi-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--gx,70%) var(--gy,20%),rgba(255,255,255,.22) 0%,transparent 55%);transition:opacity .2s}
.kpi-hero .kpi-ico{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);display:inline-flex;align-items:center;justify-content:center;font-size:.95rem;backdrop-filter:blur(4px);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.kpi-hero::after{content:'';position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(115deg,transparent 0,rgba(255,255,255,.18) 50%,transparent 100%);transform:skewX(-18deg);animation:kpiHeroShine 5.5s ease-in-out infinite}
@keyframes kpiHeroShine{0%,68%{left:-70%}88%,100%{left:140%}}
.dash-command-bar{background:linear-gradient(120deg,#064e3b 0%,#065f46 55%,#047857 100%);box-shadow:0 8px 24px -10px rgba(6,78,59,.5);position:relative;overflow:hidden}
.dash-command-bar::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:26px 26px;pointer-events:none;mask-image:linear-gradient(115deg,rgba(0,0,0,.9),transparent 75%)}
.stat-mini .stat-ico{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.stat-mini:hover .stat-ico{transform:scale(1.14) rotateY(14deg)}
.funnel-fill-anim{animation:funnelGrow 1s cubic-bezier(.22,1,.36,1) both;transform-origin:left}
@keyframes funnelGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
</style>
</head>
<body class="bg-gray-100">
<div id="admin-splash">
  <div class="admin-splash-aurora"></div>
  <div class="admin-splash-grid"></div>
  <div class="admin-splash-content">
    <div class="admin-ring-wrap">
      <div class="admin-ring"></div>
      <div class="admin-ring"></div>
      <div class="admin-splash-logo">${s.brand_logo ? `<img src="${(s.brand_logo || '').replace(/"/g, '&quot;')}" alt="logo">` : `<i class="fas fa-leaf" style="font-size:30px;color:#059669"></i>`}<div class="admin-shine"></div></div>
    </div>
    <div class="admin-splash-name-mask"><div class="admin-splash-name">${(s.brand_name || 'Nature Care Bangladesh').replace(/</g, '&lt;')}</div></div>
    <div class="admin-splash-divider"></div>
    <div class="admin-splash-sub">অ্যাডমিন প্যানেল লোড হচ্ছে</div>
    <div class="admin-splash-progress-wrap">
      <div class="admin-splash-bar"><div class="admin-splash-bar-fill" id="admin-splash-bar-fill"></div></div>
      <div class="admin-splash-pct" id="admin-splash-pct">0%</div>
    </div>
  </div>
</div>
<div id="admin-app"></div>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/admin.js?v=${ASSET_V}"></script>
<script src="/static/admin-views.js?v=${ASSET_V}"></script>
<script src="/static/admin-views2.js?v=${ASSET_V}"></script>
<script src="/static/admin-views3.js?v=${ASSET_V}"></script>
</body>
</html>`)
})

// ============ CLOUDFLARE WORKERS EXPORTS ============
// Real cron (wrangler.jsonc → triggers.crons = "*/5 * * * *"): Steadfast auto status sync.
// syncPendingOrders() takes the atomic courier_sync_lock, so an overlapping lazy-trigger run
// from the admin middleware is skipped safely.
const scheduled: ExportedHandlerScheduledHandler<Bindings> = (event, env, ctx) => {
  ctx.waitUntil(
    syncPendingOrders(env.DB)
      .then((r) => console.log(`[cron ${event.cron}] steadfast sync: ${JSON.stringify(r)}`))
      .catch((e) => console.error(`[cron ${event.cron}] steadfast sync failed:`, e))
  )
}

export default {
  fetch: app.fetch,
  scheduled
} satisfies ExportedHandler<Bindings>
