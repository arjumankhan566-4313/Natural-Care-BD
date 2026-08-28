// ============ Nature Care BD — Admin Panel SPA ============
(function () {
  'use strict';
  axios.defaults.withCredentials = true;

  var S = { user: null, route: 'dashboard', param: null, lastNotifId: 0, pollTimer: null };
  var root = document.getElementById('admin-app');

  // ---------- helpers ----------
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n) { return '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function fmtDT(d) { if (!d) return '—'; return new Date(d.replace(' ', 'T') + (d.includes('Z') || d.includes('+') ? '' : 'Z')).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function toast(msg, type) {
    var t = document.createElement('div');
    t.className = 'toast-enter fixed top-4 right-4 z-[100] px-5 py-3.5 rounded-xl shadow-lg text-white text-sm font-semibold ' + (type === 'error' ? 'bg-red-500' : type === 'warn' ? 'bg-amber-500' : 'bg-emerald-600');
    t.innerHTML = (type === 'error' ? '<i class="fas fa-circle-xmark mr-2"></i>' : '<i class="fas fa-circle-check mr-2"></i>') + esc(msg);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  function apiErr(e) { toast((e.response && e.response.data && (e.response.data.message || e.response.data.error)) || 'ত্রুটি হয়েছে', 'error'); }
  function confirmDlg(msg, cb) {
    var m = document.createElement('div');
    m.className = 'modal-backdrop fixed inset-0 z-[90] flex items-center justify-center p-4';
    m.innerHTML = '<div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"><div class="text-gray-800 font-semibold mb-5">' + esc(msg) + '</div>' +
      '<div class="flex gap-3 justify-end"><button class="px-4 py-2 rounded-lg bg-gray-100 font-semibold text-sm" id="cd-no">বাতিল</button>' +
      '<button class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm" id="cd-yes">হ্যাঁ, নিশ্চিত</button></div></div>';
    document.body.appendChild(m);
    m.querySelector('#cd-no').onclick = function () { m.remove(); };
    m.querySelector('#cd-yes').onclick = function () { m.remove(); cb(); };
  }
  function modal(title, bodyHtml, footHtml) {
    closeModal();
    var m = document.createElement('div');
    m.id = 'app-modal';
    m.className = 'modal-backdrop fixed inset-0 z-[80] flex items-start justify-center p-4 overflow-y-auto';
    m.innerHTML = '<div class="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-8">' +
      '<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h3 class="font-bold text-gray-900">' + title + '</h3>' +
      '<button onclick="A.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-xmark text-lg"></i></button></div>' +
      '<div class="px-6 py-5">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">' + footHtml + '</div>' : '') + '</div>';
    document.body.appendChild(m);
  }
  function closeModal() { var m = document.getElementById('app-modal'); if (m) m.remove(); }
  function field(label, inner) { return '<div class="mb-4"><label class="block text-sm font-semibold text-gray-700 mb-1.5">' + label + '</label>' + inner + '</div>'; }
  function inp(id, val, ph, type) { return '<input type="' + (type || 'text') + '" id="' + id + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm">'; }
  function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function chk(id) { var el = document.getElementById(id); return el ? el.checked : false; }

  var STATUS_BN = { new: 'নতুন', pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', ready_to_ship: 'রেডি টু শিপ', shipped: 'শিপড', out_for_delivery: 'ডেলিভারির পথে', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'রিটার্নড', fake: 'ফেক', manual_review: 'ম্যানুয়াল রিভিউ' };
  var STATUS_COLOR = { new: 'bg-blue-100 text-blue-700', pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-emerald-100 text-emerald-700', processing: 'bg-indigo-100 text-indigo-700', ready_to_ship: 'bg-purple-100 text-purple-700', shipped: 'bg-cyan-100 text-cyan-700', out_for_delivery: 'bg-teal-100 text-teal-700', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-700', returned: 'bg-orange-100 text-orange-700', fake: 'bg-gray-800 text-white', manual_review: 'bg-yellow-100 text-yellow-800' };
  function statusBadge(st) { return '<span class="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ' + (STATUS_COLOR[st] || 'bg-gray-100') + '">' + (STATUS_BN[st] || st) + '</span>'; }
  function riskBadge(lv, score) {
    var map = { low: ['🟢', 'bg-emerald-50 text-emerald-700'], medium: ['🟡', 'bg-amber-50 text-amber-700'], high: ['🔴', 'bg-red-50 text-red-700'] };
    var x = map[lv] || map.low;
    return '<span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + x[1] + '">' + x[0] + ' ' + lv.toUpperCase() + (score != null ? ' (' + score + ')' : '') + '</span>';
  }

  // ---------- login ----------
  function renderLogin() {
    stopPolling();
    root.innerHTML =
    '<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-950 px-4">' +
      '<div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">' +
        '<div class="text-center mb-6">' +
          (window.BRAND_LOGO
            ? '<img src="' + window.BRAND_LOGO + '" alt="logo" class="w-24 h-24 mx-auto mb-3 object-contain drop-shadow-md">'
            : '<div class="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center"><i class="fas fa-leaf text-emerald-600 text-xl"></i></div>') +
        '<h1 class="text-xl font-bold text-gray-900">' + (window.BRAND_NAME || 'Nature Care Bangladesh') + '</h1><p class="text-sm text-gray-500">Admin Panel Login</p></div>' +
        '<div id="login-err" class="hidden bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4"></div>' +
        '<form onsubmit="A.login(event)">' +
          field('ইউজারনেম', inp('l-user', '', 'username')) +
          field('পাসওয়ার্ড', inp('l-pass', '', '••••••••', 'password')) +
          '<button type="submit" id="l-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition">লগইন করুন</button>' +
        '</form>' +
      '</div></div>';
  }

  function login(ev) {
    ev.preventDefault();
    var btn = document.getElementById('l-btn');
    btn.disabled = true; btn.textContent = 'লগইন হচ্ছে...';
    axios.post('/api/auth/login', { username: v('l-user'), password: v('l-pass') }).then(function (r) {
      S.user = r.data.user;
      startApp();
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'লগইন করুন';
      var el = document.getElementById('login-err');
      el.textContent = (e.response && e.response.data.message) || 'লগইন ব্যর্থ হয়েছে';
      el.classList.remove('hidden');
    });
  }

  // ---------- layout ----------
  var MENU = [
    { id: 'dashboard', icon: 'fa-gauge-high', label: 'ড্যাশবোর্ড' },
    { id: 'orders', icon: 'fa-cart-shopping', label: 'অর্ডারসমূহ' },
    { id: 'incomplete', icon: 'fa-cart-arrow-down', label: 'ইনকমপ্লিট অর্ডার' },
    { id: 'products', icon: 'fa-box', label: 'প্রোডাক্ট' },
    { id: 'customers', icon: 'fa-users', label: 'কাস্টমার' },
    { id: 'couriers', icon: 'fa-truck', label: 'কুরিয়ার' },
    { id: 'marketing', icon: 'fa-bullhorn', label: 'মার্কেটিং' },
    { id: 'pixel', icon: 'fa-bullseye', label: 'পিক্সেল সেটাপ' },
    { id: 'finance', icon: 'fa-coins', label: 'ফাইন্যান্স' },
    { id: 'analytics', icon: 'fa-chart-line', label: 'অ্যানালিটিক্স' },
    { id: 'content', icon: 'fa-pen-to-square', label: 'কনটেন্ট' },
    { id: 'settings', icon: 'fa-gear', label: 'সেটিংস' },
    { id: 'users', icon: 'fa-user-shield', label: 'ইউজার' }
  ];

  function layout(contentHtml) {
    root.innerHTML =
    '<div class="flex min-h-screen">' +
      // sidebar (desktop)
      '<aside id="sidebar" class="fixed md:sticky top-0 h-screen w-64 bg-emerald-950 text-emerald-100 z-50 -translate-x-full md:translate-x-0 transition-transform flex flex-col">' +
        '<div class="p-5 border-b border-emerald-900 flex items-center gap-3">' +
          (window.BRAND_LOGO
            ? '<img src="' + window.BRAND_LOGO + '" alt="logo" class="w-11 h-11 rounded-full bg-white object-contain p-0.5 shadow">'
            : '<div class="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center"><i class="fas fa-leaf text-white"></i></div>') +
          '<div><div class="font-bold text-white text-sm">' + (window.BRAND_NAME || 'Nature Care BD') + '</div><div class="text-xs text-emerald-400">Admin Panel</div></div>' +
        '</div>' +
        '<nav class="flex-1 overflow-y-auto py-3">' +
          MENU.map(function (m) {
            return '<a href="#/' + m.id + '" class="sidebar-link flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-emerald-900 transition ' + (S.route === m.id ? 'active' : '') + '"><i class="fas ' + m.icon + ' w-5"></i>' + m.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="p-4 border-t border-emerald-900">' +
          '<div class="text-xs text-emerald-400 mb-2">' + esc(S.user.full_name) + ' <span class="opacity-60">(' + esc(S.user.role) + ')</span></div>' +
          '<button onclick="A.logout()" class="w-full bg-emerald-900 hover:bg-emerald-800 rounded-lg py-2 text-sm font-semibold"><i class="fas fa-right-from-bracket mr-1.5"></i>লগআউট</button>' +
        '</div>' +
      '</aside>' +
      '<div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden md:hidden" onclick="A.toggleSidebar()"></div>' +
      // main
      '<div class="flex-1 min-w-0">' +
        '<header class="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">' +
          '<div class="flex items-center gap-3">' +
            '<button class="md:hidden text-gray-600" onclick="A.toggleSidebar()"><i class="fas fa-bars text-lg"></i></button>' +
            '<h1 class="font-bold text-gray-900" id="page-title"></h1>' +
          '</div>' +
          '<div class="flex items-center gap-3">' +
            '<a href="/" target="_blank" class="text-sm text-gray-500 hover:text-emerald-600 hidden sm:block"><i class="fas fa-arrow-up-right-from-square mr-1"></i>সাইট দেখুন</a>' +
            '<button onclick="A.showNotifications()" class="relative text-gray-500 hover:text-emerald-600 p-1"><i class="fas fa-bell text-lg"></i><span id="notif-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"></span></button>' +
          '</div>' +
        '</header>' +
        '<main class="p-4 md:p-6" id="main-content">' + contentHtml + '</main>' +
      '</div>' +
    '</div>';
    updateNotifBadge();
  }

  function setContent(html, title) {
    var mc = document.getElementById('main-content');
    if (mc) mc.innerHTML = html;
    var pt = document.getElementById('page-title');
    if (pt && title) pt.textContent = title;
  }

  function skeleton() {
    return '<div class="space-y-4"><div class="skeleton h-24 rounded-2xl"></div><div class="skeleton h-64 rounded-2xl"></div></div>';
  }

  // ---------- routing ----------
  function navigate() {
    var hash = location.hash.replace(/^#\//, '') || 'dashboard';
    var parts = hash.split('/');
    S.route = parts[0];
    S.param = parts[1] || null;
    S.query = parts.slice(1).join('/');
    if (!S.user) return;
    layout(skeleton());
    var views = {
      dashboard: viewDashboard, orders: S.param ? viewOrderDetail : viewOrders, products: viewProducts,
      customers: S.param ? viewCustomerDetail : viewCustomers, couriers: viewCouriers, marketing: viewMarketing,
      finance: viewFinance, analytics: viewAnalytics, content: viewContent, settings: viewSettings, users: viewUsers,
      incomplete: viewIncomplete, pixel: viewPixel
    };
    (views[S.route] || viewDashboard)();
  }

  // ---------- notifications polling ----------
  function startPolling() {
    stopPolling();
    S.pollTimer = setInterval(function () {
      axios.get('/api/admin/poll?since_id=' + S.lastNotifId).then(function (r) {
        if (S.lastNotifId > 0) {
          (r.data.notifications || []).forEach(function (n) {
            if (n.type === 'new_order') toast(n.title + ' — ' + n.message);
          });
        }
        S.lastNotifId = r.data.max_id || S.lastNotifId;
        updateNotifBadge();
      }).catch(function () {});
    }, 15000);
    axios.get('/api/admin/poll?since_id=999999999').then(function (r) { S.lastNotifId = r.data.max_id || 0; }).catch(function () {});
  }
  function stopPolling() { if (S.pollTimer) { clearInterval(S.pollTimer); S.pollTimer = null; } }
  function updateNotifBadge() {
    axios.get('/api/admin/notifications').then(function (r) {
      var b = document.getElementById('notif-badge');
      if (!b) return;
      if (r.data.unread > 0) { b.textContent = r.data.unread > 99 ? '99+' : r.data.unread; b.classList.remove('hidden'); }
      else b.classList.add('hidden');
    }).catch(function () {});
  }
  function showNotifications() {
    axios.get('/api/admin/notifications').then(function (r) {
      var items = (r.data.notifications || []).map(function (n) {
        return '<div class="flex items-start gap-3 py-3 border-b border-gray-50 ' + (n.is_read ? 'opacity-60' : '') + '">' +
          '<i class="fas ' + (n.type === 'new_order' ? 'fa-cart-plus text-emerald-500' : 'fa-circle-info text-blue-400') + ' mt-1"></i>' +
          '<div class="flex-1 min-w-0"><div class="text-sm font-semibold">' + esc(n.title) + '</div><div class="text-xs text-gray-500">' + esc(n.message) + '</div><div class="text-[10px] text-gray-400 mt-0.5">' + fmtDT(n.created_at) + '</div></div>' +
          (n.link ? '<a href="' + esc(n.link) + '" onclick="A.closeModal()" class="text-xs text-emerald-600 font-semibold shrink-0">দেখুন</a>' : '') + '</div>';
      }).join('') || '<div class="text-center text-gray-400 py-8">কোনো নোটিফিকেশন নেই</div>';
      modal('<i class="fas fa-bell mr-2 text-emerald-600"></i>নোটিফিকেশন', '<div class="max-h-96 overflow-y-auto">' + items + '</div>',
        '<button onclick="A.markNotifsRead()" class="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold">সব পঠিত হিসেবে চিহ্নিত করুন</button>');
    }).catch(apiErr);
  }

  // placeholder view functions defined in part 2
  var viewDashboard, viewOrders, viewOrderDetail, viewProducts, viewCustomers, viewCustomerDetail,
      viewCouriers, viewMarketing, viewFinance, viewAnalytics, viewContent, viewSettings, viewUsers,
      viewIncomplete, viewPixel;

  // ---------- global API ----------
  window.A = {
    login: login,
    logout: function () { axios.post('/api/auth/logout').then(function () { S.user = null; renderLogin(); }); },
    toggleSidebar: function () {
      document.getElementById('sidebar').classList.toggle('-translate-x-full');
      document.getElementById('sidebar-backdrop').classList.toggle('hidden');
    },
    closeModal: closeModal,
    showNotifications: showNotifications,
    markNotifsRead: function () { axios.post('/api/admin/notifications/mark-read').then(function () { closeModal(); updateNotifBadge(); }); }
  };

  function startApp() {
    startPolling();
    navigate();
  }

  window.addEventListener('hashchange', navigate);

  // boot: check session
  axios.get('/api/auth/me').then(function (r) {
    S.user = r.data.user;
    startApp();
  }).catch(function () { renderLogin(); });

  // expose internals for part 2
  window.__ADMIN__ = {
    S: S, esc: esc, money: money, fmtDT: fmtDT, toast: toast, apiErr: apiErr, confirmDlg: confirmDlg,
    modal: modal, closeModal: closeModal, field: field, inp: inp, v: v, chk: chk,
    statusBadge: statusBadge, riskBadge: riskBadge, STATUS_BN: STATUS_BN, setContent: setContent, skeleton: skeleton,
    registerViews: function (views) {
      viewDashboard = views.dashboard; viewOrders = views.orders; viewOrderDetail = views.orderDetail;
      viewProducts = views.products; viewCustomers = views.customers; viewCustomerDetail = views.customerDetail;
      viewCouriers = views.couriers; viewMarketing = views.marketing; viewFinance = views.finance;
      viewAnalytics = views.analytics; viewContent = views.content; viewSettings = views.settings; viewUsers = views.users;
      viewIncomplete = views.incomplete; viewPixel = views.pixel;
      if (S.user) navigate();
    }
  };
})();
