// ============ Admin Panel Views (part 4): marketing, finance, analytics, content, settings, users ============
(function () {
  'use strict';
  var H = window.__ADMIN__, C = window.__ADMIN_VIEWS_CORE__, C2 = window.__ADMIN_VIEWS_2__;
  var S = H.S, esc = H.esc, money = H.money, fmtDT = H.fmtDT, toast = H.toast, apiErr = H.apiErr,
      confirmDlg = H.confirmDlg, modal = H.modal, closeModal = H.closeModal, field = H.field,
      inp = H.inp, v = H.v, chk = H.chk, setContent = H.setContent,
      card = C.card, rangeSelector = C.rangeSelector, destroyCharts = C.destroyCharts,
      sectionCard = C2.sectionCard, textarea = C2.textarea, checkbox = C2.checkbox;
  var AV = window.AV;
  var charts = {};
  function killCharts() { Object.values(charts).forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = {}; }

  function tbl(headers, rowsHtml) {
    return '<div class="overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100">' +
      headers.map(function (h) { return '<th class="px-3 py-2.5">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rowsHtml || '<tr><td colspan="' + headers.length + '" class="text-center text-gray-400 py-8">কোনো ডেটা নেই</td></tr>') + '</tbody></table></div>';
  }

  // ============ MARKETING ============
  function viewMarketing() {
    Promise.all([
      axios.get('/api/admin/ad-spends'),
      axios.get('/api/admin/analytics/marketing?range=last30')
    ]).then(function (rs) {
      var d = rs[0].data, mk = rs[1].data;
      var spendRows = d.ad_spends.map(function (a) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5"><div class="font-semibold">' + esc(a.campaign_name) + '</div><div class="text-[10px] text-gray-400">' + esc(a.campaign_id || '') + '</div></td>' +
          '<td class="px-3 py-2.5 text-xs">' + a.spend_date + '</td>' +
          '<td class="px-3 py-2.5">' + (a.currency === 'USD' ? '$' + a.amount : money(a.amount)) + '</td>' +
          '<td class="px-3 py-2.5 font-semibold">' + money(a.amount_bdt) + '</td>' +
          '<td class="px-3 py-2.5"><button onclick="AV.deleteAdSpend(' + a.id + ')" class="text-red-400"><i class="fas fa-trash-can"></i></button></td></tr>';
      }).join('');
      var cpoRows = d.campaign_cpo.map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.campaign_name) + '</td>' +
          '<td class="px-3 py-2.5">' + money(x.total_spend_bdt) + '</td><td class="px-3 py-2.5">' + x.attributed_orders + '</td>' +
          '<td class="px-3 py-2.5 font-bold text-emerald-700">' + (x.cost_per_order != null ? money(x.cost_per_order) : '—') + '</td></tr>';
      }).join('');
      var srcRows = mk.sources.map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.source) + '</td><td class="px-3 py-2.5">' + x.orders + '</td><td class="px-3 py-2.5">' + money(x.revenue) + '</td></tr>';
      }).join('');
      var campRows = mk.campaigns.map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.campaign) + '</td><td class="px-3 py-2.5">' + x.orders + '</td><td class="px-3 py-2.5">' + money(x.revenue) + '</td><td class="px-3 py-2.5">' + money(x.ad_cost) + '</td></tr>';
      }).join('');
      var evRows = mk.events.map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.event_name) + '</td><td class="px-3 py-2.5">' + x.cnt + '</td></tr>';
      }).join('');
      setContent(
        sectionCard('<i class="fas fa-dollar-sign text-purple-600 mr-2"></i>অ্যাড খরচ (Ad Spend)',
          tbl(['ক্যাম্পেইন', 'তারিখ', 'খরচ', 'BDT', ''], spendRows),
          '<button onclick="AV.addAdSpendModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold"><i class="fas fa-plus mr-1"></i>অ্যাড খরচ যোগ</button>') +
        sectionCard('<i class="fas fa-calculator text-purple-600 mr-2"></i>Cost Per Order (CPO)', tbl(['ক্যাম্পেইন', 'মোট খরচ', 'অর্ডার', 'CPO'], cpoRows)) +
        '<div class="grid lg:grid-cols-2 gap-5">' +
          sectionCard('অর্ডার সোর্স (শেষ ৩০ দিন)', tbl(['Source', 'অর্ডার', 'রেভিনিউ'], srcRows)) +
          sectionCard('ক্যাম্পেইন পারফরম্যান্স', tbl(['Campaign', 'অর্ডার', 'রেভিনিউ', 'অ্যাড খরচ'], campRows)) +
        '</div>' +
        sectionCard('ট্র্যাকিং ইভেন্ট (শেষ ৩০ দিন)', tbl(['Event', 'সংখ্যা'], evRows)) +
        '<div class="text-right"><a href="/api/admin/export/ad-spends" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700"><i class="fas fa-download mr-1.5"></i>এক্সপোর্ট</a></div>',
        'মার্কেটিং');
    }).catch(apiErr);
  }
  AV.addAdSpendModal = function () {
    function hint(t) { return '<p class="text-[11px] text-gray-400 -mt-2 mb-3 leading-snug"><i class="fas fa-circle-info mr-1"></i>' + t + '</p>'; }
    modal('অ্যাড খরচ যোগ করুন',
      field('ক্যাম্পেইন নাম *', inp('as-name', '', 'যেমন: শীতের অফার')) + hint('ফেসবুক ক্যাম্পেইনের নাম — নিজের চেনার জন্য যেকোনো নাম দিলেই হবে') +
      '<div class="grid grid-cols-2 gap-3">' +
        '<div>' + field('Campaign ID', inp('as-cid', '', 'Meta campaign ID')) + hint('Facebook Ads Manager-এ ক্যাম্পেইনের লম্বা সংখ্যার ID — এটা দিলে খরচ অটো অর্ডারে ভাগ হবে') + '</div>' +
        '<div>' + field('তারিখ *', inp('as-date', new Date().toISOString().slice(0, 10), '', 'date')) + hint('কোন দিনের অ্যাড খরচ লিখছেন') + '</div>' +
        '<div>' + field('খরচ *', inp('as-amount', '', '25.50', 'number')) + hint('ওই দিনে এই ক্যাম্পেইনে মোট কত খরচ হয়েছে') + '</div>' +
        '<div>' + field('কারেন্সি', '<select id="as-currency" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"><option value="USD">USD ($)</option><option value="BDT">BDT (৳)</option></select>') + hint('ফেসবুক ডলারে বিল করলে USD, টাকায় করলে BDT') + '</div>' +
        field('Adset ID', inp('as-adset')) + field('Ad ID', inp('as-adid')) +
      '</div>' +
      hint('Adset/Ad ID ঐচ্ছিক — না দিলেও চলবে') +
      field('নোট', inp('as-note', '', 'নিজের জন্য মন্তব্য (ঐচ্ছিক)')) +
      checkbox('as-distribute', true, 'এই ক্যাম্পেইনের অর্ডারগুলোতে খরচ ভাগ করে দিন (per-order ad cost)') +
      '<div class="bg-purple-50 rounded-lg p-3 mt-2 text-[11px] text-purple-800 leading-relaxed">' +
        '<b><i class="fas fa-lightbulb mr-1"></i>কীভাবে অটো হিসাব হয়:</b> USD দিলে সেটিংসের রেট অনুযায়ী টাকায় কনভার্ট হবে। Campaign ID দিলে + উপরের টিক দেওয়া থাকলে — ওই তারিখে ওই ক্যাম্পেইন থেকে আসা অর্ডারগুলোতে খরচ সমান ভাগ হয়ে প্রতিটার নেট প্রফিট অটো আপডেট হবে।<br>' +
        '<b class="mt-1 inline-block">শর্ত:</b> অ্যাডের লিংকে <code class="bg-purple-100 px-1 rounded">?campaign_id={{campaign.id}}</code> থাকতে হবে, নাহলে অর্ডার-ক্যাম্পেইন মিলবে না। শুধু নাম+খরচ দিলেও মোট খরচ রিপোর্টে যোগ হবে।' +
      '</div>',
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveAdSpend()" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveAdSpend = function () {
    axios.post('/api/admin/ad-spends', {
      campaign_name: v('as-name'), campaign_id: v('as-cid'), spend_date: v('as-date'),
      amount: Number(v('as-amount')), currency: v('as-currency'), adset_id: v('as-adset'), ad_id: v('as-adid'),
      note: v('as-note'), distribute_to_orders: chk('as-distribute')
    }).then(function (r) { closeModal(); toast('অ্যাড খরচ যোগ হয়েছে (৳' + r.data.amount_bdt + ')'); viewMarketing(); }).catch(apiErr);
  };
  AV.deleteAdSpend = function (id) {
    confirmDlg('এই অ্যাড খরচ ডিলিট করবেন?', function () {
      axios.delete('/api/admin/ad-spends/' + id).then(function () { viewMarketing(); }).catch(apiErr);
    });
  };

  // ============ FINANCE ============
  var finRange = 'this_month';
  function viewFinance() {
    Promise.all([
      axios.get('/api/admin/analytics/summary?range=' + finRange),
      axios.get('/api/admin/expenses')
    ]).then(function (rs) {
      var d = rs[0].data, exps = rs[1].data.expenses;
      var expRows = exps.map(function (e) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(e.name) + '</td>' +
          '<td class="px-3 py-2.5"><span class="text-xs bg-gray-100 px-2 py-0.5 rounded-full">' + esc(e.category) + '</span></td>' +
          '<td class="px-3 py-2.5 text-xs">' + e.expense_date + '</td>' +
          '<td class="px-3 py-2.5 font-semibold">' + (e.currency === 'USD' ? '$' + e.amount + ' → ' : '') + money(e.amount_bdt) + '</td>' +
          '<td class="px-3 py-2.5"><button onclick="AV.deleteExpense(' + e.id + ')" class="text-red-400"><i class="fas fa-trash-can"></i></button></td></tr>';
      }).join('');
      setContent(
        '<div class="flex justify-between items-center mb-5 flex-wrap gap-3"><div class="text-sm text-gray-500">' + d.range.from + ' → ' + d.range.to + ' | রেট: $1 = ৳' + d.usd_rate + '</div>' + rangeSelector(finRange, 'AV.finRange(this.value)') + '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
          card('মোট রেভিনিউ', money(d.revenue), 'fa-sack-dollar', 'bg-emerald-100 text-emerald-600') +
          card('মোট খরচ', money(d.total_expenses), 'fa-receipt', 'bg-red-100 text-red-500') +
          card('নেট প্রফিট', money(d.net_profit), 'fa-arrow-trend-up', d.net_profit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600') +
          card('ROI', d.roi + '%', 'fa-chart-pie', 'bg-pink-100 text-pink-600') +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">' +
          card('প্রোডাক্ট খরচ', money(d.product_cost), 'fa-box', 'bg-amber-100 text-amber-600') +
          card('কুরিয়ার খরচ', money(d.courier_cost), 'fa-truck', 'bg-cyan-100 text-cyan-600') +
          card('অ্যাড খরচ', money(d.ad_spend_bdt), 'fa-bullhorn', 'bg-purple-100 text-purple-600') +
          card('মার্জিন', d.profit_margin + '%', 'fa-percent', 'bg-indigo-100 text-indigo-600') +
        '</div>' +
        sectionCard('<i class="fas fa-receipt text-red-500 mr-2"></i>অন্যান্য খরচ (Expenses)',
          tbl(['নাম', 'ক্যাটাগরি', 'তারিখ', 'পরিমাণ', ''], expRows),
          '<button onclick="AV.addExpenseModal()" class="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold"><i class="fas fa-plus mr-1"></i>খরচ যোগ</button>') +
        '<div class="text-right space-x-2"><a href="/api/admin/export/expenses" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700"><i class="fas fa-download mr-1.5"></i>খরচ এক্সপোর্ট</a>' +
        '<a href="/api/admin/export/profit-loss" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700"><i class="fas fa-download mr-1.5"></i>P&L এক্সপোর্ট</a></div>',
        'ফাইন্যান্স');
    }).catch(apiErr);
  }
  AV.finRange = function (r) { finRange = r; viewFinance(); };
  AV.addExpenseModal = function () {
    var cats = ['packaging', 'staff', 'phone', 'software', 'refund', 'return', 'courier_penalty', 'miscellaneous'];
    modal('খরচ যোগ করুন',
      field('নাম *', inp('ex-name', '', 'যেমন: প্যাকেজিং ম্যাটেরিয়াল')) +
      '<div class="grid grid-cols-2 gap-3">' +
        field('পরিমাণ *', inp('ex-amount', '', '', 'number')) +
        field('কারেন্সি', '<select id="ex-currency" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"><option value="BDT">BDT (৳)</option><option value="USD">USD ($)</option></select>') +
        field('তারিখ *', inp('ex-date', new Date().toISOString().slice(0, 10), '', 'date')) +
        field('ক্যাটাগরি', '<select id="ex-cat" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' + cats.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>') +
      '</div>' + field('নোট', inp('ex-note')),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveExpense()" class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveExpense = function () {
    axios.post('/api/admin/expenses', { name: v('ex-name'), amount: Number(v('ex-amount')), currency: v('ex-currency'), expense_date: v('ex-date'), category: v('ex-cat'), note: v('ex-note') })
      .then(function () { closeModal(); toast('খরচ যোগ হয়েছে'); viewFinance(); }).catch(apiErr);
  };
  AV.deleteExpense = function (id) {
    confirmDlg('খরচটি ডিলিট করবেন?', function () { axios.delete('/api/admin/expenses/' + id).then(function () { viewFinance(); }).catch(apiErr); });
  };

  // ============ ANALYTICS ============
  var anRange = 'last30';
  function viewAnalytics() {
    killCharts();
    Promise.all([
      axios.get('/api/admin/analytics/charts?range=' + anRange),
      axios.get('/api/admin/analytics/products?range=' + anRange),
      axios.get('/api/admin/analytics/couriers')
    ]).then(function (rs) {
      var ch = rs[0].data, prods = rs[1].data.products, cours = rs[2].data.couriers;
      var prodRows = prods.map(function (p) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(p.product_name) + '</td>' +
          '<td class="px-3 py-2.5">' + p.total_orders + '</td><td class="px-3 py-2.5">' + p.total_units + '</td>' +
          '<td class="px-3 py-2.5">' + money(p.revenue) + '</td><td class="px-3 py-2.5">' + money(p.product_cost) + '</td>' +
          '<td class="px-3 py-2.5 font-bold ' + (p.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600') + '">' + money(p.net_profit) + '</td>' +
          '<td class="px-3 py-2.5">' + p.profit_margin + '%</td></tr>';
      }).join('');
      var courRows = cours.map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.name) + '</td>' +
          '<td class="px-3 py-2.5">' + x.total_orders + '</td><td class="px-3 py-2.5 text-emerald-700 font-semibold">' + x.delivered + '</td>' +
          '<td class="px-3 py-2.5">' + x.cancelled + '</td><td class="px-3 py-2.5">' + x.returned + '</td>' +
          '<td class="px-3 py-2.5 font-bold">' + x.success_rate + '%</td><td class="px-3 py-2.5">' + x.return_rate + '%</td>' +
          '<td class="px-3 py-2.5">' + money(x.courier_cost) + '</td><td class="px-3 py-2.5">' + money(x.net_revenue) + '</td></tr>';
      }).join('');
      setContent(
        '<div class="flex justify-end mb-4">' + rangeSelector(anRange, 'AV.anRange(this.value)') + '</div>' +
        '<div class="grid lg:grid-cols-2 gap-5 mb-5">' +
          '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-4">রেভিনিউ / প্রফিট / অ্যাড খরচ</h3><canvas id="an-rev" height="240"></canvas></div>' +
          '<div class="bg-white rounded-2xl p-5 shadow-sm"><h3 class="font-bold mb-4">দৈনিক অর্ডার</h3><canvas id="an-ord" height="240"></canvas></div>' +
        '</div>' +
        sectionCard('<i class="fas fa-box text-emerald-600 mr-2"></i>প্রোডাক্ট প্রফিটাবিলিটি', tbl(['প্রোডাক্ট', 'অর্ডার', 'ইউনিট', 'রেভিনিউ', 'খরচ', 'প্রফিট', 'মার্জিন'], prodRows)) +
        sectionCard('<i class="fas fa-truck text-cyan-600 mr-2"></i>কুরিয়ার পারফরম্যান্স', tbl(['কুরিয়ার', 'অর্ডার', 'ডেলিভারড', 'বাতিল', 'রিটার্ন', 'সাকসেস', 'রিটার্ন রেট', 'খরচ', 'রেভিনিউ'], courRows)),
        'অ্যানালিটিক্স');
      var days = (ch.daily || []).map(function (x) { return x.day.slice(5); });
      var adMap = {};
      (ch.ad_daily || []).forEach(function (x) { adMap[x.day] = x.spend; });
      charts.rev = new Chart(document.getElementById('an-rev'), { type: 'line', data: { labels: days, datasets: [
        { label: 'রেভিনিউ', data: ch.daily.map(function (x) { return x.revenue; }), borderColor: '#059669', tension: 0.35 },
        { label: 'প্রফিট', data: ch.daily.map(function (x) { return x.profit; }), borderColor: '#6366f1', tension: 0.35 },
        { label: 'অ্যাড খরচ', data: ch.daily.map(function (x) { return adMap[x.day] || 0; }), borderColor: '#a855f7', borderDash: [5, 5], tension: 0.35 }
      ] }, options: { plugins: { legend: { position: 'bottom' } } } });
      charts.ord = new Chart(document.getElementById('an-ord'), { type: 'bar', data: { labels: days, datasets: [
        { label: 'অর্ডার', data: ch.daily.map(function (x) { return x.orders; }), backgroundColor: '#34d399' }
      ] }, options: { plugins: { legend: { display: false } } } });
    }).catch(apiErr);
  }
  AV.anRange = function (r) { anRange = r; viewAnalytics(); };

  // ============ CONTENT ============
  function viewContent() {
    Promise.all([
      axios.get('/api/admin/content/benefits'),
      axios.get('/api/admin/content/reviews'),
      axios.get('/api/admin/content/faqs'),
      axios.get('/api/admin/content/sections'),
      axios.get('/api/admin/banners').catch(function () { return { data: { banners: [] } }; })
    ]).then(function (rs) {
      var bens = rs[0].data.benefits, revs = rs[1].data.reviews, faqs = rs[2].data.faqs, secs = rs[3].data.sections;
      S._banners = rs[4].data.banners || [];
      var benRows = bens.map(function (b) {
        return '<div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2"><div class="flex items-center gap-3"><i class="fas ' + esc(b.icon) + ' text-emerald-600 w-5"></i><div><div class="font-semibold text-sm">' + esc(b.title) + (b.is_visible ? '' : ' <span class="text-xs text-gray-400">(লুকানো)</span>') + '</div><div class="text-xs text-gray-500">' + esc(b.description || '') + '</div></div></div>' +
        '<div class="flex gap-1 shrink-0"><button onclick="AV.editBenefit(' + b.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button><button onclick="AV.delContent(\'benefits\',' + b.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>';
      }).join('') || '<div class="text-gray-400 text-sm">কিছু নেই</div>';
      var revRows = revs.map(function (r2) {
        return '<div class="flex items-start justify-between bg-gray-50 rounded-xl p-3 mb-2"><div><div class="font-semibold text-sm">' + esc(r2.customer_name) + ' ' + '⭐'.repeat(r2.rating) + (r2.is_published ? '' : ' <span class="text-xs text-red-400">(আনপাবলিশড)</span>') + (r2.is_featured ? ' <span class="text-xs bg-amber-100 text-amber-700 px-1.5 rounded">Featured</span>' : '') + '</div><div class="text-xs text-gray-500 mt-1">' + esc(r2.review_text) + '</div></div>' +
        '<div class="flex gap-1 shrink-0"><button onclick="AV.editReview(' + r2.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button><button onclick="AV.delContent(\'reviews\',' + r2.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>';
      }).join('') || '<div class="text-gray-400 text-sm">কিছু নেই</div>';
      var faqRows = faqs.map(function (f) {
        return '<div class="flex items-start justify-between bg-gray-50 rounded-xl p-3 mb-2"><div><div class="font-semibold text-sm">' + esc(f.question) + (f.is_visible ? '' : ' <span class="text-xs text-gray-400">(লুকানো)</span>') + '</div><div class="text-xs text-gray-500 mt-1">' + esc(f.answer) + '</div></div>' +
        '<div class="flex gap-1 shrink-0"><button onclick="AV.editFaq(' + f.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button><button onclick="AV.delContent(\'faqs\',' + f.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>';
      }).join('') || '<div class="text-gray-400 text-sm">কিছু নেই</div>';
      var secRows = secs.map(function (sx) {
        return '<div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2"><div><span class="font-semibold text-sm">' + esc(sx.title || sx.section_type) + '</span> <span class="text-xs bg-gray-200 px-1.5 rounded">' + esc(sx.section_type) + '</span>' + (sx.is_visible ? '' : ' <span class="text-xs text-gray-400">(লুকানো)</span>') + ' <span class="text-xs text-gray-400">#' + sx.sort_order + '</span></div>' +
        '<div class="flex gap-1 shrink-0"><button onclick="AV.editSection(' + sx.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button><button onclick="AV.delContent(\'sections\',' + sx.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>';
      }).join('') || '<div class="text-gray-400 text-sm">কিছু নেই</div>';
      setContent(
        bannerSectionHtml() +
        sectionCard('<i class="fas fa-star text-emerald-600 mr-2"></i>বেনিফিট', benRows, '<button onclick="AV.editBenefit(0)" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fas fa-plus mr-1"></i>যোগ</button>') +
        sectionCard('<i class="fas fa-comment text-amber-500 mr-2"></i>রিভিউ', revRows, '<button onclick="AV.editReview(0)" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fas fa-plus mr-1"></i>যোগ</button>') +
        sectionCard('<i class="fas fa-circle-question text-blue-500 mr-2"></i>FAQ', faqRows, '<button onclick="AV.editFaq(0)" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fas fa-plus mr-1"></i>যোগ</button>') +
        sectionCard('<i class="fas fa-layer-group text-purple-500 mr-2"></i>পেজ সেকশন (Section Builder)', secRows, '<button onclick="AV.editSection(0)" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fas fa-plus mr-1"></i>যোগ</button>'),
        'কনটেন্ট');
      S._content = { benefits: bens, reviews: revs, faqs: faqs, sections: secs };
    }).catch(apiErr);
  }
  AV.delContent = function (type, id) {
    confirmDlg('ডিলিট করবেন?', function () {
      axios.delete('/api/admin/content/' + type + '/' + id).then(function () { toast('ডিলিট হয়েছে'); viewContent(); }).catch(apiErr);
    });
  };
  AV.editBenefit = function (id) {
    var b = (S._content.benefits || []).find(function (x) { return x.id === id; }) || {};
    modal(id ? 'বেনিফিট এডিট' : 'নতুন বেনিফিট',
      field('আইকন (FontAwesome)', inp('bn-icon', b.icon || 'fa-check-circle', 'fa-leaf')) +
      field('টাইটেল *', inp('bn-title', b.title)) + field('বিবরণ', textarea('bn-desc', b.description, 2)) +
      field('ছবি URL', inp('bn-image', b.image)) + field('Sort', inp('bn-sort', b.sort_order || 0, '', 'number')) +
      checkbox('bn-visible', b.is_visible !== 0, 'দৃশ্যমান'),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveBenefit(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveBenefit = function (id) {
    var payload = { icon: v('bn-icon'), title: v('bn-title'), description: v('bn-desc'), image: v('bn-image'), sort_order: Number(v('bn-sort') || 0), is_visible: chk('bn-visible') };
    (id ? axios.put('/api/admin/content/benefits/' + id, payload) : axios.post('/api/admin/content/benefits', payload))
      .then(function () { closeModal(); toast('সংরক্ষিত'); viewContent(); }).catch(apiErr);
  };
  AV.editReview = function (id) {
    var b = (S._content.reviews || []).find(function (x) { return x.id === id; }) || {};
    modal(id ? 'রিভিউ এডিট' : 'নতুন রিভিউ',
      field('কাস্টমার নাম *', inp('rv-name', b.customer_name)) +
      field('রিভিউ *', textarea('rv-text', b.review_text, 3)) +
      '<div class="grid grid-cols-2 gap-3">' + field('রেটিং (১-৫)', inp('rv-rating', b.rating || 5, '', 'number')) + field('কাস্টমারের ছবি URL (ছোট, ঐচ্ছিক)', inp('rv-image', b.customer_image)) + '</div>' +
      field('Sort', inp('rv-sort', b.sort_order || 0, '', 'number')) +
      '<div class="mb-3">' +
        '<label class="block text-sm font-semibold text-gray-700 mb-1.5">রিভিউ স্ক্রিনশট (WhatsApp/Messenger/Facebook)</label>' +
        '<div id="rv-ss-prev" class="mb-2">' + (b.screenshot_url ? '<img src="' + esc(b.screenshot_url) + '" class="rounded-lg max-h-40 border border-gray-200">' : '') + '</div>' +
        '<input type="hidden" id="rv-screenshot" value="' + esc(b.screenshot_url || '') + '">' +
        '<input type="file" id="rv-ss-file" accept="image/*" class="hidden" onchange="AV.uploadReviewScreenshot()">' +
        '<button type="button" onclick="document.getElementById(\'rv-ss-file\').click()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"><i class="fas fa-upload mr-1.5"></i>স্ক্রিনশট আপলোড</button>' +
        '<p class="text-xs text-gray-400 mt-1">কাস্টমারের WhatsApp/Messenger/Facebook চ্যাটের স্ক্রিনশট দিলে বিশ্বাসযোগ্যতা বাড়ে</p>' +
      '</div>' +
      '<div class="flex gap-5">' + checkbox('rv-pub', b.is_published !== 0, 'পাবলিশড') + checkbox('rv-feat', !!b.is_featured, 'Featured') + '</div>' +
      '<p class="text-xs text-amber-600 mt-3"><i class="fas fa-triangle-exclamation mr-1"></i>শুধুমাত্র প্রকৃত কাস্টমার রিভিউ ব্যবহার করুন।</p>',
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveReview(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveReview = function (id) {
    var payload = { customer_name: v('rv-name'), review_text: v('rv-text'), rating: Number(v('rv-rating') || 5), customer_image: v('rv-image'), screenshot_url: v('rv-screenshot'), sort_order: Number(v('rv-sort') || 0), is_published: chk('rv-pub'), is_featured: chk('rv-feat') };
    (id ? axios.put('/api/admin/content/reviews/' + id, payload) : axios.post('/api/admin/content/reviews', payload))
      .then(function () { closeModal(); toast('সংরক্ষিত'); viewContent(); }).catch(apiErr);
  };
  AV.uploadReviewScreenshot = function () {
    var input = document.getElementById('rv-ss-file');
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('শুধু ইমেজ ফাইল দিন', 'error'); return; }
    var img = new Image();
    var fr = new FileReader();
    fr.onload = function () { img.src = fr.result; };
    img.onload = function () {
      var maxDim = 1000;
      var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var mime = 'image/jpeg';
      var dataUrl = cv.toDataURL(mime, 0.82);
      var b64 = dataUrl.split(',')[1];
      toast('আপলোড হচ্ছে...');
      axios.post('/api/admin/upload-image', { data: b64, mime: mime }).then(function (r) {
        toast('স্ক্রিনশট আপলোড সফল ✅');
        document.getElementById('rv-screenshot').value = r.data.url;
        var prev = document.getElementById('rv-ss-prev');
        if (prev) prev.innerHTML = '<img src="' + r.data.url + '" class="rounded-lg max-h-40 border border-gray-200">';
      }).catch(apiErr);
    };
    fr.readAsDataURL(file);
  };
  AV.editFaq = function (id) {
    var b = (S._content.faqs || []).find(function (x) { return x.id === id; }) || {};
    modal(id ? 'FAQ এডিট' : 'নতুন FAQ',
      field('প্রশ্ন *', inp('fq-q', b.question)) + field('উত্তর *', textarea('fq-a', b.answer, 3)) +
      field('Sort', inp('fq-sort', b.sort_order || 0, '', 'number')) + checkbox('fq-visible', b.is_visible !== 0, 'দৃশ্যমান'),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveFaq(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveFaq = function (id) {
    var payload = { question: v('fq-q'), answer: v('fq-a'), sort_order: Number(v('fq-sort') || 0), is_visible: chk('fq-visible') };
    (id ? axios.put('/api/admin/content/faqs/' + id, payload) : axios.post('/api/admin/content/faqs', payload))
      .then(function () { closeModal(); toast('সংরক্ষিত'); viewContent(); }).catch(apiErr);
  };
  AV.editSection = function (id) {
    var b = (S._content.sections || []).find(function (x) { return x.id === id; }) || {};
    var types = ['hero', 'product', 'benefits', 'features', 'offer', 'gallery', 'video', 'reviews', 'faq', 'trust', 'delivery', 'cta', 'order_form', 'how_it_works', 'custom_html', 'custom_text'];
    modal(id ? 'সেকশন এডিট' : 'নতুন সেকশন',
      field('টাইপ', '<select id="sc-type" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' + types.map(function (t) { return '<option ' + (b.section_type === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') + '</select>') +
      field('টাইটেল', inp('sc-title', b.title)) +
      field('কনটেন্ট (JSON বা HTML/টেক্সট)', textarea('sc-content', b.content, 6)) +
      field('Sort', inp('sc-sort', b.sort_order || 0, '', 'number')) + checkbox('sc-visible', b.is_visible !== 0, 'দৃশ্যমান'),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveSection(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveSection = function (id) {
    var payload = { section_type: v('sc-type'), title: v('sc-title'), content: v('sc-content'), sort_order: Number(v('sc-sort') || 0), is_visible: chk('sc-visible') };
    (id ? axios.put('/api/admin/content/sections/' + id, payload) : axios.post('/api/admin/content/sections', payload))
      .then(function () { closeModal(); toast('সংরক্ষিত'); viewContent(); }).catch(apiErr);
  };

  // ============ SETTINGS ============
  function viewSettings() {
    axios.get('/api/admin/settings').then(function (r) {
      var st = r.data.settings;
      var grp = function (title, fields) { return sectionCard(title, fields); };
      var f = function (key, label, ph, type) { return field(label, inp('st-' + key, st[key], ph, type)); };
      setContent(
        '<form onsubmit="AV.saveSettings(event)">' +
        grp('<i class="fas fa-store text-emerald-600 mr-2"></i>ব্র্যান্ড ও জেনারেল',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('brand_name', 'ব্র্যান্ড নাম') + f('brand_tagline', 'ট্যাগলাইন') +
          f('support_phone', 'সাপোর্ট ফোন') + f('whatsapp_number', 'WhatsApp নম্বর (880...)') + f('messenger_link', 'Messenger লিংক') + '</div>') +
        grp('<i class="fas fa-image text-pink-500 mr-2"></i>লোগো ও ফ্যাভিকন',
          '<div class="grid md:grid-cols-2 gap-4 mb-2">' +
            assetUploader('brand_logo', 'সাইটের লোগো', st.brand_logo, 'ল্যান্ডিং পেজ, অ্যাডমিন লগইন ও অ্যাডমিন প্যানেলে দেখাবে (PNG, স্বচ্ছ ব্যাকগ্রাউন্ড সবচেয়ে ভালো)') +
            assetUploader('favicon', 'ফ্যাভিকন (ব্রাউজার ট্যাবের আইকন)', st.favicon_url, 'বর্গাকার ছবি দিন — 64x64 বা 128x128 px হলে ভালো') +
          '</div>' +
          '<p class="text-xs text-gray-400">আপলোড করলেই সাথে সাথে সব জায়গায় বসে যাবে — আলাদা করে সেইভ করা লাগবে না।</p>') +
        grp('<i class="fas fa-certificate text-amber-500 mr-2"></i>BSTI সার্টিফিকেট',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('bsti_enabled', 'ল্যান্ডিং পেজে দেখান (1 = হ্যাঁ / 0 = না)') + f('bsti_title', 'সেকশন টাইটেল') + '</div>' +
          field('বিবরণ', textarea('st-bsti_description', st.bsti_description, 2)) +
          assetUploader('bsti_certificate', 'BSTI সার্টিফিকেটের ছবি', st.bsti_certificate_image, 'সার্টিফিকেটের পরিষ্কার ছবি/স্ক্যান আপলোড করুন — ল্যান্ডিং পেজে দেখাবে')) +
        grp('<i class="fas fa-heading text-blue-500 mr-2"></i>হিরো ও অফার কনটেন্ট',
          f('hero_headline', 'হেডলাইন') +
          field('সাবহেডলাইন', textarea('st-hero_subheadline', st.hero_subheadline, 2)) +
          '<div class="grid md:grid-cols-2 gap-x-4">' + f('offer_title', 'অফার টাইটেল') + f('offer_description', 'অফার বিবরণ') + '</div>') +
        grp('<i class="fas fa-clock text-red-500 mr-2"></i>কাউন্টডাউন টাইমার',
          '<div class="grid md:grid-cols-3 gap-x-4">' +
          field('চালু (1) / বন্ধ (0)', inp('st-countdown_enabled', st.countdown_enabled)) +
          field('শেষ সময়', inp('st-countdown_end', st.countdown_end, '2026-09-30T23:59:59', 'datetime-local')) + '</div>' +
          f('countdown_fallback_text', 'শেষ হলে ফলব্যাক টেক্সট')) +
        grp('<i class="fas fa-truck text-cyan-600 mr-2"></i>ডেলিভারি',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('delivery_charge_dhaka', 'ঢাকার ভেতরে চার্জ', '', 'number') + f('delivery_charge_outside', 'ঢাকার বাইরে চার্জ', '', 'number') +
          f('free_delivery_enabled', 'ফ্রি ডেলিভারি (1/0)') + f('free_delivery_min', 'ফ্রি ডেলিভারির ন্যূনতম মূল্য', '', 'number') + '</div>') +
        grp('<i class="fas fa-dollar-sign text-purple-600 mr-2"></i>কারেন্সি ও ডিফল্ট খরচ',
          '<div class="grid md:grid-cols-3 gap-x-4">' +
          f('usd_to_bdt_rate', 'USD → BDT রেট', '120', 'number') +
          f('default_packaging_cost', 'ডিফল্ট প্যাকেজিং খরচ', '', 'number') +
          f('default_cod_fee_percent', 'ডিফল্ট COD ফি %', '', 'number') + '</div>') +
        grp('<i class="fas fa-shield-halved text-amber-600 mr-2"></i>ফ্রড প্রোটেকশন',
          '<div class="grid md:grid-cols-3 gap-x-4">' +
          f('otp_enabled', 'OTP ভেরিফিকেশন (1/0)') +
          f('duplicate_order_window_minutes', 'ডুপ্লিকেট উইন্ডো (মিনিট)', '', 'number') +
          f('max_orders_per_phone_per_day', 'দৈনিক সর্বোচ্চ অর্ডার/ফোন', '', 'number') + '</div>' +
          '<p class="text-xs text-gray-400">OTP-র জন্য SMS গেটওয়ে integration প্রয়োজন। SMS প্রোভাইডারের credential না দেওয়া পর্যন্ত OTP কোড শুধু নোটিফিকেশনে দেখা যাবে (ম্যানুয়াল ভেরিফিকেশন)।</p>') +
        grp('<i class="fab fa-facebook text-blue-600 mr-2"></i>Meta Pixel ও Conversions API',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('meta_pixel_id', 'Pixel ID') + f('meta_pixel_enabled', 'Pixel চালু (1/0)') +
          f('meta_capi_token', 'CAPI Access Token (গোপন — সার্ভারে থাকে)') + f('meta_capi_enabled', 'CAPI চালু (1/0)') + '</div>' +
          f('meta_events_enabled', 'সক্রিয় ইভেন্ট (কমা দিয়ে)', 'PageView,ViewContent,InitiateCheckout,Lead,Purchase') +
          '<p class="text-xs text-gray-400">Token কখনো ফ্রন্টএন্ডে exposed হয় না। Events Manager → Settings → Conversions API থেকে token নিন।</p>') +
        grp('<i class="fas fa-chart-simple text-orange-500 mr-2"></i>অন্যান্য ট্র্যাকিং',
          '<div class="grid md:grid-cols-3 gap-x-4">' +
          f('ga_id', 'Google Analytics ID', 'G-XXXX') + f('gtm_id', 'GTM ID', 'GTM-XXXX') + f('tiktok_pixel_id', 'TikTok Pixel ID') + '</div>') +
        grp('<i class="fas fa-magnifying-glass text-gray-600 mr-2"></i>SEO ও শেয়ার',
          f('seo_title', 'SEO টাইটেল') +
          field('SEO বিবরণ', textarea('st-seo_description', st.seo_description, 2)) +
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('seo_keywords', 'Keywords') + f('og_image', 'OG ইমেজ URL') + f('canonical_url', 'Canonical URL') + f('robots', 'Robots', 'index, follow') +
          f('fb_share_title', 'FB শেয়ার টাইটেল') + f('fb_share_description', 'FB শেয়ার বিবরণ') + '</div>') +
        '<div class="sticky bottom-4"><button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg"><i class="fas fa-floppy-disk mr-2"></i>সব সেটিংস সংরক্ষণ করুন</button></div>' +
        '</form>' +
        '<div class="mt-6 bg-red-50 border border-red-100 rounded-2xl p-5">' +
          '<h3 class="font-bold text-red-700 mb-2"><i class="fas fa-triangle-exclamation mr-2"></i>ডেঞ্জার জোন</h3>' +
          '<p class="text-sm text-red-600 mb-3">প্রোডাকশনে যাওয়ার আগে সব ডেমো/টেস্ট অর্ডার, কাস্টমার ও লেনদেন ডেটা মুছে ফেলুন। প্রোডাক্ট, সেটিংস ও অ্যাডমিন ইউজার অক্ষত থাকবে।</p>' +
          '<button onclick="AV.clearDemo()" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">ডেমো ডেটা মুছে ফেলুন</button>' +
        '</div>',
        'সেটিংস');
    }).catch(apiErr);
  }
  // ---------- Asset uploader (logo / favicon / BSTI certificate) ----------
  function assetUploader(key, label, currentUrl, hint) {
    return '<div class="mb-3">' +
      '<label class="block text-sm font-semibold text-gray-700 mb-1.5">' + label + '</label>' +
      '<div class="flex items-center gap-3">' +
        '<div id="asset-prev-' + key + '" class="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">' +
          (currentUrl ? '<img src="' + esc(currentUrl) + '" class="w-full h-full object-contain">' : '<i class="fas fa-image text-gray-300 text-xl"></i>') +
        '</div>' +
        '<div class="flex-1">' +
          '<input type="file" id="asset-file-' + key + '" accept="image/*" class="hidden" onchange="AV.uploadAsset(\'' + key + '\')">' +
          '<div class="flex gap-2">' +
            '<button type="button" onclick="document.getElementById(\'asset-file-' + key + '\').click()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"><i class="fas fa-upload mr-1.5"></i>আপলোড</button>' +
            (currentUrl ? '<button type="button" onclick="AV.removeAsset(\'' + key + '\')" class="bg-gray-100 hover:bg-red-50 text-red-600 text-sm font-semibold px-3 py-2 rounded-lg"><i class="fas fa-trash"></i></button>' : '') +
          '</div>' +
          (hint ? '<p class="text-xs text-gray-400 mt-1">' + hint + '</p>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }
  AV.uploadAsset = function (key) {
    var input = document.getElementById('asset-file-' + key);
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('শুধু ইমেজ ফাইল দিন', 'error'); return; }
    var maxDim = key === 'favicon' ? 128 : (key === 'brand_logo' ? 512 : 1400);
    var img = new Image();
    var fr = new FileReader();
    fr.onload = function () { img.src = fr.result; };
    img.onload = function () {
      // Resize client-side to keep D1 rows small
      var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var isPhoto = key === 'bsti_certificate';
      var mime = isPhoto ? 'image/jpeg' : 'image/png';
      var dataUrl = cv.toDataURL(mime, isPhoto ? 0.85 : undefined);
      var b64 = dataUrl.split(',')[1];
      toast('আপলোড হচ্ছে...');
      axios.post('/api/admin/assets/' + key, { data: b64, mime: mime }).then(function (r) {
        toast('আপলোড সফল! সব জায়গায় বসে গেছে ✅');
        var prev = document.getElementById('asset-prev-' + key);
        if (prev) prev.innerHTML = '<img src="' + r.data.url + '" class="w-full h-full object-contain">';
      }).catch(apiErr);
    };
    fr.readAsDataURL(file);
  };
  AV.removeAsset = function (key) {
    confirmDlg('এই ইমেজটি মুছে ফেলবেন?', function () {
      axios.delete('/api/admin/assets/' + key).then(function () { toast('মুছে ফেলা হয়েছে'); viewSettings(); }).catch(apiErr);
    });
  };

  AV.saveSettings = function (ev) {
    ev.preventDefault();
    var payload = {};
    document.querySelectorAll('[id^="st-"]').forEach(function (el) { payload[el.id.slice(3)] = el.value; });
    axios.put('/api/admin/settings', payload).then(function () { toast('সেটিংস সংরক্ষিত হয়েছে'); }).catch(apiErr);
  };
  AV.clearDemo = function () {
    confirmDlg('সব অর্ডার, কাস্টমার, খরচ ও ট্র্যাকিং ডেটা স্থায়ীভাবে মুছে যাবে। নিশ্চিত?', function () {
      axios.post('/api/admin/clear-demo-data').then(function (r) { toast(r.data.message); }).catch(apiErr);
    });
  };

  // ============ USERS ============
  function viewUsers() {
    Promise.all([
      axios.get('/api/admin/users').catch(function () { return { data: { users: [], roles: [] } }; }),
      axios.get('/api/admin/audit-logs').catch(function () { return { data: { logs: [] } }; }),
      axios.get('/api/admin/login-history').catch(function () { return { data: { history: [] } }; })
    ]).then(function (rs) {
      var users = rs[0].data.users, roles = rs[0].data.roles || [], logs = rs[1].data.logs, hist = rs[2].data.history;
      S._roles = roles;
      var userRows = users.map(function (u) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5"><div class="font-semibold">' + esc(u.full_name) + '</div><div class="text-xs text-gray-400">@' + esc(u.username) + '</div></td>' +
          '<td class="px-3 py-2.5"><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">' + esc(u.role) + '</span></td>' +
          '<td class="px-3 py-2.5">' + (u.is_active ? '<span class="text-emerald-600 text-xs font-bold">Active</span>' : '<span class="text-red-500 text-xs font-bold">Inactive</span>') + '</td>' +
          '<td class="px-3 py-2.5 text-xs text-gray-400">' + fmtDT(u.last_login_at) + '</td>' +
          '<td class="px-3 py-2.5"><button onclick="AV.editUser(' + u.id + ')" class="text-emerald-600"><i class="fas fa-pen"></i></button></td></tr>';
      }).join('');
      var logRows = logs.slice(0, 50).map(function (l) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2 text-xs">' + fmtDT(l.created_at) + '</td>' +
          '<td class="px-3 py-2 text-xs font-semibold">' + esc(l.username) + '</td>' +
          '<td class="px-3 py-2 text-xs"><span class="bg-gray-100 px-1.5 py-0.5 rounded">' + esc(l.action) + '</span> ' + esc(l.entity_type) + ' ' + esc(l.entity_id || '') + '</td>' +
          '<td class="px-3 py-2 text-xs text-gray-500 max-w-[280px] truncate">' + esc(l.details || '') + '</td></tr>';
      }).join('');
      var histRows = hist.slice(0, 30).map(function (l) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2 text-xs">' + fmtDT(l.created_at) + '</td>' +
          '<td class="px-3 py-2 text-xs font-semibold">' + esc(l.username) + '</td>' +
          '<td class="px-3 py-2 text-xs">' + (l.success ? '<span class="text-emerald-600 font-bold">সফল</span>' : '<span class="text-red-500 font-bold">ব্যর্থ</span>') + '</td>' +
          '<td class="px-3 py-2 text-xs text-gray-400">' + esc(l.ip_address || '') + '</td></tr>';
      }).join('');
      setContent(
        sectionCard('<i class="fas fa-user-shield text-indigo-600 mr-2"></i>অ্যাডমিন ইউজার', tbl(['ইউজার', 'রোল', 'স্ট্যাটাস', 'শেষ লগইন', ''], userRows),
          roles.length ? '<button onclick="AV.editUser(0)" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"><i class="fas fa-plus mr-1"></i>নতুন ইউজার</button>' : '') +
        sectionCard('<i class="fas fa-clock-rotate-left text-gray-600 mr-2"></i>অডিট লগ (Activity Log)', tbl(['সময়', 'ইউজার', 'অ্যাকশন', 'বিস্তারিত'], logRows)) +
        sectionCard('<i class="fas fa-key text-amber-600 mr-2"></i>লগইন হিস্ট্রি', tbl(['সময়', 'ইউজার', 'ফলাফল', 'IP'], histRows)),
        'ইউজার ও সিকিউরিটি');
      S._users = users;
    }).catch(apiErr);
  }
  AV.editUser = function (id) {
    var u = (S._users || []).find(function (x) { return x.id === id; }) || {};
    var roles = S._roles || ['super_admin', 'admin', 'order_manager', 'marketing_manager', 'account_manager', 'viewer'];
    modal(id ? 'ইউজার এডিট' : 'নতুন অ্যাডমিন ইউজার',
      (id ? '' : field('ইউজারনেম *', inp('us-username'))) +
      field('পূর্ণ নাম *', inp('us-name', u.full_name)) +
      field('ইমেইল', inp('us-email', u.email)) +
      field('রোল', '<select id="us-role" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' + roles.map(function (r) { return '<option ' + (u.role === r ? 'selected' : '') + '>' + r + '</option>'; }).join('') + '</select>') +
      field(id ? 'নতুন পাসওয়ার্ড (খালি রাখলে অপরিবর্তিত)' : 'পাসওয়ার্ড * (কমপক্ষে ৬ অক্ষর)', inp('us-pass', '', '', 'password')) +
      (id ? checkbox('us-active', u.is_active !== 0, 'Active') : ''),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveUser(' + (id || 0) + ')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveUser = function (id) {
    if (id) {
      var payload = { full_name: v('us-name'), email: v('us-email'), role: v('us-role'), is_active: chk('us-active') };
      if (v('us-pass')) payload.password = v('us-pass');
      axios.put('/api/admin/users/' + id, payload).then(function () { closeModal(); toast('ইউজার আপডেট হয়েছে'); viewUsers(); }).catch(apiErr);
    } else {
      axios.post('/api/admin/users', { username: v('us-username'), full_name: v('us-name'), email: v('us-email'), role: v('us-role'), password: v('us-pass') })
        .then(function () { closeModal(); toast('ইউজার তৈরি হয়েছে'); viewUsers(); }).catch(apiErr);
    }
  };

  // ============ INCOMPLETE ORDERS ============
  var incStatus = '', incQ = '', incPage = 1;
  var INC_STATUS_BN = { incomplete: 'ইনকমপ্লিট', contacted: 'যোগাযোগ হয়েছে', converted: 'কনভার্টেড', discarded: 'বাতিল' };
  var INC_STATUS_COLOR = { incomplete: 'bg-amber-100 text-amber-700', contacted: 'bg-blue-100 text-blue-700', converted: 'bg-emerald-100 text-emerald-700', discarded: 'bg-gray-100 text-gray-500' };
  function viewIncomplete() {
    axios.get('/api/admin/incomplete-orders?status=' + encodeURIComponent(incStatus) + '&q=' + encodeURIComponent(incQ) + '&page=' + incPage)
    .then(function (r) {
      var d = r.data, sc = d.status_counts || {};
      var totalAll = (sc.incomplete || 0) + (sc.contacted || 0) + (sc.converted || 0) + (sc.discarded || 0);
      var tabs = [['', 'সব (' + totalAll + ')'], ['incomplete', 'ইনকমপ্লিট (' + (sc.incomplete || 0) + ')'], ['contacted', 'যোগাযোগ হয়েছে (' + (sc.contacted || 0) + ')'], ['converted', 'কনভার্টেড (' + (sc.converted || 0) + ')'], ['discarded', 'বাতিল (' + (sc.discarded || 0) + ')']];
      var tabHtml = '<div class="flex flex-wrap gap-2 mb-4">' + tabs.map(function (t) {
        return '<button onclick="AV.incTab(\'' + t[0] + '\')" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition ' + (incStatus === t[0] ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50') + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      var rows = (d.incomplete_orders || []).map(function (o) {
        var fields = [];
        if (o.address) fields.push('ঠিকানা');
        if (o.district) fields.push(o.district);
        var utm = [o.utm_source, o.utm_campaign].filter(Boolean).join(' / ');
        return '<tr class="border-b border-gray-50 hover:bg-amber-50/40">' +
          '<td class="px-3 py-2.5"><div class="font-semibold">' + (esc(o.customer_name) || '<span class="text-gray-400">নাম নেই</span>') + '</div>' +
            '<div class="text-xs text-gray-500">' + esc(o.phone || '—') + (o.alt_phone ? ' / ' + esc(o.alt_phone) : '') + '</div></td>' +
          '<td class="px-3 py-2.5"><div class="text-xs">' + esc(o.product_name || '—') + (o.package_name ? '<div class="text-gray-400">' + esc(o.package_name) + '</div>' : '') + '</div></td>' +
          '<td class="px-3 py-2.5 font-semibold">' + (o.grand_total ? money(o.grand_total) : '—') + '</td>' +
          '<td class="px-3 py-2.5"><div class="text-xs">' + esc(fields.join(', ') || '—') + '</div>' + (utm ? '<div class="text-[10px] text-purple-500">' + esc(utm) + '</div>' : '') + '</td>' +
          '<td class="px-3 py-2.5"><div class="flex items-center gap-1"><span class="text-xs font-bold px-2 py-0.5 rounded-full ' + (INC_STATUS_COLOR[o.status] || '') + '">' + (INC_STATUS_BN[o.status] || o.status) + '</span>' +
            '<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full">' + (o.field_count || 0) + '/৭</span></div>' +
            (o.order_id ? '<a href="#/orders/' + o.order_id + '" class="text-[10px] text-emerald-600 font-semibold">অর্ডার দেখুন →</a>' : '') + '</td>' +
          '<td class="px-3 py-2.5 text-xs text-gray-400">' + fmtDT(o.updated_at) + '</td>' +
          '<td class="px-3 py-2.5"><div class="flex gap-1">' +
            (o.phone ? '<a href="tel:' + esc(o.phone) + '" class="text-blue-500 p-1.5" title="কল করুন"><i class="fas fa-phone"></i></a>' : '') +
            '<button onclick="AV.incDetail(' + o.id + ')" class="text-gray-500 p-1.5" title="বিস্তারিত"><i class="fas fa-eye"></i></button>' +
            (o.status !== 'converted' ? '<button onclick="AV.incConvert(' + o.id + ')" class="text-emerald-600 p-1.5" title="অর্ডারে কনভার্ট"><i class="fas fa-cart-plus"></i></button>' : '') +
            '<button onclick="AV.incDelete(' + o.id + ')" class="text-red-400 p-1.5" title="ডিলিট"><i class="fas fa-trash-can"></i></button>' +
          '</div></td></tr>';
      }).join('');
      setContent(
        '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-800"><i class="fas fa-lightbulb mr-1.5"></i><b>ইনকমপ্লিট অর্ডার:</b> কাস্টমার অর্ডার ফর্মে নাম/ফোন লিখলেই এখানে অটো-সেভ হয় — সাবমিট না করলেও। ফোন করে কনফার্ম করে <b>কনভার্ট</b> বাটনে ক্লিক করলেই অর্ডারে রূপান্তরিত হবে। কোনো অর্ডার আর মিস হবে না!</div>' +
        tabHtml +
        '<div class="mb-4"><input type="text" value="' + esc(incQ) + '" placeholder="নাম / ফোন / জেলা দিয়ে খুঁজুন..." class="w-full sm:w-80 border border-gray-300 rounded-lg px-4 py-2.5 text-sm" onkeydown="if(event.key===\'Enter\'){AV.incSearch(this.value)}"></div>' +
        '<div class="bg-white rounded-2xl shadow-sm">' + tbl(['কাস্টমার', 'প্রোডাক্ট', 'টাকা', 'তথ্য', 'স্ট্যাটাস', 'সর্বশেষ', ''], rows) + '</div>' +
        (d.total > d.limit ? '<div class="flex justify-center gap-2 mt-4">' +
          (incPage > 1 ? '<button onclick="AV.incPage(' + (incPage - 1) + ')" class="bg-white shadow-sm px-4 py-2 rounded-lg text-sm">← আগের</button>' : '') +
          '<span class="px-4 py-2 text-sm text-gray-500">পেজ ' + incPage + '</span>' +
          (incPage * d.limit < d.total ? '<button onclick="AV.incPage(' + (incPage + 1) + ')" class="bg-white shadow-sm px-4 py-2 rounded-lg text-sm">পরের →</button>' : '') + '</div>' : ''),
        'ইনকমপ্লিট অর্ডার');
      S._incomplete = d.incomplete_orders || [];
    }).catch(apiErr);
  }
  AV.incTab = function (st) { incStatus = st; incPage = 1; viewIncomplete(); };
  AV.incSearch = function (q) { incQ = q; incPage = 1; viewIncomplete(); };
  AV.incPage = function (p) { incPage = p; viewIncomplete(); };
  AV.incDetail = function (id) {
    var o = (S._incomplete || []).find(function (x) { return x.id === id; });
    if (!o) return;
    var row = function (l, val) { return '<div class="flex justify-between py-1.5 border-b border-gray-50 text-sm"><span class="text-gray-500">' + l + '</span><span class="font-semibold text-right max-w-[60%]">' + (val || '—') + '</span></div>'; };
    modal('ইনকমপ্লিট অর্ডার #' + o.id,
      row('নাম', esc(o.customer_name)) + row('ফোন', esc(o.phone)) + row('বিকল্প ফোন', esc(o.alt_phone)) +
      row('ঠিকানা', esc(o.address)) + row('জেলা', esc(o.district)) + row('উপজেলা', esc(o.upazila)) +
      row('নোট', esc(o.order_note)) + row('প্রোডাক্ট', esc(o.product_name)) + row('প্যাকেজ', esc(o.package_name)) +
      row('মোট', o.grand_total ? money(o.grand_total) : '') +
      row('UTM Source', esc(o.utm_source)) + row('Campaign', esc(o.utm_campaign)) + row('fbclid', o.fbclid ? '✓ আছে' : '') +
      row('IP', esc(o.ip_address)) + row('সর্বশেষ আপডেট', fmtDT(o.updated_at)) +
      field('অ্যাডমিন নোট', textarea('inc-note', o.admin_note, 2)) +
      field('স্ট্যাটাস', '<select id="inc-status" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">' +
        ['incomplete', 'contacted', 'discarded'].map(function (st) { return '<option value="' + st + '" ' + (o.status === st ? 'selected' : '') + '>' + INC_STATUS_BN[st] + '</option>'; }).join('') + '</select>'),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বন্ধ</button>' +
      '<button onclick="AV.incSave(' + id + ')" class="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>' +
      (o.status !== 'converted' ? '<button onclick="A.closeModal();AV.incConvert(' + id + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold"><i class="fas fa-cart-plus mr-1"></i>অর্ডারে কনভার্ট</button>' : ''));
  };
  AV.incSave = function (id) {
    axios.put('/api/admin/incomplete-orders/' + id, { status: v('inc-status'), admin_note: v('inc-note') })
      .then(function () { closeModal(); toast('সংরক্ষিত'); viewIncomplete(); }).catch(apiErr);
  };
  AV.incConvert = function (id) {
    confirmDlg('কাস্টমারের সাথে কথা হয়েছে? এটি একটি কনফার্মড অর্ডারে রূপান্তরিত হবে।', function () {
      axios.post('/api/admin/incomplete-orders/' + id + '/convert').then(function (r) {
        toast('✅ অর্ডার তৈরি হয়েছে: ' + r.data.order_number);
        viewIncomplete();
      }).catch(apiErr);
    });
  };
  AV.incDelete = function (id) {
    confirmDlg('এই ইনকমপ্লিট অর্ডারটি স্থায়ীভাবে ডিলিট হবে। নিশ্চিত?', function () {
      axios.delete('/api/admin/incomplete-orders/' + id).then(function () { viewIncomplete(); }).catch(apiErr);
    });
  };

  // ============ PIXEL SETUP (dedicated section) ============
  function viewPixel() {
    axios.get('/api/admin/pixel').then(function (r) {
      var d = r.data, st = d.settings, h = d.health, cs = d.capi_stats;
      var f = function (key, label, ph, type) { return field(label, inp('px-' + key, st[key], ph, type)); };
      var healthBadge = function (ok, okText, badText) {
        return ok ? '<span class="flex items-center gap-1.5 text-emerald-700 text-sm font-bold"><i class="fas fa-circle-check"></i>' + okText + '</span>'
                  : '<span class="flex items-center gap-1.5 text-red-500 text-sm font-bold"><i class="fas fa-circle-xmark"></i>' + badText + '</span>';
      };
      var evRows = (d.event_stats || []).map(function (x) {
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2.5 font-semibold">' + esc(x.event_name) + '</td>' +
          '<td class="px-3 py-2.5">' + x.cnt + '</td><td class="px-3 py-2.5">' + (x.capi_sent || 0) + '</td></tr>';
      }).join('');
      var logRows = (d.recent_events || []).map(function (e) {
        var capiState = e.sent_to_capi ? '<span class="text-emerald-600 text-xs font-bold">✓ CAPI</span>' :
          (e.capi_response ? '<span class="text-red-500 text-xs font-bold" title="' + esc(e.capi_response) + '">✗ ব্যর্থ</span>' : '<span class="text-gray-400 text-xs">—</span>');
        return '<tr class="border-b border-gray-50"><td class="px-3 py-2 text-xs">' + fmtDT(e.created_at) + '</td>' +
          '<td class="px-3 py-2 text-xs font-semibold">' + esc(e.event_name) + '</td>' +
          '<td class="px-3 py-2 text-xs text-gray-400 max-w-[140px] truncate">' + esc(e.event_id) + '</td>' +
          '<td class="px-3 py-2">' + capiState + '</td>' +
          '<td class="px-3 py-2 text-xs">' + (e.fbclid ? '<span class="text-purple-500">fb ad</span>' : '') + '</td></tr>';
      }).join('');
      setContent(
        // Health overview
        '<div class="bg-white rounded-2xl shadow-sm p-5 mb-5">' +
          '<h3 class="font-bold mb-4"><i class="fas fa-heart-pulse text-red-500 mr-2"></i>পিক্সেল হেলথ চেক</h3>' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">' +
            '<div class="bg-gray-50 rounded-xl p-3">' + healthBadge(h.pixel_configured, 'Pixel ID সেট আছে', 'Pixel ID নেই') + '</div>' +
            '<div class="bg-gray-50 rounded-xl p-3">' + healthBadge(h.pixel_enabled, 'Pixel চালু', 'Pixel বন্ধ') + '</div>' +
            '<div class="bg-gray-50 rounded-xl p-3">' + healthBadge(h.capi_configured, 'CAPI Token সেট আছে', 'CAPI Token নেই') + '</div>' +
            '<div class="bg-gray-50 rounded-xl p-3">' + healthBadge(h.capi_enabled, 'CAPI চালু', 'CAPI বন্ধ') + '</div>' +
          '</div>' +
          '<div class="grid grid-cols-3 gap-3 mt-4">' +
            card('মোট ইভেন্ট (৭ দিন)', cs.total, 'fa-chart-simple', 'bg-blue-100 text-blue-600') +
            card('CAPI পাঠানো', cs.sent, 'fa-paper-plane', 'bg-emerald-100 text-emerald-600') +
            card('CAPI ব্যর্থ', cs.failed, 'fa-triangle-exclamation', cs.failed > 0 ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400') +
          '</div>' +
        '</div>' +
        // Settings form
        '<form onsubmit="AV.savePixel(event)">' +
        sectionCard('<i class="fab fa-facebook text-blue-600 mr-2"></i>Meta Pixel (ব্রাউজার-সাইড)',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('meta_pixel_id', 'Pixel ID *', '1234567890') +
          f('meta_pixel_enabled', 'Pixel চালু (1) / বন্ধ (0)') + '</div>' +
          f('meta_events_enabled', 'সক্রিয় ইভেন্ট (কমা দিয়ে)', 'PageView,ViewContent,InitiateCheckout,Lead,Purchase') +
          '<p class="text-xs text-gray-400 mt-1"><i class="fas fa-circle-info mr-1"></i>Pixel ID পাবেন: Meta Events Manager → Data Sources → আপনার Pixel → Settings</p>') +
        sectionCard('<i class="fas fa-server text-indigo-600 mr-2"></i>Conversions API (সার্ভার-সাইড)',
          '<div class="grid md:grid-cols-2 gap-x-4">' +
          f('meta_capi_token', 'CAPI Access Token (গোপন)', 'EAAxxxx...') +
          f('meta_capi_enabled', 'CAPI চালু (1) / বন্ধ (0)') + '</div>' +
          f('meta_test_event_code', 'Test Event Code (ঐচ্ছিক)', 'TEST12345') +
          '<div class="bg-blue-50 rounded-xl p-3 mt-2 text-xs text-blue-800 space-y-1">' +
            '<div><i class="fas fa-shield-halved mr-1"></i><b>CAPI কেন জরুরি:</b> iOS 14+ / অ্যাড ব্লকারে ব্রাউজার পিক্সেল ব্লক হলেও সার্ভার থেকে ইভেন্ট Meta-তে পৌঁছাবে — কোনো Purchase ইভেন্ট মিস হবে না।</div>' +
            '<div><i class="fas fa-key mr-1"></i>Token নিন: Events Manager → Settings → Conversions API → Generate Access Token</div>' +
            '<div><i class="fas fa-flask mr-1"></i>Test Event Code দিলে টেস্ট ইভেন্টগুলো Events Manager → Test Events ট্যাবে লাইভ দেখা যাবে।</div>' +
            '<div><i class="fas fa-lock mr-1"></i>Token কখনো ফ্রন্টএন্ডে exposed হয় না — শুধু সার্ভারে থাকে।</div>' +
          '</div>') +
        sectionCard('<i class="fas fa-chart-simple text-orange-500 mr-2"></i>অন্যান্য ট্র্যাকিং (ঐচ্ছিক)',
          '<div class="grid md:grid-cols-3 gap-x-4">' +
          f('ga_id', 'Google Analytics ID', 'G-XXXX') + f('gtm_id', 'GTM ID', 'GTM-XXXX') + f('tiktok_pixel_id', 'TikTok Pixel ID') + '</div>') +
        '<div class="flex gap-3 mb-6">' +
          '<button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl"><i class="fas fa-floppy-disk mr-2"></i>পিক্সেল সেটিংস সংরক্ষণ</button>' +
          '<button type="button" onclick="AV.pixelTest()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-xl"><i class="fas fa-flask mr-2"></i>CAPI টেস্ট ইভেন্ট পাঠান</button>' +
        '</div>' +
        '</form>' +
        // Event stats + log
        '<div class="grid lg:grid-cols-2 gap-5">' +
          sectionCard('<i class="fas fa-chart-column text-emerald-600 mr-2"></i>ইভেন্ট পরিসংখ্যান (শেষ ৭ দিন)', tbl(['ইভেন্ট', 'সংখ্যা', 'CAPI পাঠানো'], evRows)) +
          sectionCard('<i class="fas fa-list text-gray-600 mr-2"></i>সাম্প্রতিক ইভেন্ট লগ', tbl(['সময়', 'ইভেন্ট', 'Event ID', 'CAPI', 'সোর্স'], logRows)) +
        '</div>' +
        // Setup guide
        sectionCard('<i class="fas fa-book text-amber-600 mr-2"></i>সম্পূর্ণ সেটাপ গাইড',
          '<ol class="list-decimal list-inside space-y-2 text-sm text-gray-700">' +
            '<li><b>Pixel তৈরি:</b> business.facebook.com → Events Manager → Connect Data Sources → Web → Pixel তৈরি করুন।</li>' +
            '<li><b>Pixel ID কপি</b> করে উপরের ঘরে বসান, "Pixel চালু" = 1 দিন।</li>' +
            '<li><b>CAPI Token:</b> Events Manager → আপনার Pixel → Settings → Conversions API → Generate Access Token → কপি করে বসান, "CAPI চালু" = 1 দিন।</li>' +
            '<li><b>টেস্ট:</b> Events Manager → Test Events ট্যাব খুলুন → Test Event Code কপি করে উপরে বসিয়ে সংরক্ষণ করুন → "CAPI টেস্ট ইভেন্ট পাঠান" ক্লিক করুন → Events Manager-এ ইভেন্ট দেখা গেলে সব ঠিক আছে। ✅</li>' +
            '<li><b>ভেরিফাই:</b> ল্যান্ডিং পেজে গিয়ে একটি টেস্ট অর্ডার দিন — PageView, ViewContent, InitiateCheckout, Lead, Purchase সব ইভেন্ট উপরের লগে ও Events Manager-এ দেখা যাবে।</li>' +
            '<li><b>ডুপ্লিকেশন চিন্তা নেই:</b> ব্রাউজার ও সার্ভার দুই দিক থেকে একই event_id পাঠানো হয়, Meta নিজেই ডিডুপ্লিকেট করে।</li>' +
          '</ol>'),
        'পিক্সেল সেটাপ');
    }).catch(apiErr);
  }
  AV.savePixel = function (ev) {
    ev.preventDefault();
    var payload = {};
    document.querySelectorAll('[id^="px-"]').forEach(function (el) { payload[el.id.slice(3)] = el.value; });
    axios.put('/api/admin/pixel', payload).then(function () { toast('পিক্সেল সেটিংস সংরক্ষিত হয়েছে'); viewPixel(); }).catch(apiErr);
  };
  AV.pixelTest = function () {
    toast('টেস্ট ইভেন্ট পাঠানো হচ্ছে...');
    axios.post('/api/admin/pixel/test-event').then(function (r) {
      if (r.data.success) {
        modal('<i class="fas fa-circle-check text-emerald-600 mr-2"></i>CAPI টেস্ট সফল!',
          '<p class="text-sm text-gray-700 mb-3">Meta সার্ভারে টেস্ট ইভেন্ট পৌঁছেছে। Events Manager → Test Events ট্যাবে দেখুন।</p>' +
          '<div class="bg-gray-50 rounded-xl p-3 text-xs font-mono break-all">' + esc(r.data.response) + '</div>',
          '<button onclick="A.closeModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">ঠিক আছে</button>');
      } else {
        modal('<i class="fas fa-circle-xmark text-red-500 mr-2"></i>CAPI টেস্ট ব্যর্থ',
          '<p class="text-sm text-gray-700 mb-3">Meta সার্ভার ইভেন্ট গ্রহণ করেনি। Token ও Pixel ID সঠিক কিনা দেখুন।</p>' +
          '<div class="bg-red-50 rounded-xl p-3 text-xs font-mono break-all text-red-700">' + esc(r.data.response || r.data.error) + '</div>',
          '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বন্ধ</button>');
      }
    }).catch(apiErr);
  };

  // ============ HERO BANNERS (in content view) ============
  function loadBanners(cb) {
    axios.get('/api/admin/banners').then(function (r) { S._banners = r.data.banners || []; cb(); }).catch(apiErr);
  }
  AV.editBanner = function (id) {
    var b = (S._banners || []).find(function (x) { return x.id === id; }) || {};
    modal(id ? 'ব্যানার এডিট' : 'নতুন ব্যানার',
      field('ছবির URL *', inp('bnr-img', b.image_url, 'https://...jpg')) +
      '<div id="bnr-preview" class="mb-3">' + (b.image_url ? '<img src="' + esc(b.image_url) + '" class="rounded-xl w-full max-h-40 object-cover">' : '') + '</div>' +
      field('টাইটেল (ঐচ্ছিক)', inp('bnr-title', b.title)) +
      field('সাবটাইটেল (ঐচ্ছিক)', inp('bnr-sub', b.subtitle)) +
      field('লিংক URL (ঐচ্ছিক — ক্লিক করলে যাবে)', inp('bnr-link', b.link_url)) +
      field('Sort (ছোট আগে দেখাবে)', inp('bnr-sort', b.sort_order || 0, '', 'number')) +
      checkbox('bnr-active', b.is_active !== 0, 'সক্রিয় (ল্যান্ডিং পেজে দেখাবে)') +
      '<p class="text-xs text-gray-400 mt-2"><i class="fas fa-circle-info mr-1"></i>একাধিক সক্রিয় ব্যানার থাকলে হিরো সেকশনে অটো-স্লাইড হবে। রেকমেন্ডেড সাইজ: 800×600 (4:3)।</p>',
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveBanner(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveBanner = function (id) {
    var payload = { image_url: v('bnr-img'), title: v('bnr-title'), subtitle: v('bnr-sub'), link_url: v('bnr-link'), sort_order: Number(v('bnr-sort') || 0), is_active: chk('bnr-active') };
    if (!payload.image_url) { toast('ছবির URL দিন'); return; }
    (id ? axios.put('/api/admin/banners/' + id, payload) : axios.post('/api/admin/banners', payload))
      .then(function () { closeModal(); toast('ব্যানার সংরক্ষিত'); viewContent(); }).catch(apiErr);
  };
  AV.deleteBanner = function (id) {
    confirmDlg('ব্যানারটি ডিলিট করবেন?', function () {
      axios.delete('/api/admin/banners/' + id).then(function () { toast('ডিলিট হয়েছে'); viewContent(); }).catch(apiErr);
    });
  };
  function bannerSectionHtml() {
    var rows = (S._banners || []).map(function (b) {
      return '<div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<img src="' + esc(b.image_url) + '" class="w-16 h-12 rounded-lg object-cover shrink-0" onerror="this.style.display=\'none\'">' +
          '<div class="min-w-0"><div class="font-semibold text-sm truncate">' + (esc(b.title) || '<span class="text-gray-400">টাইটেল নেই</span>') + (b.is_active ? '' : ' <span class="text-xs text-gray-400">(নিষ্ক্রিয়)</span>') + '</div>' +
          '<div class="text-xs text-gray-400">#' + b.sort_order + (b.link_url ? ' · <i class="fas fa-link"></i>' : '') + '</div></div></div>' +
        '<div class="flex gap-1 shrink-0"><button onclick="AV.editBanner(' + b.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button><button onclick="AV.deleteBanner(' + b.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>';
    }).join('') || '<div class="text-gray-400 text-sm">কোনো ব্যানার নেই — ব্যানার না থাকলে প্রোডাক্টের ছবি দেখাবে</div>';
    return sectionCard('<i class="fas fa-images text-pink-500 mr-2"></i>হিরো ব্যানার স্লাইডার',
      '<p class="text-xs text-gray-500 mb-3">ল্যান্ডিং পেজের প্রথম সেকশনে (প্রোডাক্ট ফটোর জায়গায়) এই ব্যানারগুলো অটো-স্লাইড হবে।</p>' + rows,
      '<button onclick="AV.editBanner(0)" class="bg-pink-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fas fa-plus mr-1"></i>ব্যানার যোগ</button>');
  }

  // ============ register all views ============
  H.registerViews({
    dashboard: C.dashboard, orders: C.orders, orderDetail: C.orderDetail,
    products: C2.products, customers: C2.customers, customerDetail: C2.customerDetail, couriers: C2.couriers,
    marketing: viewMarketing, finance: viewFinance, analytics: viewAnalytics,
    content: viewContent, settings: viewSettings, users: viewUsers,
    incomplete: viewIncomplete, pixel: viewPixel
  });
})();
