-- ============================================================
-- NATURE CARE BANGLADESH - Complete E-Commerce Schema
-- ============================================================

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer', -- super_admin, admin, order_manager, marketing_manager, account_manager, viewer
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

-- Login history
CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  success INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT UNIQUE,
  description TEXT,
  features TEXT, -- JSON array
  benefits TEXT, -- JSON array
  ingredients TEXT,
  usage_instructions TEXT,
  package_details TEXT,
  main_image TEXT,
  gallery_images TEXT, -- JSON array
  video_url TEXT,
  regular_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  product_cost REAL NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  stock_status TEXT DEFAULT 'in_stock', -- in_stock, low_stock, out_of_stock
  is_active INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product packages (quantity-based pricing)
CREATE TABLE IF NOT EXISTS product_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  regular_price REAL DEFAULT 0,
  free_delivery INTEGER DEFAULT 0,
  badge TEXT, -- e.g. "সবচেয়ে জনপ্রিয়"
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  alt_phone TEXT,
  address TEXT,
  district TEXT,
  upazila TEXT,
  area TEXT,
  total_orders INTEGER DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  cancelled_orders INTEGER DEFAULT 0,
  returned_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  last_order_at DATETIME,
  risk_score INTEGER DEFAULT 0, -- 0-100
  list_status TEXT DEFAULT 'none', -- none, blacklist, whitelist
  blacklist_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Couriers
CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo TEXT,
  has_api INTEGER DEFAULT 0,
  api_key TEXT,
  secret_key TEXT,
  merchant_id TEXT,
  base_url TEXT,
  delivery_charge REAL DEFAULT 0,
  return_charge REAL DEFAULT 0,
  cod_charge_percent REAL DEFAULT 0,
  tracking_url_template TEXT, -- e.g. https://courier.com/track/{tracking_id}
  is_active INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL, -- NCB-XXXXX
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  address TEXT NOT NULL,
  district TEXT,
  upazila TEXT,
  area TEXT,
  delivery_method TEXT DEFAULT 'home_delivery',
  order_note TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  delivery_charge REAL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new', -- new, pending, confirmed, processing, ready_to_ship, shipped, out_for_delivery, delivered, cancelled, returned, fake, manual_review
  is_verified INTEGER DEFAULT 0, -- OTP verified
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low', -- low, medium, high
  risk_reasons TEXT, -- JSON array
  -- Financial fields (per-order overrides)
  product_cost REAL DEFAULT 0,
  packaging_cost REAL DEFAULT 0,
  courier_cost REAL DEFAULT 0,
  cod_charge REAL DEFAULT 0,
  ad_cost REAL DEFAULT 0,
  other_cost REAL DEFAULT 0,
  net_profit REAL DEFAULT 0,
  -- Courier
  courier_id INTEGER,
  tracking_id TEXT,
  tracking_url TEXT,
  shipped_at DATETIME,
  delivered_at DATETIME,
  -- Attribution
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  fbclid TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  order_source TEXT DEFAULT 'website',
  ip_address TEXT,
  user_agent TEXT,
  event_id TEXT, -- for pixel dedup
  admin_notes TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (courier_id) REFERENCES couriers(id)
);

-- Order items (multi-product support)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  package_id INTEGER,
  product_name TEXT NOT NULL,
  package_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Order status history / timeline
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT, -- admin username or 'system' or 'customer'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Courier transfer history
CREATE TABLE IF NOT EXISTS courier_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  from_courier_id INTEGER,
  from_courier_name TEXT,
  to_courier_id INTEGER NOT NULL,
  to_courier_name TEXT,
  tracking_id TEXT,
  delivery_charge REAL DEFAULT 0,
  courier_charge REAL DEFAULT 0,
  note TEXT,
  transferred_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Campaigns (ad spend)
CREATE TABLE IF NOT EXISTS ad_spends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_name TEXT NOT NULL,
  campaign_id TEXT,
  adset_name TEXT,
  adset_id TEXT,
  ad_name TEXT,
  ad_id TEXT,
  spend_date DATE NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD', -- USD or BDT
  amount_bdt REAL DEFAULT 0, -- converted
  orders_count INTEGER DEFAULT 0,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BDT',
  amount_bdt REAL DEFAULT 0,
  expense_date DATE NOT NULL,
  category TEXT DEFAULT 'miscellaneous', -- packaging, staff, phone, software, refund, return, courier_penalty, miscellaneous
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_image TEXT,
  review_text TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  is_published INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Benefits (landing page)
CREATE TABLE IF NOT EXISTS benefits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT DEFAULT 'fa-check-circle',
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1
);

-- Landing page sections (section builder)
CREATE TABLE IF NOT EXISTS page_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_type TEXT NOT NULL, -- hero, product, benefits, features, offer, gallery, video, reviews, faq, trust, delivery, cta, order_form, custom_html, custom_text
  title TEXT,
  content TEXT, -- JSON config
  is_visible INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT DEFAULT 'general',
  is_secret INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT DEFAULT 'info', -- new_order, status_change, info, warning
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracking events (server-side pixel event log + dedup)
CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL, -- PageView, ViewContent, InitiateCheckout, Lead, Purchase
  event_data TEXT, -- JSON
  source_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  fbclid TEXT,
  sent_to_capi INTEGER DEFAULT 0,
  capi_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OTP codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_transfers_order ON courier_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_id ON tracking_events(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_adspend_date ON ad_spends(spend_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
