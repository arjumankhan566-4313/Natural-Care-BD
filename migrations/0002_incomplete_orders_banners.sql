-- ============================================================
-- Incomplete (abandoned) order capture + Hero banner slider
-- ============================================================

-- Incomplete orders: form partially filled but never submitted
CREATE TABLE IF NOT EXISTS incomplete_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  phone TEXT,
  alt_phone TEXT,
  address TEXT,
  district TEXT,
  upazila TEXT,
  order_note TEXT,
  product_id INTEGER,
  product_name TEXT,
  package_id INTEGER,
  package_name TEXT,
  subtotal REAL DEFAULT 0,
  delivery_charge REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
  fbclid TEXT, campaign_id TEXT, adset_id TEXT, ad_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  source_url TEXT,
  field_count INTEGER DEFAULT 0,          -- how many fields filled
  status TEXT DEFAULT 'incomplete',       -- incomplete, contacted, converted, discarded
  admin_note TEXT,
  order_id INTEGER,                        -- linked order if converted
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_incomplete_status ON incomplete_orders(status);
CREATE INDEX IF NOT EXISTS idx_incomplete_phone ON incomplete_orders(phone);
CREATE INDEX IF NOT EXISTS idx_incomplete_created ON incomplete_orders(created_at);

-- Hero banner slider images (admin managed, multiple, sortable)
CREATE TABLE IF NOT EXISTS hero_banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_banners_active ON hero_banners(is_active, sort_order);

-- New pixel-related settings (safe defaults)
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('meta_test_event_code', '', 'tracking'),
  ('meta_advanced_matching', '1', 'tracking'),
  ('banner_autoplay_seconds', '4', 'content');
