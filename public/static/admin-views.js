// ============ Admin Panel Views (part 2) ============
(function () {
  'use strict';
  var H = window.__ADMIN__;
  var S = H.S, esc = H.esc, money = H.money, fmtDT = H.fmtDT, toast = H.toast, apiErr = H.apiErr,
      confirmDlg = H.confirmDlg, modal = H.modal, closeModal = H.closeModal, field = H.field,
      inp = H.inp, v = H.v, chk = H.chk, statusBadge = H.statusBadge, riskBadge = H.riskBadge,
      STATUS_BN = H.STATUS_BN, setContent = H.setContent;

  var charts = {};
  function destroyCharts() { Object.values(charts).forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = {}; }

  var cardIdx = 0;
  function card(label, value, icon, color, opts) {
    opts = opts || {};
    var idx = cardIdx++;
    var delay = (idx * 0.05).toFixed(2);
    var valHtml;
    if (opts.raw != null && !isNaN(opts.raw)) {
      valHtml = '<span class="count-up-num" data-target="' + opts.raw + '" data-prefix="' + esc(opts.prefix || '') + '" data-suffix="' + esc(opts.suffix || '') + '">' + (opts.prefix || '') + '0' + (opts.suffix || '') + '</span>';
    } else {
      valHtml = value;
    }
    return '<div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 kpi-card-in" style="animation-delay:' + delay + 's">' +
      '<div class="w-11 h-11 rounded-xl ' + (color || 'bg-emerald-100 text-emerald-600') + ' flex items-center justify-center shrink-0"><i class="fas ' + icon + '"></i></div>' +
      '<div class="min-w-0"><div class="text-xs text-gray-500 truncate">' + label + '</div><div class="font-bold text-gray-900 text-lg truncate">' + valHtml + '</div></div></div>';
  }

  function rangeSelector(current, onchangeFn) {
    var opts = [['today', 'আজ'], ['yesterday', 'গতকাল'], ['last7', 'শেষ ৭ দিন'], ['last30', 'শেষ ৩০ দিন'], ['this_month', 'এই মাস'], ['last_month', 'গত মাস']];
    return '<select id="range-sel" onchange="' + onchangeFn + '" class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">' +
      opts.map(function (o) { return '<option value="' + o[0] + '" ' + (current === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  }

  // ============ ENTERPRISE DASHBOARD (real-time) ============
  var dashRange = 'today';
  var dashTimer = null;       // auto-refresh timer (real-time)
  var dashClockTimer = null;  // live BD-time clock in the hero strip
  var DASH_REFRESH_MS = 30000;

  function stopDashAutoRefresh() {
    if (dashTimer) { clearInterval(dashTimer); dashTimer = null; }
    if (dashClockTimer) { clearInterval(dashClockTimer); dashClockTimer = null; }
  }
  function startDashAutoRefresh() {
    stopDashAutoRefresh();
    dashTimer = setInterval(function () {
      // Only refresh while the dashboard is actually visible
      if (S.route !== 'dashboard' || document.hidden) return;
      viewDashboard(true); // silent refresh
    }, DASH_REFRESH_MS);
    // Live ticking clock (Asia/Dhaka)
    dashClockTimer = setInterval(function () {
      var el = document.getElementById('dash-clock');
      if (!el) return;
      try { el.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) {}
    }, 1000);
  }

  function trendBadge(change) {
    var up = change >= 0;
    return '<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ' + (up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600') + '">' +
      '<i class="fas fa-arrow-' + (up ? 'up' : 'down') + '"></i>' + Math.abs(change) + '%</span>';
  }

  function funnelBar(label, val, maxVal, color, icon) {
    var w = maxVal > 0 ? Math.max(2, Math.round((val / maxVal) * 100)) : 2;
    var dropOff = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    return '<div class="mb-3"><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-gray-600">' + (icon ? '<i class="fas ' + icon + ' mr-1.5 opacity-60"></i>' : '') + label + '</span><span class="font-bold text-gray-900">' + Number(val).toLocaleString('en-US') + ' <span class="text-gray-400 font-medium">(' + dropOff + '%)</span></span></div>' +
      '<div class="h-3 bg-gray-100 rounded-full overflow-hidden"><div class="h-full rounded-full funnel-fill-anim" style="width:' + w + '%;background:linear-gradient(90deg,' + color + 'cc,' + color + ')"></div></div></div>';
  }

  // ---------- 3D tilt for dashboard cards (contained per-card, desktop only) ----------
  // Each .card3d tilts ONLY itself on its own mousemove — never affects page layout
  // or scroll (the earlier "zoom bug" came from page-wide mouse tracking; this is scoped).
  function init3DTilt(scope) {
    if (!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    (scope || document).querySelectorAll('.card3d').forEach(function (el) {
      if (el.__tiltBound) return;
      el.__tiltBound = true;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 7).toFixed(2) + 'deg) translateY(-2px)';
        el.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0)';
      });
    });
  }

  // ---------- Bangladesh geo intelligence (division rollup from district data) ----------
  var BD_DIVISIONS = {
    'ঢাকা': ['ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'মুন্সিগঞ্জ', 'মানিকগঞ্জ', 'নরসিংদী', 'টাঙ্গাইল', 'কিশোরগঞ্জ', 'ফরিদপুর', 'গোপালগঞ্জ', 'মাদারীপুর', 'রাজবাড়ী', 'শরীয়তপুর'],
    'চট্টগ্রাম': ['চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'ব্রাহ্মণবাড়িয়া', 'চাঁদপুর', 'লক্ষ্মীপুর', 'নোয়াখালী', 'ফেনী', 'খাগড়াছড়ি', 'রাঙ্গামাটি', 'বান্দরবান'],
    'রাজশাহী': ['রাজশাহী', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ', 'নওগাঁ', 'নাটোর', 'জয়পুরহাট', 'চাঁপাইনবাবগঞ্জ'],
    'খুলনা': ['খুলনা', 'যশোর', 'সাতক্ষীরা', 'বাগেরহাট', 'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'কুষ্টিয়া', 'চুয়াডাঙ্গা', 'মেহেরপুর'],
    'বরিশাল': ['বরিশাল', 'পটুয়াখালী', 'ভোলা', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি'],
    'সিলেট': ['সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ'],
    'রংপুর': ['রংপুর', 'দিনাজপুর', 'গাইবান্ধা', 'কুড়িগ্রাম', 'লালমনিরহাট', 'নীলফামারী', 'পঞ্চগড়', 'ঠাকুরগাঁও'],
    'ময়মনসিংহ': ['ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'শেরপুর']
  };
  var DIVISION_COLORS = { 'ঢাকা': '#059669', 'চট্টগ্রাম': '#0ea5e9', 'রাজশাহী': '#8b5cf6', 'খুলনা': '#f59e0b', 'বরিশাল': '#ef4444', 'সিলেট': '#06b6d4', 'রংপুর': '#ec4899', 'ময়মনসিংহ': '#84cc16' };
  function districtToDivision(district) {
    for (var div in BD_DIVISIONS) {
      if (BD_DIVISIONS[div].some(function (d) { return district.indexOf(d) !== -1 || d.indexOf(district) !== -1; })) return div;
    }
    return 'অন্যান্য';
  }

  // Enterprise KPI hero-card: gradient face, 3D tilt, glow spot, count-up value, trend slot
  function kpiHero(label, raw, prefix, suffix, icon, grad, delay, sub) {
    return '<div class="card3d kpi-hero rounded-2xl p-4 text-white relative overflow-hidden kpi-card-in" style="background:' + grad + ';animation-delay:' + delay + 's">' +
      '<div class="kpi-glow"></div>' +
      '<div class="relative z-10">' +
        '<div class="flex items-center justify-between mb-2"><span class="text-[11px] font-semibold opacity-85">' + label + '</span><span class="kpi-ico"><i class="fas ' + icon + '"></i></span></div>' +
        '<div class="text-2xl font-bold tracking-tight"><span class="count-up-num" data-target="' + (raw || 0) + '" data-prefix="' + (prefix || '') + '" data-suffix="' + (suffix || '') + '">' + (prefix || '') + '0' + (suffix || '') + '</span></div>' +
        (sub ? '<div class="text-[11px] opacity-80 mt-1">' + sub + '</div>' : '') +
      '</div></div>';
  }

  function statMini(label, raw, icon, color, delay, suffix) {
    return '<div class="card3d bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 kpi-card-in stat-mini" style="animation-delay:' + delay + 's">' +
      '<div class="w-11 h-11 rounded-xl ' + color + ' flex items-center justify-center shrink-0 stat-ico"><i class="fas ' + icon + '"></i></div>' +
      '<div class="min-w-0"><div class="text-xs text-gray-500 truncate">' + label + '</div><div class="font-bold text-gray-900 text-lg"><span class="count-up-num" data-target="' + (raw || 0) + '" data-suffix="' + (suffix || '') + '">0</span></div></div></div>';
  }

  function viewDashboard(silent) {
    if (!silent) destroyCharts();
    Promise.all([
      axios.get('/api/admin/analytics/summary?range=' + dashRange),
      axios.get('/api/admin/analytics/charts?range=' + (dashRange === 'today' || dashRange === 'yesterday' ? 'last7' : dashRange)),
      axios.get('/api/admin/orders?limit=8'),
      axios.get('/api/admin/analytics/dashboard?range=' + dashRange),
      axios.get('/api/admin/courier-sync/dashboard-stats').catch(function () { return { data: null }; })
    ]).then(function (rs) {
      if (S.route !== 'dashboard') return; // user navigated away mid-request
      destroyCharts();
      var d = rs[0].data, ch = rs[1].data, ords = rs[2].data.orders, ent = rs[3].data, sync = rs[4].data;
      var live = ent.live, fn = ent.funnel, wc = ent.week_compare;
      cardIdx = 0;

      var lowStockHtml = (ent.low_stock || []).length
        ? ent.low_stock.map(function (p) {
            return '<div class="flex items-center justify-between py-2 border-b border-gray-50 text-sm">' +
              '<div class="min-w-0"><div class="font-semibold truncate">' + esc(p.name) + '</div><div class="text-[11px] text-gray-400">থ্রেশহোল্ড: ' + p.low_stock_threshold + '</div></div>' +
              '<span class="px-2 py-1 rounded-lg text-xs font-bold ' + (p.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700') + '">' + p.stock + ' পিস</span></div>';
          }).join('')
        : '<div class="text-center text-gray-400 py-6 text-sm"><i class="fas fa-circle-check text-emerald-400 mr-1"></i>সব প্রোডাক্টের স্টক ঠিক আছে</div>';

      var topProdHtml = (ent.top_products || []).length
        ? ent.top_products.map(function (p, i) {
            var medals = ['🥇', '🥈', '🥉'];
            return '<div class="flex items-center gap-3 py-2 border-b border-gray-50 text-sm">' +
              '<span class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">' + (medals[i] || (i + 1)) + '</span>' +
              '<div class="flex-1 min-w-0"><div class="font-semibold truncate">' + esc(p.product_name) + '</div><div class="text-[11px] text-gray-400">' + p.orders + ' অর্ডার</div></div>' +
              '<div class="text-right shrink-0"><div class="font-bold">' + p.units + ' পিস</div><div class="text-[11px] text-gray-400">' + money(p.value) + '</div></div></div>';
          }).join('')
        : '<div class="text-center text-gray-400 py-6 text-sm">এই রেঞ্জে কোনো বিক্রি নেই</div>';

      // ---- GEO INTELLIGENCE: division rollup + top districts (like int'l dashboards' region map) ----
      var allDist = ent.top_districts || [];
      var divAgg = {};
      allDist.forEach(function (x) {
        var div = districtToDivision(x.district);
        if (!divAgg[div]) divAgg[div] = { orders: 0, revenue: 0 };
        divAgg[div].orders += x.orders;
        divAgg[div].revenue += x.revenue;
      });
      var divRows = Object.keys(divAgg).sort(function (a, b) { return divAgg[b].orders - divAgg[a].orders; });
      var totalGeoOrders = allDist.reduce(function (s, x) { return s + x.orders; }, 0) || 1;
      var distMax = Math.max.apply(null, allDist.map(function (x) { return x.orders; }).concat([1]));
      var top10 = allDist.slice(0, 10);
      var distHtml = top10.length
        ? top10.map(function (x, i) {
            var w = Math.max(4, Math.round((x.orders / distMax) * 100));
            var share = Math.round((x.orders / totalGeoOrders) * 100);
            var col = DIVISION_COLORS[districtToDivision(x.district)] || '#059669';
            return '<div class="mb-2.5"><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-gray-700"><span class="inline-block w-4 text-gray-400">' + (i + 1) + '</span>' + esc(x.district) + ' <span class="text-[10px] text-gray-400">(' + share + '%)</span></span><span class="text-gray-500">' + x.orders + ' | ' + money(x.revenue) + '</span></div>' +
              '<div class="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div class="h-full rounded-full funnel-fill-anim" style="width:' + w + '%;background:linear-gradient(90deg,' + col + '99,' + col + ')"></div></div></div>';
          }).join('')
        : '<div class="text-center text-gray-400 py-6 text-sm">এই রেঞ্জে ডেটা নেই</div>';

      setContent(
        // ===== COMMAND BAR =====
        '<div class="dash-command-bar rounded-2xl px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-3 kpi-card-in">' +
          '<div class="flex items-center gap-3 flex-wrap">' +
            '<span class="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3.5 py-1.5 text-xs font-bold text-white"><span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span></span>LIVE — ৩০ সেকেন্ডে অটো আপডেট</span>' +
            '<span class="text-xs text-emerald-100/90 font-medium"><i class="far fa-calendar mr-1"></i>' + d.range.from + (d.range.from !== d.range.to ? ' → ' + d.range.to : '') + '</span>' +
            '<span class="text-xs text-emerald-100/90 font-mono"><i class="far fa-clock mr-1"></i><span id="dash-clock">--:--:--</span> BD</span>' +
            '<span class="text-xs text-emerald-100/70">$1 = ৳' + d.usd_rate + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<button onclick="AV.dashRefresh()" class="bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 text-sm transition" title="এখনই রিফ্রেশ"><i class="fas fa-rotate"></i></button>' +
            rangeSelector(dashRange, 'AV.dashRange(this.value)') +
          '</div>' +
        '</div>' +

        // ===== HERO KPIs (gradient 3D cards) =====
        '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">' +
          kpiHero('মোট অর্ডার', d.total_orders, '', '', 'fa-cart-shopping', 'linear-gradient(135deg,#2563eb,#1e40af)', 0, trendBadgeLight(wc.orders_change) + ' vs গত সপ্তাহ') +
          kpiHero('রেভিনিউ (ডেলিভারড)', d.revenue, '৳', '', 'fa-sack-dollar', 'linear-gradient(135deg,#059669,#065f46)', 0.05, trendBadgeLight(wc.revenue_change) + ' vs গত সপ্তাহ') +
          kpiHero('নেট প্রফিট', d.net_profit, '৳', '', 'fa-arrow-trend-up', d.net_profit >= 0 ? 'linear-gradient(135deg,#10b981,#047857)' : 'linear-gradient(135deg,#ef4444,#b91c1c)', 0.1, 'মার্জিন ' + d.profit_margin + '% | ROI ' + d.roi + '%') +
          kpiHero('অ্যাড খরচ', d.ad_spend_bdt, '৳', '', 'fa-bullhorn', 'linear-gradient(135deg,#8b5cf6,#6d28d9)', 0.15, d.ad_spend_usd ? '$' + d.ad_spend_usd + ' USD' : 'এই রেঞ্জে') +
        '</div>' +

        // ===== LIVE ACTIVITY STRIP =====
        '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">' +
          statMini('লাইভ ভিজিটর (৩০ মি.)', live.visitors_30m, 'fa-eye', 'bg-emerald-100 text-emerald-600', 0.18) +
          statMini('পেজভিউ (১ ঘণ্টা)', live.pageviews_1h, 'fa-file', 'bg-blue-100 text-blue-600', 0.21) +
          statMini('অর্ডার (১ ঘণ্টা)', live.orders_1h, 'fa-bolt', 'bg-amber-100 text-amber-600', 0.24) +
          statMini('অর্ডার (২৪ ঘণ্টা)', live.orders_24h, 'fa-cart-shopping', 'bg-indigo-100 text-indigo-600', 0.27) +
          statMini('ইনকমপ্লিট (২৪ ঘণ্টা)', live.incomplete_24h, 'fa-cart-arrow-down', 'bg-orange-100 text-orange-600', 0.3) +
        '</div>' +

        // ===== COST + STATUS ROW =====
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
          card('কুরিয়ার খরচ', money(d.courier_cost), 'fa-truck', 'bg-cyan-100 text-cyan-600', { raw: d.courier_cost, prefix: '৳' }) +
          card('প্রোডাক্ট খরচ', money(d.product_cost), 'fa-box', 'bg-amber-100 text-amber-600', { raw: d.product_cost, prefix: '৳' }) +
          card('অন্যান্য খরচ', money(d.other_expenses), 'fa-receipt', 'bg-gray-100 text-gray-600', { raw: d.other_expenses, prefix: '৳' }) +
          card('লস', money(d.loss), 'fa-arrow-trend-down', 'bg-red-100 text-red-500', { raw: d.loss, prefix: '৳' }) +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">' +
          card('পেন্ডিং', d.pending, 'fa-clock', 'bg-amber-100 text-amber-600', { raw: d.pending }) +
          card('ডেলিভারড', d.delivered, 'fa-circle-check', 'bg-green-100 text-green-600', { raw: d.delivered }) +
          card('বাতিল', d.cancelled, 'fa-circle-xmark', 'bg-red-100 text-red-500', { raw: d.cancelled }) +
          card('রিটার্নড', d.returned, 'fa-rotate-left', 'bg-orange-100 text-orange-500', { raw: d.returned }) +
        '</div>' +

        // ===== FUNNEL + LIVE PULSE + RISK =====
        '<div class="grid lg:grid-cols-3 gap-5 mb-5">' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.3s">' +
            '<div class="flex justify-between items-center mb-4"><h3 class="font-bold"><i class="fas fa-filter text-emerald-600 mr-2"></i>কনভার্সন ফানেল</h3><span class="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">CVR ' + fn.conversion_rate + '%</span></div>' +
            funnelBar('পেজ ভিজিট', fn.pageview, fn.pageview, '#3b82f6', 'fa-eye') +
            funnelBar('প্রোডাক্ট দেখেছে', fn.viewcontent, fn.pageview, '#8b5cf6', 'fa-box-open') +
            funnelBar('চেকআউট শুরু', fn.checkout, fn.pageview, '#f59e0b', 'fa-cart-plus') +
            funnelBar('লিড (ফর্ম পূরণ)', fn.lead, fn.pageview, '#f97316', 'fa-user-pen') +
            funnelBar('অর্ডার সম্পন্ন', fn.purchase, fn.pageview, '#059669', 'fa-circle-check') +
          '</div>' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.34s"><h3 class="font-bold mb-4"><i class="fas fa-heart-pulse text-red-500 mr-2"></i>লাইভ পালস (২৪ ঘণ্টা, BD টাইম)</h3><canvas id="ch-pulse" height="210"></canvas></div>' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.38s"><h3 class="font-bold mb-4"><i class="fas fa-shield-halved text-amber-500 mr-2"></i>রিস্ক ও কাস্টমার</h3>' +
            '<canvas id="ch-risk" height="130"></canvas>' +
            '<div class="grid grid-cols-2 gap-2 mt-4 text-center">' +
              '<div class="bg-gray-50 rounded-xl p-2.5"><div class="text-lg font-bold">' + ent.customers.total + '</div><div class="text-[11px] text-gray-500">মোট কাস্টমার</div></div>' +
              '<div class="bg-emerald-50 rounded-xl p-2.5"><div class="text-lg font-bold text-emerald-700">' + ent.customers.repeat + '</div><div class="text-[11px] text-gray-500">রিপিট কাস্টমার</div></div>' +
              '<div class="bg-blue-50 rounded-xl p-2.5"><div class="text-lg font-bold text-blue-700">' + ent.customers.new_in_range + '</div><div class="text-[11px] text-gray-500">নতুন (এই রেঞ্জ)</div></div>' +
              '<div class="bg-red-50 rounded-xl p-2.5"><div class="text-lg font-bold text-red-600">' + ent.customers.blacklisted + '</div><div class="text-[11px] text-gray-500">ব্ল্যাকলিস্টেড</div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ===== REVENUE/ORDERS CHARTS =====
        '<div class="grid lg:grid-cols-2 gap-5 mb-5">' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.42s"><h3 class="font-bold mb-4"><i class="fas fa-chart-area text-emerald-600 mr-2"></i>রেভিনিউ ও প্রফিট</h3><canvas id="ch-rev" height="220"></canvas></div>' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.46s"><h3 class="font-bold mb-4"><i class="fas fa-chart-column text-purple-600 mr-2"></i>অর্ডার ও অ্যাড খরচ</h3><canvas id="ch-ord" height="220"></canvas></div>' +
        '</div>' +

        // ===== GEO INTELLIGENCE (division + district) =====
        '<div class="grid lg:grid-cols-3 gap-5 mb-5">' +
          '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in lg:col-span-2" style="animation-delay:.5s">' +
            '<div class="flex justify-between items-center mb-4"><h3 class="font-bold"><i class="fas fa-map-location-dot text-blue-500 mr-2"></i>লোকেশন ইন্টেলিজেন্স — কোন জেলা থেকে অর্ডার আসছে</h3><span class="text-xs text-gray-400">' + allDist.length + ' জেলা</span></div>' +
            '<div class="grid md:grid-cols-2 gap-5">' +
              '<div>' + distHtml + '</div>' +
              '<div><canvas id="ch-division" height="200"></canvas>' +
                '<div class="grid grid-cols-2 gap-1.5 mt-3">' +
                  divRows.map(function (dv) {
                    var share = Math.round((divAgg[dv].orders / totalGeoOrders) * 100);
                    return '<div class="flex items-center gap-1.5 text-[11px]"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:' + (DIVISION_COLORS[dv] || '#94a3b8') + '"></span><span class="font-semibold text-gray-700 truncate">' + dv + '</span><span class="text-gray-400 ml-auto">' + divAgg[dv].orders + ' (' + share + '%)</span></div>';
                  }).join('') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="space-y-5">' +
            '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.54s"><h3 class="font-bold mb-4"><i class="fas fa-trophy text-amber-500 mr-2"></i>টপ প্রোডাক্ট</h3>' + topProdHtml + '</div>' +
            '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.58s"><div class="flex justify-between items-center mb-3"><h3 class="font-bold"><i class="fas fa-triangle-exclamation text-red-500 mr-2"></i>স্টক অ্যালার্ট</h3><a href="#/products" class="text-xs text-emerald-600 font-semibold">প্রোডাক্ট →</a></div>' + lowStockHtml + '</div>' +
            '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.62s"><div class="flex justify-between items-center mb-3"><h3 class="font-bold"><i class="fas fa-life-ring text-orange-500 mr-2"></i>লিড রিকভারি</h3><a href="#/incomplete" class="text-xs text-emerald-600 font-semibold">বিস্তারিত →</a></div>' +
              '<div class="grid grid-cols-3 gap-2 text-center">' +
                '<div class="bg-gray-50 rounded-xl p-2.5"><div class="text-lg font-bold">' + ent.incomplete.total + '</div><div class="text-[11px] text-gray-500">ইনকমপ্লিট</div></div>' +
                '<div class="bg-emerald-50 rounded-xl p-2.5"><div class="text-lg font-bold text-emerald-700">' + ent.incomplete.converted + '</div><div class="text-[11px] text-gray-500">কনভার্টেড</div></div>' +
                '<div class="bg-amber-50 rounded-xl p-2.5"><div class="text-lg font-bold text-amber-700">' + ent.incomplete.recovery_rate + '%</div><div class="text-[11px] text-gray-500">রিকভারি রেট</div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ===== STEADFAST AUTO SYNC WIDGET (real DB counts, never hardcoded) =====
        (sync ? '<div class="card3d bg-white rounded-2xl p-5 shadow-sm kpi-card-in mb-5" style="animation-delay:.64s">' +
          '<div class="flex justify-between items-center mb-4"><h3 class="font-bold"><i class="fas fa-satellite-dish text-emerald-600 mr-2"></i>Steadfast অটো সিঙ্ক</h3>' +
            '<span class="text-xs text-gray-400"><i class="fas fa-circle-check text-emerald-500 mr-1"></i>সর্বশেষ গ্লোবাল সিঙ্ক: ' + (sync.last_global_sync ? fmtDT(sync.last_global_sync) : 'এখনো হয়নি') + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
            '<div class="bg-blue-50 rounded-xl p-3 text-center"><div class="text-xl font-bold text-blue-700">' + sync.active_orders + '</div><div class="text-[11px] text-gray-500">অ্যাক্টিভ কুরিয়ার অর্ডার</div></div>' +
            '<div class="bg-emerald-50 rounded-xl p-3 text-center"><div class="text-xl font-bold text-emerald-700">' + sync.synced_ok + '</div><div class="text-[11px] text-gray-500">সফলভাবে সিঙ্কড</div></div>' +
            '<div class="bg-red-50 rounded-xl p-3 text-center"><div class="text-xl font-bold text-red-600">' + sync.sync_errors + '</div><div class="text-[11px] text-gray-500">সিঙ্ক এরর</div></div>' +
            '<div class="bg-gray-50 rounded-xl p-3 text-center"><div class="text-xl font-bold text-gray-700">' + (sync.last_run_stats ? sync.last_run_stats.checked : '—') + '</div><div class="text-[11px] text-gray-500">সর্বশেষ ব্যাচে চেক হয়েছে</div></div>' +
          '</div>' +
          (Object.keys(sync.status_counts || {}).length ? '<div class="flex flex-wrap gap-2 mt-3">' +
            Object.keys(sync.status_counts).map(function (st) {
              return '<span class="px-2 py-1 rounded-lg text-[11px] font-semibold ' + (COURIER_STATUS_COLOR[st] || 'bg-gray-100 text-gray-600') + '">' + (st || 'unsynced') + ': ' + sync.status_counts[st] + '</span>';
            }).join('') + '</div>' : '') +
        '</div>' : '') +

        // ===== RECENT ORDERS =====
        '<div class="bg-white rounded-2xl shadow-sm overflow-hidden kpi-card-in" style="animation-delay:.66s">' +
          '<div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-bold"><i class="fas fa-clock-rotate-left text-emerald-600 mr-2"></i>সাম্প্রতিক অর্ডার</h3><a href="#/orders" class="text-sm text-emerald-600 font-semibold">সব দেখুন →</a></div>' +
          orderTable(ords) +
        '</div>',
        'ড্যাশবোর্ড');

      if (H.runCountUps) H.runCountUps();
      init3DTilt(document.getElementById('main-content'));

      // ---- Charts ----
      var days = (ch.daily || []).map(function (x) { return x.day.slice(5); });
      var adMap = {};
      (ch.ad_daily || []).forEach(function (x) { adMap[x.day] = x.spend; });
      var revCtx = document.getElementById('ch-rev');
      var revGrad = null;
      try {
        var g = revCtx.getContext('2d').createLinearGradient(0, 0, 0, 240);
        g.addColorStop(0, 'rgba(5,150,105,0.28)'); g.addColorStop(1, 'rgba(5,150,105,0)');
        revGrad = g;
      } catch (e) {}
      charts.rev = new Chart(revCtx, {
        type: 'line',
        data: { labels: days, datasets: [
          { label: 'রেভিনিউ', data: (ch.daily || []).map(function (x) { return x.revenue; }), borderColor: '#059669', backgroundColor: revGrad || 'rgba(5,150,105,0.08)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#059669' },
          { label: 'প্রফিট', data: (ch.daily || []).map(function (x) { return x.profit; }), borderColor: '#6366f1', tension: 0.4, borderWidth: 2, borderDash: [5, 3], pointRadius: 2 }
        ] },
        options: { responsive: true, animation: { duration: 900, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { backgroundColor: 'rgba(6,78,59,.92)', padding: 12, cornerRadius: 10 } } }
      });
      charts.ord = new Chart(document.getElementById('ch-ord'), {
        type: 'bar',
        data: { labels: days, datasets: [
          { label: 'অর্ডার', data: (ch.daily || []).map(function (x) { return x.orders; }), backgroundColor: '#34d399', borderRadius: 6, maxBarThickness: 26 },
          { label: 'অ্যাড খরচ (৳)', data: (ch.daily || []).map(function (x) { return adMap[x.day] || 0; }), backgroundColor: '#a78bfa', borderRadius: 6, maxBarThickness: 26 }
        ] },
        options: { responsive: true, animation: { duration: 900, easing: 'easeOutQuart' }, plugins: { legend: { position: 'bottom' }, tooltip: { backgroundColor: 'rgba(30,27,75,.92)', padding: 12, cornerRadius: 10 } } }
      });
      // Live pulse: hourly orders (last 24h)
      var hrs = (ent.hourly || []).map(function (x) { return x.hour; });
      charts.pulse = new Chart(document.getElementById('ch-pulse'), {
        type: 'line',
        data: { labels: hrs, datasets: [
          { label: 'অর্ডার', data: (ent.hourly || []).map(function (x) { return x.orders; }), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.45, pointRadius: 2, borderWidth: 2 }
        ] },
        options: { responsive: true, animation: { duration: 900 }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
      // Risk doughnut
      charts.risk = new Chart(document.getElementById('ch-risk'), {
        type: 'doughnut',
        data: { labels: ['🟢 Low', '🟡 Medium', '🔴 High'], datasets: [{ data: [ent.risk_mix.low, ent.risk_mix.medium, ent.risk_mix.high], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0, hoverOffset: 8 }] },
        options: { responsive: true, cutout: '65%', animation: { animateRotate: true, duration: 900 }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
      });
      // Division doughnut (geo intelligence)
      var divCanvas = document.getElementById('ch-division');
      if (divCanvas && divRows.length) {
        charts.division = new Chart(divCanvas, {
          type: 'doughnut',
          data: { labels: divRows, datasets: [{ data: divRows.map(function (dv) { return divAgg[dv].orders; }), backgroundColor: divRows.map(function (dv) { return DIVISION_COLORS[dv] || '#94a3b8'; }), borderWidth: 2, borderColor: '#fff', hoverOffset: 10 }] },
          options: { responsive: true, cutout: '58%', animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { var dv = ctx.label; return ' ' + dv + ': ' + divAgg[dv].orders + ' অর্ডার | ৳' + Number(divAgg[dv].revenue).toLocaleString('en-US'); } }, backgroundColor: 'rgba(6,78,59,.92)', padding: 12, cornerRadius: 10 } } }
        });
      } else if (divCanvas) {
        divCanvas.parentNode.innerHTML = '<div class="text-center text-gray-400 py-10 text-sm"><i class="fas fa-map text-3xl mb-2 block opacity-40"></i>বিভাগভিত্তিক ডেটা এই রেঞ্জে নেই</div>';
      }

      startDashAutoRefresh();
      var clockEl = document.getElementById('dash-clock');
      if (clockEl) { try { clockEl.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) {} }
    }).catch(function (e) { if (!silent) apiErr(e); });
  }

  // Light trend badge for use on gradient (dark) hero cards
  function trendBadgeLight(change) {
    var up = change >= 0;
    return '<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ' + (up ? 'bg-white/20 text-white' : 'bg-black/20 text-red-100') + '"><i class="fas fa-arrow-' + (up ? 'up' : 'down') + '"></i>' + Math.abs(change) + '%</span>';
  }

  function orderTable(orders) {
    if (!orders.length) return '<div class="text-center text-gray-400 py-10"><i class="fas fa-inbox text-3xl mb-2"></i><div>কোনো অর্ডার নেই</div></div>';
    return '<div class="overflow-x-auto"><table class="w-full">' +
      '<thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100"><th class="px-5 py-3">অর্ডার</th><th class="px-3 py-3">কাস্টমার</th><th class="px-3 py-3">পণ্য</th><th class="px-3 py-3">মোট</th><th class="px-3 py-3">স্ট্যাটাস</th><th class="px-3 py-3">রিস্ক</th><th class="px-3 py-3">সময়</th></tr></thead><tbody>' +
      orders.map(function (o) {
        return '<tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.hash=\'#/orders/' + o.id + '\'">' +
          '<td class="px-5 py-3 font-semibold text-emerald-700">' + esc(o.order_number) + '</td>' +
          '<td class="px-3 py-3"><div class="font-medium">' + esc(o.customer_name) + '</div><div class="text-xs text-gray-400">' + esc(o.phone) + '</div></td>' +
          '<td class="px-3 py-3 text-xs text-gray-500 max-w-[180px] truncate">' + esc(o.items_summary || '') + '</td>' +
          '<td class="px-3 py-3 font-semibold">' + money(o.grand_total) + '</td>' +
          '<td class="px-3 py-3">' + statusBadge(o.status) + '</td>' +
          '<td class="px-3 py-3">' + riskBadge(o.risk_level || 'low', null) + '</td>' +
          '<td class="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">' + fmtDT(o.created_at) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ============ ORDERS LIST ============
  var oFilter = { status: '', search: '', page: 1, risk_level: '', date_from: '', date_to: '' };
  function viewOrders() {
    Promise.all([
      axios.get('/api/admin/orders/counts'),
      axios.get('/api/admin/orders', { params: oFilter })
    ]).then(function (rs) {
      var counts = rs[0].data.counts, total = rs[0].data.total, d = rs[1].data;
      var tabs = [['', 'সব (' + total + ')']].concat(Object.keys(STATUS_BN).map(function (st) {
        return [st, STATUS_BN[st] + ' (' + (counts[st] || 0) + ')'];
      }));
      setContent(
        '<div class="flex gap-2 overflow-x-auto pb-2 mb-4">' +
          tabs.map(function (t) {
            return '<button onclick="AV.oStatus(\'' + t[0] + '\')" class="px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ' +
              (oFilter.status === t[0] ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm') + '">' + t[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="bg-white rounded-2xl p-4 shadow-sm mb-4 grid md:grid-cols-5 gap-3">' +
          '<input id="of-search" value="' + esc(oFilter.search) + '" placeholder="🔍 Order ID / ফোন / নাম / ট্র্যাকিং" class="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm" onkeydown="if(event.key===\'Enter\')AV.oSearch()">' +
          '<select id="of-risk" class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="">সব রিস্ক</option><option value="low" ' + (oFilter.risk_level === 'low' ? 'selected' : '') + '>🟢 Low</option><option value="medium" ' + (oFilter.risk_level === 'medium' ? 'selected' : '') + '>🟡 Medium</option><option value="high" ' + (oFilter.risk_level === 'high' ? 'selected' : '') + '>🔴 High</option></select>' +
          '<input type="date" id="of-from" value="' + oFilter.date_from + '" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">' +
          '<div class="flex gap-2"><input type="date" id="of-to" value="' + oFilter.date_to + '" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">' +
          '<button onclick="AV.oSearch()" class="bg-emerald-600 text-white px-4 rounded-lg text-sm font-semibold">খুঁজুন</button></div>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow-sm overflow-hidden">' + orderTable(d.orders) +
          '<div class="px-5 py-3 flex items-center justify-between border-t border-gray-100">' +
            '<div class="text-xs text-gray-500">মোট ' + d.total + ' টি | পেজ ' + d.page + '</div>' +
            '<div class="flex gap-2">' +
              (d.page > 1 ? '<button onclick="AV.oPage(' + (d.page - 1) + ')" class="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold">← আগের</button>' : '') +
              (d.page * d.limit < d.total ? '<button onclick="AV.oPage(' + (d.page + 1) + ')" class="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold">পরের →</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mt-4 text-right"><a href="/api/admin/export/orders?status=' + oFilter.status + '&date_from=' + oFilter.date_from + '&date_to=' + oFilter.date_to + '" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"><i class="fas fa-download mr-1.5"></i>CSV এক্সপোর্ট</a></div>',
        'অর্ডারসমূহ');
    }).catch(apiErr);
  }

  // ============ Steadfast courier status — shared render helpers (also used by poll) ============
  var COURIER_STATUS_COLOR = {
    pending: 'bg-amber-100 text-amber-700',
    delivered_approval_pending: 'bg-emerald-100 text-emerald-700',
    partial_delivered_approval_pending: 'bg-lime-100 text-lime-700',
    cancelled_approval_pending: 'bg-red-100 text-red-700',
    unknown_approval_pending: 'bg-gray-100 text-gray-600',
    delivered: 'bg-green-100 text-green-800',
    partial_delivered: 'bg-lime-100 text-lime-700',
    cancelled: 'bg-red-100 text-red-700',
    hold: 'bg-orange-100 text-orange-700',
    in_review: 'bg-blue-100 text-blue-700',
    unknown: 'bg-gray-100 text-gray-500'
  };
  function courierStatusBadge(o) {
    if (!o.courier_status) return '';
    var cls = COURIER_STATUS_COLOR[o.courier_status] || 'bg-gray-100 text-gray-600';
    return '<span class="px-2 py-0.5 rounded-full text-xs font-bold ' + cls + '">' + esc(o.courier_status_label || o.courier_status) + '</span>';
  }
  function transfersHtml(transfers) {
    return (transfers || []).length ? transfers.map(function (t) {
      return '<div class="bg-gray-50 rounded-xl p-3 mb-2 text-sm">' +
        '<div class="font-semibold">' + (t.from_courier_name ? esc(t.from_courier_name) + ' <i class="fas fa-arrow-right text-gray-400 mx-1"></i> ' : '<i class="fas fa-plus-circle text-emerald-500 mr-1"></i>') + esc(t.to_courier_name) + '</div>' +
        '<div class="text-xs text-gray-500 mt-1">' + (t.tracking_id ? 'ট্র্যাকিং: ' + esc(t.tracking_id) + ' | ' : '') + 'চার্জ: ' + money(t.courier_charge) + (t.weight ? ' | ওজন: ' + t.weight + 'কেজি' : '') + (t.consignment_id ? ' | <span class="text-emerald-600 font-semibold">API ✅ ' + esc(t.consignment_id) + '</span>' : '') + (t.note ? ' | ' + esc(t.note) : '') + '</div>' +
        '<div class="text-[10px] text-gray-400">' + fmtDT(t.created_at) + ' — ' + esc(t.transferred_by) + '</div></div>';
    }).join('') : '<div class="text-sm text-gray-400 text-center py-3">কোনো কুরিয়ার ট্রান্সফার হয়নি</div>';
  }
  // Whole "কুরিয়ার" card — built once for first render, and rebuilt (outerHTML swap) on
  // every courier-status poll tick so only THIS component updates, not the full page.
  function courierCardHtml(o, transfers) {
    var hasId = !!(o.consignment_id || o.tracking_id);
    return '<div class="bg-white rounded-2xl p-5 shadow-sm" id="courier-status-card">' +
      '<div class="flex justify-between items-center mb-3"><h3 class="font-bold"><i class="fas fa-truck text-emerald-600 mr-2"></i>কুরিয়ার</h3>' +
        (hasId ? '<button id="sync-now-btn" onclick="AV.syncNow(' + o.id + ')" class="text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-100"><i class="fas fa-rotate mr-1"></i>Sync Now</button>' : '') +
      '</div>' +
      '<div class="text-sm space-y-1.5">' +
        '<div><span class="text-gray-500">কুরিয়ার:</span> <span class="font-semibold">' + esc(o.courier_name || 'নির্ধারিত হয়নি') + '</span></div>' +
        '<div><span class="text-gray-500">ট্র্যাকিং:</span> <span class="font-semibold">' + esc(o.tracking_id || '—') + '</span></div>' +
        (o.consignment_id ? '<div><span class="text-gray-500">কনসাইনমেন্ট:</span> <span class="font-semibold text-emerald-700">' + esc(o.consignment_id) + '</span> <span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">API</span></div>' : '') +
        (hasId ? '<div><span class="text-gray-500">স্ট্যাটাস:</span> ' + (courierStatusBadge(o) || '<span class="text-gray-400 text-xs">এখনো সিঙ্ক হয়নি</span>') + '</div>' : '') +
        (hasId ? '<div class="flex items-center gap-1.5 text-[11px] text-gray-400"><i class="fas fa-circle-check text-emerald-500"></i>অটোমেটিক সিঙ্ক | সর্বশেষ: ' + (o.courier_last_synced_at ? fmtDT(o.courier_last_synced_at) : 'এখনো হয়নি') + '</div>' : '') +
        (o.courier_sync_error ? '<div class="text-xs text-red-600 bg-red-50 rounded-lg p-2 mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>' + esc(o.courier_sync_error) + '</div>' : '') +
        (o.tracking_url ? '<a href="' + esc(o.tracking_url) + '" target="_blank" class="block text-center bg-blue-50 text-blue-700 rounded-lg py-2 font-semibold text-xs mt-2"><i class="fas fa-arrow-up-right-from-square mr-1"></i>ট্র্যাক করুন</a>' : '') +
      '</div>' +
      '<h4 class="font-semibold text-sm mt-4 mb-2 text-gray-600">ট্রান্সফার হিস্ট্রি</h4>' + transfersHtml(transfers) +
    '</div>';
  }
  // Status History timeline — generated purely from real courier_status_logs rows (no
  // manual entry possible). Returns '' when there's no history yet (card omitted).
  function courierHistoryHtml(logs) {
    if (!logs || !logs.length) return '';
    var rows = logs.map(function (l) {
      return '<div class="flex gap-3 pb-3 relative"><div class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-100"></div>' +
        '<div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 z-10 text-[10px]"><i class="fas fa-truck-fast"></i></div>' +
        '<div class="min-w-0"><div class="text-sm font-semibold">' + (l.old_status ? esc(l.old_status) + ' → ' : '') + esc(l.new_status) + '</div>' +
        '<div class="text-[10px] text-gray-400 mt-0.5">' + fmtDT(l.synced_at) + ' — Steadfast API</div></div></div>';
    }).join('');
    return '<div class="bg-white rounded-2xl p-5 shadow-sm" id="courier-history-card"><h3 class="font-bold mb-3"><i class="fas fa-route text-blue-600 mr-2"></i>কুরিয়ার স্ট্যাটাস হিস্ট্রি</h3>' + rows + '</div>';
  }
  // Scoped poll: while an order-detail page is open, silently re-fetch just this order
  // every 20s and swap only #courier-status-card / #courier-history-card — never a full
  // page reload, and never lets the admin type/select a fake status.
  var courierPollTimer = null;
  function stopCourierPoll() { if (courierPollTimer) { clearInterval(courierPollTimer); courierPollTimer = null; } }
  function startCourierPoll(orderId) {
    stopCourierPoll();
    courierPollTimer = setInterval(function () {
      if (S.route !== 'orders' || String(S.param) !== String(orderId) || document.hidden) return;
      axios.get('/api/admin/orders/' + orderId).then(function (r) {
        var d = r.data, o = d.order;
        var card = document.getElementById('courier-status-card');
        if (card) card.outerHTML = courierCardHtml(o, d.transfers);
        var hist = document.getElementById('courier-history-card');
        var newHist = courierHistoryHtml(d.courierLogs);
        if (hist) { if (newHist) hist.outerHTML = newHist; else hist.remove(); }
        else if (newHist) { var anchor = document.getElementById('courier-status-card'); if (anchor) anchor.insertAdjacentHTML('afterend', newHist); }
        S._currentOrder = o;
      }).catch(function () {});
    }, 20000);
  }

  // ============ ORDER DETAIL ============
  function viewOrderDetail() {
    var id = S.param;
    Promise.all([
      axios.get('/api/admin/orders/' + id),
      axios.get('/api/admin/couriers')
    ]).then(function (rs) {
      var d = rs[0].data, o = d.order, fin = d.financial;
      var couriers = rs[1].data.couriers.filter(function (c) { return c.is_active; });

      var timeline = d.history.map(function (h) {
        return '<div class="flex gap-3 pb-4 relative"><div class="absolute left-[11px] top-7 bottom-0 w-0.5 bg-gray-100"></div>' +
          '<div class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 z-10 text-[10px]"><i class="fas fa-check"></i></div>' +
          '<div class="min-w-0"><div class="text-sm font-semibold">' + (h.from_status && h.from_status !== h.to_status ? statusBadge(h.from_status) + ' → ' : '') + statusBadge(h.to_status) + '</div>' +
          (h.note ? '<div class="text-xs text-gray-500 mt-1">' + esc(h.note) + '</div>' : '') +
          '<div class="text-[10px] text-gray-400 mt-0.5">' + fmtDT(h.created_at) + ' — ' + esc(h.changed_by) + '</div></div></div>';
      }).join('');

      setContent(
        '<div class="flex items-center justify-between flex-wrap gap-3 mb-5">' +
          '<div class="flex items-center gap-3"><a href="#/orders" class="text-gray-400 hover:text-gray-600"><i class="fas fa-arrow-left"></i></a>' +
          '<div><h2 class="font-bold text-lg">' + esc(o.order_number) + '</h2><div class="text-xs text-gray-500">' + fmtDT(o.created_at) + '</div></div>' +
          statusBadge(o.status) + riskBadge(o.risk_level, o.risk_score) + (o.is_verified ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><i class="fas fa-shield-halved mr-1"></i>Verified</span>' : '') + '</div>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<select id="new-status" class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">' +
              Object.keys(STATUS_BN).map(function (st) { return '<option value="' + st + '" ' + (st === o.status ? 'selected' : '') + '>' + STATUS_BN[st] + '</option>'; }).join('') +
            '</select>' +
            '<button onclick="AV.changeStatus(' + o.id + ')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">স্ট্যাটাস পরিবর্তন</button>' +
            '<button onclick="AV.transferModal(' + o.id + ')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-truck-arrow-right mr-1"></i>কুরিয়ার ট্রান্সফার</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid lg:grid-cols-3 gap-5">' +
          '<div class="lg:col-span-2 space-y-5">' +
            // Customer + address
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><div class="flex justify-between items-center mb-3"><h3 class="font-bold"><i class="fas fa-user text-emerald-600 mr-2"></i>কাস্টমার তথ্য</h3>' +
              '<button onclick="AV.editCustModal(' + o.id + ')" class="text-sm text-emerald-600 font-semibold"><i class="fas fa-pen mr-1"></i>এডিট</button></div>' +
              '<div class="grid sm:grid-cols-2 gap-3 text-sm">' +
                '<div><span class="text-gray-500">নাম:</span> <a href="#/customers/' + esc(o.phone) + '" class="font-semibold text-emerald-700">' + esc(o.customer_name) + '</a></div>' +
                '<div><span class="text-gray-500">ফোন:</span> <a href="tel:' + esc(o.phone) + '" class="font-semibold text-blue-600">' + esc(o.phone) + '</a>' + (o.alt_phone ? ' / <a href="tel:' + esc(o.alt_phone) + '" class="text-blue-600">' + esc(o.alt_phone) + '</a>' : '') + '</div>' +
                '<div class="sm:col-span-2"><span class="text-gray-500">ঠিকানা:</span> <span class="font-medium">' + esc(o.address) + ', ' + esc(o.upazila || '') + ', ' + esc(o.district || '') + '</span></div>' +
                (o.order_note ? '<div class="sm:col-span-2 bg-amber-50 rounded-lg p-2.5"><span class="text-amber-700 text-xs font-bold">কাস্টমার নোট:</span> ' + esc(o.order_note) + '</div>' : '') +
              '</div>' +
              (o.risk_reasons && o.risk_reasons.length ? '<div class="mt-3 bg-red-50 rounded-lg p-3"><div class="text-xs font-bold text-red-700 mb-1"><i class="fas fa-triangle-exclamation mr-1"></i>রিস্ক ফ্যাক্টর:</div><ul class="text-xs text-red-600 list-disc ml-4">' + o.risk_reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' : '') +
            '</div>' +
            // Items
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-3"><i class="fas fa-box text-emerald-600 mr-2"></i>পণ্যসমূহ</h3>' +
              d.items.map(function (it) {
                return '<div class="flex justify-between items-center py-2 border-b border-gray-50 text-sm"><div><span class="font-semibold">' + esc(it.product_name) + '</span>' + (it.package_name ? ' <span class="text-xs text-gray-400">(' + esc(it.package_name) + ')</span>' : '') + ' × ' + it.quantity + '</div><span class="font-semibold">' + money(it.total_price) + '</span></div>';
              }).join('') +
              '<div class="pt-3 space-y-1.5 text-sm">' +
                '<div class="flex justify-between"><span class="text-gray-500">সাবটোটাল</span><span>' + money(o.subtotal) + '</span></div>' +
                '<div class="flex justify-between"><span class="text-gray-500">ডিসকাউন্ট</span><span>−' + money(o.discount) + '</span></div>' +
                '<div class="flex justify-between"><span class="text-gray-500">ডেলিভারি চার্জ</span><span>' + money(o.delivery_charge) + '</span></div>' +
                '<div class="flex justify-between font-bold text-base border-t border-gray-100 pt-2"><span>সর্বমোট</span><span class="text-emerald-700">' + money(o.grand_total) + '</span></div>' +
              '</div></div>' +
            // Financial
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><div class="flex justify-between items-center mb-3"><h3 class="font-bold"><i class="fas fa-coins text-emerald-600 mr-2"></i>প্রফিট/লস হিসাব</h3>' +
              '<button onclick="AV.editFinModal(' + o.id + ')" class="text-sm text-emerald-600 font-semibold"><i class="fas fa-pen mr-1"></i>খরচ এডিট</button></div>' +
              '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">' +
                [['নেট সেলস', fin.net_sales], ['প্রোডাক্ট খরচ', o.product_cost], ['প্যাকেজিং', o.packaging_cost], ['কুরিয়ার খরচ', o.courier_cost], ['COD চার্জ', o.cod_charge], ['অ্যাড খরচ', o.ad_cost], ['অন্যান্য', o.other_cost], ['মোট খরচ', fin.total_cost]].map(function (x) {
                  return '<div class="bg-gray-50 rounded-lg p-2.5"><div class="text-xs text-gray-500">' + x[0] + '</div><div class="font-semibold">' + money(x[1]) + '</div></div>';
                }).join('') +
                '<div class="rounded-lg p-2.5 ' + (fin.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50') + '"><div class="text-xs text-gray-500">নেট প্রফিট/লস</div><div class="font-bold ' + (fin.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600') + '">' + money(fin.net_profit) + '</div><div class="text-[10px] text-gray-400">মার্জিন ' + fin.profit_margin + '% | ROI ' + fin.roi + '%</div></div>' +
              '</div></div>' +
            // Attribution
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-3"><i class="fas fa-bullhorn text-emerald-600 mr-2"></i>মার্কেটিং অ্যাট্রিবিউশন</h3>' +
              '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">' +
                [['Source', o.utm_source], ['Medium', o.utm_medium], ['Campaign', o.utm_campaign], ['Campaign ID', o.campaign_id], ['Adset ID', o.adset_id], ['Ad ID', o.ad_id], ['IP', o.ip_address], ['Event ID', o.event_id]].map(function (x) {
                  return '<div class="bg-gray-50 rounded-lg p-2"><div class="text-gray-400">' + x[0] + '</div><div class="font-medium truncate">' + esc(x[1] || '—') + '</div></div>';
                }).join('') +
              '</div></div>' +
          '</div>' +
          // Right column
          '<div class="space-y-5">' +
            courierCardHtml(o, d.transfers) +
            courierHistoryHtml(d.courierLogs) +
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-3"><i class="fas fa-clock-rotate-left text-emerald-600 mr-2"></i>টাইমলাইন</h3>' + timeline + '</div>' +
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-3"><i class="fas fa-note-sticky text-emerald-600 mr-2"></i>অ্যাডমিন নোট</h3>' +
              '<textarea id="admin-notes" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">' + esc(o.admin_notes || '') + '</textarea>' +
              '<button onclick="AV.saveNotes(' + o.id + ')" class="mt-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold w-full">নোট সংরক্ষণ</button>' +
            '</div>' +
            '<button onclick="AV.deleteOrder(' + o.id + ')" class="w-full bg-red-50 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100"><i class="fas fa-trash-can mr-1.5"></i>অর্ডার ডিলিট (Soft Delete)</button>' +
          '</div>' +
        '</div>',
        'অর্ডার বিস্তারিত');
      // stash couriers for transfer modal
      S._couriers = couriers;
      S._currentOrder = o;
      // Live courier-status polling — only while this exact order-detail view is open,
      // and only swaps #courier-status-card / #courier-history-card (spec: "update only
      // the affected component, not the whole page").
      if (o.consignment_id || o.tracking_id) startCourierPoll(o.id);
      else stopCourierPoll();
    }).catch(apiErr);
  }

  // ============ order actions ============
  var AV = window.AV = {
    dashRange: function (r) { dashRange = r; viewDashboard(); },
    dashRefresh: function () { viewDashboard(); toast('ড্যাশবোর্ড রিফ্রেশ হয়েছে'); },
    oStatus: function (st) { oFilter.status = st; oFilter.page = 1; viewOrders(); },
    oSearch: function () {
      oFilter.search = v('of-search'); oFilter.risk_level = v('of-risk');
      oFilter.date_from = v('of-from'); oFilter.date_to = v('of-to'); oFilter.page = 1;
      viewOrders();
    },
    oPage: function (p) { oFilter.page = p; viewOrders(); },

    // Manual "🔄 Sync Now" — asks Steadfast for the latest status right now. Never lets
    // the admin type/pick a status themselves; the value always comes from the courier API.
    syncNow: function (id) {
      var btn = document.getElementById('sync-now-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>সিঙ্ক হচ্ছে...'; }
      axios.post('/api/admin/courier-sync/sync-now/' + id).then(function (r) {
        if (r.data.changed) toast('স্ট্যাটাস আপডেট হয়েছে: ' + (r.data.courier_status_label || r.data.courier_status));
        else toast('সিঙ্ক সম্পন্ন — স্ট্যাটাস অপরিবর্তিত আছে');
        if (S.route === 'orders' && String(S.param) === String(id)) viewOrderDetail();
      }).catch(function (e) {
        apiErr(e);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate mr-1"></i>Sync Now'; }
      });
    },

    changeStatus: function (id) {
      var ns = v('new-status');
      var critical = ['delivered', 'cancelled', 'returned', 'fake'];
      var doIt = function () {
        axios.put('/api/admin/orders/' + id + '/status', { status: ns }).then(function () {
          toast('স্ট্যাটাস আপডেট হয়েছে'); viewOrderDetail();
        }).catch(apiErr);
      };
      if (critical.indexOf(ns) !== -1) confirmDlg('আপনি কি নিশ্চিত এই অর্ডারটি "' + STATUS_BN[ns] + '" করতে চান?', doIt);
      else doIt();
    },

    transferModal: function (id) {
      var couriers = S._couriers || [];
      var fh = function (label, inner, hint) {
        return '<div class="mb-3"><label class="block text-sm font-semibold text-gray-700 mb-1">' + label + '</label>' + inner +
          (hint ? '<p class="text-[11px] text-gray-400 mt-1 leading-snug"><i class="fas fa-circle-info mr-1"></i>' + hint + '</p>' : '') + '</div>';
      };
      modal('<i class="fas fa-truck-arrow-right text-blue-600 mr-2"></i>কুরিয়ার ট্রান্সফার / অ্যাসাইন',
        fh('কুরিয়ার নির্বাচন', '<select id="tf-courier" onchange="AV.tfCourierChanged()" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' +
          couriers.map(function (c) { return '<option value="' + c.id + '" data-api="' + (c.has_api && c.api_configured ? 1 : 0) + '">' + esc(c.name) + ' (চার্জ: ' + money(c.delivery_charge) + ')' + (c.has_api ? (c.api_configured ? ' 🔌 API' : ' ⚠️ API key দেওয়া হয়নি') : ' — ম্যানুয়াল') + '</option>'; }).join('') + '</select>',
          'যে কুরিয়ারে অর্ডার পাঠাবেন সেটি বাছাই করুন — 🔌 API থাকলে অটো পাঠানো যাবে') +
        '<div id="tf-api-box" class="hidden mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">' +
          '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="tf-sendapi" class="w-4 h-4 accent-emerald-600" checked onchange="AV.tfApiToggled()">' +
          '<span class="text-sm font-semibold text-emerald-800"><i class="fas fa-bolt mr-1"></i>Steadfast-এ অটো অর্ডার পাঠান (API)</span></label>' +
          '<p class="text-[11px] text-emerald-700 mt-1 ml-6">টিক থাকলে অর্ডারটি সরাসরি Steadfast প্যানেলে চলে যাবে এবং ট্র্যাকিং আইডি অটো চলে আসবে — নিচের ট্র্যাকিং ঘর খালি রাখুন</p>' +
        '</div>' +
        fh('ট্র্যাকিং / কনসাইনমেন্ট আইডি', inp('tf-tracking', '', 'যেমন: 15BAEB8A'), 'API দিয়ে পাঠালে খালি রাখুন (অটো আসবে)। ম্যানুয়ালি পাঠালে কুরিয়ার প্যানেল থেকে পাওয়া আইডি এখানে লিখুন') +
        '<div class="grid grid-cols-2 gap-3">' +
          fh('প্রোডাক্টের ওজন', '<select id="tf-weight" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' +
            [['0.01', '১০ গ্রাম'], ['0.02', '২০ গ্রাম'], ['0.03', '৩০ গ্রাম'], ['0.5', '০.৫ কেজি'], ['1', '১ কেজি'], ['1.5', '১.৫ কেজি'], ['2', '২ কেজি'], ['3', '৩ কেজি'], ['4', '৪ কেজি'], ['5', '৫ কেজি'], ['7', '৭ কেজি'], ['10', '১০ কেজি']]
              .map(function (w) { return '<option value="' + w[0] + '"' + (w[0] === '0.5' ? ' selected' : '') + '>' + w[1] + '</option>'; }).join('') + '</select>',
            'প্যাকেজসহ মোট ওজন — বেশি ওজনে কুরিয়ার চার্জ বাড়তে পারে') +
          fh('ডেলিভারি চার্জ (কাস্টমার)', inp('tf-delivery', '', 'খালি = অপরিবর্তিত', 'number'), 'কাস্টমারের কাছ থেকে নেওয়া ডেলিভারি চার্জ পাল্টাতে চাইলে লিখুন') +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3">' +
          fh('কুরিয়ার খরচ (ব্যবসার)', inp('tf-charge', '', 'খালি = ডিফল্ট চার্জ', 'number'), 'আপনার ব্যবসা থেকে কুরিয়ারকে দেওয়া খরচ — প্রফিট হিসাবে যাবে') +
          fh('ট্রান্সফার নোট', inp('tf-note', '', 'যেমন: ফ্রাজিল পণ্য'), 'ঐচ্ছিক — কুরিয়ারের জন্য বিশেষ নির্দেশনা (যেমন: সাবধানে বহন করুন)') +
        '</div>',
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
        '<button id="tf-submit" onclick="AV.doTransfer(' + id + ')" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">ট্রান্সফার করুন</button>');
      AV.tfCourierChanged();
    },
    tfCourierChanged: function () {
      var sel = document.getElementById('tf-courier');
      if (!sel) return;
      var opt = sel.options[sel.selectedIndex];
      var hasApi = opt && opt.getAttribute('data-api') === '1';
      var box = document.getElementById('tf-api-box');
      if (box) box.classList.toggle('hidden', !hasApi);
      AV.tfApiToggled();
    },
    tfApiToggled: function () {
      var box = document.getElementById('tf-api-box');
      var cb = document.getElementById('tf-sendapi');
      var btn = document.getElementById('tf-submit');
      var useApi = box && !box.classList.contains('hidden') && cb && cb.checked;
      if (btn) btn.innerHTML = useApi ? '<i class="fas fa-bolt mr-1"></i>Steadfast-এ পাঠান' : 'ট্রান্সফার করুন';
      var tr = document.getElementById('tf-tracking');
      if (tr) tr.placeholder = useApi ? 'অটো আসবে — খালি রাখুন' : 'যেমন: 15BAEB8A';
    },
    doTransfer: function (id) {
      var box = document.getElementById('tf-api-box');
      var cb = document.getElementById('tf-sendapi');
      var useApi = box && !box.classList.contains('hidden') && cb && cb.checked;
      var btn = document.getElementById('tf-submit');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>পাঠানো হচ্ছে...'; }
      axios.post('/api/admin/orders/' + id + '/transfer', {
        courier_id: Number(v('tf-courier')), tracking_id: v('tf-tracking'),
        delivery_charge: v('tf-delivery') !== '' ? Number(v('tf-delivery')) : null,
        courier_charge: v('tf-charge') !== '' ? Number(v('tf-charge')) : null,
        note: v('tf-note'), weight: Number(v('tf-weight') || 0.5), send_via_api: !!useApi
      }).then(function (r) {
        closeModal();
        toast(useApi && r.data.tracking_id ? '✅ Steadfast-এ পাঠানো হয়েছে! ট্র্যাকিং: ' + r.data.tracking_id : r.data.message);
        viewOrderDetail();
      }).catch(function (e) {
        if (btn) { btn.disabled = false; AV.tfApiToggled(); }
        apiErr(e);
      });
    },

    editFinModal: function (id) {
      var o = S._currentOrder;
      modal('<i class="fas fa-coins text-emerald-600 mr-2"></i>খরচ ও মূল্য এডিট',
        '<div class="grid grid-cols-2 gap-3">' +
        field('ডিসকাউন্ট', inp('ef-discount', o.discount, '', 'number')) +
        field('ডেলিভারি চার্জ', inp('ef-delivery', o.delivery_charge, '', 'number')) +
        field('প্রোডাক্ট খরচ', inp('ef-pcost', o.product_cost, '', 'number')) +
        field('প্যাকেজিং খরচ', inp('ef-pack', o.packaging_cost, '', 'number')) +
        field('কুরিয়ার খরচ', inp('ef-courier', o.courier_cost, '', 'number')) +
        field('COD চার্জ', inp('ef-cod', o.cod_charge, '', 'number')) +
        field('অ্যাড খরচ', inp('ef-ad', o.ad_cost, '', 'number')) +
        field('অন্যান্য খরচ', inp('ef-other', o.other_cost, '', 'number')) +
        '</div><p class="text-xs text-gray-400">সংরক্ষণ করলে প্রফিট/লস স্বয়ংক্রিয়ভাবে পুনরায় হিসাব হবে।</p>',
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
        '<button onclick="AV.saveFin(' + id + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
    },
    saveFin: function (id) {
      axios.put('/api/admin/orders/' + id, {
        discount: Number(v('ef-discount') || 0), delivery_charge: Number(v('ef-delivery') || 0),
        product_cost: Number(v('ef-pcost') || 0), packaging_cost: Number(v('ef-pack') || 0),
        courier_cost: Number(v('ef-courier') || 0), cod_charge: Number(v('ef-cod') || 0),
        ad_cost: Number(v('ef-ad') || 0), other_cost: Number(v('ef-other') || 0)
      }).then(function () { closeModal(); toast('আপডেট হয়েছে, প্রফিট পুনরায় হিসাব হয়েছে'); viewOrderDetail(); }).catch(apiErr);
    },

    editCustModal: function (id) {
      var o = S._currentOrder;
      modal('<i class="fas fa-user-pen text-emerald-600 mr-2"></i>কাস্টমার তথ্য এডিট',
        field('নাম', inp('ec-name', o.customer_name, '')) +
        '<div class="grid grid-cols-2 gap-3">' +
          field('ফোন', inp('ec-phone', o.phone, '01XXXXXXXXX')) +
          field('বিকল্প ফোন', inp('ec-altphone', o.alt_phone || '', '01XXXXXXXXX')) +
        '</div>' +
        field('ঠিকানা', inp('ec-address', o.address, '')) +
        '<div class="grid grid-cols-2 gap-3">' +
          field('জেলা', inp('ec-district', o.district || '', '')) +
          field('উপজেলা', inp('ec-upazila', o.upazila || '', '')) +
        '</div>' +
        '<p class="text-xs text-gray-400">ফোন নম্বর ভুল ফরম্যাট (leading 0 ছাড়া ইত্যাদি) হলে কুরিয়ারে ট্রান্সফার ব্যর্থ হতে পারে — এখান থেকেই ঠিক করে নিন।</p>',
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
        '<button onclick="AV.saveCust(' + id + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
    },
    saveCust: function (id) {
      axios.put('/api/admin/orders/' + id, {
        customer_name: v('ec-name'), phone: v('ec-phone'), alt_phone: v('ec-altphone'),
        address: v('ec-address'), district: v('ec-district'), upazila: v('ec-upazila')
      }).then(function () { closeModal(); toast('কাস্টমার তথ্য আপডেট হয়েছে'); viewOrderDetail(); }).catch(apiErr);
    },

    saveNotes: function (id) {
      axios.put('/api/admin/orders/' + id, { admin_notes: v('admin-notes') }).then(function () { toast('নোট সংরক্ষিত'); }).catch(apiErr);
    },
    deleteOrder: function (id) {
      confirmDlg('অর্ডারটি ডিলিট করবেন? (Soft delete — পরে recover করা যাবে)', function () {
        axios.delete('/api/admin/orders/' + id).then(function () { toast('অর্ডার ডিলিট হয়েছে'); location.hash = '#/orders'; }).catch(apiErr);
      });
    }
  };

  // Stop the dashboard auto-refresh / courier-status poll timers when the user navigates away
  window.addEventListener('hashchange', function () {
    var route = location.hash.replace(/^#\//, '').split('/')[0] || 'dashboard';
    if (route !== 'dashboard') stopDashAutoRefresh();
    if (route !== 'orders') stopCourierPoll();
  });

  // register part-1 views now; part 3 adds the rest
  window.__ADMIN_VIEWS_CORE__ = {
    dashboard: viewDashboard, orders: viewOrders, orderDetail: viewOrderDetail, orderTable: orderTable,
    card: card, rangeSelector: rangeSelector, destroyCharts: destroyCharts, chartsRef: function () { return charts; }
  };
})();
