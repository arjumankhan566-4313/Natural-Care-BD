# Nature Care Bangladesh — E-Commerce Landing Page + Admin Panel

## Project Overview
- **Name**: Nature Care Bangladesh (webapp)
- **Goal**: প্রিমিয়াম, conversion-focused Bangla e-commerce landing page + সম্পূর্ণ order/courier/profit management system
- **Stack**: Hono + TypeScript + Cloudflare Pages + D1 (SQLite) + TailwindCSS (CDN) + Chart.js

## URLs
- **Production (Live)**: https://naturalcarebangladesh.shop (কাস্টম ডোমেইন) / https://natural-care-bd.pages.dev
- **Sandbox (Dev)**: https://3000-iuwkt82gn1267zz4zum3h-de59bda9.sandbox.novita.ai
- **GitHub**: https://github.com/arjumankhan566-4313/Natural-Care-BD
- **Landing Page**: `/`
- **Order Tracking**: `/track-order`
- **Admin Panel**: `/admin` — লগইন: `arjumankhan566@gmail.com` (পাসওয়ার্ড admin panel মালিকের কাছে)
- **Deployment**: ✅ Cloudflare Pages (project: `natural-care-bd`, D1: `natural-care-bd-production`) — Last deployed: 2026-09-01 (অর্ডার ফর্ম: নাম/ঠিকানা/জেলা/উপজেলা কঠোর ভ্যালিডেশন — জাংক ডেটা দিয়ে অর্ডার সাবমিট ব্লক)

### ল্যান্ডিং পেজ অর্ডার ফর্ম: নাম/ঠিকানা/জেলা/উপজেলা কঠোর ভ্যালিডেশন (2026-09-01) 🆕
- ✅ **সমস্যা**: অর্ডার ফর্মে নাম, ফোন নাম্বার, এড্রেস, জেলা, থানা/উপজেলা ফিল্ডে ভুলভাল বা অর্থহীন (garbage) টেক্সট দিয়ে অর্ডার সাবমিট করা যেত — যেমন এক অক্ষরের নাম, র‍্যান্ডম টাইপ করা ঠিকানা, বা বাস্তবে নেই এমন জেলার নাম।
- ✅ **সমাধান**: এখন প্রতিটি ফিল্ড সঠিকভাবে পূরণ না হলে অর্ডার সাবমিট **ব্লক** হয়ে যাবে — ফিল্ডের নিচে নির্দিষ্ট বাংলা এরর মেসেজ দেখানো হবে।
  - **নাম**: কমপক্ষে ২ শব্দ (প্রথম নাম + শেষ নাম), শুধু বাংলা/ইংরেজি অক্ষর, ৩–১০০ ক্যারেক্টার, একই অক্ষর ৪+ বার পুনরাবৃত্তি হলে (যেমন "aaaa") রিজেক্ট।
  - **ফোন নাম্বার**: বিদ্যমান বাংলাদেশি মোবাইল ফরম্যাট চেক (`01XXXXXXXXX`) অপরিবর্তিত, শুধু ফ্রন্টএন্ডেও হার্ড-গেট করা হয়েছে।
  - **এড্রেস**: কমপক্ষে ১৫ ক্যারেক্টার, একই অক্ষরের পুনরাবৃত্তি বা অতি-কম ইউনিক ক্যারেক্টার (যেমন "asdfasdfasdf") রিজেক্ট, সংখ্যা না থাকলে কমপক্ষে ৩ শব্দ লাগবে (বাসা/রোড/এলাকা বোঝানোর জন্য)।
  - **জেলা**: ফ্রি-টেক্সট ইনপুট (আগের মতোই, `datalist` সাজেশন সহ) কিন্তু সাবমিট করা মান বাংলাদেশের বৈধ ৬৪টি জেলার একটির সাথে মিলতে হবে (স্পেস/কেস ইনসেনসিটিভ, এবং ইংরেজি নাম যেমন "Dhaka"/"Chittagong" ও গ্রহণযোগ্য — অটোমেটিক বাংলা জেলার নামে রূপান্তরিত হয়)। না মিললে "সঠিক জেলার নাম লিখুন" এরর দেখাবে।
  - **উপজেলা/থানা**: ফরম্যাট-ভিত্তিক চেক (অক্ষর সংখ্যা, রিপিটেড ক্যারেক্টার, ইউনিক ক্যারেক্টার) — উপজেলার কোনো exhaustive তালিকার বিরুদ্ধে ম্যাচ করা হয় না (যেহেতু উপজেলা তালিকা জেলার চেয়ে অনেক বড় ও কম স্ট্যান্ডার্ডাইজড), কিন্তু "aaaa"-এর মতো জাংক টেক্সট রিজেক্ট হবে।
- ✅ **সার্ভার-সাইড আসল গেট**: `src/lib/helpers.ts`-এ নতুন শেয়ারড ভ্যালিডেটর ফাংশন (`validCustomerName`, `validAddress`, `validUpazila`, `resolveDistrict`, `BD_DISTRICTS`) — `src/routes/public.ts`-এর `/api/public/orders` এন্ডপয়েন্টে ব্যবহৃত হয়, প্রতিটি ভুল ফিল্ডের জন্য আলাদা বাংলা মেসেজ সহ `400` রেসপন্স দেয়। এটাই real security gate — ব্রাউজার JS বাইপাস করলেও সার্ভার কখনো garbage ডেটা accept করবে না।
- ✅ **ক্লায়েন্ট-সাইড UX**: `public/static/landing.js`-এ সার্ভারের একই লজিকের মিরর কপি — টাইপ করার সময়/ব্লার হলে ইনস্ট্যান্ট রিয়েল-টাইম ফিডব্যাক (লাল বর্ডার + ফিল্ডের নিচে এরর টেক্সট), সাবমিট করার আগে সব ফিল্ড আবার চেক করে প্রথম ভুল ফিল্ডে স্মূথ স্ক্রল করে।
- ✅ ঢাকা/ঢাকার বাইরের ডেলিভারি চার্জ লজিক (`isDhaka` regex) অপরিবর্তিত এবং সঠিকভাবে কাজ করে যেহেতু জেলা এখন সবসময় ক্যানোনিকাল বাংলা নামে (যেমন "ঢাকা") রূপান্তরিত হয়ে সংরক্ষিত হয়।
- ✅ Meta Pixel/CAPI event ID ফ্লো, ইনকমপ্লিট অর্ডার অটোসেভ, রিস্ক স্কোরিং — সবকিছু অপরিবর্তিত ও পুরোপুরি কার্যকর (টেস্ট করে যাচাই করা হয়েছে)।
- ✅ টেস্ট করা হয়েছে: ১-অক্ষরের নাম রিজেক্ট, জাংক এড্রেস/জেলা/উপজেলা একসাথে রিজেক্ট (আলাদা মেসেজ সহ), সম্পূর্ণ বৈধ ডেটায় অর্ডার সফল (সঠিক ঢাকা ডেলিভারি চার্জ ৭০ টাকা সহ), ইংরেজি/স্পেস/কেস-মিক্সড জেলা ইনপুট ("  DHAKA  ") সঠিকভাবে "ঢাকা"-তে রিজলভ হয়ে অর্ডার সফল।

### ল্যান্ডিং পেজ অর্ডার ফর্ম: জেলা ফিল্ড ফ্রি-টেক্সট (2026-08-31) 🆕
- ✅ অর্ডার ফর্মে "জেলা" ফিল্ড আগে ড্রপডাউন (`<select>`) ছিল, যেখানে তালিকা থেকে বেছে নেওয়া বাধ্যতামূলক ছিল। এখন এটি সাধারণ টেক্সট ইনপুট — কাস্টমার শুধু জেলার নাম টাইপ করে দিতে পারবেন, নির্বাচন করার দরকার নেই।
- ✅ টাইপ করার সময় সুবিধার জন্য একটি `datalist` (৬৪ জেলার তালিকা) যুক্ত আছে — এটি ঐচ্ছিক অটোকমপ্লিট সাজেশন মাত্র, কোনোভাবেই বাধ্যতামূলক সিলেকশন না (উপজেলা/থানা ফিল্ড আগে থেকেই এভাবে ফ্রি-টেক্সট ছিল, জেলাও এখন একই রকম আচরণ করে)।
- ✅ ব্যাকএন্ড (`src/routes/public.ts`) আগে থেকেই জেলাকে শুধু trimmed স্ট্রিং হিসেবে সংরক্ষণ করত (শুধু খালি-কিনা চেক করত) — তাই ব্যাকএন্ডে কোনো পরিবর্তন লাগেনি।
- ✅ ঢাকা/ঢাকার বাইরের ডেলিভারি চার্জ নির্ধারণের লজিক (`isDhaka`) আগে exact-match স্ট্রিং তুলনা করত (`district === 'ঢাকা'`), এখন case-insensitive regex (`/ঢাকা|dhaka/i`) ব্যবহার করে — যেহেতু ফ্রি-টেক্সট ইনপুটে ব্যবহারকারী ভিন্নভাবে (স্পেস/কেস) লিখতে পারেন, তাই এই পরিবর্তনটা প্রয়োজনীয় ছিল।

### Steadfast Auto Status Sync (2026-08-31) 🆕
- ✅ **স্বয়ংক্রিয় কুরিয়ার স্ট্যাটাস সিঙ্ক**: Steadfast-এ ট্রান্সফার হওয়া প্রতিটি অর্ডারের ডেলিভারি স্ট্যাটাস (pending/delivered/cancelled/hold ইত্যাদি — Steadfast-এর ১১টি অফিসিয়াল স্ট্যাটাসের একটি) এখন প্রতি ৫ মিনিটে অটোমেটিক চেক হয় এবং পরিবর্তন হলে সাথে সাথে আমাদের DB-তে আপডেট হয় — **admin থেকে ম্যানুয়ালি কিছু পরিবর্তন করা লাগে না**।
- ⚙️ **টেকনিক্যাল নোট**: Cloudflare Pages hosted-deploy-এ real cron (`triggers`) সাপোর্ট নেই, তাই একটি "lazy catch-up sync" প্যাটার্ন ব্যবহার করা হয়েছে — প্রতিটি admin API রিকোয়েস্ট চেক করে শেষ গ্লোবাল সিঙ্ক কতক্ষণ আগে হয়েছে, ৫ মিনিট পার হয়ে গেলে ব্যাকগ্রাউন্ডে (`waitUntil`) একটি ব্যাচ সিঙ্ক ট্রিগার হয় — অ্যাডমিন প্যানেল লগইন থাকা অবস্থায় ব্যবহারিকভাবে এটি রিয়েল ৫-মিনিট ইন্টারভালের মতোই কাজ করে।
- ✅ Steadfast API লুকআপ প্রায়োরিটি: `consignment_id` → `invoice` → `tracking_code` (fallback chain সহ)।
- ✅ অর্ডার-ডিটেইল পেজে (কুরিয়ার কার্ড): লাইভ স্ট্যাটাস ব্যাজ, শেষ সিঙ্ক টাইম, "✓ Automatic" ইঙ্গিত, **"🔄 Sync Now"** ম্যানুয়াল রিফ্রেশ বাটন (admin কখনো স্ট্যাটাস টাইপ/সিলেক্ট করতে পারবে না — মান সবসময় Steadfast API থেকেই আসে), এবং **কুরিয়ার স্ট্যাটাস হিস্ট্রি টাইমলাইন** (`courier_status_logs` থেকে অটোমেটিক জেনারেটেড)।
- ✅ অর্ডার-ডিটেইল ভিউ খোলা থাকলে প্রতি ২০ সেকেন্ডে সাইলেন্ট পোল হয় — শুধু কুরিয়ার কার্ড/হিস্ট্রি অংশ আপডেট হয়, পুরো পেজ রিলোড হয় না।
- ✅ ড্যাশবোর্ডে নতুন **"Steadfast অটো সিঙ্ক"** উইজেট: Active Courier Orders / Synced Successfully / Sync Errors / Last Global Sync + স্ট্যাটাস ব্রেকডাউন — সব real DB count থেকে, hardcoded না।
- ✅ এরর হ্যান্ডলিং: API ফেইল হলে বিদ্যমান valid স্ট্যাটাস কখনো overwrite হয় না; error message + attempt counter সংরক্ষিত হয়; পরের সাইকেলে আবার রিট্রাই হয়।
- ✅ দুই সিঙ্ক ব্যাচ একসাথে চলা প্রতিরোধে single-row DB lock (`courier_sync_lock`, ২ মিনিট stale-timeout)।
- ✅ বিদ্যমান "Transfer to Steadfast" ফ্লো, `consignment_id`/`tracking_id` ফিল্ড, Steadfast auth/config — সবকিছু অপরিবর্তিত/পুনঃব্যবহৃত, নতুন করে ডুপ্লিকেট ইন্টিগ্রেশন তৈরি হয়নি।
- **নতুন DB ফিল্ড/টেবিল** (`migrations/0008_courier_auto_sync.sql`, প্রোডাকশনে অ্যাপ্লাই করা হয়েছে): `orders.courier_status`, `courier_status_label`, `courier_last_synced_at`, `courier_sync_error`, `courier_sync_attempts`; নতুন টেবিল `courier_status_logs`, `courier_sync_lock`।
- **নতুন API**: `POST /api/admin/courier-sync/sync-now/:orderId`, `GET /api/admin/courier-sync/dashboard-stats`; `GET /api/admin/orders/:id` রেসপন্সে এখন `courierLogs` অ্যারে যুক্ত।
- ✅ **আপডেট (একই দিনে, দ্বিতীয় দফা ফিক্স)**: প্রোডাকশনে ব্যবহারকারীর রিপোর্ট করা ২টি সমস্যা ধরা পড়ে ও ঠিক করা হয়েছে —
  1. **ডুপ্লিকেট স্ট্যাটাস হিস্ট্রি বাগ**: একই স্ট্যাটাসে ৪টি করে ডুপ্লিকেট এন্ট্রি হচ্ছিল — কারণ ছিল lock/status-change চেক SELECT-then-UPDATE (non-atomic) হওয়ায় দুইটি concurrent সিঙ্ক রিকোয়েস্ট একসাথে "changed" দেখে ফেলছিল। এখন lock গ্রহণ এবং status-change ডিটেকশন — দুটোই একটিমাত্র atomic conditional `UPDATE ... WHERE ...` স্টেটমেন্ট দিয়ে করা হয় (D1 নিজে থেকেই writes সিরিয়ালাইজ করে), তাই একসাথে ৫টি রিকোয়েস্ট পাঠালেও এখন গ্যারান্টিড ঠিক ১টি লগ রো তৈরি হয়। ৫টি concurrent সিঙ্ক রিকোয়েস্ট দিয়ে টেস্ট করে নিশ্চিত করা হয়েছে (স্থানীয়ভাবে মক Steadfast API দিয়ে)।
  2. **মূল অর্ডার স্ট্যাটাস (যেমন "কনফার্মড") অটো-আপডেট হচ্ছিল না**: ব্যবহারকারী আশা করেছিলেন Steadfast-এর real-time প্রোগ্রেস দেখে মূল `orders.status` ফিল্ডও (যেটা admin panel-এর উপরে বড় ব্যাজ ও ড্রপডাউনে দেখানো হয়) নিজে থেকেই এগিয়ে যাবে — শুধু আলাদা `courier_status` ফিল্ডই না। এখন `deriveOrderStatus()` ফাংশন Steadfast-এর নিরাপদ/স্পষ্ট স্ট্যাটাসগুলোকে মূল অর্ডার লাইফসাইকেলে ম্যাপ করে: `in_review`/`hold`/`pending` → `shipped`, `delivered_approval_pending` → `out_for_delivery`, `delivered` → `delivered`, `cancelled` → `cancelled`। এই অটো-আপডেট মূল ম্যানুয়াল স্ট্যাটাস-পরিবর্তন বাটনের মতোই সব side-effect (স্টক অ্যাডজাস্ট, প্রফিট রিক্যালকুলেশন, কাস্টমার স্ট্যাটস, অডিট লগ, নোটিফিকেশন, ডেলিভারি SMS) চালায়, শুধু `changed_by = "Steadfast (Auto)"` হিসেবে হিস্ট্রিতে দেখা যায়। **কখনো পেছনে যায় না, এবং cancelled/returned/fake/manual_review-এ যদি admin ইতিমধ্যে ম্যানুয়ালি সেট করে থাকে তাহলে সেটাকে ওভাররাইট করে না** — `partial_delivered`/`unknown`-এর মতো দ্ব্যর্থক স্ট্যাটাসগুলো ইচ্ছাকৃতভাবে ম্যাপ করা হয়নি, মানুষের রিভিউয়ের জন্য রাখা হয়েছে। অর্ডার-ডিটেইল পেজের ২০ সেকেন্ড পোলিং এখন মূল status পরিবর্তনও ডিটেক্ট করে পুরো ভিউ রিফ্রেশ করে (উপরের ব্যাজ, ড্রপডাউন, টাইমলাইন — সব সিঙ্ক থাকে), পুরো পেজ রিলোড ছাড়াই।
  - লোকাল এন্ড-টু-এন্ড টেস্ট: mock Steadfast API দিয়ে confirmed→shipped (in_review)→delivered ফ্লো ভেরিফাই করা হয়েছে — status history, audit log, notification, stock/profit recalculation, delivered_at/paid_amount — সব সঠিকভাবে কাজ করেছে।
- ✅ **আপডেট (একই দিনে, তৃতীয় দফা — মূল রুট-কজ ফিক্স)**: দ্বিতীয় দফার ফিক্স ডিপ্লয় করার পরেও ব্যবহারকারী রিপোর্ট করেন যে অর্ডার `NCB-L60O82255`-এর মূল স্ট্যাটাস ("কনফার্মড") তবুও পরিবর্তন হচ্ছে না। রুট কজ: `deriveOrderStatus()`/`applyOrderStatusChange()` কলটি `syncOneOrder()`-এর `if (changed)` ব্লকের **ভেতরে** বসানো ছিল — অর্থাৎ শুধুমাত্র তখনই চলত যখন `courier_status` টেক্সট নিজেই সেই মুহূর্তে বদলাচ্ছিল। কিন্তু এই অর্ডারের `courier_status` আগে থেকেই স্থিতিশীলভাবে `in_review`-এ সেট ছিল (দ্বিতীয় ফিক্স ডিপ্লয়ের আগে থেকেই) — প্রতি ৫ মিনিটে সিঙ্ক সফল হচ্ছিল ঠিকই, কিন্তু Steadfast প্রতিবারই একই মান ফেরত দেওয়ায় `changed` কখনোই `true` হচ্ছিল না, ফলে অটো-অ্যাডভান্স লজিক কখনোই না চলে চিরকালের জন্য "আটকে" ছিল। **ফিক্স**: `deriveOrderStatus()`/`applyOrderStatusChange()` কলটি এখন `if (changed)` ব্লকের বাইরে নিয়ে প্রতিটি সফল সিঙ্কের পরে (courier_status বদলাক বা না বদলাক) unconditionally চলে — Steadfast-এর লাইভ স্ট্যাটাসকে অর্ডারের বর্তমান স্ট্যাটাসের সাথে তুলনা করে, যাতে দুটো ফিল্ড যেভাবেই আউট-অফ-সিঙ্ক হোক না কেন সবসময় একসময় মিলে যায় (`deriveOrderStatus()` ইতিমধ্যে idempotent — অ্যালাইন হয়ে গেলে `null` রিটার্ন করে, তাই প্রতিবার চালানো সস্তা/no-op)। এই পরিবর্তনে একটি নতুন concurrency ঝুঁকি তৈরি হয় (একই অর্ডারের একাধিক সমান্তরাল সিঙ্ক একই ট্রানজিশন প্রয়োগ করতে চাইতে পারে) — যা আগে থেকেই সমাধান করা হয়েছে `applyOrderStatusChange()`-এর মূল `UPDATE`-কে atomic/conditional (`WHERE id=? AND status=?` + `changes===0` হলে early-return) করে, ঠিক যেভাবে lock ও courier_status change-detection-এ করা হয়েছিল।
  - **ভেরিফিকেশন**: লোকালি হুবহু এই বাগের প্রোডাকশন সিনারিও রিপ্রোডিউস করে টেস্ট করা হয়েছে (`courier_status='in_review'` স্থিতিশীল, `status='confirmed'`) — সিঙ্গেল রিকোয়েস্টে `changed:false` রিটার্ন করলেও `order.status` ঠিকমতো `confirmed`→`shipped`-এ অ্যাডভান্স হয়েছে। ৫টি concurrent রিকোয়েস্ট দিয়েও টেস্ট করা হয়েছে — ঠিক ১টি (ডুপ্লিকেট ছাড়া) status-history রো তৈরি হয়েছে।

### Enterprise Dashboard 2.0 + Pixel Accuracy Update (2026-08-30)
- ✅ **জিরো-ডেটা বাগ ফিক্স (BD টাইমজোন)**: ড্যাশবোর্ডের "আজ" আগে UTC-তে হিসাব হতো — বাংলাদেশ সময় রাত ১২টার পর থেকে ভোর ৬টা পর্যন্ত সব KPI শূন্য দেখাত এবং সন্ধ্যার অর্ডার ভুল দিনে পড়তো। এখন সব analytics query `date(created_at, '+6 hours')` (Asia/Dhaka) ব্যবহার করে।
- ✅ **এন্টারপ্রাইজ ড্যাশবোর্ড রিডিজাইন**: গ্রাডিয়েন্ট 3D KPI হিরো কার্ড (mouse-tilt প্রতি কার্ডে স্কোপড, শাইন-সুইপ, গ্লো-স্পট), কমান্ড বার (লাইভ BD ঘড়ি + রেঞ্জ + রেট), উন্নত চার্ট (gradient fill, smooth animation, rich tooltip)।
- ✅ **লোকেশন ইন্টেলিজেন্স**: কোন জেলা থেকে অর্ডার আসছে — টপ ১০ জেলা (শেয়ার % সহ) + ৮ বিভাগের ডোনাট চার্ট + বিভাগভিত্তিক কালার-কোডেড ব্রেকডাউন (৬৪ জেলা পর্যন্ত)।
- ✅ **হেডার লোগো 3D এনিমেশন**: প্রফেশনাল coin-flip এন্ট্রান্স + স্লো 3D ফ্লোট + breathing গ্লো + periodic শাইন-সুইপ; ব্র্যান্ড নামে gradient shimmer — সব লোগোর নিজস্ব বক্সে স্বয়ানসম্পূর্ণ, পেজ লেআউট/স্ক্রলে কোনো প্রভাব নেই (জুম-বাগ ফেরেনি), `prefers-reduced-motion` সাপোর্টেড।
- ✅ **Pixel নির্ভুলতা ফিক্স (অ্যাড ক্যাম্পেইন ডেটা)**: (1) InitiateCheckout আগে পেজ লোডেই ফায়ার হতো (ডিফল্ট প্যাকেজ অটো-সিলেক্টে) — এখন শুধু রিয়েল ইন্টারঅ্যাকশনে (প্যাকেজ ক্লিক/ফর্ম ফোকাস) ফায়ার হয় — Facebook-এর অপ্টিমাইজার এখন সঠিক ফানেল ডেটা পায়; (2) Purchase/ViewContent-এ `content_type:'product'` + `contents[]` + `num_items` যুক্ত (ক্যাটালগ/ম্যাচ-কোয়ালিটি বুস্ট); (3) Graph API v18→v21 আপডেট; আগের মতই value+currency+event_id dedup সহ প্রতিটা অর্ডারের সঠিক টাকার অ্যামাউন্ট Meta-তে যায়।
- ✅ **ক্যাম্পেইন ROI টেবিল (কত ডলারে কয়টা অর্ডার)**: মার্কেটিং সেকশনে এখন প্রতি ক্যাম্পেইনে USD খরচ, $/অর্ডার, ডেলিভারড রেভিনিউ ও ROAS (রঙিন ব্যাজ) দেখা যায়।

### Meta Pixel + CAPI Fix Log (2026-08-29)
- ✅ **fbc timestamp bug ফিক্স**: `fbc` কুকি/ভ্যালু রিকনস্ট্রাক্ট করার সময় আগে সেকেন্ড ব্যবহার হতো, Meta স্পেক অনুযায়ী মিলিসেকেন্ড লাগে — এখন ঠিক করা হয়েছে (client `landing.js` + server `helpers.ts`)।
- ✅ **fbp সম্পূর্ণ যুক্ত করা হয়েছে**: `_fbp` ব্রাউজার কুকি আগে কখনো CAPI-তে পাঠানো হতো না — এখন `landing.js` → `/api/public/orders` ও `/api/public/events` → `forwardToCapi()` → Meta CAPI `user_data.fbp` পর্যন্ত সম্পূর্ণভাবে ফরওয়ার্ড হয়।
- ✅ **fbc কুকি প্রায়োরিটি**: সার্ভার এখন রিয়েল `_fbc` ব্রাউজার কুকি (সঠিক ফরম্যাট) কে ম্যানুয়াল রিকনস্ট্রাকশনের চেয়ে প্রায়োরিটি দেয়।
- ✅ **autocomplete attributes**: অর্ডার ফর্মে `autocomplete="name"`/`autocomplete="tel"` যুক্ত করা হয়েছে যা Meta-র অফিসিয়াল "Automatic Advanced Matching" ফিচারকে সাপোর্ট করে (Events Manager সেটিংসে টগল করা)।
- ℹ️ পূর্বে থেকেই সঠিক ছিল (এই সেশনে পুনঃনিশ্চিত): SHA-256 hashed `ph`(880 কোড সহ)/`fn` পিক্সেল+CAPI দুই জায়গায়, CAPI-তে real IP+User-Agent, browser Pixel ও backend CAPI-তে identical shared `event_id` (dedup), ফর্ম সাবমিট হওয়ার সাথে সাথেই ইমিডিয়েট ফ্রন্টএন্ড Purchase pixel fire + ইন্ডিপেন্ডেন্ট ব্যাকগ্রাউন্ড CAPI কল।

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
- ✅ **রিভিউ স্ক্রিনশট** 🆕: প্রতিটি কাস্টমার রিভিউতে (ঐচ্ছিক) স্ক্রিনশট ছবি দেখানো যায় — ট্যাপ করলে জুম হয়ে বড় দেখা যায়
- ✅ **ট্রাস্ট স্ট্যাটস সেকশন** 🆕: Trust Bar-এর নিচে ৪টি কার্ডে সত্য/যাচাইযোগ্য সংখ্যা (যেমন কাস্টমার সংখ্যা, বছরের অভিজ্ঞতা, ক্যাশ অন ডেলিভারি, প্রাকৃতিক উপাদান %) — admin থেকে অন/অফ + সংখ্যা/লেবেল/আইকন এডিটযোগ্য, কখনো বানানো সংখ্যা ব্যবহার করা হয়নি
- ✅ **দ্রুত পেজ লোড** 🆕: সব প্রোডাক্ট/ব্যানার/গ্যালারি ছবি কম্প্রেস (৯৪–৯৬% সাইজ কমানো) করে D1-এ নিজস্ব `/assets/:key` থেকে সার্ভ করা হয় — বাইরের ইমেজ হোস্টিং (ibb.co ইত্যাদি) নির্ভরতা সম্পূর্ণ বাদ, ফলে ল্যান্ডিং পেজ অনেক দ্রুত লোড হয়

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
- ✅ **Courier transfer**: Courier A → B with tracking ID, charges, weight, note; full transfer history
- ✅ **Steadfast API Integration** 🆕: অ্যাডমিন প্যানেল থেকে এক ক্লিকে Steadfast-এ অর্ডার পাঠানো (create_order API), অটো ট্র্যাকিং কোড + consignment ID, API connection test বাটন, ডুপ্লিকেট প্রোটেকশন, প্রোডাক্ট ওজন ফিল্ড, প্রতিটি ঘরে বাংলা হেল্প টেক্সট
- ✅ **Products**: CRUD + packages CRUD (এখন ✏️ এডিট বাটন সহ — নাম/পরিমাণ/মূল্য/রেগুলার মূল্য/ব্যাজ/ফ্রি ডেলিভারি/active status সব এডিটযোগ্য 🆕) + inventory (stock/low/out) + gallery + video
- ✅ **রিভিউ স্ক্রিনশট আপলোড** 🆕: Content → Reviews থেকে প্রতিটি রিভিউতে স্ক্রিনশট ছবি আপলোড (ক্লায়েন্ট-সাইড রিসাইজ, D1 assets-এ সংরক্ষণ)
- ✅ **ট্রাস্ট স্ট্যাটস এডিটর** 🆕: Settings → "ট্রাস্ট স্ট্যাটস" গ্রুপ — অন/অফ, সেকশন টাইটেল, ৪টি স্ট্যাট কার্ডের সংখ্যা/লেবেল/আইকন — সতর্কবার্তা সহ (শুধু সত্য সংখ্যা দিতে বলা হয়)
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
| POST | `/api/admin/sms/test` | 🆕 SMS গেটওয়ে টেস্ট (config check + real send + `sms_logs` লগ) |

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) — 24 tables + `assets` (ছবি বাইনারি base64 সংরক্ষণ, `key`/`mime`/`data`, serve করা হয় `GET /assets/:key` দিয়ে)
- **Tables**: admin_users, admin_sessions, login_history, products, product_packages, customers, couriers, orders, order_items, order_status_history, courier_transfers, ad_spends, expenses, reviews (এখন `screenshot_url` কলাম সহ 🆕), faqs, benefits, page_sections, settings (এখন `trust_stats_enabled` + `trust_stat1..4_{number,label,icon}` + SMS/ফন্ট সেটিংস সহ 🆕), audit_logs, notifications, tracking_events, otp_codes, incomplete_orders, hero_banners, assets, **`sms_logs`** 🆕 (প্রতিটি SMS পাঠানোর চেষ্টার লগ — `order_id, phone, message, event_type, success, response`)
- **Profit formula**: `(subtotal − discount + delivery) − (product + packaging + courier + COD + ad + other cost)` — auto-recalculated on every change
- **Soft delete**: orders/products/couriers recoverable

## External Integrations (Configuration Screens Ready)
এগুলোর জন্য credential দিলেই কাজ করবে — Admin Panel-এ config screen আছে:
- **Meta CAPI**: Settings → Meta Pixel ও Conversions API → token দিন (server-side forwarding built-in ✅)
- **Courier APIs** (Steadfast/Pathao/RedX): Couriers → Edit → API key/secret/merchant ID। Credential ছাড়া manual transfer mode কাজ করে ✅
- **SMS গেটওয়ে** 🆕: Settings → "SMS গেটওয়ে" সেকশনে যেকোনো generic SMS API (URL টেমপ্লেটে `{phone}`,`{message}`,`{api_key}`,`{sender_id}` প্লেসহোল্ডার) + API key/sender ID দিয়ে চালু করুন। চালু হলে ৩টি ইভেন্টে অটো SMS যায় (প্রতিটির টেমপ্লেট আলাদা এডিটযোগ্য, {name}/{order_number}/{total}/{tracking_id}/{brand} ভ্যারিয়েবল সাপোর্ট করে):
  1. অর্ডার প্লেস হলে (কাস্টমারকে কনফার্মেশন)
  2. কুরিয়ারে পাঠানো হলে (ট্র্যাকিং আইডি সহ)
  3. ডেলিভারি সম্পন্ন হলে
  - সেটিংসেই "টেস্ট SMS পাঠান" বাটন আছে — নম্বর দিয়ে সাথে সাথে টেস্ট করা যায় এবং প্রতিটি পাঠানোর ফলাফল `sms_logs` টেবিলে সংরক্ষিত হয়।

## Font Checker (নতুন 🆕)
Settings → "ফন্ট চেকার" সেকশনে যেকোনো Google Font নাম দিয়ে সাইট-ওয়াইড ফন্ট লাইভ প্রিভিউ ও অ্যাপ্লাই করা যায় (কোনো কোড পরিবর্তনের প্রয়োজন নেই) — সাথে সাথে ল্যান্ডিং পেজে প্রতিফলিত হয়, রিসেট বাটনে ডিফল্ট Hind Siliguri-তে ফিরে যাওয়া যায়।

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
- **Platform**: Cloudflare Pages (D1) — production-এ লাইভ ও সম্পূর্ণ কার্যকর
- **Last Updated**: 2026-08-30 — **Meta Pixel/CAPI Event Match Quality (EMQ) উন্নতি** 🆕
  1. **`ln` (last name) হ্যাশ যুক্ত** — আগে Advanced Matching-এ শুধু `fn` (first name) পাঠানো হতো, `ln` পাঠানো হতো না। Meta-র EMQ স্কোরিং `fn`+`ln` একসাথে থাকলে বেশি পয়েন্ট দেয় — এই ফিক্সে দুটোই পাঠানো হচ্ছে (কাস্টমারের নামে স্পেস থাকলে শেষ শব্দটুকু `ln` হিসেবে হ্যাশ হয়ে যায়, একটি শব্দের নাম হলে `ln` স্কিপ হয়, এটাই স্বাভাবিক)।
  2. **`external_id` (session_id ভিত্তিক) যুক্ত** — ল্যান্ডিং পেজের প্রতি ভিজিটর সেশনে একটি ইউনিক `session_id` (sessionStorage-এ সংরক্ষিত) এখন প্রতিটি ইভেন্টের (PageView, ViewContent, InitiateCheckout, Lead, Purchase) সাথে হ্যাশ হয়ে Meta-কে `external_id` হিসেবে পাঠানো হচ্ছে। এতে একই ভিজিটরের প্রথম দিকের ইভেন্ট (যেখানে এখনো ফোন/নাম টাইপ করা হয়নি) আর পরের Purchase ইভেন্ট Meta-র কাছে একই ব্যক্তির বলে লিংক হবে — যা "শুধু fn/IP আসছে, ph আসছে না" সমস্যার একটি আংশিক সমাধান (early-funnel ইভেন্টে ফোন সত্যিই তখনো নেই, external_id সেই গ্যাপ পূরণ করে)।
  3. **স্পষ্টীকরণ (কোড বাগ নয়, Facebook Ads-সাইড সেটআপ ইস্যু)**: বেশিরভাগ অর্ডারে `fbclid`/`campaign_id` না থাকায় (১৩/১৪ অর্ডারে fbclid নেই, সব অর্ডারে campaign_id নেই) Facebook Ads Manager-এ campaign-লেভেল Purchase অ্যাট্রিবিউশন দেখানো সম্ভব হচ্ছে না — এটা হয় (a) সত্যিকারের organic/direct ট্রাফিক, বা (b) Facebook বিজ্ঞাপনের ডেস্টিনেশন URL-এ `?campaign_id={{campaign.id}}` প্যারামিটার সেট না থাকা। এটি অ্যাডমিন প্যানেলের নিজস্ব "ক্যাম্পেইন ROI" রিপোর্টেও (Admin → Finance) প্রভাব ফেলে। এটি কোডের বাগ নয়, বরং Facebook বিজ্ঞাপন সেটআপে ঠিক করতে হবে।

- **আগের আপডেট (2026-08-30, পূর্ববর্তী রাউন্ড)** — **প্রিমিয়াম এন্টারপ্রাইজ-গ্রেড এন্ট্রি স্প্ল্যাশ অ্যানিমেশন** 🆕 (ল্যান্ডিং পেজ + অ্যাডমিন প্যানেল দুটোতেই, "বড় প্রতিষ্ঠান"-এর মতো প্রফেশনাল লুক):
  1. **Aurora/Mesh Gradient ব্যাকগ্রাউন্ড**: গাঢ় ইমারেলড থিমে ধীরে ধীরে ঘুরতে থাকা ৩টি গ্লো (aurora drift অ্যানিমেশন)
  2. **অ্যানিমেটেড গ্রিড ওভারলে**: radial mask দিয়ে কেন্দ্রে ফোকাসড subtle গ্রিড লাইন
  3. **ফ্লোটিং গ্লো পার্টিকেলস** (ল্যান্ডিং পেজে ৬টি) স্বতন্ত্র delay দিয়ে ভাসতে থাকে
  4. **পালসিং রিং** (রাডার-স্টাইল, ২টি রিং লোগোর চারপাশে ছড়িয়ে পড়ে ফেড-আউট হয়)
  5. **৩D লোগো ফ্লিপ-ইন**: `rotateY()` দিয়ে গ্লাস-কার্ড স্টাইলের লোগো ৩D পারস্পেক্টিভে ঘুরে এসে সেট হয়, সাথে shine/light-sweep লাইট ইফেক্ট লোগোর উপর দিয়ে বয়ে যায়
  6. **ব্র্যান্ড-নেম মাস্ক-ওয়াইপ রিভিল**: নাম নিচ থেকে wipe-up অ্যানিমেশনে উপরে উঠে আসে (বাংলা স্ক্রিপ্টের জন্য নিরাপদ — অক্ষর-ভিত্তিক স্প্লিটিং নয়)
  7. **অ্যানিমেটেড গ্লোয়িং ডিভাইডার লাইন**: প্রস্থ ০ থেকে বেড়ে গ্লো ইফেক্ট সহ পূর্ণ হয়
  8. **ট্যাগলাইন Letter-Spacing "Tracking" অ্যানিমেশন**: ট্যাগলাইন প্রশস্ত letter-spacing থেকে normal-এ সংকুচিত হতে হতে ফেড-ইন হয়
  9. **রিয়েল প্রোগ্রেস-পার্সেন্টেজ বার**: `requestAnimationFrame`-চালিত, আসল ডেটা-লোডিং স্টেট (`/api/public/content` বা `/api/auth/me` রেসপন্স) এর সাথে সংযুক্ত — অর্গানিক ইজিং দিয়ে ৯২% পর্যন্ত ওঠে অপেক্ষার সময়, ডেটা রেডি হলে ১০০%-এ সম্পূর্ণ হয় (কোনো ফেক ইনস্ট্যান্ট-১০০% নয়)
  10. **আইরিস-ওয়াইপ এক্সিট ট্রানজিশন**: `clip-path: circle()` দিয়ে সিনেমাটিক বৃত্তাকার ওয়াইপ-আউট এক্সিট (আগের সিম্পল fade/opacity-এর পরিবর্তে)
  - ল্যান্ডিং পেজে মিনিমাম স্প্ল্যাশ সময় ২.২ সেকেন্ড, অ্যাডমিনে ১.৫ সেকেন্ড — দ্রুত কানেকশনেও সম্পূর্ণ সিনেমাটিক সিকোয়েন্স দেখা যায়
  - সব পুরনো অ্যানিমেশন (headline word-reveal, KPI count-up/stagger ইত্যাদি) অক্ষত রাখা হয়েছে, কিছুই রিমুভ করা হয়নি

- **আগের আপডেট (2026-08-29, নতুন রাউন্ড)** — অ্যানিমেশন (বেসিক ভার্সন), SMS সিস্টেম, ফন্ট চেকার, ফর্ম ভ্যালিডেশন, অর্ডার-বাটন মেসেজ:
  1. **এন্ট্রি স্প্ল্যাশ/লোগো অ্যানিমেশন**: ল্যান্ডিং পেজ ও অ্যাডমিন প্যানেল দুটোতেই সাইট ওপেন হওয়ার সময় লোগো/ব্র্যান্ড-নেম পপ-ইন অ্যানিমেশন (গ্র্যাডিয়েন্ট ব্যাকগ্রাউন্ড + লোডিং বার) দেখায়, মিনিমাম সময় শেষ হলে স্মুথ ফেড-আউট
  2. **হেডলাইন টেক্সট অ্যানিমেশন**: হিরো হেডলাইন word-by-word স্ট্যাগার্ড রিভিল অ্যানিমেশন, সাবহেডলাইন ফেড-আপ, হেডার লোগো/ব্র্যান্ড-নেম এন্ট্রি অ্যানিমেশন
  3. **অ্যাডমিন ড্যাশবোর্ড অ্যাডভান্স**: সব KPI কার্ড স্ট্যাগার্ড entrance অ্যানিমেশনে আসে + সংখ্যাগুলো (অর্ডার/রেভিনিউ/প্রফিট ইত্যাদি) count-up অ্যানিমেটেড হয়ে ০ থেকে আসল ভ্যালুতে ওঠে; প্রতিটি ভিউ পরিবর্তনে (orders/products/... সব মেনু) হালকা fade-in transition
  4. **SMS গেটওয়ে সিস্টেম** 🆕: generic SMS API ইন্টিগ্রেশন (`sendSms()` helper, Meta CAPI-এর মতোই settings-gated) — অর্ডার প্লেসমেন্ট, কুরিয়ার ট্রান্সফার, ডেলিভারি কনফার্মেশন — এই ৩ ইভেন্টে অটো SMS (প্রতিটি on/off + কাস্টম টেমপ্লেট), সব লগ `sms_logs`-এ, Settings থেকে টেস্ট-সেন্ড সাপোর্ট
  5. **ফন্ট চেকার** 🆕: Settings থেকে যেকোনো Google Font নাম দিয়ে লাইভ প্রিভিউ + পুরো সাইটে অ্যাপ্লাই/রিসেট
  6. **অর্ডার ফর্ম ভ্যালিডেশন**: নাম/ফোন/ঠিকানা/জেলা/উপজেলা — সব ফিল্ডে `required` + বাংলায় কাস্টম ভ্যালিডেশন মেসেজ (খালি রাখলে/ভুল দিলে স্পষ্ট বার্তা দেখাবে)
  7. **ফেক-অর্ডার প্রিভেনশন মেসেজ + ধাপে ধাপে নির্দেশনা**: অর্ডার বাটনের নিচে ইমোশনাল অনুরোধ (~১৩০ টাকা কুরিয়ার খরচের কথা উল্লেখ করে, কড়া ভাষায় না) এবং ৪-ধাপের স্পষ্ট অর্ডারিং নির্দেশিকা
  8. **ফোন নম্বর মাস্ট**: সঠিক বাংলাদেশি মোবাইল নম্বর (`01XXXXXXXXX`) ছাড়া অর্ডার সার্ভার-সাইডে reject হয় (আগে থেকেই ছিল, এই রাউন্ডে পুনঃনিশ্চিত ও টেস্ট করা হয়েছে)

- **আগের আপডেট (2026-08-29, পূর্ববর্তী রাউন্ড)**:
  1. **ইমেজ অপ্টিমাইজেশন**: সব প্রোডাক্ট/ব্যানার/গ্যালারি ছবি (৭টি external ছবি খুঁজে বের করে) কম্প্রেস করে D1 `assets`-এ আপলোড, ফলে পেজ লোড অনেক দ্রুত
  2. **রিভিউ স্ক্রিনশট**: অ্যাডমিন থেকে আপলোড, ল্যান্ডিং পেজে জুম-এবল ছবি হিসেবে প্রদর্শিত
  3. **ট্রাস্ট স্ট্যাটস সেকশন**: বাস্তব সংখ্যা — "১০০০+ সন্তুষ্ট কাস্টমার", "৫+ বছর বিশ্বাসের সাথে সেবা", "ক্যাশ অন ডেলিভারি", "১০০% প্রাকৃতিক উপাদান"
  4. **প্যাকেজ এডিট**: অ্যাডমিন প্যানেল থেকে প্রতিটি প্যাকেজের (১/২/৩ মাসের কোর্স) নাম, মূল্য, রেগুলার মূল্য, ব্যাজ, ফ্রি ডেলিভারি, active status এখন এডিট করা যায়

### ব্র্যান্ডিং ও BSTI (নতুন — 2026-08-28)
- ✅ লোগো: ল্যান্ডিং হেডার, অ্যাডমিন লগইন পেজ, অ্যাডমিন সাইডবার, ফ্যাভিকন (ব্রাউজার ট্যাব)
- ✅ অ্যাডমিন সেটিংস → "লোগো ও ফ্যাভিকন" সেকশন থেকে যেকোনো সময় লোগো/ফ্যাভিকন আপলোড/পরিবর্তন (ক্লায়েন্ট-সাইড রিসাইজ + D1 তে সংরক্ষণ, `/assets/:key` দিয়ে serve)
- ✅ BSTI সার্টিফিকেট সেকশন ল্যান্ডিং পেজে (টাইটেল/বিবরণ/ছবি অ্যাডমিন থেকে নিয়ন্ত্রণ, 1/0 দিয়ে অন/অফ, ছবিতে ট্যাপ করলে জুম)
- API: `POST /api/admin/assets/:key` (brand_logo | favicon | bsti_certificate | og_image_asset), `DELETE /api/admin/assets/:key`, public serve: `GET /assets/:key`
