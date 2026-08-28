// ============ Customer Order Tracking Page ============
(function () {
  'use strict';
  var app = document.getElementById('track-app');

  var STATUS_FLOW = ['new', 'pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
  var STATUS_ICONS = {
    new: 'fa-file-circle-plus', pending: 'fa-clock', confirmed: 'fa-circle-check', processing: 'fa-gears',
    ready_to_ship: 'fa-boxes-packing', shipped: 'fa-truck', out_for_delivery: 'fa-truck-ramp-box', delivered: 'fa-house-circle-check',
    cancelled: 'fa-circle-xmark', returned: 'fa-rotate-left', fake: 'fa-ban', manual_review: 'fa-magnifying-glass'
  };

  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n) { return '৳' + Number(n || 0).toLocaleString('bn-BD'); }
  function fmtDate(d) { return d ? new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z')).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }

  function renderForm(errorMsg) {
    app.innerHTML =
    '<div class="min-h-screen flex items-center justify-center px-4 py-10">' +
      '<div class="max-w-md w-full">' +
        '<div class="text-center mb-8">' +
          '<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center"><i class="fas fa-truck-fast text-emerald-600 text-2xl"></i></div>' +
          '<h1 class="text-2xl font-bold text-gray-900">অর্ডার ট্র্যাক করুন</h1>' +
          '<p class="text-gray-500 text-sm mt-1">Order ID ও মোবাইল নম্বর দিয়ে অর্ডারের অবস্থা জানুন</p>' +
        '</div>' +
        '<div class="bg-white rounded-2xl shadow-lg p-6">' +
          (errorMsg ? '<div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">' + esc(errorMsg) + '</div>' : '') +
          '<form onsubmit="trackOrder(event)">' +
            '<label class="block text-sm font-semibold text-gray-700 mb-1.5">অর্ডার আইডি</label>' +
            '<input type="text" id="t-order" required class="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4" placeholder="NCB-XXXXX">' +
            '<label class="block text-sm font-semibold text-gray-700 mb-1.5">মোবাইল নম্বর</label>' +
            '<input type="tel" id="t-phone" required class="w-full border border-gray-300 rounded-lg px-4 py-3 mb-5" placeholder="01XXXXXXXXX">' +
            '<button type="submit" id="t-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition"><i class="fas fa-magnifying-glass mr-2"></i>ট্র্যাক করুন</button>' +
          '</form>' +
        '</div>' +
        '<div class="text-center mt-6"><a href="/" class="text-sm text-gray-400 hover:text-gray-600">← হোমপেজে ফিরে যান</a>' +
        (window.SUPPORT_PHONE ? '<div class="mt-2 text-sm text-gray-500">সাহায্য প্রয়োজন? <a href="tel:' + esc(window.SUPPORT_PHONE) + '" class="text-emerald-600 font-semibold">' + esc(window.SUPPORT_PHONE) + '</a></div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderResult(o) {
    var isFailed = ['cancelled', 'returned', 'fake'].indexOf(o.status) !== -1;
    var currentIdx = STATUS_FLOW.indexOf(o.status);

    var timeline = STATUS_FLOW.map(function (st, i) {
      var reached = currentIdx >= i && !isFailed;
      var hEntry = (o.timeline || []).filter(function (h) { return h.status === st; }).pop();
      return '<div class="flex items-start gap-3 relative">' +
        (i < STATUS_FLOW.length - 1 ? '<div class="absolute left-[15px] top-8 bottom-0 w-0.5 ' + (reached && currentIdx > i ? 'bg-emerald-500' : 'bg-gray-200') + '"></div>' : '') +
        '<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ' + (reached ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400') + '"><i class="fas ' + (STATUS_ICONS[st] || 'fa-circle') + ' text-xs"></i></div>' +
        '<div class="pb-6"><div class="font-semibold text-sm ' + (reached ? 'text-gray-900' : 'text-gray-400') + '">' + statusLabel(st) + '</div>' +
        (hEntry ? '<div class="text-xs text-gray-400">' + fmtDate(hEntry.at) + '</div>' : '') + '</div>' +
      '</div>';
    }).join('');

    app.innerHTML =
    '<div class="min-h-screen px-4 py-10">' +
      '<div class="max-w-md mx-auto">' +
        '<div class="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">' +
          '<div class="' + (isFailed ? 'bg-red-500' : o.status === 'delivered' ? 'bg-emerald-600' : 'bg-emerald-700') + ' text-white p-6 text-center">' +
            '<i class="fas ' + (STATUS_ICONS[o.status] || 'fa-box') + ' text-3xl mb-2"></i>' +
            '<div class="text-xl font-bold">' + esc(o.status_label) + '</div>' +
            '<div class="text-sm opacity-80 mt-1">#' + esc(o.order_number) + '</div>' +
          '</div>' +
          '<div class="p-5 space-y-2 text-sm border-b border-gray-100">' +
            '<div class="flex justify-between"><span class="text-gray-500">অর্ডারের তারিখ</span><span class="font-semibold">' + fmtDate(o.created_at) + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">মোট মূল্য</span><span class="font-bold text-emerald-700">' + money(o.grand_total) + '</span></div>' +
            (o.courier_name ? '<div class="flex justify-between"><span class="text-gray-500">কুরিয়ার</span><span class="font-semibold">' + esc(o.courier_name) + '</span></div>' : '') +
            (o.tracking_id ? '<div class="flex justify-between"><span class="text-gray-500">ট্র্যাকিং আইডি</span><span class="font-semibold">' + esc(o.tracking_id) + '</span></div>' : '') +
            (o.tracking_url ? '<a href="' + esc(o.tracking_url) + '" target="_blank" rel="noopener" class="block text-center bg-blue-50 text-blue-700 font-semibold rounded-lg py-2.5 mt-2"><i class="fas fa-arrow-up-right-from-square mr-1.5"></i>কুরিয়ার ওয়েবসাইটে ট্র্যাক করুন</a>' : '') +
          '</div>' +
          '<div class="p-5">' +
            (isFailed ?
              '<div class="bg-red-50 rounded-xl p-4 text-center text-sm text-red-700"><i class="fas fa-circle-info mr-1"></i>এই অর্ডারটি ' + esc(o.status_label) + ' হয়েছে। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।</div>'
            : '<h3 class="font-bold text-gray-900 mb-4">অর্ডার টাইমলাইন</h3>' + timeline) +
          '</div>' +
        '</div>' +
        '<button onclick="location.reload()" class="w-full bg-gray-100 hover:bg-gray-200 font-semibold py-3 rounded-xl text-sm text-gray-700"><i class="fas fa-magnifying-glass mr-1.5"></i>অন্য অর্ডার ট্র্যাক করুন</button>' +
        (window.SUPPORT_PHONE ? '<a href="tel:' + esc(window.SUPPORT_PHONE) + '" class="block text-center mt-3 text-sm text-emerald-600 font-semibold"><i class="fas fa-headset mr-1"></i>সাপোর্ট: ' + esc(window.SUPPORT_PHONE) + '</a>' : '') +
      '</div>' +
    '</div>';
  }

  function statusLabel(st) {
    var map = { new: 'অর্ডার গৃহীত', pending: 'পেন্ডিং', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', ready_to_ship: 'শিপমেন্টের জন্য প্রস্তুত', shipped: 'শিপড', out_for_delivery: 'ডেলিভারির পথে', delivered: 'ডেলিভারড' };
    return map[st] || st;
  }

  window.trackOrder = function (ev) {
    ev.preventDefault();
    var btn = document.getElementById('t-btn');
    btn.disabled = true;
    btn.innerHTML = 'খোঁজা হচ্ছে...';
    axios.post('/api/public/track', {
      order_number: document.getElementById('t-order').value.trim(),
      phone: document.getElementById('t-phone').value.trim()
    }).then(function (r) {
      renderResult(r.data.order);
    }).catch(function (e) {
      renderForm((e.response && e.response.data.message) || 'অর্ডার পাওয়া যায়নি');
    });
  };

  renderForm();
})();
