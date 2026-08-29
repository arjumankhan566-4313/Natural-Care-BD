-- Font Checker: optional custom Google Font family name applied site-wide
-- (landing page + admin panel). Empty string = use the default Hind Siliguri font.
INSERT OR IGNORE INTO settings (key, value, category, is_secret) VALUES
  ('custom_font_family', '', 'appearance', 0);
