-- ============================================================
-- NATURE CARE BANGLADESH - Seed Data (Demo)
-- ============================================================

-- Default admin: username=arjumankhan566@gmail.com (SHA-256 with salt 'ncb_salt_2026')
INSERT OR IGNORE INTO admin_users (username, password_hash, full_name, email, role) VALUES
  ('arjumankhan566@gmail.com', '5c0a4b14ef48922e3a7e81a3750af8fe93913676a47d091acefdde28a121c883', 'Arjuman Khan', 'arjumankhan566@gmail.com', 'super_admin');

-- Settings
INSERT OR REPLACE INTO settings (key, value, category) VALUES
  ('brand_name', 'Nature Care Bangladesh', 'brand'),
  ('brand_tagline', 'প্রকৃতির যত্নে, আপনার সুস্থতায়', 'brand'),
  ('brand_logo', '', 'brand'),
  ('support_phone', '01700000000', 'general'),
  ('whatsapp_number', '8801700000000', 'general'),
  ('messenger_link', 'https://m.me/naturecarebd', 'general'),
  ('hero_headline', 'প্রাকৃতিক উপাদানে তৈরি প্রিমিয়াম হারবাল কেয়ার', 'content'),
  ('hero_subheadline', '১০০% প্রাকৃতিক উপাদান দিয়ে তৈরি — আপনার প্রতিদিনের যত্নে নিরাপদ ও কার্যকর সমাধান। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।', 'content'),
  ('offer_title', 'বিশেষ অফার চলছে!', 'content'),
  ('offer_description', 'সীমিত সময়ের জন্য বিশেষ ছাড়ে অর্ডার করুন', 'content'),
  ('countdown_enabled', '1', 'offer'),
  ('countdown_end', '2026-09-30T23:59:59', 'offer'),
  ('countdown_fallback_text', 'অফার শেষ! তবে এখনও নিয়মিত মূল্যে অর্ডার করতে পারবেন।', 'offer'),
  ('delivery_charge_dhaka', '70', 'delivery'),
  ('delivery_charge_outside', '130', 'delivery'),
  ('free_delivery_enabled', '0', 'delivery'),
  ('free_delivery_min', '2000', 'delivery'),
  ('usd_to_bdt_rate', '120', 'currency'),
  ('default_packaging_cost', '15', 'costs'),
  ('default_cod_fee_percent', '1', 'costs'),
  ('default_other_cost', '0', 'costs'),
  ('otp_enabled', '0', 'fraud'),
  ('duplicate_order_window_minutes', '30', 'fraud'),
  ('max_orders_per_phone_per_day', '3', 'fraud'),
  ('meta_pixel_id', '', 'marketing'),
  ('meta_pixel_enabled', '0', 'marketing'),
  ('meta_capi_token', '', 'marketing'),
  ('meta_capi_enabled', '0', 'marketing'),
  ('meta_events_enabled', 'PageView,ViewContent,InitiateCheckout,Lead,Purchase', 'marketing'),
  ('meta_advanced_matching', '1', 'tracking'),
  ('meta_pixel_host_lock', '1', 'tracking'),
  ('meta_pixel_allowed_hosts', 'naturalcarebangladesh.shop,natural-care-bd.pages.dev,localhost,127.0.0.1', 'tracking'),
  ('ga_id', '', 'marketing'),
  ('gtm_id', '', 'marketing'),
  ('tiktok_pixel_id', '', 'marketing'),
  ('seo_title', 'Nature Care Bangladesh — প্রাকৃতিক হারবাল কেয়ার | ক্যাশ অন ডেলিভারি', 'seo'),
  ('seo_description', '১০০% প্রাকৃতিক উপাদানে তৈরি প্রিমিয়াম হারবাল প্রোডাক্ট। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। এখনই অর্ডার করুন!', 'seo'),
  ('seo_keywords', 'nature care bangladesh, হারবাল, প্রাকৃতিক, ক্যাশ অন ডেলিভারি', 'seo'),
  ('og_image', '', 'seo'),
  ('canonical_url', '', 'seo'),
  ('robots', 'index, follow', 'seo'),
  ('fb_share_title', 'Nature Care Bangladesh — প্রাকৃতিক হারবাল কেয়ার', 'seo'),
  ('fb_share_description', 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি — এখনই অর্ডার করুন!', 'seo');

-- Demo product
INSERT OR IGNORE INTO products (id, name, subtitle, slug, description, features, benefits, ingredients, usage_instructions, package_details, main_image, gallery_images, regular_price, sale_price, product_cost, stock, is_active, is_featured) VALUES
  (1, 'ন্যাচার কেয়ার হারবাল হেয়ার অয়েল', 'চুলের সম্পূর্ণ প্রাকৃতিক যত্ন', 'herbal-hair-oil',
   'ন্যাচার কেয়ার হারবাল হেয়ার অয়েল তৈরি হয়েছে সম্পূর্ণ প্রাকৃতিক উপাদান দিয়ে। আমলকী, ব্রাহ্মী, ভৃঙ্গরাজ ও নারকেল তেলের সমন্বয়ে তৈরি এই তেল আপনার চুলের গোড়া মজবুত করতে সাহায্য করে।',
   '["১০০% প্রাকৃতিক উপাদান","কোনো ক্ষতিকর কেমিক্যাল নেই","সব ধরনের চুলে ব্যবহারযোগ্য","পরীক্ষিত ফর্মুলা"]',
   '["চুলের গোড়া মজবুত করতে সাহায্য করে","চুলের স্বাভাবিক উজ্জ্বলতা বাড়ায়","মাথার ত্বক ঠান্ডা রাখে","নিয়মিত ব্যবহারে চুল ঝলমলে হয়"]',
   'আমলকী, ব্রাহ্মী, ভৃঙ্গরাজ, নারকেল তেল, কালোজিরা তেল, মেথি',
   'সপ্তাহে ৩-৪ দিন রাতে চুলের গোড়ায় ভালোভাবে ম্যাসাজ করুন। সকালে মৃদু শ্যাম্পু দিয়ে ধুয়ে ফেলুন।',
   'প্রতি বোতল ২০০ মি.লি.',
   'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80',
   '["https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80","https://images.unsplash.com/photo-1571875257727-256c39da42af?w=800&q=80","https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=800&q=80"]',
   1290, 990, 450, 150, 1, 1);

-- Demo packages
INSERT OR IGNORE INTO product_packages (id, product_id, name, quantity, price, regular_price, free_delivery, badge, sort_order) VALUES
  (1, 1, '১টি প্যাকেজ', 1, 990, 1290, 0, NULL, 1),
  (2, 1, '২টি প্যাকেজ', 2, 1850, 2580, 1, 'সবচেয়ে জনপ্রিয়', 2),
  (3, 1, '৩টি প্যাকেজ', 3, 2650, 3870, 1, 'সেরা সাশ্রয়', 3);

-- Demo couriers
INSERT OR IGNORE INTO couriers (id, name, has_api, delivery_charge, return_charge, cod_charge_percent, tracking_url_template, is_active) VALUES
  (1, 'Steadfast Courier', 1, 60, 60, 1.0, 'https://steadfast.com.bd/t/{tracking_id}', 1),
  (2, 'Pathao Courier', 1, 70, 70, 1.0, 'https://merchant.pathao.com/tracking?consignment_id={tracking_id}', 1),
  (3, 'RedX', 1, 65, 65, 1.0, 'https://redx.com.bd/track-global-parcel/?trackingId={tracking_id}', 1),
  (4, 'SA Paribahan', 0, 100, 100, 1.5, '', 1);

-- Benefits
INSERT OR IGNORE INTO benefits (icon, title, description, sort_order) VALUES
  ('fa-leaf', '১০০% প্রাকৃতিক', 'সম্পূর্ণ প্রাকৃতিক উপাদানে তৈরি, কোনো ক্ষতিকর কেমিক্যাল নেই', 1),
  ('fa-shield-halved', 'নিরাপদ ও পরীক্ষিত', 'যত্নসহকারে প্রস্তুতকৃত এবং মান নিয়ন্ত্রিত প্রোডাক্ট', 2),
  ('fa-truck-fast', 'দ্রুত ডেলিভারি', 'ঢাকায় ২৪-৪৮ ঘণ্টা, সারাদেশে ২-৪ দিনে ডেলিভারি', 3),
  ('fa-hand-holding-dollar', 'ক্যাশ অন ডেলিভারি', 'পণ্য হাতে পেয়ে টাকা পরিশোধ করুন — সম্পূর্ণ ঝুঁকিমুক্ত', 4);

-- Reviews
INSERT OR IGNORE INTO reviews (customer_name, review_text, rating, is_published, is_featured, sort_order) VALUES
  ('রাহেলা খাতুন, ঢাকা', 'প্রোডাক্টের মান খুবই ভালো। ডেলিভারিও দ্রুত পেয়েছি। ধন্যবাদ Nature Care!', 5, 1, 1, 1),
  ('মো. কামরুল হাসান, চট্টগ্রাম', 'দুই মাস ধরে ব্যবহার করছি। সত্যিই ভালো মানের প্রোডাক্ট। আবার অর্ডার করব ইনশাআল্লাহ।', 5, 1, 1, 2),
  ('সাবরিনা আক্তার, সিলেট', 'কাস্টমার সার্ভিস খুব আন্তরিক। ফোনে কনফার্ম করে তারপর পাঠিয়েছে। প্যাকেজিং সুন্দর ছিল।', 4, 1, 0, 3);

-- FAQs
INSERT OR IGNORE INTO faqs (question, answer, sort_order, is_visible) VALUES
  ('অর্ডার করার পর কতদিনে পণ্য পাব?', 'ঢাকার ভেতরে ২৪-৪৮ ঘণ্টা এবং ঢাকার বাইরে সাধারণত ২-৪ কার্যদিবসের মধ্যে পণ্য পৌঁছে যায়।', 1, 1),
  ('পেমেন্ট কীভাবে করব?', 'আমরা ক্যাশ অন ডেলিভারি সাপোর্ট করি। পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিবেন।', 2, 1),
  ('ডেলিভারি চার্জ কত?', 'ঢাকার ভেতরে ৭০ টাকা এবং ঢাকার বাইরে ১৩০ টাকা। ২টি বা তার বেশি প্যাকেজ নিলে ডেলিভারি ফ্রি!', 3, 1),
  ('অর্ডার কীভাবে ট্র্যাক করব?', 'আমাদের ওয়েবসাইটের Track Order পেজে গিয়ে আপনার Order ID ও মোবাইল নম্বর দিয়ে অর্ডারের সর্বশেষ অবস্থা দেখতে পারবেন।', 4, 1),
  ('পণ্যে সমস্যা থাকলে কী করব?', 'পণ্য গ্রহণের সময় ডেলিভারি ম্যানের সামনে চেক করে নিন। কোনো সমস্যা থাকলে আমাদের হটলাইনে যোগাযোগ করুন।', 5, 1);

-- How it works steps (stored as page section)
INSERT OR IGNORE INTO page_sections (id, section_type, title, content, sort_order, is_visible) VALUES
  (1, 'how_it_works', 'যেভাবে অর্ডার করবেন', '{"steps":[{"icon":"fa-box-open","title":"পণ্য নির্বাচন করুন","desc":"আপনার পছন্দের প্যাকেজ বেছে নিন"},{"icon":"fa-file-pen","title":"অর্ডার ফর্ম পূরণ করুন","desc":"নাম, মোবাইল ও ঠিকানা দিন"},{"icon":"fa-phone-volume","title":"ফোনে কনফার্মেশন","desc":"আমরা ফোন করে অর্ডার নিশ্চিত করব"},{"icon":"fa-truck","title":"পণ্য বুঝে নিন","desc":"কুরিয়ারের মাধ্যমে পণ্য পেয়ে টাকা দিন"}]}', 1, 1);
