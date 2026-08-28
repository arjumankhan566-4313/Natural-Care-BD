-- Branding assets (logo, favicon, BSTI certificate) uploaded from admin panel
CREATE TABLE IF NOT EXISTS assets (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New settings keys
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('brand_logo', '', 'brand'),
  ('favicon_url', '', 'brand'),
  ('bsti_enabled', '1', 'content'),
  ('bsti_title', 'BSTI অনুমোদিত পণ্য', 'content'),
  ('bsti_description', 'আমাদের প্রোডাক্ট বাংলাদেশ স্ট্যান্ডার্ডস অ্যান্ড টেস্টিং ইনস্টিটিউশন (BSTI) কর্তৃক অনুমোদিত ও মান নিয়ন্ত্রিত।', 'content'),
  ('bsti_certificate_image', '', 'content');

-- Set default logo/favicon where empty
UPDATE settings SET value = '/static/logo-small.png' WHERE key = 'brand_logo' AND (value IS NULL OR value = '');
UPDATE settings SET value = '/static/favicon.png' WHERE key = 'favicon_url' AND (value IS NULL OR value = '');
