import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './lib/helpers'
import { getSettings } from './lib/helpers'
import pub from './routes/public'
import auth from './routes/auth'
import adminOrders from './routes/admin-orders'
import adminCatalog from './routes/admin-catalog'
import adminCustomers from './routes/admin-customers'
import adminFinance from './routes/admin-finance'
import adminSystem from './routes/admin-system'
import adminIncomplete from './routes/admin-incomplete'

const app = new Hono<{ Bindings: Bindings }>()

// Cache-busting version for static JS/CSS — bump on every deploy of frontend assets
const ASSET_V = '6'

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

// ============ API ROUTES ============
app.route('/api/public', pub)
app.route('/api/auth', auth)
app.route('/api/admin/orders', adminOrders)
app.route('/api/admin', adminCatalog)     // /products, /couriers, /content
app.route('/api/admin/customers', adminCustomers)
app.route('/api/admin', adminFinance)     // /ad-spends, /expenses, /analytics
app.route('/api/admin', adminSystem)      // /settings, /users, /audit-logs, /notifications, /export, /poll
app.route('/api/admin', adminIncomplete)  // /incomplete-orders, /pixel, /banners

// ============ LANDING PAGE ============
app.get('/', async (c) => {
  const s = await getSettings(c.env.DB, ['seo_title', 'seo_description', 'seo_keywords', 'og_image', 'canonical_url', 'robots',
    'fb_share_title', 'fb_share_description', 'brand_name', 'meta_pixel_id', 'meta_pixel_enabled', 'ga_id', 'gtm_id', 'tiktok_pixel_id', 'favicon_url'])
  const esc = (t: string) => (t || '').replace(/</g, '&lt;').replace(/"/g, '&quot;')

  const pixelScript = s.meta_pixel_enabled === '1' && s.meta_pixel_id ? `
  <script>
  !function(f,b,e,v,n,t,x){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;x=b.getElementsByTagName(e)[0];x.parentNode.insertBefore(t,x)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${s.meta_pixel_id.replace(/[^0-9]/g, '')}');
  </script>` : ''

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
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="/static/landing.css?v=${ASSET_V}" rel="stylesheet">
${pixelScript}${gaScript}${gtmScript}
</head>
<body class="bg-white text-gray-800" style="font-family:'Hind Siliguri',sans-serif">
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
<script src="https://cdn.tailwindcss.com"></script>
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
<script src="https://cdn.tailwindcss.com"></script>
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
</style>
</head>
<body class="bg-gray-100">
<div id="admin-app"></div>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/admin.js?v=${ASSET_V}"></script>
<script src="/static/admin-views.js?v=${ASSET_V}"></script>
<script src="/static/admin-views2.js?v=${ASSET_V}"></script>
<script src="/static/admin-views3.js?v=${ASSET_V}"></script>
</body>
</html>`)
})

export default app
