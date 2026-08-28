# Nature Care Bangladesh — E-Commerce Landing Page + Admin Panel

## Project Overview
- **Name**: Nature Care Bangladesh (webapp)
- **Goal**: প্রিমিয়াম, conversion-focused Bangla e-commerce landing page + সম্পূর্ণ order/courier/profit management system
- **Stack**: Hono + TypeScript + Cloudflare Pages + D1 (SQLite) + TailwindCSS (CDN) + Chart.js

## URLs
- **Sandbox (Dev)**: https://3000-io0pg26tejjrjlxl7g7ky-ecea8f22.sandbox.novita.ai
- **GitHub**: https://github.com/arjumankhan566-4313/Natural-Care-BD
- **Landing Page**: `/`
- **Order Tracking**: `/track-order`
- **Admin Panel**: `/admin` — ডিফল্ট লগইন: `admin` / `admin123` ⚠️ **প্রোডাকশনে অবশ্যই পাসওয়ার্ড পরিবর্তন করুন**
- **Production**: এখনো ডিপ্লয় হয়নি (Cloudflare Pages ready)

## Completed Features (সম্পূর্ণ কার্যকর — শুধু UI নয়)

### Landing Page (Public)
- ✅ Premium mobile-first Bangla landing page (Hind Siliguri ফন্ট)
- ✅ Hero: headline, subheadline, offer price, discount %, CTA (smooth scroll), trust badges
- ✅ **Hero Banner Slider** 🆕: admin-managed multiple banners, auto-slide (configurable seconds), dots + arrows + touch swipe, title/subtitle/link per banner, ব্যানার না থাকলে প্রোডাক্ট ফটো fallback
- ✅ Sticky mobile bottom CTA ("🚚 Cash on Delivery | এখনই অর্ডার করুন")
- ✅ Product section: gallery (multi-image), video, features, benefits, ingredients, usage, stock status
- ✅ Quantity-based packages (১/২/৩ প্যাকেজ) + free delivery flags + badges
- ✅ Countdown timer (admin-controlled, auto fallback offer)
- ✅ Benefits, How It Works (৪ ধাপ), Reviews, FAQ (accordion) — সব admin-managed
- ✅ Smart order form: name, phone (BD validation), alt phone, address, জেলা (৬৪), উপজেলা, note
- ✅ Live subtotal + delivery charge + grand total calculation (server-side verified)
- ✅ Optional OTP verification section (admin toggle)
- ✅ **Incomplete Order Capture** 🆕: কাস্টমার ফর্মে নাম/ফোন লিখলেই ডিবাউন্সড অটোসেভ (১.৫স) + পেজ ছাড়ার সময় সেভ — সাবমিট না করলেও অর্ডার লিড হারায় না
- ✅ Premium order confirmation page with Order ID (#NCB-XXXXX)
- ✅ Call / WhatsApp / Messenger buttons (admin-configurable)

### Tracking & Marketing
- ✅ `/track-order`: Order ID + Phone দিয়ে status + timeline (sensitive data hidden)
- ✅ UTM capture (source/medium/campaign/term/content) + fbclid + campaign/adset/ad ID → saved with order
- ✅ Meta Pixel (admin toggle, event whitelist) + event_id deduplication
- ✅ Server-side Conversions API forwarding (token server-side only, never exposed)
- ✅ Events: PageView, ViewContent, InitiateCheckout, Lead, Purchase (logged in `tracking_events`)
- ✅ GA / GTM / TikTok Pixel injection from settings

### Fraud Protection
- ✅ Risk score (0–100) → 🟢 LOW / 🟡 MEDIUM / 🔴 HIGH per order
- ✅ Signals: cancelled/returned history, duplicate order (30 min), 3+ orders/24h, same-IP multi-phone, short address, OTP bonus, repeat-customer trust bonus
- ✅ High risk → "Manual Review" status; blacklisted → "Fake" status
- ✅ Blacklist / Whitelist per customer

### Admin Panel (`/admin`) — Mobile Responsive SPA
- ✅ Secure session auth (hashed passwords, HttpOnly cookie, 7d expiry, rate-limited login)
- ✅ Roles: super_admin, admin, order_manager, marketing_manager, account_manager, viewer (RBAC per API)
- ✅ **Dashboard**: revenue/profit/loss/ad spend/courier cost/product cost cards + status counts + charts + recent orders + date ranges
- ✅ **Orders**: 12-status tabs with counts, search (ID/phone/name/tracking), filters (risk/date), pagination
- ✅ **Order detail**: full financial breakdown (net sales, all costs, net profit, margin %, ROI %), attribution data, timeline, admin notes, soft delete/restore
- ✅ Status change with confirmation dialog + stock deduct/restore + return charge auto-add
- ✅ **Courier transfer**: Courier A → B with tracking ID, charges, note; full transfer history
- ✅ **Products**: CRUD + packages CRUD + inventory (stock/low/out) + gallery + video
- ✅ **Customers**: aggregate stats, order history by phone, repeat/blacklist/whitelist tabs
- ✅ **Couriers**: unlimited couriers, API credential config screens (Steadfast/Pathao/RedX presets), tracking URL templates, performance stats
- ✅ **Marketing**: ad spend entry (USD→BDT auto-convert), CPO per campaign, per-order ad cost distribution, source/campaign reports, event counts
- ✅ **ইনকমপ্লিট অর্ডার** 🆕 (আলাদা সেকশন): স্ট্যাটাস ট্যাব (ইনকমপ্লিট/যোগাযোগ/কনভার্টেড/বাতিল) + কাউন্ট, সার্চ, বিস্তারিত ভিউ (UTM/fbclid সহ), সরাসরি কল বাটন, এক ক্লিকে কনফার্মড অর্ডারে কনভার্ট (order_source: incomplete_recovery), অর্ডার সাবমিট হলে অটো-কনভার্টেড মার্ক
- ✅ **পিক্সেল সেটাপ** 🆕 (সম্পূর্ণ আলাদা সেকশন): হেলথ চেক (Pixel/CAPI configured+enabled), ৪টি স্ট্যাট কার্ড, Pixel ID/CAPI Token/Test Event Code সেটিংস, **CAPI টেস্ট ইভেন্ট বাটন** (Events Manager-এ লাইভ ভেরিফাই), ইভেন্ট পরিসংখ্যান + সাম্প্রতিক ইভেন্ট লগ, বাংলায় ধাপে-ধাপে সেটাপ গাইড
- ✅ **হিরো ব্যানার ম্যানেজমেন্ট** 🆕 (কনটেন্ট সেকশনে): ব্যানার CRUD, preview, sort, active toggle
- ✅ **Finance**: P&L summary, expense management (8 categories, dual currency), USD rate setting
- ✅ **Analytics**: revenue/profit/ad charts, product profitability, courier performance (success/return rate)
- ✅ **Content**: benefits/reviews/FAQ/page-section builder (add/edit/hide/reorder/delete)
- ✅ **Settings**: brand, hero copy, offer, countdown, delivery charges, currency rate, default costs, fraud rules, Meta Pixel/CAPI, GA/GTM/TikTok, SEO/OG/share — সব DB-driven, কোনো hard-coded content নেই
- ✅ **Users**: admin user CRUD, role assignment, audit log, login history
- ✅ Notifications: 🔔 new order toast (15s polling) + notification center
- ✅ CSV export (UTF-8 BOM): orders, customers, products, expenses, P&L, ad spends
- ✅ Demo data clear button (danger zone)

## Functional API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/public/content` | Landing page data (products, packages, reviews, FAQs, settings, **banners**) |
| POST | `/api/public/orders` | Order submission (server-side pricing + risk scoring, incomplete→converted mark) |
| POST | `/api/public/incomplete` | 🆕 Incomplete order autosave (upsert by session_id, rate-limited) |
| POST | `/api/public/track` | Customer order tracking |
| POST | `/api/public/events` | Pixel event log + CAPI forward (dedup by event_id) |
| POST | `/api/public/otp/request`, `/otp/verify` | OTP flow |
| POST | `/api/auth/login`, `/logout`; GET `/me` | Admin auth |
| CRUD | `/api/admin/orders`, `/products`, `/couriers`, `/customers`, `/content/*`, `/ad-spends`, `/expenses`, `/settings`, `/users` | Admin management |
| GET/PUT/DELETE | `/api/admin/incomplete-orders`, POST `/:id/convert` | 🆕 Incomplete order list/update/delete/convert-to-order |
| GET/PUT | `/api/admin/pixel`, POST `/pixel/test-event` | 🆕 Dedicated pixel settings + health + CAPI test event |
| CRUD | `/api/admin/banners` | 🆕 Hero banner slider management |
| GET | `/api/admin/analytics/{summary,charts,products,couriers,marketing}` | Reports |
| GET | `/api/admin/export/{orders,customers,products,expenses,profit-loss,ad-spends}` | CSV export |

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) — 24 tables
- **Tables**: admin_users, admin_sessions, login_history, products, product_packages, customers, couriers, orders, order_items, order_status_history, courier_transfers, ad_spends, expenses, reviews, faqs, benefits, page_sections, settings, audit_logs, notifications, tracking_events, otp_codes, **incomplete_orders** 🆕, **hero_banners** 🆕
- **Profit formula**: `(subtotal − discount + delivery) − (product + packaging + courier + COD + ad + other cost)` — auto-recalculated on every change
- **Soft delete**: orders/products/couriers recoverable

## External Integrations (Configuration Screens Ready)
এগুলোর জন্য credential দিলেই কাজ করবে — Admin Panel-এ config screen আছে:
- **Meta CAPI**: Settings → Meta Pixel ও Conversions API → token দিন (server-side forwarding built-in ✅)
- **Courier APIs** (Steadfast/Pathao/RedX): Couriers → Edit → API key/secret/merchant ID। Credential ছাড়া manual transfer mode কাজ করে ✅
- **SMS/OTP gateway**: OTP কোড generate হয় ও notification-এ দেখা যায়; SMS প্রোভাইডার credential যোগ করলে auto-send করা যাবে

## Local Development
```bash
cd /home/user/webapp
npm run build
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql
pm2 start ecosystem.config.cjs
curl http://localhost:3000
```

## Deployment (Cloudflare Pages)
```bash
npx wrangler d1 create webapp-production   # copy database_id → wrangler.jsonc
npx wrangler d1 migrations apply webapp-production
npm run build && npx wrangler pages deploy dist --project-name webapp
```

## Production Checklist
1. ⚠️ Admin password পরিবর্তন করুন (`admin/admin123`)
2. Settings → demo data clear করুন
3. Meta Pixel ID + CAPI token দিন
4. Courier API credentials দিন
5. Support phone/WhatsApp আপডেট করুন
6. Real product images/copy দিন

## Status
- **Platform**: Cloudflare Pages (D1) — sandbox-এ সম্পূর্ণ কার্যকর
- **Last Updated**: 2026-08-28 (incomplete orders + pixel section + hero banner slider যোগ হয়েছে)
