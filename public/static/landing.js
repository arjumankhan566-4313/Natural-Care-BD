// ============ Nature Care Bangladesh — Landing Page App ============
(function () {
  'use strict';

  var DISTRICTS = ['ঢাকা','গাজীপুর','নারায়ণগঞ্জ','মুন্সিগঞ্জ','মানিকগঞ্জ','নরসিংদী','টাঙ্গাইল','কিশোরগঞ্জ','ফরিদপুর','গোপালগঞ্জ','মাদারীপুর','রাজবাড়ী','শরীয়তপুর','চট্টগ্রাম','কক্সবাজার','কুমিল্লা','ব্রাহ্মণবাড়িয়া','চাঁদপুর','লক্ষ্মীপুর','নোয়াখালী','ফেনী','খাগড়াছড়ি','রাঙ্গামাটি','বান্দরবান','রাজশাহী','বগুড়া','পাবনা','সিরাজগঞ্জ','নওগাঁ','নাটোর','জয়পুরহাট','চাঁপাইনবাবগঞ্জ','খুলনা','যশোর','সাতক্ষীরা','বাগেরহাট','ঝিনাইদহ','মাগুরা','নড়াইল','কুষ্টিয়া','চুয়াডাঙ্গা','মেহেরপুর','বরিশাল','পটুয়াখালী','ভোলা','পিরোজপুর','বরগুনা','ঝালকাঠি','সিলেট','মৌলভীবাজার','হবিগঞ্জ','সুনামগঞ্জ','রংপুর','দিনাজপুর','গাইবান্ধা','কুড়িগ্রাম','লালমনিরহাট','নীলফামারী','পঞ্চগড়','ঠাকুরগাঁও','ময়মনসিংহ','জামালপুর','নেত্রকোণা','শেরপুর'];

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
  // Meta ad params
  state.utm.campaign_id = params.get('campaign_id') || '';
  state.utm.adset_id = params.get('adset_id') || '';
  state.utm.ad_id = params.get('ad_id') || '';

  // ---- Event tracking (client pixel + server-side dedup) ----
  function genEventId() {
    return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }
  function track(eventName, data, eventId) {
    var eid = eventId || genEventId();
    var enabled = state.data && state.data.settings.meta_pixel_enabled === '1';
    var events = ((state.data && state.data.settings.meta_events_enabled) || '').split(',');
    if (enabled && window.fbq && events.indexOf(eventName) !== -1) {
      window.fbq('track', eventName, data || {}, { eventID: eid });
    }
    axios.post('/api/public/events', {
      event_name: eventName, event_id: eid, data: data || {},
      source_url: location.href, fbclid: state.utm.fbclid || ''
    }).catch(function () {});
    return eid;
  }

  function money(n) { return '৳' + Number(n || 0).toLocaleString('bn-BD'); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function stars(r) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += '<i class="fa' + (i <= r ? 's' : 'r') + ' fa-star text-amber-400"></i>';
    return out;
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
        '<div class="flex items-center gap-2">' +
          (s.brand_logo ? '<img src="' + esc(s.brand_logo) + '" alt="logo" class="h-10">' :
          '<div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white"><i class="fas fa-leaf"></i></div>') +
          '<div><div class="font-bold text-emerald-800 leading-tight">' + esc(s.brand_name) + '</div>' +
          '<div class="text-xs text-gray-500">' + esc(s.brand_tagline || '') + '</div></div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<a href="tel:' + esc(s.support_phone) + '" class="hidden sm:flex items-center gap-2 text-sm font-semibold text-emerald-700"><i class="fas fa-phone"></i>' + esc(s.support_phone) + '</a>' +
          '<a href="/track-order" class="text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-medium"><i class="fas fa-truck-fast mr-1"></i>অর্ডার ট্র্যাক</a>' +
        '</div>' +
      '</div>' +
    '</header>' +

    // ===== HERO =====
    '<section id="hero-section" class="bg-gradient-to-b from-emerald-50 via-white to-white">' +
      '<div class="max-w-6xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">' +
        '<div class="order-2 md:order-1">' +
          '<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full mb-4"><i class="fas fa-bolt"></i> ' + esc(s.offer_title || 'বিশেষ অফার') + '</span>' +
          '<h1 class="text-3xl md:text-5xl font-bold text-gray-900 leading-snug mb-4">' + esc(s.hero_headline) + '</h1>' +
          '<p class="text-gray-600 text-base md:text-lg mb-6">' + esc(s.hero_subheadline) + '</p>' +
          (product ?
          '<div class="flex items-center gap-4 mb-6">' +
            '<span class="text-3xl md:text-4xl font-bold text-emerald-700">' + money(product.sale_price) + '</span>' +
            (product.regular_price > product.sale_price ? '<span class="text-xl text-gray-400 line-through">' + money(product.regular_price) + '</span>' +
            '<span class="bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-lg">' + discountPct + '% ছাড়</span>' : '') +
          '</div>' : '') +
          '<div id="countdown-wrap" class="mb-6"></div>' +
          '<div class="flex flex-col sm:flex-row gap-3">' +
            '<button onclick="NCB.scrollToOrder()" class="btn-primary pulse-cta text-white font-bold text-lg px-8 py-4 rounded-xl"><i class="fas fa-cart-shopping mr-2"></i>অর্ডার করতে এখনই ক্লিক করুন</button>' +
            '<a href="tel:' + esc(s.support_phone) + '" class="border-2 border-emerald-600 text-emerald-700 font-bold text-lg px-8 py-4 rounded-xl text-center hover:bg-emerald-50 transition"><i class="fas fa-phone mr-2"></i>কল করুন</a>' +
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

    // ===== PRODUCT SECTION =====
    (product ? renderProduct(product) : '') +

    // ===== BENEFITS =====
    (d.benefits.length ?
    '<section id="benefits-section" class="py-12 bg-emerald-50/50">' +
      '<div class="max-w-6xl mx-auto px-4">' +
        '<h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">কেন আমাদের বেছে নেবেন?</h2>' +
        '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">' +
        d.benefits.map(function (b) {
          return '<article class="fade-up bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition">' +
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
          return '<div class="fade-up relative bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">' +
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
          return '<article class="review-card fade-up bg-white rounded-2xl p-6">' +
            '<div class="mb-3">' + stars(rv.rating) + '</div>' +
            '<p class="text-gray-700 mb-4">"' + esc(rv.review_text) + '"</p>' +
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
          return '<div class="faq-item bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden" id="faq-' + i + '">' +
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
          '<a href="tel:' + esc(s.support_phone) + '" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><i class="fas fa-phone mr-1.5"></i>কল করুন</a>' +
          (s.whatsapp_number ? '<a href="https://wa.me/' + esc(s.whatsapp_number) + '" target="_blank" rel="noopener" class="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><i class="fab fa-whatsapp mr-1.5"></i>WhatsApp</a>' : '') +
          (s.messenger_link ? '<a href="' + esc(s.messenger_link) + '" target="_blank" rel="noopener" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><i class="fab fa-facebook-messenger mr-1.5"></i>Messenger</a>' : '') +
        '</div>' +
        '<div class="text-xs text-gray-500">© ' + new Date().getFullYear() + ' ' + esc(s.brand_name) + ' — সর্বস্বত্ব সংরক্ষিত | <a href="/track-order" class="underline">অর্ডার ট্র্যাক করুন</a></div>' +
      '</div>' +
    '</footer>' +

    // ===== STICKY MOBILE CTA =====
    '<div id="sticky-cta" class="sticky-cta md:hidden bg-white border-t border-gray-200 p-3 hidden">' +
      '<button onclick="NCB.scrollToOrder()" class="btn-primary w-full text-white font-bold py-3.5 rounded-xl text-base"><i class="fas fa-truck mr-2"></i>🚚 Cash on Delivery | এখনই অর্ডার করুন</button>' +
    '</div>';

    initCountdown();
    initScrollAnimations();
    initStickyCta();
    initBannerSlider();
    initAutosave();
    if (product) selectPackage(product.packages.length ? product.packages[0].id : 0);
    track('PageView', {});
    if (product) track('ViewContent', { content_name: product.name, content_ids: [String(product.id)], value: product.sale_price, currency: 'BDT' });
  }

  // ============ HERO BANNER SLIDER ============
  function renderHeroBanner(d, product, discountPct) {
    var banners = d.banners || [];
    if (!banners.length) {
      // Fallback: product main image (previous behaviour)
      return (product ? '<img src="' + esc(product.main_image) + '" alt="' + esc(product.name) + '" class="rounded-2xl shadow-2xl w-full" loading="eager">' +
        (discountPct ? '<div class="badge-float absolute -top-3 -right-3 bg-red-500 text-white w-20 h-20 rounded-full flex flex-col items-center justify-center font-bold shadow-lg"><span class="text-xl">' + discountPct + '%</span><span class="text-xs">৛াড়</span></div>' : '') : '');
    }
    var slides = banners.map(function (b, i) {
      var img = '<img src="' + esc(b.image_url) + '" alt="' + esc(b.title || 'banner') + '" class="w-full h-full object-cover" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
      var caption = (b.title || b.subtitle) ?
        '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">' +
          (b.title ? '<div class="text-white font-bold text-lg drop-shadow">' + esc(b.title) + '</div>' : '') +
          (b.subtitle ? '<div class="text-white/90 text-sm drop-shadow">' + esc(b.subtitle) + '</div>' : '') +
        '</div>' : '';
      var inner = '<div class="relative w-full h-full">' + img + caption + '</div>';
      if (b.link_url) inner = '<a href="' + esc(b.link_url) + '" class="block w-full h-full">' + inner + '</a>';
      return '<div class="banner-slide absolute inset-0 transition-opacity duration-700 ' + (i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0') + '" data-slide="' + i + '">' + inner + '</div>';
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
    return '<div id="hero-banner" class="relative rounded-2xl shadow-2xl overflow-hidden w-full" style="aspect-ratio:4/3">' + slides + dots + arrows + '</div>';
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
      source_url: location.href
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
          (p.benefits.length ? '<div class="bg-emerald-50 rounded-xl p-5 mb-5"><h3 class="font-bold text-emerald-900 mb-3"><i class="fas fa-star mr-1.5"></i>উপকারিতা</h3><ul class="space-y-2">' + p.benefits.map(function (b) {
            return '<li class="flex items-start gap-2 text-sm"><i class="fas fa-leaf text-emerald-600 mt-0.5"></i><span>' + esc(b) + '</span></li>';
          }).join('') + '</ul></div>' : '') +
          (p.ingredients ? '<details class="mb-3 bg-white border border-gray-200 rounded-xl"><summary class="px-4 py-3 font-semibold cursor-pointer">উপাদানসমূহ</summary><p class="px-4 pb-4 text-sm text-gray-600">' + esc(p.ingredients) + '</p></details>' : '') +
          (p.usage_instructions ? '<details class="mb-3 bg-white border border-gray-200 rounded-xl"><summary class="px-4 py-3 font-semibold cursor-pointer">ব্যবহারবিধি</summary><p class="px-4 pb-4 text-sm text-gray-600">' + esc(p.usage_instructions) + '</p></details>' : '') +
          (p.package_details ? '<p class="text-sm text-gray-500 mb-4"><i class="fas fa-box mr-1.5"></i>' + esc(p.package_details) + '</p>' : '') +
          '<div class="flex items-center gap-2 mb-5">' +
            (p.stock_status === 'out_of_stock' ? '<span class="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-circle-xmark mr-1"></i>স্টকে নেই</span>' :
             p.stock_status === 'low_stock' ? '<span class="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-triangle-exclamation mr-1"></i>সীমিত স্টক!</span>' :
             '<span class="bg-emerald-100 text-emerald-700 text-sm font-bold px-3 py-1 rounded-full"><i class="fas fa-circle-check mr-1"></i>স্টকে আছে</span>') +
          '</div>' +
          '<button onclick="NCB.scrollToOrder()" class="btn-primary text-white font-bold text-lg px-8 py-4 rounded-xl w-full sm:w-auto"><i class="fas fa-cart-shopping mr-2"></i>এখনই অর্ডার করুন</button>' +
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
            return '<div class="package-card border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between" data-pkg="' + pk.id + '" onclick="NCB.selectPackage(' + pk.id + ')">' +
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
          '<div class="package-card border-2 border-gray-200 rounded-xl p-4" data-pkg="0" onclick="NCB.selectPackage(0)"><div class="font-bold">' + esc(product.name) + ' — ' + money(product.sale_price) + '</div></div>') +
          '</div>' +

          '<form id="order-form" onsubmit="NCB.submitOrder(event)">' +
            '<div class="grid sm:grid-cols-2 gap-4 mb-4">' +
              '<div class="sm:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1.5">আপনার নাম *</label>' +
              '<input type="text" name="customer_name" id="f-name" required class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="সম্পূর্ণ নাম লিখুন"></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">মোবাইল নম্বর *</label>' +
              '<input type="tel" name="phone" id="f-phone" required class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="01XXXXXXXXX" maxlength="14"></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">বিকল্প মোবাইল (ঐচ্ছিক)</label>' +
              '<input type="tel" name="alt_phone" id="f-alt-phone" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="01XXXXXXXXX" maxlength="14"></div>' +
              '<div class="sm:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1.5">সম্পূর্ণ ঠিকানা *</label>' +
              '<textarea name="address" id="f-address" required rows="2" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="বাসা/হোল্ডিং নম্বর, রোড, এলাকা"></textarea></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">জেলা *</label>' +
              '<select name="district" id="f-district" required class="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white" onchange="NCB.updateTotal()">' +
                '<option value="">জেলা নির্বাচন করুন</option>' +
                DISTRICTS.map(function (dd) { return '<option value="' + dd + '">' + dd + '</option>'; }).join('') +
              '</select></div>' +
              '<div><label class="block text-sm font-semibold text-gray-700 mb-1.5">উপজেলা/থানা</label>' +
              '<input type="text" name="upazila" id="f-upazila" class="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="উপজেলা/থানা"></div>' +
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

            '<button type="submit" id="submit-btn" class="btn-primary w-full text-white font-bold text-lg py-4 rounded-xl">' +
            '<i class="fas fa-check-circle mr-2"></i>অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)</button>' +
            '<p class="text-center text-xs text-gray-500 mt-3"><i class="fas fa-lock mr-1"></i>আপনার তথ্য সম্পূর্ণ নিরাপদ থাকবে</p>' +
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
    document.querySelectorAll('.fade-up').forEach(function (el) { io.observe(el); });
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
  function selectPackage(pkgId) {
    selectedPkg = pkgId;
    document.querySelectorAll('.package-card').forEach(function (el) {
      var on = Number(el.dataset.pkg) === Number(pkgId);
      el.classList.toggle('selected', on);
      var dot = el.querySelector('.pkg-dot');
      if (dot) dot.classList.toggle('hidden', !on);
    });
    updateTotal();
    if (!checkoutTracked) {
      checkoutTracked = true;
      var p = state.data.products[0];
      track('InitiateCheckout', { content_ids: [String(p.id)], currency: 'BDT' });
    }
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
    var isDhaka = district === 'ঢাকা';
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
    if (!/^01[3-9]\d{8}$/.test(phone.replace(/^\+?880?/, '0'))) {
      errEl.textContent = 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)';
      errEl.classList.remove('hidden');
      errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    state.submitting = true;
    var btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner mr-2"></span>অর্ডার প্রসেস হচ্ছে...';

    var payload = {
      customer_name: document.getElementById('f-name').value,
      phone: phone,
      alt_phone: document.getElementById('f-alt-phone').value,
      address: document.getElementById('f-address').value,
      district: document.getElementById('f-district').value,
      upazila: document.getElementById('f-upazila').value,
      order_note: document.getElementById('f-note').value,
      items: [{ product_id: p.id, package_id: selectedPkg || null, quantity: 1 }],
      otp_verified: otpVerified,
      source_url: location.href,
      session_id: sessionId
    };
    Object.assign(payload, state.utm);

    track('Lead', { content_name: p.name });

    axios.post('/api/public/orders', payload).then(function (r) {
      var o = r.data.order;
      // Purchase event with server-generated event_id for dedup
      track('Purchase', { value: o.grand_total, currency: 'BDT', content_ids: [String(p.id)] }, o.event_id);
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
          '<a href="tel:' + esc(s.support_phone) + '" class="block border-2 border-gray-200 hover:border-emerald-500 text-gray-700 font-semibold py-3 rounded-xl"><i class="fas fa-headset mr-2"></i>সাপোর্ট: ' + esc(s.support_phone) + '</a>' +
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
    goBanner: function (i, relative) { showBanner(relative ? bannerIdx + i : i); }
  };

  // ============ INIT ============
  axios.get('/api/public/content').then(function (r) {
    state.data = r.data;
    render();
    // Show OTP section if enabled
    if (r.data.settings.otp_enabled === '1') {
      var otpSec = document.getElementById('otp-section');
      if (otpSec) otpSec.classList.remove('hidden');
    }
  }).catch(function () {
    document.getElementById('app').innerHTML = '<div class="min-h-screen flex items-center justify-center px-4"><div class="text-center"><i class="fas fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i><p class="text-gray-600">পেজটি লোড করা যায়নি। অনুগ্রহ করে পেজ রিফ্রেশ করুন।</p></div></div>';
  });
})();
