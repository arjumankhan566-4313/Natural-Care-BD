# Meta Pixel + Conversions API (CAPI): ডিডুপ্লিকেশন, ডায়নামিক মূল্য ও `fbc` ফিক্স

এই নথিটি Natural Care BD-এর বর্তমান ইমপ্লিমেন্টেশন এবং GTM-ভিত্তিক বিকল্প—দুটোর জন্য প্রযোজ্য।

## সবচেয়ে গুরুত্বপূর্ণ নিয়ম

একই customer action-এর জন্য Meta-কে সর্বোচ্চ:

- **একটি browser event**, এবং
- **একটি server/CAPI event**

পাঠাতে হবে। দুটির:

1. event name হুবহু একই (`Lead`/`Purchase`), এবং
2. browser-এর `eventID` ও server-এর `event_id` হুবহু একই

হতে হবে। ID-তে trim, lowercase, uppercase বা truncate করা যাবে না।

> Browser Pixel-এর key হলো `eventID` (capital `ID`), কিন্তু CAPI payload-এর key হলো `event_id`। নাম দুটি আলাদা হলেও **value একই** হবে।

---

## এই প্রজেক্টে প্রয়োগ করা সমাধান

| সমস্যা | বর্তমান সমাধান |
|---|---|
| Lead deduplication | browser-এ একবার UUID তৈরি; একই ID দিয়ে `fbq('track', 'Lead', ..., {eventID})` এবং `/api/public/events` → CAPI `event_id` |
| Purchase deduplication | successful order তৈরির পরে backend ID তৈরি করে; CAPI ও API response-এ একই ID; browser response পাওয়ার পরে সেই ID দিয়ে Purchase fire করে |
| Fixed Purchase price | backend DB/package/delivery charge থেকে `meta_purchase` তৈরি করে; Pixel ও CAPI একই object ব্যবহার করে |
| Modified `fbclid`/`fbc` | URL-এর case-sensitive `fbclid` অপরিবর্তিত রাখা হয়; 90 দিনের `_fbc` cookie; server cookie সরাসরি পড়ে; কোনো lowercase/hash/slice নেই |
| GTM hand-off | প্রতিটি event `dataLayer`-এ `ncb_meta_event` নামে একই ID ও event data-সহ push হয় |
| Future refactor guard | branded TypeScript ID/fbc, discriminated CAPI event type, required Purchase `value`, runtime recovery, persistent diagnostics এবং CI tests |

### সংশ্লিষ্ট ফাইল

- Browser tracking: `public/static/landing.js`
- Order/Event API: `src/routes/public.ts`
- CAPI payload ও validation: `src/lib/helpers.ts`
- প্রথম request-এ `_fbc` cookie: `src/index.tsx`
- Persistent tracking diagnostics + retention: `migrations/0012_meta_tracking_guardrails.sql`, `migrations/0013_tracking_diagnostics_retention.sql`
- Compile/runtime regression locks: `tests/meta-contract.type-test.ts`, `tests/meta-tracking.test.mjs`
- Deployment gate: `.github/workflows/deploy.yml`

---

## ১) Lead event deduplication

### সঠিক browser call

```js
const eventId = 'lead_' + crypto.randomUUID();

fbq('track', 'Lead', {
  content_name: productName
}, {
  eventID: eventId
});

fetch('/api/public/events', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    event_name: 'Lead',
    event_id: eventId,
    data: {content_name: productName}
  })
});
```

### সঠিক server/CAPI অংশ

```json
{
  "event_name": "Lead",
  "event_time": 1788566400,
  "event_id": "lead_550e8400-e29b-41d4-a716-446655440000",
  "action_source": "website",
  "event_source_url": "https://naturalcarebangladesh.shop/",
  "user_data": {}
}
```

বর্তমান `landing.js` browser Pixel বা CAPI—কোনোটিই fire করার আগে একটি required tracking envelope বানায়: valid `event_id`, `fbc` key (real exact-case value অথবা organic traffic-এ `null`) এবং event data। D1 migration deploy-এর চেয়ে পিছিয়ে গেলেও public content request, ৫-মিনিট cron এবং diagnostic logger-এর idempotent bootstrap `tracking_diagnostics` table/index/retention trigger নিজে তৈরি করে; monitoring warning হারায় না। তাই স্বাভাবিক flow-তে browser/server ID আলাদা হওয়ার সুযোগ নেই। কোনো পুরোনো/untyped client তবু missing বা malformed `event_id` পাঠালে backend আর `400` দিয়ে tracking request drop করে না; valid `*_recovered_*` ID বানিয়ে response-এ ফেরত দেয় এবং Workers log + `tracking_diagnostics`-এ **critical `EVENT_ID_FALLBACK`** লিখে। এই fallback legacy request বাঁচায়; এটি স্বাভাবিক dedup path-এর বিকল্প নয়।

---

## ২) Purchase event deduplication

Purchase button click-এর সময় event fire করা ঠিক নয়। Order validation/stock check ব্যর্থ হলেও তাতে phantom Purchase তৈরি হয়। সঠিক flow:

1. Browser order API call করে।
2. Backend order সফলভাবে তৈরি করে।
3. Backend একটি unique Purchase ID তৈরি করে।
4. Backend একই ID দিয়ে CAPI Purchase পাঠায়।
5. API response-এ `order.event_id` ফেরত দেয়।
6. Browser response পাওয়ার **পরে** একই ID দিয়ে Pixel Purchase পাঠায়।

বর্তমান response-এর উদাহরণ:

```json
{
  "order": {
    "order_number": "NCB-ABCD12345",
    "event_id": "purchase_0123456789abcdef0123456789abcdef",
    "grand_total": 1080,
    "meta_purchase": {
      "value": 1080,
      "currency": "BDT",
      "content_ids": ["1"],
      "content_type": "product",
      "contents": [{"id": "1", "quantity": 1, "item_price": 950}],
      "order_id": "NCB-ABCD12345",
      "delivery_category": "home_delivery"
    }
  }
}
```

Browser:

```js
fbq(
  'track',
  'Purchase',
  response.order.meta_purchase,
  {eventID: response.order.event_id}
);
```

CAPI:

```js
{
  event_name: 'Purchase',
  event_id: response.order.event_id,
  custom_data: response.order.meta_purchase
}
```

---

## ৩) Purchase-এর price ডায়নামিক রাখা

`value: 950`-এর মতো hard-coded value, DOM-এর offer text, অথবা GTM Custom JavaScript-এ আলাদা price calculation ব্যবহার করবেন না। Backend-এর authoritative হিসাব ব্যবহার করুন:

```text
subtotal = প্রতিটি validated product/package-এর DB price × quantity
value    = subtotal - discount + actual delivery charge
currency = BDT
```

এই প্রজেক্টে `buildMetaPurchaseDataResult()` একবার server-এ object বানায়। একই object:

- CAPI `custom_data`-তে যায়, এবং
- API response-এর `order.meta_purchase` হিসেবে browser-এ যায়।

ফলে package, quantity, free delivery, Dhaka/outside-Dhaka delivery charge বদলালে `value`-ও বদলায়। Browser ও server value mismatch হয় না। TypeScript-এ `value` required এবং runtime schema numeric/finite value যাচাই করে। কোনো mixed-version/legacy request-এ value হারালে request fail/drop না করে প্রথমে matching order-এর trusted total, তারপর current catalog price দিয়ে complete Purchase object recover হয়; fallback ঘটলেই `PURCHASE_DATA_FALLBACK` warning console, Workers log ও Admin diagnostics-এ দেখা যায়।

> যদি বাস্তবে প্রায় সব customer একই package কেনেন, Events Manager একই value বেশি দেখাতে পারে। এটি নিজে থেকে bug নয়। Test Events-এ দুইটি ভিন্ন package/delivery location দিয়ে order করে payload যাচাই করুন।

---

## ৪) `fbclid`/`fbc` অপরিবর্তিত রাখা

`fbclid` **case-sensitive**। নিচের কোনো কাজ করা যাবে না:

```js
fbclid.toLowerCase(); // ভুল
fbclid.toUpperCase(); // ভুল
fbclid.trim();        // ভুল
fbclid.slice(0, 50);  // ভুল
sha256(fbclid);       // ভুল
```

সঠিক `fbc` format:

```text
fb.<subdomainIndex>.<firstSeenTimeInMilliseconds>.<exact fbclid>
```

উদাহরণ:

```text
fb.1.1788566400123.AbCdEf_123-XyZ
```

মূল নিয়ম:

- URL থেকে `new URL(location.href).searchParams.get('fbclid')` ব্যবহার করুন।
- timestamp অবশ্যই milliseconds (`Date.now()`), seconds নয়।
- `_fbc` cookie valid এবং বর্তমান URL-এর `fbclid`-এর সঙ্গে case-sensitive exact match হলে cookie হুবহু পাঠান।
- নতুন click ID এলে stale cookie ব্যবহার না করে নতুন exact ID দিয়ে `_fbc` update করুন।
- CAPI-তে `user_data.fbc` পাঠান; hash করবেন না।
- `_fbp` থাকলে `user_data.fbp`-ও হুবহু পাঠান।

বর্তমান server initial landing request-এ `_fbc` first-party cookie সেট করে এবং `/orders` ও `/events` request থেকে cookie সরাসরি পড়ে। JSON body শুধু fallback।

---

# GTM ব্যবহার করলে

## আগে একটি ownership model বেছে নিন

### Option A — এই প্রজেক্টের জন্য recommended

- Browser Pixel: website code
- CAPI: website backend
- GTM: GA/অন্যান্য tag; **Meta Lead/Purchase tag বন্ধ**

এটাই বর্তমান default implementation।

### Option B — Browser Meta tag GTM-এ, CAPI website backend-এ

- Admin → Pixel Setup-এ browser Pixel off করুন।
- CAPI on রাখুন।
- GTM-এ `ncb_meta_event` trigger দিয়ে browser event fire করুন।
- GTM browser tag-এর Event ID অবশ্যই `meta_event_id` variable হবে।

### Option C — Browser এবং server দুটিই GTM/sGTM

- Website-এর browser Pixel এবং built-in CAPI দুটিই off করুন।
- Web GTM থেকে browser event এবং server container-এ একই ID পাঠান।
- sGTM Meta CAPI tag-এ সেই value সরাসরি `event_id` হিসেবে map করুন।

> Built-in CAPI এবং sGTM CAPI একসঙ্গে চালাবেন না। একইভাবে website Pixel ও GTM Pixel একসঙ্গে চালাবেন না। একই source থেকে দুইটি event পাঠালে browser-server deduplication নিয়ম দিয়ে সেটি নির্ভরযোগ্যভাবে ঠিক হয় না।

## Data Layer variables

প্রজেক্টটি event-এ নিচের shape push করে:

```js
dataLayer.push({
  event: 'ncb_meta_event',
  meta_event_name: 'Purchase',
  meta_event_id: 'purchase_0123456789abcdef...',
  meta_event_data: {
    value: 1080,
    currency: 'BDT',
    content_ids: ['1'],
    contents: [{id: '1', quantity: 1, item_price: 950}]
  }
});
```

GTM Web container-এ Data Layer Variable (Version 2) তৈরি করুন:

- `DLV - Meta Event Name` → `meta_event_name`
- `DLV - Meta Event ID` → `meta_event_id`
- `DLV - Meta Event Data` → `meta_event_data`
- প্রয়োজনে `meta_event_data.value`, `meta_event_data.currency`, `meta_event_data.contents`

Trigger:

- Type: **Custom Event**
- Event name: `ncb_meta_event`
- Lead tag filter: `{{DLV - Meta Event Name}} equals Lead`
- Purchase tag filter: `{{DLV - Meta Event Name}} equals Purchase`

Meta Pixel template/tag configuration:

- Event Name → সংশ্লিষ্ট `Lead` বা `Purchase`
- Event ID → `{{DLV - Meta Event ID}}`
- Purchase Value → `{{DLV - Meta Value}}`
- Currency → `{{DLV - Meta Currency}}`

sGTM/CAPI mapping:

| Incoming event field | Meta CAPI field |
|---|---|
| `meta_event_name` | `event_name` |
| `meta_event_id` | `event_id` |
| `meta_event_data` | `custom_data` |
| request URL | `event_source_url` |
| original client IP | `client_ip_address` |
| original browser UA | `client_user_agent` |
| `_fbc` | `user_data.fbc` |
| `_fbp` | `user_data.fbp` |

কোনো GTM variable/Transformation-এ Event ID বা `fbc`-কে lowercase/trim/substr করবেন না।

---

# ডুপ্লিকেট tag খোঁজার checklist

GTM Preview ও browser DevTools ব্যবহার করে যাচাই করুন:

- GTM-এ পুরোনো Meta Pixel template আছে কি না
- Custom HTML tag-এ `fbq('track', 'Lead'...)`/`Purchase` আছে কি না
- Meta Event Setup Tool-এর automatic Lead/Purchase একই action ধরছে কি না
- theme/plugin/app integration আলাদাভাবে Meta event পাঠাচ্ছে কি না
- thank-you page refresh-এ Purchase আবার fire হচ্ছে কি না
- built-in CAPI-এর পাশাপাশি sGTM/plugin CAPI চলছে কি না
- পুরোনো staging/sandbox domain একই production Pixel ID ব্যবহার করছে কি না

একটি real action-এর browser Network-এ একটিমাত্র Pixel request এবং server side-এ একটিমাত্র CAPI request থাকা উচিত।

---

# Test Events-এ যাচাই

1. Events Manager → Data Sources → Pixel → **Test Events** খুলুন।
2. Admin → Pixel Setup-এ অস্থায়ী Test Event Code দিন।
3. Incognito browser-এ একটি real Meta ad preview/click থেকে landing URL খুলুন, যাতে আসল `fbclid` থাকে। শুধু local DevTools test-এ `?fbclid=AbCdEf_123-XyZ` ব্যবহার করা যায়; synthetic ID production dataset-এ পাঠাবেন না।
4. Form submit করে Lead ও Purchase তৈরি করুন।
5. Lead-এর browser `eventID` ও server `event_id` exact match দেখুন।
6. Purchase-এর browser/server ID exact match দেখুন।
7. দুইটি আলাদা package/district দিয়ে test করে `value` বদলাচ্ছে কি না দেখুন।
8. CAPI payload-এ `fbc`-এর শেষ অংশ `AbCdEf_123-XyZ` হুবহু আছে কি না দেখুন।
9. Test শেষ হলে Test Event Code সরিয়ে production event flow পুনরায় যাচাই করুন।

Meta পুরোনো diagnostics সঙ্গে সঙ্গে সরায় না; নতুন সঠিক event জমা হওয়ার পরে Diagnostics/Event Deduplication metric আপডেট হতে সময় লাগতে পারে। তাই শুধু warning text নয়, Test Events-এর live paired event এবং নতুন event-এর payload দিয়ে ফল যাচাই করুন।

---

## Official references

- Deduplication: <https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events>
- `fbc`/`fbp` ও case-sensitive ClickID: <https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc>
- Customer information parameters: <https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters>
- Purchase parameters: <https://developers.facebook.com/documentation/meta-pixel/implementation/conversion-tracking>
