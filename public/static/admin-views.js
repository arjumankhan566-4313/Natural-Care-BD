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

  // ============ DASHBOARD ============
  var dashRange = 'today';
  function viewDashboard() {
    destroyCharts();
    Promise.all([
      axios.get('/api/admin/analytics/summary?range=' + dashRange),
      axios.get('/api/admin/analytics/charts?range=' + (dashRange === 'today' || dashRange === 'yesterday' ? 'last7' : dashRange)),
      axios.get('/api/admin/orders?limit=8')
    ]).then(function (rs) {
      var d = rs[0].data, ch = rs[1].data, ords = rs[2].data.orders;
      var sc = d.status_counts || {};
      cardIdx = 0;
      setContent(
        '<div class="flex items-center justify-between mb-5 flex-wrap gap-3">' +
          '<div><div class="text-sm text-gray-500">' + d.range.from + (d.range.from !== d.range.to ? ' → ' + d.range.to : '') + ' | $1 = ৳' + d.usd_rate + '</div></div>' +
          rangeSelector(dashRange, 'AV.dashRange(this.value)') +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
          card('মোট অর্ডার', d.total_orders, 'fa-cart-shopping', 'bg-blue-100 text-blue-600', { raw: d.total_orders }) +
          card('রেভিনিউ (ডেলিভারড)', money(d.revenue), 'fa-sack-dollar', 'bg-emerald-100 text-emerald-600', { raw: d.revenue, prefix: '৳' }) +
          card('নেট প্রফিট', money(d.net_profit), 'fa-arrow-trend-up', d.net_profit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600', { raw: d.net_profit, prefix: '৳' }) +
          card('লস', money(d.loss), 'fa-arrow-trend-down', 'bg-red-100 text-red-500', { raw: d.loss, prefix: '৳' }) +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
          card('অ্যাড খরচ', money(d.ad_spend_bdt) + (d.ad_spend_usd ? ' ($' + d.ad_spend_usd + ')' : ''), 'fa-bullhorn', 'bg-purple-100 text-purple-600', { raw: d.ad_spend_bdt, prefix: '৳' }) +
          card('কুরিয়ার খরচ', money(d.courier_cost), 'fa-truck', 'bg-cyan-100 text-cyan-600', { raw: d.courier_cost, prefix: '৳' }) +
          card('প্রোডাক্ট খরচ', money(d.product_cost), 'fa-box', 'bg-amber-100 text-amber-600', { raw: d.product_cost, prefix: '৳' }) +
          card('অন্যান্য খরচ', money(d.other_expenses), 'fa-receipt', 'bg-gray-100 text-gray-600', { raw: d.other_expenses, prefix: '৳' }) +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">' +
          card('পেন্ডিং', d.pending, 'fa-clock', 'bg-amber-100 text-amber-600', { raw: d.pending }) +
          card('ডেলিভারড', d.delivered, 'fa-circle-check', 'bg-green-100 text-green-600', { raw: d.delivered }) +
          card('বাতিল', d.cancelled, 'fa-circle-xmark', 'bg-red-100 text-red-500', { raw: d.cancelled }) +
          card('রিটার্নড', d.returned, 'fa-rotate-left', 'bg-orange-100 text-orange-500', { raw: d.returned }) +
          card('মার্জিন', d.profit_margin + '%', 'fa-percent', 'bg-indigo-100 text-indigo-600', { raw: d.profit_margin, suffix: '%' }) +
          card('ROI', d.roi + '%', 'fa-chart-pie', 'bg-pink-100 text-pink-600', { raw: d.roi, suffix: '%' }) +
        '</div>' +
        '<div class="grid lg:grid-cols-2 gap-5 mb-6">' +
          '<div class="bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.35s"><h3 class="font-bold mb-4">রেভিনিউ ও প্রফিট</h3><canvas id="ch-rev" height="220"></canvas></div>' +
          '<div class="bg-white rounded-2xl p-5 shadow-sm kpi-card-in" style="animation-delay:.42s"><h3 class="font-bold mb-4">অর্ডার ও অ্যাড খরচ</h3><canvas id="ch-ord" height="220"></canvas></div>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow-sm overflow-hidden kpi-card-in" style="animation-delay:.5s">' +
          '<div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-bold">সাম্প্রতিক অর্ডার</h3><a href="#/orders" class="text-sm text-emerald-600 font-semibold">সব দেখুন →</a></div>' +
          orderTable(ords) +
        '</div>',
        'ড্যাশবোর্ড');

      if (H.runCountUps) H.runCountUps();

      var days = (ch.daily || []).map(function (x) { return x.day.slice(5); });
      var adMap = {};
      (ch.ad_daily || []).forEach(function (x) { adMap[x.day] = x.spend; });
      charts.rev = new Chart(document.getElementById('ch-rev'), {
        type: 'line',
        data: { labels: days, datasets: [
          { label: 'রেভিনিউ', data: (ch.daily || []).map(function (x) { return x.revenue; }), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.35 },
          { label: 'প্রফিট', data: (ch.daily || []).map(function (x) { return x.profit; }), borderColor: '#6366f1', tension: 0.35 }
        ] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
      charts.ord = new Chart(document.getElementById('ch-ord'), {
        type: 'bar',
        data: { labels: days, datasets: [
          { label: 'অর্ডার', data: (ch.daily || []).map(function (x) { return x.orders; }), backgroundColor: '#34d399' },
          { label: 'অ্যাড খরচ (৳)', data: (ch.daily || []).map(function (x) { return adMap[x.day] || 0; }), backgroundColor: '#a78bfa' }
        ] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }).catch(apiErr);
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

      var transfers = d.transfers.length ? d.transfers.map(function (t) {
        return '<div class="bg-gray-50 rounded-xl p-3 mb-2 text-sm">' +
          '<div class="font-semibold">' + (t.from_courier_name ? esc(t.from_courier_name) + ' <i class="fas fa-arrow-right text-gray-400 mx-1"></i> ' : '<i class="fas fa-plus-circle text-emerald-500 mr-1"></i>') + esc(t.to_courier_name) + '</div>' +
          '<div class="text-xs text-gray-500 mt-1">' + (t.tracking_id ? 'ট্র্যাকিং: ' + esc(t.tracking_id) + ' | ' : '') + 'চার্জ: ' + money(t.courier_charge) + (t.weight ? ' | ওজন: ' + t.weight + 'কেজি' : '') + (t.consignment_id ? ' | <span class="text-emerald-600 font-semibold">API ✅ ' + esc(t.consignment_id) + '</span>' : '') + (t.note ? ' | ' + esc(t.note) : '') + '</div>' +
          '<div class="text-[10px] text-gray-400">' + fmtDT(t.created_at) + ' — ' + esc(t.transferred_by) + '</div></div>';
      }).join('') : '<div class="text-sm text-gray-400 text-center py-3">কোনো কুরিয়ার ট্রান্সফার হয়নি</div>';

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
            '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-3"><i class="fas fa-truck text-emerald-600 mr-2"></i>কুরিয়ার</h3>' +
              '<div class="text-sm space-y-1.5">' +
                '<div><span class="text-gray-500">কুরিয়ার:</span> <span class="font-semibold">' + esc(o.courier_name || 'নির্ধারিত হয়নি') + '</span></div>' +
                '<div><span class="text-gray-500">ট্র্যাকিং:</span> <span class="font-semibold">' + esc(o.tracking_id || '—') + '</span></div>' +
                (o.consignment_id ? '<div><span class="text-gray-500">কনসাইনমেন্ট:</span> <span class="font-semibold text-emerald-700">' + esc(o.consignment_id) + '</span> <span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">API</span></div>' : '') +
                (o.tracking_url ? '<a href="' + esc(o.tracking_url) + '" target="_blank" class="block text-center bg-blue-50 text-blue-700 rounded-lg py-2 font-semibold text-xs mt-2"><i class="fas fa-arrow-up-right-from-square mr-1"></i>ট্র্যাক করুন</a>' : '') +
              '</div>' +
              '<h4 class="font-semibold text-sm mt-4 mb-2 text-gray-600">ট্রান্সফার হিস্ট্রি</h4>' + transfers +
            '</div>' +
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
    }).catch(apiErr);
  }

  // ============ order actions ============
  var AV = window.AV = {
    dashRange: function (r) { dashRange = r; viewDashboard(); },
    oStatus: function (st) { oFilter.status = st; oFilter.page = 1; viewOrders(); },
    oSearch: function () {
      oFilter.search = v('of-search'); oFilter.risk_level = v('of-risk');
      oFilter.date_from = v('of-from'); oFilter.date_to = v('of-to'); oFilter.page = 1;
      viewOrders();
    },
    oPage: function (p) { oFilter.page = p; viewOrders(); },

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

  // register part-1 views now; part 3 adds the rest
  window.__ADMIN_VIEWS_CORE__ = {
    dashboard: viewDashboard, orders: viewOrders, orderDetail: viewOrderDetail, orderTable: orderTable,
    card: card, rangeSelector: rangeSelector, destroyCharts: destroyCharts, chartsRef: function () { return charts; }
  };
})();
