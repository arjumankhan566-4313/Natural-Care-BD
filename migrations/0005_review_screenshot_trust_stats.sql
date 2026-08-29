-- Review screenshot support + Trust/social-proof stats section
ALTER TABLE reviews ADD COLUMN screenshot_url TEXT;

-- Trust stats settings (admin-editable "কেন আমাদের বিশ্বাস করবেন" strip)
-- NOTE: numbers below are placeholders — admin MUST update with real figures before going live.
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('trust_stats_enabled', '0', 'trust'),
  ('trust_stats_title', 'হাজারো কাস্টমারের আস্থা আমাদের সাথে', 'trust'),
  ('trust_stat1_number', '10,000+', 'trust'),
  ('trust_stat1_label', 'সন্তুষ্ট কাস্টমার', 'trust'),
  ('trust_stat1_icon', 'fa-users', 'trust'),
  ('trust_stat2_number', '15,000+', 'trust'),
  ('trust_stat2_label', 'সফল ডেলিভারি', 'trust'),
  ('trust_stat2_icon', 'fa-box-open', 'trust'),
  ('trust_stat3_number', '৪.৮/৫', 'trust'),
  ('trust_stat3_label', 'গড় রেটিং', 'trust'),
  ('trust_stat3_icon', 'fa-star', 'trust'),
  ('trust_stat4_number', '৩+ বছর', 'trust'),
  ('trust_stat4_label', 'বিশ্বাসের সাথে সেবা', 'trust'),
  ('trust_stat4_icon', 'fa-award', 'trust');
