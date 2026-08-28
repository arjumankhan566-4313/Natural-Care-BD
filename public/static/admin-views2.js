// ============ Admin Panel Views (part 3): products, customers, couriers, marketing, finance, analytics, content, settings, users ============
(function () {
  'use strict';
  var H = window.__ADMIN__, C = window.__ADMIN_VIEWS_CORE__;
  var S = H.S, esc = H.esc, money = H.money, fmtDT = H.fmtDT, toast = H.toast, apiErr = H.apiErr,
      confirmDlg = H.confirmDlg, modal = H.modal, closeModal = H.closeModal, field = H.field,
      inp = H.inp, v = H.v, chk = H.chk, statusBadge = H.statusBadge, riskBadge = H.riskBadge,
      setContent = H.setContent, card = C.card, rangeSelector = C.rangeSelector, destroyCharts = C.destroyCharts;
  var AV = window.AV;

  function textarea(id, val, rows) { return '<textarea id="' + id + '" rows="' + (rows || 3) + '" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm">' + esc(val || '') + '</textarea>'; }
  function checkbox(id, checked, label) { return '<label class="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' class="w-4 h-4 accent-emerald-600">' + label + '</label>'; }
  function sectionCard(title, body, action) {
    return '<div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-5"><div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-bold">' + title + '</h3>' + (action || '') + '</div><div class="p-5">' + body + '</div></div>';
  }

  // ============ PRODUCTS ============
  function viewProducts() {
    axios.get('/api/admin/products').then(function (r) {
      var rows = r.data.products.map(function (p) {
        return '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
          '<td class="px-4 py-3"><div class="flex items-center gap-3">' + (p.main_image ? '<img src="' + esc(p.main_image) + '" class="w-10 h-10 rounded-lg object-cover">' : '<div class="w-10 h-10 rounded-lg bg-gray-100"></div>') +
          '<div><div class="font-semibold">' + esc(p.name) + '</div><div class="text-xs text-gray-400">' + p.package_count + ' প্যাকেজ | ' + p.order_count + ' অর্ডার</div></div></div></td>' +
          '<td class="px-3 py-3"><span class="font-semibold">' + money(p.sale_price) + '</span> <span class="text-xs text-gray-400 line-through">' + money(p.regular_price) + '</span><div class="text-xs text-gray-400">খরচ: ' + money(p.product_cost) + '</div></td>' +
          '<td class="px-3 py-3"><span class="font-semibold">' + p.stock + '</span> ' + (p.stock_status === 'out_of_stock' ? '<span class="text-xs text-red-600 font-bold">স্টক নেই</span>' : p.stock_status === 'low_stock' ? '<span class="text-xs text-amber-600 font-bold">কম স্টক</span>' : '<span class="text-xs text-emerald-600">✓</span>') + '</td>' +
          '<td class="px-3 py-3">' + (p.is_active ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Active</span>' : '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">Inactive</span>') + '</td>' +
          '<td class="px-3 py-3 text-right whitespace-nowrap">' +
            '<button onclick="AV.editProduct(' + p.id + ')" class="text-emerald-600 px-2"><i class="fas fa-pen"></i></button>' +
            '<button onclick="AV.managePackages(' + p.id + ')" class="text-blue-600 px-2" title="প্যাকেজ"><i class="fas fa-boxes-stacked"></i></button>' +
            '<button onclick="AV.deleteProduct(' + p.id + ')" class="text-red-500 px-2"><i class="fas fa-trash-can"></i></button></td></tr>';
      }).join('');
      setContent(
        '<div class="flex justify-between items-center mb-5"><div></div><button onclick="AV.editProduct(0)" class="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold"><i class="fas fa-plus mr-1.5"></i>নতুন প্রোডাক্ট</button></div>' +
        '<div class="bg-white rounded-2xl shadow-sm overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100"><th class="px-4 py-3">প্রোডাক্ট</th><th class="px-3 py-3">মূল্য</th><th class="px-3 py-3">স্টক</th><th class="px-3 py-3">স্ট্যাটাস</th><th class="px-3 py-3"></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5" class="text-center text-gray-400 py-10">কোনো প্রোডাক্ট নেই</td></tr>') + '</tbody></table></div>' +
        '<div class="mt-4 text-right"><a href="/api/admin/export/products" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700"><i class="fas fa-download mr-1.5"></i>CSV এক্সপোর্ট</a></div>',
        'প্রোডাক্ট');
    }).catch(apiErr);
  }

  AV.editProduct = function (id) {
    var render = function (p, pkgs) {
      p = p || {};
      modal(id ? 'প্রোডাক্ট এডিট' : 'নতুন প্রোডাক্ট',
        field('নাম *', inp('p-name', p.name)) +
        field('সাবটাইটেল', inp('p-subtitle', p.subtitle)) +
        field('বিবরণ', textarea('p-desc', p.description, 4)) +
        '<div class="grid grid-cols-2 gap-3">' +
          field('রেগুলার মূল্য', inp('p-regular', p.regular_price, '', 'number')) +
          field('সেল মূল্য *', inp('p-sale', p.sale_price, '', 'number')) +
          field('প্রোডাক্ট খরচ (per unit)', inp('p-cost', p.product_cost, '', 'number')) +
          field('স্টক', inp('p-stock', p.stock != null ? p.stock : 0, '', 'number')) +
          field('Low stock সীমা', inp('p-lowstock', p.low_stock_threshold != null ? p.low_stock_threshold : 10, '', 'number')) +
          field('Sort order', inp('p-sort', p.sort_order || 0, '', 'number')) +
        '</div>' +
        field('মূল ছবি (URL)', inp('p-image', p.main_image, 'https://...')) +
        field('গ্যালারি ছবি (প্রতি লাইনে একটি URL)', textarea('p-gallery', (p.gallery_images ? JSON.parse(p.gallery_images || '[]') : []).join('\n'), 3)) +
        field('ভিডিও URL (YouTube embed)', inp('p-video', p.video_url, 'https://www.youtube.com/embed/...')) +
        field('ফিচার (প্রতি লাইনে একটি)', textarea('p-features', (p.features ? JSON.parse(p.features || '[]') : []).join('\n'), 3)) +
        field('উপকারিতা (প্রতি লাইনে একটি)', textarea('p-benefits', (p.benefits ? JSON.parse(p.benefits || '[]') : []).join('\n'), 3)) +
        field('উপাদানসমূহ', textarea('p-ingredients', p.ingredients, 2)) +
        field('ব্যবহারবিধি', textarea('p-usage', p.usage_instructions, 2)) +
        field('প্যাকেজ বিবরণ', inp('p-pkgdetails', p.package_details)) +
        '<div class="flex gap-5">' + checkbox('p-active', p.is_active !== 0, 'Active') + checkbox('p-featured', !!p.is_featured, 'Featured') + '</div>',
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
        '<button onclick="AV.saveProduct(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
    };
    if (id) axios.get('/api/admin/products/' + id).then(function (r) { render(r.data.product, r.data.packages); }).catch(apiErr);
    else render(null, []);
  };

  AV.saveProduct = function (id) {
    var lines = function (x) { return v(x).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    var payload = {
      name: v('p-name'), subtitle: v('p-subtitle'), description: v('p-desc'),
      regular_price: Number(v('p-regular') || 0), sale_price: Number(v('p-sale') || 0), product_cost: Number(v('p-cost') || 0),
      stock: Number(v('p-stock') || 0), low_stock_threshold: Number(v('p-lowstock') || 10), sort_order: Number(v('p-sort') || 0),
      main_image: v('p-image'), gallery_images: lines('p-gallery'), video_url: v('p-video'),
      features: lines('p-features'), benefits: lines('p-benefits'),
      ingredients: v('p-ingredients'), usage_instructions: v('p-usage'), package_details: v('p-pkgdetails'),
      is_active: chk('p-active'), is_featured: chk('p-featured')
    };
    var req = id ? axios.put('/api/admin/products/' + id, payload) : axios.post('/api/admin/products', payload);
    req.then(function () { closeModal(); toast('প্রোডাক্ট সংরক্ষিত হয়েছে'); viewProducts(); }).catch(apiErr);
  };

  AV.deleteProduct = function (id) {
    confirmDlg('প্রোডাক্টটি ডিলিট করবেন?', function () {
      axios.delete('/api/admin/products/' + id).then(function () { toast('ডিলিট হয়েছে'); viewProducts(); }).catch(apiErr);
    });
  };

  AV.managePackages = function (productId) {
    axios.get('/api/admin/products/' + productId).then(function (r) {
      var pkgs = r.data.packages;
      var rows = pkgs.map(function (pk) {
        return '<div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2 text-sm">' +
          '<div><span class="font-semibold">' + esc(pk.name) + '</span> — ' + pk.quantity + ' পিস, ' + money(pk.price) +
          (pk.free_delivery ? ' <span class="text-xs text-emerald-600 font-bold">ফ্রি ডেলিভারি</span>' : '') +
          (pk.badge ? ' <span class="text-xs bg-amber-100 text-amber-700 px-1.5 rounded">' + esc(pk.badge) + '</span>' : '') + '</div>' +
          '<button onclick="AV.deletePackage(' + pk.id + ',' + productId + ')" class="text-red-500"><i class="fas fa-trash-can"></i></button></div>';
      }).join('') || '<div class="text-gray-400 text-sm text-center py-2">কোনো প্যাকেজ নেই</div>';
      modal('প্যাকেজ ম্যানেজমেন্ট — ' + esc(r.data.product.name),
        rows + '<hr class="my-4">' +
        '<h4 class="font-bold text-sm mb-3">নতুন প্যাকেজ যোগ করুন</h4>' +
        '<div class="grid grid-cols-2 gap-3">' +
          field('নাম *', inp('pk-name', '', 'যেমন: ২টি প্যাকেজ')) +
          field('পরিমাণ (পিস)', inp('pk-qty', 1, '', 'number')) +
          field('মূল্য (মোট) *', inp('pk-price', '', '', 'number')) +
          field('রেগুলার মূল্য', inp('pk-regular', '', '', 'number')) +
          field('ব্যাজ', inp('pk-badge', '', 'যেমন: সবচেয়ে জনপ্রিয়')) +
          field('Sort', inp('pk-sort', pkgs.length + 1, '', 'number')) +
        '</div>' + checkbox('pk-freedel', false, 'ফ্রি ডেলিভারি'),
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বন্ধ</button>' +
        '<button onclick="AV.addPackage(' + productId + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">প্যাকেজ যোগ করুন</button>');
    }).catch(apiErr);
  };
  AV.addPackage = function (productId) {
    axios.post('/api/admin/products/' + productId + '/packages', {
      name: v('pk-name'), quantity: Number(v('pk-qty') || 1), price: Number(v('pk-price')),
      regular_price: Number(v('pk-regular') || 0), badge: v('pk-badge'), free_delivery: chk('pk-freedel'), sort_order: Number(v('pk-sort') || 0)
    }).then(function () { toast('প্যাকেজ যোগ হয়েছে'); AV.managePackages(productId); }).catch(apiErr);
  };
  AV.deletePackage = function (pkgId, productId) {
    axios.delete('/api/admin/products/packages/' + pkgId).then(function () { AV.managePackages(productId); }).catch(apiErr);
  };

  // ============ CUSTOMERS ============
  var cFilter = { list: '', search: '', page: 1 };
  function viewCustomers() {
    axios.get('/api/admin/customers', { params: cFilter }).then(function (r) {
      var tabs = [['', 'সব'], ['repeat', 'রিপিট কাস্টমার'], ['blacklist', 'ব্ল্যাকলিস্ট'], ['whitelist', 'হোয়াইটলিস্ট']];
      var rows = r.data.customers.map(function (cu) {
        return '<tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.hash=\'#/customers/' + esc(cu.phone) + '\'">' +
          '<td class="px-4 py-3"><div class="font-semibold">' + esc(cu.name) + '</div><div class="text-xs text-blue-600">' + esc(cu.phone) + '</div></td>' +
          '<td class="px-3 py-3 text-xs text-gray-500 max-w-[160px] truncate">' + esc(cu.district || '') + '</td>' +
          '<td class="px-3 py-3 text-center"><span class="font-bold">' + cu.total_orders + '</span><div class="text-[10px] text-gray-400">D:' + cu.delivered_orders + ' C:' + cu.cancelled_orders + ' R:' + cu.returned_orders + '</div></td>' +
          '<td class="px-3 py-3 font-semibold">' + money(cu.total_spent) + '</td>' +
          '<td class="px-3 py-3">' + (cu.list_status === 'blacklist' ? '<span class="text-xs bg-gray-800 text-white px-2 py-0.5 rounded-full font-bold">Blacklist</span>' : cu.list_status === 'whitelist' ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Whitelist</span>' : '<span class="text-xs text-gray-400">—</span>') + '</td>' +
          '<td class="px-3 py-3 text-xs text-gray-400">' + fmtDT(cu.last_order_at) + '</td></tr>';
      }).join('');
      setContent(
        '<div class="flex gap-2 overflow-x-auto pb-2 mb-4">' + tabs.map(function (t) {
          return '<button onclick="AV.cList(\'' + t[0] + '\')" class="px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap ' + (cFilter.list === t[0] ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 shadow-sm') + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="bg-white rounded-2xl p-4 shadow-sm mb-4 flex gap-3">' +
          '<input id="cf-search" value="' + esc(cFilter.search) + '" placeholder="🔍 নাম / ফোন / ঠিকানা" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" onkeydown="if(event.key===\'Enter\')AV.cSearch()">' +
          '<button onclick="AV.cSearch()" class="bg-emerald-600 text-white px-4 rounded-lg text-sm font-semibold">খুঁজুন</button></div>' +
        '<div class="bg-white rounded-2xl shadow-sm overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100"><th class="px-4 py-3">কাস্টমার</th><th class="px-3 py-3">জেলা</th><th class="px-3 py-3 text-center">অর্ডার</th><th class="px-3 py-3">মোট কেনা</th><th class="px-3 py-3">লিস্ট</th><th class="px-3 py-3">শেষ অর্ডার</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="text-center text-gray-400 py-10">কোনো কাস্টমার নেই</td></tr>') + '</tbody></table>' +
        '<div class="px-5 py-3 flex justify-between items-center border-t border-gray-100"><div class="text-xs text-gray-500">মোট ' + r.data.total + '</div><div class="flex gap-2">' +
        (r.data.page > 1 ? '<button onclick="AV.cPage(' + (r.data.page - 1) + ')" class="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold">←</button>' : '') +
        (r.data.page * r.data.limit < r.data.total ? '<button onclick="AV.cPage(' + (r.data.page + 1) + ')" class="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold">→</button>' : '') + '</div></div></div>' +
        '<div class="mt-4 text-right"><a href="/api/admin/export/customers" class="inline-block bg-white shadow-sm px-4 py-2 rounded-lg text-sm font-semibold text-gray-700"><i class="fas fa-download mr-1.5"></i>CSV এক্সপোর্ট</a></div>',
        'কাস্টমার');
    }).catch(apiErr);
  }
  AV.cList = function (l) { cFilter.list = l; cFilter.page = 1; viewCustomers(); };
  AV.cSearch = function () { cFilter.search = v('cf-search'); cFilter.page = 1; viewCustomers(); };
  AV.cPage = function (p) { cFilter.page = p; viewCustomers(); };

  function viewCustomerDetail() {
    var phone = S.param;
    axios.get('/api/admin/customers/by-phone/' + encodeURIComponent(phone)).then(function (r) {
      var cu = r.data.customer;
      setContent(
        '<div class="flex items-center gap-3 mb-5"><a href="#/customers" class="text-gray-400"><i class="fas fa-arrow-left"></i></a>' +
        '<div><h2 class="font-bold text-lg">' + esc(cu.name) + '</h2><a href="tel:' + esc(cu.phone) + '" class="text-sm text-blue-600 font-semibold"><i class="fas fa-phone mr-1"></i>' + esc(cu.phone) + '</a></div>' +
        (cu.list_status !== 'none' ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold ' + (cu.list_status === 'blacklist' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-700') + '">' + cu.list_status + '</span>' : '') + '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">' +
          card('মোট অর্ডার', cu.total_orders, 'fa-cart-shopping', 'bg-blue-100 text-blue-600') +
          card('ডেলিভারড', cu.delivered_orders, 'fa-circle-check', 'bg-green-100 text-green-600') +
          card('বাতিল/রিটার্ন', cu.cancelled_orders + '/' + cu.returned_orders, 'fa-circle-xmark', 'bg-red-100 text-red-500') +
          card('মোট কেনাকাটা', money(cu.total_spent), 'fa-sack-dollar', 'bg-emerald-100 text-emerald-600') +
        '</div>' +
        '<div class="bg-white rounded-2xl p-5 shadow-sm mb-5"><div class="flex flex-wrap gap-2">' +
          '<button onclick="AV.setListStatus(' + cu.id + ',\'blacklist\')" class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-ban mr-1.5"></i>ব্ল্যাকলিস্ট করুন</button>' +
          '<button onclick="AV.setListStatus(' + cu.id + ',\'whitelist\')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-star mr-1.5"></i>হোয়াইটলিস্ট করুন</button>' +
          '<button onclick="AV.setListStatus(' + cu.id + ',\'none\')" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold">লিস্ট থেকে সরান</button>' +
        '</div>' + (cu.blacklist_reason ? '<div class="mt-3 text-xs text-red-600">কারণ: ' + esc(cu.blacklist_reason) + '</div>' : '') + '</div>' +
        '<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="px-5 py-4 border-b border-gray-100 font-bold">অর্ডার হিস্ট্রি</div>' + C.orderTable(r.data.orders.map(function (o) { o.customer_name = cu.name; o.phone = cu.phone; return o; })) + '</div>',
        'কাস্টমার প্রোফাইল');
    }).catch(apiErr);
  }
  AV.setListStatus = function (id, status) {
    if (status === 'blacklist') {
      modal('ব্ল্যাকলিস্ট কারণ', field('কারণ লিখুন', inp('bl-reason', '', 'যেমন: বারবার অর্ডার বাতিল')),
        '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
        '<button onclick="AV.doListStatus(' + id + ',\'blacklist\')" class="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold">ব্ল্যাকলিস্ট করুন</button>');
    } else AV.doListStatus(id, status);
  };
  AV.doListStatus = function (id, status) {
    axios.put('/api/admin/customers/' + id + '/list-status', { list_status: status, reason: v('bl-reason') || '' })
      .then(function () { closeModal(); toast('আপডেট হয়েছে'); viewCustomerDetail(); }).catch(apiErr);
  };

  // ============ COURIERS ============
  function viewCouriers() {
    axios.get('/api/admin/couriers').then(function (r) {
      var rows = r.data.couriers.map(function (co) {
        var successRate = co.total_orders > 0 ? Math.round(co.delivered / co.total_orders * 100) : 0;
        return '<div class="bg-white rounded-2xl p-5 shadow-sm">' +
          '<div class="flex justify-between items-start mb-3"><div><div class="font-bold">' + esc(co.name) + '</div>' +
          '<div class="text-xs text-gray-400 mt-0.5">' + (co.has_api ? (co.api_configured ? '<span class="text-emerald-600 font-semibold"><i class="fas fa-plug mr-1"></i>API কনফিগারড</span>' : '<span class="text-amber-600 font-semibold"><i class="fas fa-triangle-exclamation mr-1"></i>API credentials প্রয়োজন</span>') : '<span class="text-gray-500">ম্যানুয়াল</span>') +
          (co.is_active ? '' : ' | <span class="text-red-500">Inactive</span>') + '</div></div>' +
          '<div class="flex gap-1"><button onclick="AV.editCourier(' + co.id + ')" class="text-emerald-600 p-1.5"><i class="fas fa-pen"></i></button>' +
          '<button onclick="AV.deleteCourier(' + co.id + ')" class="text-red-500 p-1.5"><i class="fas fa-trash-can"></i></button></div></div>' +
          '<div class="grid grid-cols-4 gap-2 text-center text-xs mb-3">' +
            '<div class="bg-gray-50 rounded-lg p-2"><div class="font-bold">' + co.total_orders + '</div><div class="text-gray-400">অর্ডার</div></div>' +
            '<div class="bg-emerald-50 rounded-lg p-2"><div class="font-bold text-emerald-700">' + co.delivered + '</div><div class="text-gray-400">ডেলিভারড</div></div>' +
            '<div class="bg-orange-50 rounded-lg p-2"><div class="font-bold text-orange-600">' + co.returned + '</div><div class="text-gray-400">রিটার্ন</div></div>' +
            '<div class="bg-blue-50 rounded-lg p-2"><div class="font-bold text-blue-700">' + successRate + '%</div><div class="text-gray-400">সাকসেস</div></div>' +
          '</div>' +
          '<div class="text-xs text-gray-500">ডেলিভারি: ' + money(co.delivery_charge) + ' | রিটার্ন: ' + money(co.return_charge) + ' | COD: ' + co.cod_charge_percent + '%</div></div>';
      }).join('');
      setContent(
        '<div class="flex justify-between items-center mb-5"><div></div><button onclick="AV.editCourier(0)" class="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold"><i class="fas fa-plus mr-1.5"></i>নতুন কুরিয়ার</button></div>' +
        '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">' + (rows || '<div class="text-gray-400">কোনো কুরিয়ার নেই</div>') + '</div>',
        'কুরিয়ার');
      S._courierList = r.data.couriers;
    }).catch(apiErr);
  }
  AV.editCourier = function (id) {
    var co = (S._courierList || []).find(function (x) { return x.id === id; }) || {};
    modal(id ? 'কুরিয়ার এডিট' : 'নতুন কুরিয়ার',
      field('নাম *', inp('co-name', co.name)) +
      '<div class="grid grid-cols-3 gap-3">' +
        field('ডেলিভারি চার্জ', inp('co-delivery', co.delivery_charge != null ? co.delivery_charge : 0, '', 'number')) +
        field('রিটার্ন চার্জ', inp('co-return', co.return_charge != null ? co.return_charge : 0, '', 'number')) +
        field('COD চার্জ %', inp('co-cod', co.cod_charge_percent != null ? co.cod_charge_percent : 0, '', 'number')) +
      '</div>' +
      field('ট্র্যাকিং URL টেমপ্লেট', inp('co-track', co.tracking_url_template, 'https://courier.com/track/{tracking_id}')) +
      '<div class="mb-4">' + checkbox('co-hasapi', !!co.has_api, 'API ইন্টিগ্রেশন আছে') + '</div>' +
      '<div class="bg-blue-50 rounded-xl p-4 mb-3"><div class="text-xs font-bold text-blue-800 mb-3"><i class="fas fa-circle-info mr-1"></i>API Credentials (কুরিয়ারের মার্চেন্ট প্যানেল থেকে সংগ্রহ করুন)</div>' +
        field('API Key', inp('co-apikey', co.api_configured ? '••••••••' : '', 'API key')) +
        field('Secret Key', inp('co-secret', co.api_configured ? '••••••••' : '', 'Secret key')) +
        field('Merchant ID', inp('co-merchant', co.merchant_id)) +
        field('API Base URL', inp('co-baseurl', co.base_url, 'https://api.courier.com')) +
      '</div>' + checkbox('co-active', co.is_active !== 0, 'Active'),
      '<button onclick="A.closeModal()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">বাতিল</button>' +
      '<button onclick="AV.saveCourier(' + (id || 0) + ')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">সংরক্ষণ</button>');
  };
  AV.saveCourier = function (id) {
    var payload = {
      name: v('co-name'), delivery_charge: Number(v('co-delivery') || 0), return_charge: Number(v('co-return') || 0),
      cod_charge_percent: Number(v('co-cod') || 0), tracking_url_template: v('co-track'),
      has_api: chk('co-hasapi'), api_key: v('co-apikey'), secret_key: v('co-secret'),
      merchant_id: v('co-merchant'), base_url: v('co-baseurl'), is_active: chk('co-active')
    };
    var req = id ? axios.put('/api/admin/couriers/' + id, payload) : axios.post('/api/admin/couriers', payload);
    req.then(function () { closeModal(); toast('কুরিয়ার সংরক্ষিত'); viewCouriers(); }).catch(apiErr);
  };
  AV.deleteCourier = function (id) {
    confirmDlg('কুরিয়ারটি ডিলিট করবেন?', function () {
      axios.delete('/api/admin/couriers/' + id).then(function () { toast('ডিলিট হয়েছে'); viewCouriers(); }).catch(apiErr);
    });
  };

  // export views (marketing/finance/analytics/content/settings/users in part 4)
  window.__ADMIN_VIEWS_2__ = {
    products: viewProducts, customers: viewCustomers, customerDetail: viewCustomerDetail, couriers: viewCouriers,
    sectionCard: sectionCard, textarea: textarea, checkbox: checkbox
  };
})();
