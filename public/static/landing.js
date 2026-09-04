// ============ Nature Care Bangladesh — Landing Page App ============
(function () {
  'use strict';

  var DISTRICTS = ['ঢাকা','গাজীপুর','নারায়ণগঞ্জ','মুন্সিগঞ্জ','মানিকগঞ্জ','নরসিংদী','টাঙ্গাইল','কিশোরগঞ্জ','ফরিদপুর','গোপালগঞ্জ','মাদারীপুর','রাজবাড়ী','শরীয়তপুর','চট্টগ্রাম','কক্সবাজার','কুমিল্লা','ব্রাহ্মণবাড়িয়া','চাঁদপুর','লক্ষ্মীপুর','নোয়াখালী','ফেনী','খাগড়াছড়ি','রাঙ্গামাটি','বান্দরবান','রাজশাহী','বগুড়া','পাবনা','সিরাজগঞ্জ','নওগাঁ','নাটোর','জয়পুরহাট','চাঁপাইনবাবগঞ্জ','খুলনা','যশোর','সাতক্ষীরা','বাগেরহাট','ঝিনাইদহ','মাগুরা','নড়াইল','কুষ্টিয়া','চুয়াডাঙ্গা','মেহেরপুর','বরিশাল','পটুয়াখালী','ভোলা','পিরোজপুর','বরগুনা','ঝালকাঠি','সিলেট','মৌলভীবাজার','হবিগঞ্জ','সুনামগঞ্জ','রংপুর','দিনাজপুর','গাইবান্ধা','কুড়িগ্রাম','লালমনিরহাট','নীলফামারী','পঞ্চগড়','ঠাকুরগাঁও','ময়মনসিংহ','জামালপুর','নেত্রকোণা','শেরপুর'];

  // ============ ORDER FORM VALIDATION (client-side mirror of src/lib/helpers.ts) ============
  // These rules give the customer INSTANT feedback (red inline error under each field,
  // submit blocked) — but the server (src/routes/public.ts) re-checks every single one
  // of these exact same rules independently, since this client JS can always be bypassed.
  var NAME_CHARS_RE = /^[\u0980-\u09FFa-zA-Z\s.'-]+$/;
  var REPEATED_CHAR_RE = /(.)\1{3,}/;
  var ENGLISH_DISTRICT_ALIASES = {
    dhaka: 'ঢাকা', chittagong: 'চট্টগ্রাম', chattogram: 'চট্টগ্রাম', khulna: 'খুলনা', rajshahi: 'রাজশাহী',
    sylhet: 'সিলেট', barisal: 'বরিশাল', barishal: 'বরিশাল', rangpur: 'রংপুর', mymensingh: 'ময়মনসিংহ',
    comilla: 'কুমিল্লা', cumilla: 'কুমিল্লা', coxsbazar: 'কক্সবাজার', jessore: 'যশোর', jashore: 'যশোর'
  };
  function resolveDistrict(input) {
    var norm = (input || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!norm) return '';
    if (ENGLISH_DISTRICT_ALIASES[norm]) return ENGLISH_DISTRICT_ALIASES[norm];
    for (var i = 0; i < DISTRICTS.length; i++) {
      if (DISTRICTS[i].trim().toLowerCase().replace(/\s+/g, '') === norm) return DISTRICTS[i];
    }
    return '';
  }
  function countDistinctChars(v) {
    return Object.keys((v || '').replace(/\s/g, '').toLowerCase().split('').reduce(function (acc, ch) { acc[ch] = 1; return acc; }, {})).length;
  }
  function validCustomerName(name) {
    var v = (name || '').trim();
    if (v.length < 3 || v.length > 100) return 'আপনার সম্পূর্ণ নাম লিখুন (কমপক্ষে ৩ অক্ষর)';
    if (!NAME_CHARS_RE.test(v)) return 'নামে শুধু অক্ষর ব্যবহার করুন (সংখ্যা/চিহ্ন দেওয়া যাবে না)';
    if (REPEATED_CHAR_RE.test(v)) return 'সঠিক নাম লিখুন';
    var words = v.split(/\s+/).filter(function (w) { return w.replace(/[.'-]/g, '').length > 0; });
    if (words.length < 2) return 'অনুগ্রহ করে প্রথম নাম ও শেষ নাম দুটোই লিখুন';
    return '';
  }
  function validAddress(address) {
    var v = (address || '').trim();
    if (v.length < 15 || v.length > 500) return 'সম্পূর্ণ ঠিকানা লিখুন (কমপক্ষে ১৫ অক্ষর)';
    if (REPEATED_CHAR_RE.test(v)) return 'সঠিক ঠিকানা লিখুন';
    var hasDigit = /\d/.test(v);
    var wordCount = v.split(/\s+/).filter(Boolean).length;
    if (!hasDigit && wordCount < 3) return 'বাসা/হোল্ডিং নম্বর, রোড, এলাকা সহ সম্পূর্ণ ঠিকানা লিখুন';
    if (countDistinctChars(v) < 5) return 'সঠিক ঠিকানা লিখুন';
    return '';
  }
  function validDistrictField(district) {
    var v = (district || '').trim();
    if (!v) return 'আপনার জেলা লিখুন';
    if (!resolveDistrict(v)) return 'সঠিক জেলার নাম লিখুন (তালিকা থেকে নির্বাচন করুন)';
    return '';
  }
  function validUpazilaField(upazila) {
    var v = (upazila || '').trim();
    if (v.length < 2 || v.length > 100) return 'আপনার উপজেলা/থানার নাম লিখুন';
    if (!NAME_CHARS_RE.test(v)) return 'উপজেলা/থানায় শুধু অক্ষর ব্যবহার করুন';
    if (REPEATED_CHAR_RE.test(v)) return 'সঠিক উপজেলা/থানার নাম লিখুন';
    if (countDistinctChars(v) < 2) return 'সঠিক উপজেলা/থানার নাম লিখুন';
    return '';
  }
  // field-id -> validator map, used both for live inline feedback and the final submit gate
  var FIELD_VALIDATORS = {
    'f-name': validCustomerName,
    'f-address': validAddress,
    'f-district': validDistrictField,
    'f-upazila': validUpazilaField
  };
  function showFieldError(id, msg) {
    var input = document.getElementById(id);
    var errBox = document.getElementById(id + '-err');
    if (!input || !errBox) return;
    if (msg) {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
      input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
    } else {
      errBox.textContent = '';
      errBox.classList.add('hidden');
      input.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
    }
  }
  function validateField(id) {
    var fn = FIELD_VALIDATORS[id];
    if (!fn) return true;
    var input = document.getElementById(id);
    if (!input) return true;
    var msg = fn(input.value);
    showFieldError(id, msg);
    return !msg;
  }
  // Validates every mandatory field, showing inline errors on all of them at once
  // (not just the first) so the customer can fix everything in one pass.
  function validateOrderForm() {
    var ok = true;
    Object.keys(FIELD_VALIDATORS).forEach(function (id) {
      if (!validateField(id)) ok = false;
    });
    return ok;
  }
  function initFieldValidation() {
    Object.keys(FIELD_VALIDATORS).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var handler = function () { validateField(id); };
      input.addEventListener('input', handler);
      input.addEventListener('blur', handler);
      input.addEventListener('change', handler);
    });
  }

  var state = { data: null, cart: {}, utm: {}, submitting: false };

  // ---- Checkout session id (for incomplete-order capture) ----
  var sessionId = null;
  try {
    sessionId = sessionStorage.getItem('ncb_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('ncb_session_id', sessionId);
    }
  } catch (e) {
    sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  }

  // ---- UTM capture ----
  var params = new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid'].forEach(function (k) {
    var v = params.get(k);
    if (v) { state.utm[k] = v; try { sessionStorage.setItem('ncb_' + k, v); } catch (e) {} }
    else { try { var sv = sessionStorage.getItem('ncb_' + k); if (sv) state.utm[k] = sv; } catch (e) {} }
  });
  // fbclid click-time (MILLISECONDS since epoch) — captured once, the moment the ad click
  // lands on the page. Required for a correct Meta 'fbc' value: fb.<subdomain>.<click_time_MS>.<fbclid>.
  // Meta's spec requires the creationTime segment in MILLISECONDS, not seconds — using seconds
  // (the previous bug here) produces a value Meta can't correctly parse as a timestamp, which
  // silently degrades/breaks fbc-based matching and hurts Event Match Quality (EMQ).
  if (state.utm.fbclid) {
    try {
      var storedTs = sessionStorage.getItem('ncb_fbclid_ts');
      if (params.get('fbclid') || !storedTs) {
        state.utm.fbclid_ts = String(Date.now());
        sessionStorage.setItem('ncb_fbclid_ts', state.utm.fbclid_ts);
      } else {
        state.utm.fbclid_ts = storedTs;
      }
    } catch (e) { state.utm.fbclid_ts = String(Date.now()); }
  }
  // Meta ad params
  state.utm.campaign_id = params.get('campaign_id') || '';
  state.utm.adset_id = params.get('adset_id') || '';
  state.utm.ad_id = params.get('ad_id') || '';

  // ---- Event tracking (client pixel + server-side dedup) ----
  function genEventId() {
    return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // Read a browser cookie by name. Used for _fbp/_fbc — cookies the Meta Pixel SDK sets and
  // maintains AUTOMATICALLY once fbq() has loaded (no extra code needed on the Pixel side).
  // The gap this fixes is server-side: our CAPI calls never read+forwarded these values, so
  // Meta's server-side event lost this important matching signal even though the browser
  // event always had it. fbp = Facebook Browser ID (identity anchor, works even without
  // email/phone/fbclid). fbc = Facebook Click ID derived from fbclid; the Pixel SDK's own
  // _fbc cookie is authoritative (correct ms timestamp) and should be preferred over any
  // value we reconstruct manually from fbclid+fbclid_ts.
  function getCookie(name) {
    var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? decodeURIComponent(match.pop()) : '';
  }

  // The standard Meta web-event set. Mirrors META_EVENT_NAMES in src/lib/helpers.ts.
  // Used as the FAIL-OPEN default for the browser-side allowlist below: an unset or empty
  // `meta_events_enabled` must enable ALL of them, never none of them.
  var DEFAULT_META_EVENTS = ['PageView', 'ViewContent', 'InitiateCheckout', 'Lead', 'Purchase'];

  function browserEventsAllowed() {
    // BROWSER-PIXEL FIX (was the cause of "server CAPI Processed but browser sends
    // nothing"): this used to be
    //     settings.meta_events_enabled.split(',')
    // which yields [''] when the setting is missing or saved blank — and since the server
    // CAPI path never reads this setting, EVERY fbq('track') call was skipped while the
    // server kept sending Purchase/InitiateCheckout/etc. Meta then showed server-only
    // events and flagged them as not deduplicated. Now an empty/absent/garbage value falls
    // back to the full standard set, and unknown names are dropped, so the browser list can
    // never end up empty. The server applies the same rule
    // (effectiveMetaEvents() in src/lib/helpers.ts) — the two sides always agree.
    var raw = (state.data && state.data.settings && state.data.settings.meta_events_enabled) || '';
    // trim each entry — a value like "PageView, ViewContent" (space after comma, as
    // sometimes entered in the admin panel) must still match event names exactly.
    var list = String(raw).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var known = list.filter(function (x) { return DEFAULT_META_EVENTS.indexOf(x) !== -1; });
    return known.length ? known : DEFAULT_META_EVENTS;
  }

  // Report an event to OUR backend only (tracking_events log + server-side CAPI forward).
  // Deliberately makes NO window.fbq() call — used for PageView, which the base pixel
  // snippet in <head> has already fired for this page load.
  function reportServerEvent(eventName, data, eventId, userData) {
    var eid = eventId || genEventId();
    axios.post('/api/public/events', {
      event_name: eventName, event_id: eid, data: data || {},
      source_url: location.href, fbclid: state.utm.fbclid || '', fbclid_ts: state.utm.fbclid_ts || '',
      // _fbp/_fbc straight from the Pixel's own cookies — sent to our backend so the
      // server-side CAPI call can include them too (browser Pixel already sends them
      // automatically; CAPI needs us to forward them manually).
      fbp: getCookie('_fbp'), fbc: getCookie('_fbc'),
      // Optional customer name/phone -> forwarded to Meta CAPI (hashed server-side) for
      // Advanced Matching on non-Purchase events (e.g. Lead) once the customer has typed them.
      customer_name: (userData && userData.name) || '', customer_phone: (userData && userData.phone) || '',
      // session_id -> forwarded to Meta as external_id (hashed server-side). Same value for
      // EVERY event in this visitor's session (PageView through Purchase), so Meta can link an
      // early, name/phone-less event (PageView/ViewContent/InitiateCheckout) to the SAME person's
      // later Purchase. This is the fix for events showing only fn/IP with no ph in Events
      // Manager — those early events genuinely have no phone yet, external_id is the match key
      // that works before the customer has typed anything.
      session_id: sessionId || ''
    }).catch(function () {});
    return eid;
  }

  // Fire the browser Pixel AND report to our backend, both carrying the SAME event_id —
  // that shared id is what lets Meta deduplicate the browser copy and the server (CAPI)
  // copy of this event into a single conversion instead of counting it twice.
  function track(eventName, data, eventId, userData) {
    var eid = eventId || genEventId();
    var enabled = state.data && String(state.data.settings.meta_pixel_enabled || '').trim() === '1';
    if (enabled && window.fbq && browserEventsAllowed().indexOf(eventName) !== -1) {
      window.fbq('track', eventName, data || {}, { eventID: eid });
    }
    return reportServerEvent(eventName, data, eid, userData);
  }

  // Convert any BD phone format to Meta's required format: digits only, WITH
  // the 880 country code, no leading zero (e.g. "01711000111" -> "8801711000111").
  // Mirrors the server-side toMetaPhone() in src/lib/helpers.ts — must stay in sync.
  function toMetaPhone(phone) {
    var p = (phone || '').replace(/[^\d+]/g, '');
    if (p.charAt(0) === '+') p = p.slice(1);
    if (p.indexOf('880') === 0) p = p.slice(3);
    else if (p.indexOf('00880') === 0) p = p.slice(5);
    p = p.replace(/^0+/, '');
    return p ? '880' + p : '';
  }

  // Facebook Ads "booster" requirement #1: send hashed name (fn) + phone (ph, with
  // 880 country code) to Meta via the browser Pixel's Advanced Matching, as soon as
  // the customer provides them (right before the Purchase pixel fires on submit).
  // We pass PLAIN text here — the Pixel JS SDK hashes fn/ph with SHA-256 automatically
  // on its own (see Meta's Advanced Matching docs); only the server-side CAPI call
  // needs us to pre-hash manually (done in helpers.ts / forwardToCapi()).
  //
  // IMPORTANT LIMITATION (confirmed against Meta's official docs): Meta's documentation
  // explicitly states Advanced Matching parameters must be placed in the pixel's BASE
  // fbq('init', PIXEL_ID, {...}) call — parameters added via a later, second init call
  // are officially "not treated as manual advanced matching values". In practice many
  // implementations still see it work (undocumented behavior), so we keep firing it as a
  // free extra attempt, but we do NOT rely on it — it is a best-effort bonus only.
  // The GUARANTEED delivery path for ph/fn is: (1) server-side CAPI, always sent with
  // SHA-256 hashing in forwardToCapi() below — this is 100% reliable and already works;
  // (2) Meta's own "Automatic Advanced Matching" (a toggle in Events Manager > Settings,
  // outside our code) which scrapes name/phone straight from the HTML form fields — this
  // is why the order form's inputs carry proper autocomplete="name"/"tel" attributes.
  function applyAdvancedMatching(name, phone) {
    var s = state.data && state.data.settings;
    if (!s || s.meta_advanced_matching !== '1' || !window.fbq || !s.meta_pixel_id) return;
    var pixelId = String(s.meta_pixel_id).replace(/[^0-9]/g, '');
    var firstName = (name || '').trim().split(/\s+/)[0] || '';
    var metaPhone = toMetaPhone(phone);
    var match = {};
    if (firstName) match.fn = firstName.toLowerCase();
    if (metaPhone) match.ph = metaPhone;
    if (!match.fn && !match.ph) return;
    try { window.fbq('init', pixelId, match); } catch (e) {}
  }

  function money(n) { return '৳' + Number(n || 0).toLocaleString('bn-BD'); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function stars(r) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += '<i class="fa' + (i <= r ? 's' : 'r') + ' fa-star text-amber-400"></i>';
    return out;
  }

  // Splits text into words and wraps each in a span with a staggered reveal
  // animation (advanced "type-in"-style headline effect requested by the client,
  // similar to big websites' entry animations). baseDelay lets callers offset
  // the start (e.g. run after the splash screen fades).
  function animateWords(text, baseDelay) {
    var words = esc(text).split(' ');
    var start = baseDelay || 0;
    return words.map(function (w, i) {
      return '<span class="text-reveal-word" style="animation-delay:' + (start + i * 0.09).toFixed(2) + 's">' + w + '&nbsp;</span>';
    }).join('');
  }

  // ============ RENDER ============
  function render() {
    var d = state.data, s = d.settings;
    var product = d.products[0] || null;
    var app = document.getElementById('app');

    var discountPct = product && product.regular_price > product.sale_price
      ? Math.round((1 - product.sale_price / product.regular_price) * 100) : 0;

    var howItWorks = (d.sections || []).find(function (x) { return x.section_type === 'how_it_works'; });

    app.innerHTML =
    // ===== HEADER =====
    '<header class="bg-white/95 backdrop-blur sticky top-0 z-40 border-b border-gray-100 shadow-sm">' +
      '<div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">' +
        '<div class="flex items-center gap-2" id="brand-3d-block">' +
          '<span class="logo-3d-card" id="header-logo-3d">' +
          (s.brand_logo ? '<img src="' + esc(s.brand_logo) + '" alt="logo" class="h-11 w-11 object-contain">' :
          '<div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white"><i class="fas fa-leaf"></i></div>') +
          '</span>' +
          '<div><div class="font-bold text-emerald-800 leading-tight brand-name-3d-load">' + esc(s.brand_name) + '</div>' +
          '<div class="text-xs text-gray-500">' + esc(s.brand_tagline || '') + '</div></div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<a href="tel:' + esc(s.support_phone) + '" class="hidden sm:flex items-center gap-2 text-sm font-semibold text-emerald-700"><i class="fas fa-phone phone-ring-icon"></i>' + esc(s.support_phone) + '</a>' +
          '<a href="/track-order" class="text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-medium"><i class="fas fa-truck-fast mr-1"></i>অর্ডার ট্র্যাক</a>' +
        '</div>' +
      '</div>' +
    '</header>' +

    // ===== HERO =====
    '<section id="hero-section" class="bg-gradient-to-b from-emerald-50 via-white to-white">' +
      '<div class="max-w-6xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">' +
        '<div class="order-2 md:order-1">' +
          '<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full mb-4"><i class="fas fa-bolt"></i> ' + esc(s.offer_title || 'বিশেষ অফার') + '</span>' +
          '<h1 class="text-3xl md:text-5xl font-bold text-gray-900 leading-snug mb-4 overflow-hidden">' + animateWords(s.hero_headline, 0.1) + '</h1>' +
          '<p class="text-gray-600 text-base md:text-lg mb-6 hero-sub-reveal">' + esc(s.hero_subheadline) + '</p>' +
          (product ?
          '<div class="flex items-center gap-4 mb-6">' +
            '<span class="text-3xl md:text-4xl font-bold text-emerald-700">' + money(product.sale_price) + '</span>' +
            (product.regular_price > product.sale_price ? '<span class="text-xl text-gray-400 line-through">' + money(product.regular_price) + '</span>' +
            '<span class="bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-lg">' + discountPct + '% ছাড়</span>' : '') +
          '</div>' : '') +
          '<div id="countdown-wrap" class="mb-6"></div>' +
          '<div class="flex flex-col sm:flex-row gap-3">' +
            '<button onclick="NCB.scrollToOrder()" class="btn-primary pulse-cta btn-tilt btn-shine-loop btn-pop-in-start text-white font-bold text-lg px-8 py-4 rounded-xl" data-tilt="1"><i class="fas fa-cart-shopping mr-2"></i>অর্ডার করতে এখনই ক্লিক করুন</button>' +
            '<a href="tel:' + esc(s.support_phone) + '" class="btn-tilt btn-pop-in-start border-2 border-emerald-600 text-emerald-700 font-bold text-lg px-8 py-4 rounded-xl text-center hover:bg-emerald-50 transition" data-tilt="1" data-pop-delay="120"><i class="fas fa-phone mr-2 phone-ring-icon"></i>কল করুন</a>' +
          '</div>' +
          '<div class="flex flex-wrap gap-3 mt-6 text-sm">' +
            '<span class="flex items-center gap-1.5 text-gray-600"><i class="fas fa-hand-holding-dollar text-emerald-600"></i> ক্যাশ অন ডেলিভারি</span>' +
            '<span class="flex items-center gap-1.5 text-gray-600"><i class="fas fa-truck-fast text-emerald-600"></i> দ্রুত ডেলিভারি</span>' +
            '<span class="flex items-center gap-1.5 text-gray-600"><i class="fas fa-shield-halved text-emerald-600"></i> নিরাপদ অর্ডার</span>' +
          '</div>' +
        '</div>' +
        '<div class="order-1 md:order-2 relative">' +
          renderHeroBanner(d, product, discountPct) +
        '</div>' +
      '</div>' +
    '</section>' +

    // ===== TRUST BAR =====
    '<section id="trust-section" class="bg-emerald-800 text-white py-4">' +
      '<div class="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">' +
        '<div class="flex items-center justify-center gap-2"><i class="fas fa-hand-holding-dollar text-emerald-300 text-lg"></i> ক্যাশ অন ডেলিভারি</div>' +
        '<div class="flex items-center justify-center gap-2"><i class="fas fa-truck-fast text-emerald-300 text-lg"></i> সারাদেশে ডেলিভারি</div>' +
        '<div class="flex items-center justify-center gap-2"><i class="fas fa-box-open text-emerald-300 text-lg"></i> খুলে দেখে নিন</div>' +
        '<div class="flex items-center justify-center gap-2"><i class="fas fa-headset text-emerald-300 text-lg"></i> কাস্টমার সাপোর্ট</div>' +
      '</div>' +
    '</section>' +

    // ===== TRUST STATS =====
    (s.trust_stats_enabled === '1' ?
    '<section id="trust-stats-section" class="py-12 bg-white">' +
      '<div class="max-w-6xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">' + esc(s.trust_stats_title || 'হাজারো কাস্টমারের আস্থা আমাদের সাথে') + '</h2>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-5">' +
        [1, 2, 3, 4].map(function (i) {
          var num = s['trust_stat' + i + '_number'], lab = s['trust_stat' + i + '_label'], icon = s['trust_stat' + i + '_icon'];
          if (!num && !lab) return '';
          return '<div class="box-pop-in text-center bg-emerald-50 rounded-2xl p-6">' +
            '<div class="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center"><i class="fas ' + esc(icon || 'fa-star') + ' text-emerald-600 text-lg"></i></div>' +
            '<div class="text-2xl md:text-3xl font-extrabold text-emerald-700 mb-1">' + esc(num) + '</div>' +
            '<div class="text-sm text-gray-600 font-medium">' + esc(lab) + '</div></div>';
        }).join('') +
        '</div></div></section>' : '') +

    // ===== PRODUCT SECTION =====
    (product ? renderProduct(product) : '') +

    // ===== BSTI CERTIFICATE =====
    (s.bsti_enabled === '1' ?
    '<section id="bsti-section" class="py-10 bg-gradient-to-b from-white to-emerald-50/60">' +
      '<div class="max-w-4xl mx-auto px-4 text-center">' +
        '<div class="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-sm font-bold mb-4"><i class="fas fa-certificate"></i> সরকারি অনুমোদিত</div>' +
        '<h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-3">' + esc(s.bsti_title || 'BSTI অনুমোদিত পণ্য') + '</h2>' +
        '<p class="text-gray-600 max-w-2xl mx-auto mb-6">' + esc(s.bsti_description || '') + '</p>' +
        (s.bsti_certificate_image ?
          '<div class="box-pop-in inline-block bg-white rounded-2xl shadow-xl border border-emerald-100 p-3 md:p-4 max-w-md mx-auto">' +
            '<img src="' + esc(s.bsti_certificate_image) + '" alt="BSTI সার্টিফিকেট" class="rounded-xl w-full cursor-zoom-in" onclick="NCB.zoomCert(this.src)">' +
            '<div class="text-xs text-gray-400 mt-2"><i class="fas fa-magnifying-glass-plus mr-1"></i>বড় করে দেখতে ছবিতে ট্যাপ করুন</div>' +
          '</div>' :
          '<div class="box-pop-in inline-flex flex-col items-center gap-3 bg-white rounded-2xl shadow-lg border border-emerald-100 px-8 py-6 max-w-md mx-auto">' +
            '<div class="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg"><i class="fas fa-award text-white text-3xl"></i></div>' +
            '<div class="font-bold text-emerald-800">BSTI সার্টিফাইড</div>' +
            '<div class="flex items-center gap-4 text-emerald-700 text-sm font-semibold"><span><i class="fas fa-check-circle mr-1"></i>মান নিয়ন্ত্রিত</span><span><i class="fas fa-check-circle mr-1"></i>নিরাপদ</span><span><i class="fas fa-check-circle mr-1"></i>অনুমোদিত</span></div>' +
          '</div>') +
      '</div>' +
    '</section>' : '') +

    // ===== BENEFITS =====
    (d.benefits.length ?
    '<section id="benefits-section" class="py-12 bg-emerald-50/50">' +
      '<div class="max-w-6xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">কেন আমাদের বেছে নেবেন?</h2>' +
        '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">' +
        d.benefits.map(function (b) {
          return '<article class="box-pop-in bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition">' +
            '<div class="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center"><i class="fas ' + esc(b.icon) + ' text-emerald-600 text-xl"></i></div>' +
            '<h3 class="font-bold text-gray-900 mb-2">' + esc(b.title) + '</h3>' +
            '<p class="text-sm text-gray-600">' + esc(b.description) + '</p></article>';
        }).join('') +
        '</div></div></section>' : '') +

    // ===== HOW IT WORKS =====
    (howItWorks ?
    '<section id="how-it-works" class="py-12">' +
      '<div class="max-w-6xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">' + esc(howItWorks.title) + '</h2>' +
        '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">' +
        (howItWorks.content.steps || []).map(function (st, i) {
          return '<div class="box-pop-in relative bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">' +
            '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">' + (i + 1) + '</div>' +
            '<i class="fas ' + esc(st.icon) + ' text-3xl text-emerald-600 mb-3 mt-2"></i>' +
            '<h3 class="font-bold mb-1">' + esc(st.title) + '</h3>' +
            '<p class="text-sm text-gray-600">' + esc(st.desc) + '</p></div>';
        }).join('') +
        '</div></div></section>' : '') +

    // ===== REVIEWS =====
    (d.reviews.length ?
    '<section id="reviews-section" class="py-12 bg-gray-50">' +
      '<div class="max-w-6xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">সম্মানিত কাস্টমারদের মতামত</h2>' +
        '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">' +
        d.reviews.map(function (rv) {
          return '<article class="review-card box-pop-in bg-white rounded-2xl p-6">' +
            '<div class="mb-3">' + stars(rv.rating) + '</div>' +
            '<p class="text-gray-700 mb-4">"' + esc(rv.review_text) + '"</p>' +
            (rv.screenshot_url ? '<img src="' + esc(rv.screenshot_url) + '" alt="কাস্টমার রিভিউ স্ক্রিনশট" class="rounded-xl w-full max-h-64 object-cover mb-4 cursor-zoom-in border border-gray-100" onclick="NCB.zoomCert(this.src)" loading="lazy">' : '') +
            '<div class="flex items-center gap-3">' +
            (rv.customer_image ? '<img src="' + esc(rv.customer_image) + '" class="w-10 h-10 rounded-full object-cover" alt="">' :
             '<div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">' + esc((rv.customer_name || '?')[0]) + '</div>') +
            '<span class="font-semibold text-sm text-gray-800">' + esc(rv.customer_name) + '</span></div></article>';
        }).join('') +
        '</div></div></section>' : '') +

    // ===== ORDER FORM =====
    renderOrderForm(product, s) +

    // ===== FAQ =====
    (d.faqs.length ?
    '<section id="faq-section" class="py-12">' +
      '<div class="max-w-3xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-8">সাধারণ জিজ্ঞাসা</h2>' +
        d.faqs.map(function (f, i) {
          return '<div class="faq-item box-pop-in bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden" id="faq-' + i + '">' +
            '<button class="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-gray-800" onclick="NCB.toggleFaq(' + i + ')">' +
            '<span>' + esc(f.question) + '</span><i class="fas fa-chevron-down faq-icon text-emerald-600"></i></button>' +
            '<div class="faq-answer"><p class="px-5 pb-4 text-gray-600">' + esc(f.answer) + '</p></div></div>';
        }).join('') +
      '</div></section>' : '') +

    // ===== SUPPORT / FOOTER =====
    '<footer class="bg-gray-900 text-gray-300 py-10 pb-24 md:pb-10">' +
      '<div class="max-w-6xl mx-auto px-4 text-center">' +
        '<div class="font-bold text-white text-lg mb-2">' + esc(s.brand_name) + '</div>' +
        '<p class="text-sm mb-5">' + esc(s.brand_tagline || '') + '</p>' +
        '<div class="flex justify-center gap-3 mb-6">' +
          '<a href="tel:' + esc(s.support_phone) + '" class="btn-tilt bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold" data-tilt="1"><i class="fas fa-phone mr-1.5 phone-ring-icon"></i>কল করুন</a>' +
          (s.whatsapp_number ? '<a href="https://wa.me/' + esc(s.whatsapp_number) + '" target="_blank" rel="noopener" class="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><i class="fab fa-whatsapp mr-1.5"></i>WhatsApp</a>' : '') +
          (s.messenger_link ? '<a href="' + esc(s.messenger_link) + '" target="_blank" rel="noopener" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><i class="fab fa-facebook-messenger mr-1.5"></i>Messenger</a>' : '') +
        '</div>' +
        '<div class="text-xs text-gray-500">© ' + new Date().getFullYear() + ' ' + esc(s.brand_name) + ' — সর্বস্বত্ব সংরক্ষিত | <a href="/track-order" class="underline">অর্ডার ট্র্যাক করুন</a></div>' +
      '</div>' +
    '</footer>' +

    // ===== STICKY MOBILE CTA =====
    '<div id="sticky-cta" class="sticky-cta md:hidden bg-white border-t border-gray-200 p-3 hidden">' +
      '<button onclick="NCB.scrollToOrder()" class="btn-primary btn-tilt btn-shine-loop w-full text-white font-bold py-3.5 rounded-xl text-base"><i class="fas fa-truck mr-2"></i>🚚 Cash on Delivery | এখনই অর্ডার করুন</button>' +
    '</div>';

    initCountdown();
    initScrollAnimations();
    initAdvanced3D();
    initStickyCta();
    initBannerSlider();
    initAutosave();
    initFieldValidation();
    if (product) selectPackage(product.packages.length ? product.packages[0].id : 0);
    // PageView: the base pixel snippet in <head> already fired it in the browser, tagged
    // with window.NCB_PV_ID. Here we ONLY report it to our own backend — reusing that exact
    // event_id so the server-side CAPI PageView deduplicates against the browser one.
    // Calling track('PageView') here instead would fire a SECOND browser PageView and
    // double-count every single page load.
    reportServerEvent('PageView', {}, window.NCB_PV_ID || null);
    if (product) track('ViewContent', { content_name: product.name, content_ids: [String(product.id)], content_type: 'product', value: product.sale_price, currency: 'BDT' });
  }

  // ============ HERO BANNER SLIDER ============
  function renderHeroBanner(d, product, discountPct) {
    // Admin banners first; if none, fall back to sliding the product's own images
    var banners = (d.banners || []).slice();
    if (!banners.length && product) {
      var imgs = [product.main_image].concat((product.gallery_images || []).filter(function (g) { return g && g !== product.main_image; }));
      banners = imgs.filter(Boolean).map(function (u) { return { image_url: u, title: '', subtitle: '', link_url: '' }; });
    }
    if (!banners.length) return '';
    // First slide stays in normal flow (w-full h-auto) so the banner keeps
    // exactly the same size as the original product image. Other slides are
    // absolutely positioned on top and cross-fade.
    var slides = banners.map(function (b, i) {
      var imgCls = i === 0 ? 'w-full h-auto block' : 'w-full h-full object-cover';
      var img = '<img src="' + esc(b.image_url) + '" alt="' + esc(b.title || (product ? product.name : 'banner')) + '" class="' + imgCls + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
      var caption = (b.title || b.subtitle) ?
        '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">' +
          (b.title ? '<div class="text-white font-bold text-lg drop-shadow">' + esc(b.title) + '</div>' : '') +
          (b.subtitle ? '<div class="text-white/90 text-sm drop-shadow">' + esc(b.subtitle) + '</div>' : '') +
        '</div>' : '';
      var inner = img + caption;
      if (b.link_url) inner = '<a href="' + esc(b.link_url) + '" class="block w-full h-full">' + inner + '</a>';
      var wrapCls = i === 0 ? 'banner-slide relative' : 'banner-slide absolute inset-0';
      return '<div class="' + wrapCls + ' transition-opacity duration-700 ' + (i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0') + '" data-slide="' + i + '">' + inner + '</div>';
    }).join('');
    var dots = banners.length > 1 ?
      '<div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">' +
        banners.map(function (_, i) {
          return '<button type="button" class="banner-dot w-2.5 h-2.5 rounded-full transition ' + (i === 0 ? 'bg-white' : 'bg-white/50') + '" data-dot="' + i + '" onclick="NCB.goBanner(' + i + ')" aria-label="banner ' + (i + 1) + '"></button>';
        }).join('') +
      '</div>' : '';
    var arrows = banners.length > 1 ?
      '<button type="button" onclick="NCB.goBanner(-1,true)" class="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center" aria-label="previous"><i class="fas fa-chevron-left"></i></button>' +
      '<button type="button" onclick="NCB.goBanner(1,true)" class="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center" aria-label="next"><i class="fas fa-chevron-right"></i></button>' : '';
    var badge = discountPct ? '<div class="badge-float absolute -top-3 -right-3 z-30 bg-red-500 text-white w-20 h-20 rounded-full flex flex-col items-center justify-center font-bold shadow-lg"><span class="text-xl">' + discountPct + '%</span><span class="text-xs">\u099b\u09be\u09dc</span></div>' : '';
    return '<div id="hero-banner" class="relative rounded-2xl shadow-2xl overflow-hidden w-full">' + slides + dots + arrows + '</div>' + badge;
  }

  var bannerIdx = 0, bannerTimer = null;
  function showBanner(idx) {
    var wrap = document.getElementById('hero-banner');
    if (!wrap) return;
    var slides = wrap.querySelectorAll('.banner-slide');
    if (!slides.length) return;
    bannerIdx = ((idx % slides.length) + slides.length) % slides.length;
    slides.forEach(function (sl, i) {
      sl.classList.toggle('opacity-100', i === bannerIdx);
      sl.classList.toggle('z-10', i === bannerIdx);
      sl.classList.toggle('opacity-0', i !== bannerIdx);
      sl.classList.toggle('z-0', i !== bannerIdx);
    });
    wrap.querySelectorAll('.banner-dot').forEach(function (dt, i) {
      dt.classList.toggle('bg-white', i === bannerIdx);
      dt.classList.toggle('bg-white/50', i !== bannerIdx);
    });
  }
  function initBannerSlider() {
    bannerIdx = 0;
    var wrap = document.getElementById('hero-banner');
    if (!wrap) return;
    var slides = wrap.querySelectorAll('.banner-slide');
    if (slides.length < 2) return;
    var secs = Number((state.data.settings.banner_autoplay_seconds || '4')) || 4;
    if (bannerTimer) clearInterval(bannerTimer);
    bannerTimer = setInterval(function () { showBanner(bannerIdx + 1); }, secs * 1000);
    wrap.addEventListener('mouseenter', function () { if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; } });
    wrap.addEventListener('mouseleave', function () {
      if (!bannerTimer) bannerTimer = setInterval(function () { showBanner(bannerIdx + 1); }, secs * 1000);
    });
    var touchX = null;
    wrap.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) showBanner(bannerIdx + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  // ============ INCOMPLETE ORDER AUTOSAVE ============
  var autosaveTimer = null;
  var lastSavedSnapshot = '';
  function collectFormData() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    return {
      customer_name: g('f-name'), phone: g('f-phone'), alt_phone: g('f-alt-phone'),
      address: g('f-address'), district: g('f-district'), upazila: g('f-upazila'), order_note: g('f-note')
    };
  }
  function saveIncomplete() {
    if (state.submitting || !state.data) return;
    var f = collectFormData();
    if (!f.customer_name && !f.phone) return;
    var snapshot = JSON.stringify(f) + '|' + selectedPkg;
    if (snapshot === lastSavedSnapshot) return;
    lastSavedSnapshot = snapshot;
    var p = state.data.products[0];
    var pr = getPricing();
    var pkg = null;
    if (p && selectedPkg) pkg = (p.packages || []).find(function (x) { return x.id === Number(selectedPkg); });
    var payload = {
      session_id: sessionId,
      customer_name: f.customer_name, phone: f.phone, alt_phone: f.alt_phone,
      address: f.address, district: f.district, upazila: f.upazila, order_note: f.order_note,
      product_id: p ? p.id : null, product_name: p ? p.name : '',
      package_id: pkg ? pkg.id : null, package_name: pkg ? pkg.name : '', quantity: 1,
      subtotal: pr.subtotal, delivery_charge: pr.delivery, grand_total: pr.total,
      source_url: location.href,
      fbp: getCookie('_fbp'), fbc: getCookie('_fbc')
    };
    Object.assign(payload, state.utm);
    axios.post('/api/public/incomplete', payload).catch(function () {});
  }
  function initAutosave() {
    var form = document.getElementById('order-form');
    if (!form) return;
    var handler = function () {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(saveIncomplete, 1500);
    };
    form.addEventListener('input', handler);
    form.addEventListener('change', handler);
    // Real checkout-intent signal: the first time the customer actually focuses
    // any order-form field, fire InitiateCheckout (once). Complements the
    // package-click trigger — together these replace the old page-load misfire.
    form.addEventListener('focusin', function onFirstFocus() {
      form.removeEventListener('focusin', onFirstFocus);
      fireInitiateCheckout();
    });
    window.addEventListener('beforeunload', function () {
      if (state.submitting) return;
      try { saveIncomplete(); } catch (e) {}
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && !state.submitting) { try { saveIncomplete(); } catch (e) {} }
    });
  }

  function renderProduct(p) {
    var gallery = [p.main_image].concat(p.gallery_images.filter(function (g) { return g !== p.main_image; }));
    return '<section id="product-section" class="py-12">' +
      '<div class="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10">' +
        '<div>' +
          '<img id="gallery-main" src="' + esc(gallery[0]) + '" alt="' + esc(p.name) + '" class="rounded-2xl shadow-lg w-full mb-3" loading="lazy">' +
          (gallery.length > 1 ?
          '<div class="flex gap-2 overflow-x-auto pb-1">' + gallery.map(function (g, i) {
            return '<img src="' + esc(g) + '" class="gallery-thumb w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg ' + (i === 0 ? 'active' : '') + '" onclick="NCB.setGallery(this, \'' + esc(g) + '\')" loading="lazy" alt="">';
          }).join('') + '</div>' : '') +
          (p.video_url ? '<div class="mt-4 rounded-2xl overflow-hidden aspect-video"><iframe src="' + esc(p.video_url) + '" class="w-full h-full" frameborder="0" allowfullscreen loading="lazy"></iframe></div>' : '') +
        '</div>' +
        '<div>' +
          '<h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-1">' + esc(p.name) + '</h2>' +
          '<p class="text-emerald-700 font-medium mb-4">' + esc(p.subtitle || '') + '</p>' +
          '<p class="text-gray-600 mb-5 leading-relaxed">' + esc(p.description) + '</p>' +
          (p.features.length ? '<ul class="space-y-2 mb-5">' + p.features.map(function (f) {
            return '<li class="flex items-start gap-2"><i class="fas fa-circle-check text-emerald-600 mt-1"></i><span>' + esc(f) + '</span></li>';
          }).join('') + '</ul>' : '') +
          (p.benefits.length ? '<div class="box-pop-in bg-emerald-50 rounded-xl p-5 mb-5"><h3 class="font-bold text-emerald-900 mb-3"><i class="fas fa-star mr-1.5"></i>উপকারিতা</h3><ul class="space-y-2">' + p.benefits.map(function (b) {
            return '<li class="flex items-start gap-2 text-sm"><i class="fas fa-leaf text-emerald-600 mt-0.5"></i><span>' + esc(b) + '</span></li>';
          }).join('') + '</ul></div>' : '') +
          (p.ingredients ? '<details class="box-pop-in mb-3 bg-white border border-gray-200 rounded-xl"><summary class="px-4 py-3 font-semibold cursor-pointer">উপাদানসমূহ</summary><p class="px-4 pb-4 text-sm text-gray-600">' + esc(p.ingredients) + '</p></details>' : '') +
          (p.usage_instructions ? '<details class="box-pop-in mb-3 bg-white border border-gray-200 rounded-xl"><summary class="px-4 py-3 font-semibold cursor-pointer">ব্যবহারবিধি</summary><p class="px-4 pb-4 text-sm text-gray-600">' + esc(p.usage_instructions) + '</p></details>' : '') +
          (p.package_details ? '<p class="text-sm text-gray-500 mb-4"><i class="fas fa-box mr-1.5"></i>' + esc(p.package_details) + '</p>' : '') +
          '<div class="flex items-center gap-2 mb-5">' +
            (p.stock_status === 'out_of_stock' ? '<span class="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-circle-xmark mr-1"></i>স্টকে নেই</span>' :
             p.stock_status === 'low_stock' ? '<span class="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-triangle-exclamation mr-1"></i>সীমিত স্টক!</span>' :
             '<span class="bg-emerald-100 text-emerald-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-circle-check mr-1"></i>স্টকে আছে</span>') +
          '</div>' +
          '<button onclick="NCB.scrollToOrder()" class="btn-primary btn-tilt btn-shine-loop text-white font-bold text-lg px-8 py-4 rounded-xl w-full sm:w-auto" data-tilt="1"><i class="fas fa-cart-shopping mr-2"></i>এখনই অর্ডার করুন</button>' +
        '</div>' +
      '</div></section>';
  }

  function renderOrderForm(product, s) {
    if (!product) return '';
    var pkgs = product.packages || [];
    return '<section id="order-section" class="py-12 bg-gradient-to-b from-emerald-900 to-emerald-950">' +
      '<div class="max-w-2xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-white mb-2">অর্ডার করতে ফর্মটি পূরণ করুন</h2>' +
        '<p class="text-center text-emerald-200 mb-8">পণ্য হাতে পেয়ে টাকা দিন — ক্যাশ অন ডেলিভারি</p>' +
        '<div class="bg-white rounded-2xl shadow-2xl p-5 md:p-8">' +
          '<h3 class="font-bold text-gray-900 mb-3"><i class="fas fa-box-open text-emerald-600 mr-1.5"></i>প্যাকেজ নির্বাচন করুন</h3>' +
          '<div class="space-y-3 mb-6" id="package-list">' +
          (pkgs.length ? pkgs.map(function (pk) {
            return '<div class="package-card box-pop-in border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between" data-pkg="' + pk.id + '" onclick="NCB.selectPackage(' + pk.id + ', true)">' +
              '<div class="flex items-center gap-3">' +
                '<div class="pkg-radio w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center"><div class="pkg-dot w-2.5 h-2.5 rounded-full bg-emerald-600 hidden"></div></div>' +
                '<div><div class="font-bold text-gray-900">' + esc(pk.name) +
                (pk.badge ? ' <span class="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full ml-1">' + esc(pk.badge) + '</span>' : '') + '</div>' +
                (pk.free_delivery ? '<div class="text-xs text-emerald-600 font-semibold"><i class="fas fa-truck mr-1"></i>ফ্রি ডেলিভারি</div>' : '') + '</div>' +
              '</div>' +
              '<div class="text-right"><div class="font-bold text-emerald-700 text-lg">' + money(pk.price) + '</div>' +
              (pk.regular_price > pk.price ? '<div class="text-xs text-gray-400 line-through">' + money(pk.regular_price) + '</div>' : '') + '</div>' +
            '</div>';
          }).join('') :
          '<div class="package-card box-pop-in border-2 border-gray-200 rounded-xl p-4" data-pkg="0" onclick="NCB.selectPackage(0, true)"><div class="font-bold">' + esc(product.name) + ' — ' + money(product.sale_price) + '</div></div>') +
          '</div>' +

          '<form id="order-form" onsubmit="NCB.submitOrder(event)">' +
            '<div class="grid sm:grid-cols-2 gap-4 mb-4">' +
              '<div class="sm:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1.5">আপনার নাম *</label>' +
              '<input type="text" name="customer_name" id="f-name" required autocomplete="name" oninvalid="this.setCustomValidity(\'অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন\')" oninput="this.setCustomValidity(\'\')" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="সম্পূর্ণ নাম লিখুন (যেমন: করিম উদ্দিন)">' +
              '<p id="f-name-err" class="hidden text-xs text-red-600 mt-1"></p></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">মোবাইল নম্বর *</label>' +
              '<input type="tel" name="phone" id="f-phone" required autocomplete="tel" oninvalid="this.setCustomValidity(\'অনুগ্রহ করে সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)\')" oninput="this.setCustomValidity(\'\')" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="01XXXXXXXXX" maxlength="14">' +
              '<p id="f-phone-err" class="hidden text-xs text-red-600 mt-1"></p></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">বিকল্প মোবাইল (ঐচ্ছিক)</label>' +
              '<input type="tel" name="alt_phone" id="f-alt-phone" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="01XXXXXXXXX" maxlength="14"></div>' +
              '<div class="sm:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1.5">সম্পূর্ণ ঠিকানা *</label>' +
              '<textarea name="address" id="f-address" required rows="2" oninvalid="this.setCustomValidity(\'অনুগ্রহ করে আপনার সম্পূর্ণ ঠিকানা লিখুন\')" oninput="this.setCustomValidity(\'\')" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="বাসা/হোল্ডিং নম্বর, রোড, এলাকা"></textarea>' +
              '<p id="f-address-err" class="hidden text-xs text-red-600 mt-1"></p></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">জেলা *</label>' +
              '<input type="text" name="district" id="f-district" required list="district-list" autocomplete="off" oninvalid="this.setCustomValidity(\'অনুগ্রহ করে আপনার জেলা লিখুন\')" oninput="this.setCustomValidity(\'\')" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="জেলার নাম লিখুন" onkeyup="NCB.updateTotal()" onchange="NCB.updateTotal()">' +
              '<datalist id="district-list">' +
                DISTRICTS.map(function (dd) { return '<option value="' + dd + '">'; }).join('') +
              '</datalist>' +
              '<p id="f-district-err" class="hidden text-xs text-red-600 mt-1"></p></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">উপজেলা/থানা *</label>' +
              '<input type="text" name="upazila" id="f-upazila" required oninvalid="this.setCustomValidity(\'অনুগ্রহ করে আপনার উপজেলা/থানা লিখুন\')" oninput="this.setCustomValidity(\'\')" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="উপজেলা/থানা লিখুন">' +
              '<p id="f-upazila-err" class="hidden text-xs text-red-600 mt-1"></p></div>' +
              '<div class="sm:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1.5">অর্ডার নোট (ঐচ্ছিক)</label>' +
              '<input type="text" name="order_note" id="f-note" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="বিশেষ কোনো নির্দেশনা থাকলে লিখুন"></div>' +
            '</div>' +

            '<div id="otp-section" class="hidden mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">' +
              '<div class="text-sm font-semibold text-blue-800 mb-2"><i class="fas fa-shield-halved mr-1"></i>মোবাইল নম্বর ভেরিফাই করুন</div>' +
              '<div class="flex gap-2"><input type="text" id="f-otp" class="flex-1 border border-blue-300 rounded-lg px-3 py-2" placeholder="OTP কোড">' +
              '<button type="button" onclick="NCB.requestOtp()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">OTP পাঠান</button>' +
              '<button type="button" onclick="NCB.verifyOtp()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">ভেরিফাই</button></div>' +
              '<div id="otp-msg" class="text-xs mt-2"></div>' +
            '</div>' +

            '<div class="bg-gray-50 rounded-xl p-4 mb-5 space-y-2 text-sm" id="order-summary">' +
              '<div class="flex justify-between"><span class="text-gray-600">পণ্যের মূল্য</span><span id="sum-subtotal" class="font-semibold">৳0</span></div>' +
              '<div class="flex justify-between"><span class="text-gray-600">ডেলিভারি চার্জ</span><span id="sum-delivery" class="font-semibold">৳0</span></div>' +
              '<div class="border-t border-gray-200 pt-2 flex justify-between text-base"><span class="font-bold text-gray-900">সর্বমোট</span><span id="sum-total" class="font-bold text-emerald-700 text-lg">৳0</span></div>' +
            '</div>' +

            '<div id="form-error" class="hidden mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4"></div>' +

            '<button type="submit" id="submit-btn" class="btn-primary btn-tilt btn-shine-loop w-full text-white font-bold text-lg py-4 rounded-xl" data-tilt="1">' +
            '<i class="fas fa-check-circle mr-2"></i>অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)</button>' +
            '<p class="text-center text-xs text-gray-500 mt-3"><i class="fas fa-lock mr-1"></i>আপনার তথ্য সম্পূর্ণ নিরাপদ থাকবে</p>' +

            '<div class="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5 items-start">' +
              '<i class="fas fa-heart text-amber-500 mt-0.5"></i>' +
              '<p class="text-xs text-amber-800 leading-relaxed">অনুগ্রহ করে সঠিক তথ্য দিয়ে অর্ডার করুন। একটি মিথ্যা/ভুয়া অর্ডারের জন্য আমাদের প্রায় <b>১৩০ টাকা কুরিয়ার খরচ</b> চলে যায়, যা একটি ছোট ব্যবসার জন্য অনেক বড় ক্ষতি। আপনার একটু সচেতনতাই আমাদের পাশে থাকার সবচেয়ে বড় সহযোগিতা 🙏</p>' +
            '</div>' +

            '<div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">' +
              '<div class="text-sm font-bold text-emerald-800 mb-2"><i class="fas fa-list-check mr-1.5"></i>অর্ডার করার নিয়ম (৪টি সহজ ধাপ)</div>' +
              '<ol class="text-xs text-emerald-800 space-y-1.5 list-none">' +
                '<li class="flex gap-2"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">১</span><span>উপরের ফর্মে আপনার নাম, সঠিক মোবাইল নম্বর ও সম্পূর্ণ ঠিকানা দিন</span></li>' +
                '<li class="flex gap-2"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">২</span><span>"অর্ডার কনফার্ম করুন" বাটনে ক্লিক করুন</span></li>' +
                '<li class="flex gap-2"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">৩</span><span>আমাদের প্রতিনিধি ফোনে কল করে অর্ডার কনফার্ম করবেন</span></li>' +
                '<li class="flex gap-2"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">৪</span><span>পণ্য হাতে পেয়ে ক্যাশ অন ডেলিভারিতে মূল্য পরিশোধ করুন</span></li>' +
              '</ol>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div></section>';
  }

  // ============ COUNTDOWN ============
  var countdownTimer = null;
  function initCountdown() {
    var s = state.data.settings;
    var wrap = document.getElementById('countdown-wrap');
    if (!wrap || s.countdown_enabled !== '1' || !s.countdown_end) return;
    var end = new Date(s.countdown_end).getTime();
    function tick() {
      var diff = end - Date.now();
      if (diff <= 0) {
        wrap.innerHTML = '<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-semibold"><i class="fas fa-info-circle mr-1"></i>' + esc(s.countdown_fallback_text || 'অফার শেষ!') + '</div>';
        clearInterval(countdownTimer);
        return;
      }
      var dd = Math.floor(diff / 86400000), hh = Math.floor(diff % 86400000 / 3600000),
          mm = Math.floor(diff % 3600000 / 60000), ss = Math.floor(diff % 60000 / 1000);
      wrap.innerHTML = '<div class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-clock text-red-500 mr-1"></i>অফার শেষ হতে বাকি:</div>' +
        '<div class="flex gap-2">' + [[dd, 'দিন'], [hh, 'ঘণ্টা'], [mm, 'মিনিট'], [ss, 'সেকেন্ড']].map(function (x) {
          return '<div class="countdown-box text-white rounded-xl px-3 py-2 text-center"><div class="text-2xl font-bold">' + String(x[0]).padStart(2, '0') + '</div><div class="text-xs opacity-80">' + x[1] + '</div></div>';
        }).join('') + '</div>';
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ============ SCROLL FX + STICKY ============
  function initScrollAnimations() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.box-pop-in').forEach(function (el) { io.observe(el); });
  }

  // ============ BUTTON ENTRANCE (zoom-bug fix) ============
  // The mousemove-driven 3D tilt (rotateX/rotateY/perspective on the header logo and
  // order/call buttons) has been REMOVED entirely — it created a "zoom in / zoom out"
  // effect whenever the mouse moved over the page. Buttons keep their shine-sweep,
  // pulse and pop-in entrance animations, which don't move the layout.
  function initAdvanced3D() {
    // One-shot pop-in for buttons using the transition-based start/go pair
    // (kept separate from `animation`-driven elements like .pulse-cta so the two
    // never fight over the same CSS `animation` shorthand property).
    document.querySelectorAll('.btn-pop-in-start').forEach(function (btn) {
      var delay = Number(btn.dataset.popDelay || 0);
      setTimeout(function () { btn.classList.add('btn-pop-in-go'); }, delay);
    });
  }
  function initStickyCta() {
    var sticky = document.getElementById('sticky-cta');
    var orderSec = document.getElementById('order-section');
    if (!sticky) return;
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY > 400;
      var orderVisible = false;
      if (orderSec) {
        var r = orderSec.getBoundingClientRect();
        orderVisible = r.top < window.innerHeight && r.bottom > 0;
      }
      sticky.classList.toggle('hidden', !scrolled || orderVisible);
    }, { passive: true });
  }

  // ============ PACKAGE + TOTALS ============
  var selectedPkg = null;
  var checkoutTracked = false;
  // PIXEL ACCURACY FIX: selectPackage() is ALSO auto-called once on page load
  // (to pre-select the default package). Previously that auto-call fired the
  // InitiateCheckout pixel for EVERY visitor — inflating the checkout count to
  // ~equal PageView and feeding Facebook's ad optimizer garbage data. Now the
  // event only fires on a REAL user interaction (package click / form focus).
  function fireInitiateCheckout() {
    if (checkoutTracked) return;
    checkoutTracked = true;
    var p = state.data.products[0];
    if (p) track('InitiateCheckout', { content_ids: [String(p.id)], currency: 'BDT', value: getPricing().subtotal });
  }
  function selectPackage(pkgId, isUserAction) {
    selectedPkg = pkgId;
    document.querySelectorAll('.package-card').forEach(function (el) {
      var on = Number(el.dataset.pkg) === Number(pkgId);
      el.classList.toggle('selected', on);
      var dot = el.querySelector('.pkg-dot');
      if (dot) dot.classList.toggle('hidden', !on);
    });
    updateTotal();
    if (isUserAction) fireInitiateCheckout();
  }

  function getPricing() {
    var s = state.data.settings;
    var p = state.data.products[0];
    if (!p) return { subtotal: 0, delivery: 0, total: 0 };
    var subtotal = 0, freeDel = false;
    if (selectedPkg) {
      var pk = p.packages.find(function (x) { return x.id === Number(selectedPkg); });
      if (pk) { subtotal = pk.price; freeDel = !!pk.free_delivery; }
      else subtotal = p.sale_price;
    } else subtotal = p.sale_price;
    var district = (document.getElementById('f-district') || {}).value || '';
    var isDhaka = /ঢাকা|dhaka/i.test(district.trim());
    var delivery = freeDel ? 0 : (isDhaka ? Number(s.delivery_charge_dhaka || 70) : Number(s.delivery_charge_outside || 130));
    if (s.free_delivery_enabled === '1' && subtotal >= Number(s.free_delivery_min || 999999)) delivery = 0;
    return { subtotal: subtotal, delivery: delivery, total: subtotal + delivery };
  }

  function updateTotal() {
    var pr = getPricing();
    var el = function (id) { return document.getElementById(id); };
    if (el('sum-subtotal')) el('sum-subtotal').textContent = money(pr.subtotal);
    if (el('sum-delivery')) el('sum-delivery').textContent = pr.delivery === 0 ? 'ফ্রি' : money(pr.delivery);
    if (el('sum-total')) el('sum-total').textContent = money(pr.total);
  }

  // ============ OTP ============
  var otpVerified = false;
  function requestOtp() {
    var phone = document.getElementById('f-phone').value;
    var msg = document.getElementById('otp-msg');
    axios.post('/api/public/otp/request', { phone: phone }).then(function (r) {
      msg.textContent = r.data.message;
      msg.className = 'text-xs mt-2 text-blue-700';
    }).catch(function (e) {
      msg.textContent = (e.response && e.response.data.message) || 'OTP পাঠানো যায়নি';
      msg.className = 'text-xs mt-2 text-red-600';
    });
  }
  function verifyOtp() {
    var phone = document.getElementById('f-phone').value;
    var code = document.getElementById('f-otp').value;
    var msg = document.getElementById('otp-msg');
    axios.post('/api/public/otp/verify', { phone: phone, code: code }).then(function () {
      otpVerified = true;
      msg.innerHTML = '<i class="fas fa-check-circle mr-1"></i>মোবাইল নম্বর ভেরিফাইড!';
      msg.className = 'text-xs mt-2 text-emerald-700 font-semibold';
    }).catch(function (e) {
      msg.textContent = (e.response && e.response.data.message) || 'ভুল OTP';
      msg.className = 'text-xs mt-2 text-red-600';
    });
  }

  // ============ SUBMIT ============
  function submitOrder(ev) {
    ev.preventDefault();
    if (state.submitting) return;
    var p = state.data.products[0];
    var errEl = document.getElementById('form-error');
    errEl.classList.add('hidden');

    var phone = document.getElementById('f-phone').value.replace(/[\s-]/g, '');
    var phoneValid = /^01[3-9]\d{8}$/.test(phone.replace(/^\+?880?/, '0'));
    showFieldError('f-phone', phoneValid ? '' : 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)');

    // Hard gate: নাম, ঠিকানা, জেলা, উপজেলা/থানা — প্রতিটি ফিল্ড সঠিকভাবে পূরণ না হলে
    // (ভুলভাল/অর্থহীন টেক্সট দিলে) অর্ডার সাবমিট হবে না — প্রতিটি ফিল্ডের নিচে
    // নির্দিষ্ট এরর মেসেজ দেখানো হবে এবং প্রথম ভুল ফিল্ডে স্ক্রল করা হবে।
    var formValid = validateOrderForm();
    if (!phoneValid || !formValid) {
      errEl.textContent = 'অনুগ্রহ করে ফর্মের চিহ্নিত ভুলগুলো ঠিক করুন';
      errEl.classList.remove('hidden');
      var firstBadId = !phoneValid ? 'f-phone' : Object.keys(FIELD_VALIDATORS).find(function (id) {
        var errBox = document.getElementById(id + '-err');
        return errBox && !errBox.classList.contains('hidden');
      });
      var scrollTarget = (firstBadId && document.getElementById(firstBadId)) || errEl;
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var customerName = document.getElementById('f-name').value;

    state.submitting = true;
    var btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner mr-2"></span>অর্ডার প্রসেস হচ্ছে...';

    var payload = {
      customer_name: customerName,
      phone: phone,
      alt_phone: document.getElementById('f-alt-phone').value,
      address: document.getElementById('f-address').value,
      district: document.getElementById('f-district').value,
      upazila: document.getElementById('f-upazila').value,
      order_note: document.getElementById('f-note').value,
      items: [{ product_id: p.id, package_id: selectedPkg || null, quantity: 1 }],
      otp_verified: otpVerified,
      source_url: location.href,
      session_id: sessionId,
      fbp: getCookie('_fbp'), fbc: getCookie('_fbc')
    };
    Object.assign(payload, state.utm);

    // Booster requirement #1: attach hashed name/phone (Advanced Matching) to the
    // Pixel BEFORE firing Purchase, so this exact event carries fn/ph.
    applyAdvancedMatching(customerName, phone);

    track('Lead', { content_name: p.name }, null, { name: customerName, phone: phone });

    // PURCHASE DEDUP + DYNAMIC VALUE FIX (2026-09-04): the browser Purchase pixel now
    // fires ONLY AFTER the order API responds successfully, using the SERVER-issued
    // event_id and SERVER-computed grand_total from the response:
    //   • event_id — generated ONCE by the backend and used for BOTH the server CAPI
    //     Purchase (fired inside /api/public/orders) and this browser fbq() call, so Meta
    //     de-duplicates them into ONE conversion by construction. (Previously the client
    //     generated its own id pre-submit; if the order then FAILED validation/stock/rate
    //     limits, that phantom browser Purchase could never be paired with a server event
    //     — it was counted as a purchase that never happened and could never dedup.)
    //   • value — the authoritative per-order total (package price + real delivery charge)
    //     straight from the server, currency 'BDT'. Fully dynamic per order — no hardcoded
    //     amount (previously the browser guessed the total before the server validated it,
    //     and the two could disagree, hurting ROAS accuracy).
    // If the customer closes the tab before the response arrives, the order is still
    // tracked — the guaranteed server-side CAPI Purchase covers that case on its own.
    axios.post('/api/public/orders', payload).then(function (r) {
      var o = r.data.order;
      var netTotal = Number(o.grand_total) - Number(o.delivery_charge || 0);
      var totalQty = o.items.reduce(function (s, it) { return s + (Number(it.quantity) || 1); }, 0) || 1;
      // content_type:'product' + contents[] per Meta spec — required for catalog/DPA
      // matching and improves the ad account's event match quality score.
      track('Purchase', {
        value: Number(o.grand_total), currency: 'BDT',
        content_ids: [String(p.id)], content_type: 'product', content_name: p.name,
        contents: [{ id: String(p.id), quantity: totalQty, item_price: Math.round(netTotal / totalQty * 100) / 100 }],
        num_items: totalQty
      }, o.event_id, { name: customerName, phone: phone });
      showConfirmation(o);
    }).catch(function (e) {
      state.submitting = false;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)';
      var d = e.response && e.response.data;
      errEl.innerHTML = d && d.messages ? d.messages.join('<br>') : (d && d.message) || 'আপনার অর্ডারটি সম্পূর্ণভাবে গ্রহণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
      errEl.classList.remove('hidden');
      errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function showConfirmation(o) {
    var s = state.data.settings;
    window.scrollTo(0, 0);
    document.getElementById('app').innerHTML =
    '<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4 py-10">' +
      '<div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">' +
        '<div class="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-100 flex items-center justify-center"><i class="fas fa-check text-emerald-600 text-4xl"></i></div>' +
        '<h1 class="text-2xl font-bold text-gray-900 mb-2">✅ অর্ডার কনফার্মড!</h1>' +
        '<p class="text-gray-600 mb-6">আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। আমাদের প্রতিনিধি শীঘ্রই ফোনে যোগাযোগ করবেন।</p>' +
        '<div class="bg-emerald-50 rounded-2xl p-5 text-left space-y-2.5 mb-6 text-sm">' +
          '<div class="flex justify-between"><span class="text-gray-500">অর্ডার আইডি</span><span class="font-bold text-emerald-700 text-base">#' + esc(o.order_number) + '</span></div>' +
          '<div class="flex justify-between"><span class="text-gray-500">নাম</span><span class="font-semibold">' + esc(o.customer_name) + '</span></div>' +
          o.items.map(function (it) {
            return '<div class="flex justify-between"><span class="text-gray-500">' + esc(it.package || it.name) + '</span><span class="font-semibold">' + money(it.total) + '</span></div>';
          }).join('') +
          '<div class="flex justify-between"><span class="text-gray-500">ডেলিভারি চার্জ</span><span class="font-semibold">' + (o.delivery_charge === 0 ? 'ফ্রি' : money(o.delivery_charge)) + '</span></div>' +
          '<div class="border-t border-emerald-200 pt-2.5 flex justify-between"><span class="font-bold">সর্বমোট (COD)</span><span class="font-bold text-emerald-700 text-lg">' + money(o.grand_total) + '</span></div>' +
          '<div class="flex justify-between"><span class="text-gray-500">ডেলিভারি সময়</span><span class="font-semibold">২-৪ কার্যদিবস</span></div>' +
        '</div>' +
        '<div class="space-y-3">' +
          '<a href="/track-order" class="block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl"><i class="fas fa-truck-fast mr-2"></i>অর্ডার ট্র্যাক করুন</a>' +
          '<a href="tel:' + esc(s.support_phone) + '" class="btn-tilt block border-2 border-gray-200 hover:border-emerald-500 text-gray-700 font-semibold py-3 rounded-xl" data-tilt="1"><i class="fas fa-headset mr-2 phone-ring-icon"></i>সাপোর্ট: ' + esc(s.support_phone) + '</a>' +
          '<a href="/" class="block text-sm text-gray-400 hover:text-gray-600 py-2">← হোমপেজে ফিরে যান</a>' +
        '</div>' +
      '</div></div>';
  }

  // ============ MISC PUBLIC API ============
  window.NCB = {
    scrollToOrder: function () {
      var el = document.getElementById('order-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
    selectPackage: selectPackage,
    updateTotal: updateTotal,
    toggleFaq: function (i) {
      document.getElementById('faq-' + i).classList.toggle('open');
    },
    setGallery: function (thumb, src) {
      document.getElementById('gallery-main').src = src;
      document.querySelectorAll('.gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
      thumb.classList.add('active');
    },
    submitOrder: submitOrder,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    goBanner: function (i, relative) { showBanner(relative ? bannerIdx + i : i); },
    zoomCert: function (src) {
      var m = document.createElement('div');
      m.className = 'fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4';
      m.onclick = function () { m.remove(); };
      m.innerHTML = '<img src="' + src + '" class="max-w-full max-h-[90vh] rounded-xl shadow-2xl"><button class="absolute top-4 right-4 text-white text-3xl"><i class="fas fa-xmark"></i></button>';
      document.body.appendChild(m);
    }
  };

  // ============ SPLASH (premium entry animation: aurora bg, 3D logo, name wipe, progress) ============
  // Keeps the splash visible for a minimum time so the full cinematic sequence is
  // always seen (even on a fast connection), then fades it out (iris-wipe) once
  // real content is ready. Progress bar reflects the real page-load state: it eases
  // up to ~92% while waiting for the API response, then completes to 100% right
  // before the iris-wipe exit — never a fake "instant 100%".
  var splashStart = Date.now();
  var MIN_SPLASH_MS = 2200;
  var splashDataReady = false;
  var splashProgressRAF = null;
  function tickSplashProgress() {
    var fill = document.getElementById('splash-progress-fill');
    var pct = document.getElementById('splash-progress-pct');
    if (!fill || !pct) return;
    var elapsed = Date.now() - splashStart;
    var target = splashDataReady ? 100 : Math.min(92, (elapsed / MIN_SPLASH_MS) * 92);
    var current = parseFloat(fill.style.width) || 0;
    var next = current + (target - current) * 0.18;
    if (splashDataReady && target - next < 0.5) next = 100;
    fill.style.width = next + '%';
    pct.textContent = Math.round(next) + '%';
    if (next < 99.5) {
      splashProgressRAF = requestAnimationFrame(tickSplashProgress);
    }
  }
  tickSplashProgress();
  function hideSplash() {
    splashDataReady = true;
    var el = document.getElementById('site-splash');
    if (!el) return;
    var elapsed = Date.now() - splashStart;
    var wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    setTimeout(function () {
      if (splashProgressRAF) cancelAnimationFrame(splashProgressRAF);
      var fill = document.getElementById('splash-progress-fill');
      var pct = document.getElementById('splash-progress-pct');
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      setTimeout(function () {
        el.classList.add('splash-hide');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
      }, 180);
    }, wait);
  }

  // ============ INIT ============
  axios.get('/api/public/content').then(function (r) {
    state.data = r.data;
    render();
    hideSplash();
    // Show OTP section if enabled
    if (r.data.settings.otp_enabled === '1') {
      var otpSec = document.getElementById('otp-section');
      if (otpSec) otpSec.classList.remove('hidden');
    }
  }).catch(function () {
    document.getElementById('app').innerHTML = '<div class="min-h-screen flex items-center justify-center px-4"><div class="text-center"><i class="fas fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i><p class="text-gray-600">পেজটি লোড করা যায়নি। অনুগ্রহ করে পেজ রিফ্রেশ করুন।</p></div></div>';
    hideSplash();
  });
})();
