-- SMS gateway integration: generic template-based sender + delivery log.
-- The admin configures ANY BD SMS gateway (bulksmsbd.net, Alpha SMS, Mimsms,
-- ADN Telecom, etc.) by pasting that provider's own GET-based send-SMS URL as
-- a template into sms_api_url_template, using the placeholders {phone},
-- {message}, {api_key}, {sender_id}. Until sms_enabled='1' and the URL/API
-- key are filled in, sendSms() silently no-ops — nothing breaks.
CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  event_type TEXT DEFAULT '',
  success INTEGER DEFAULT 0,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_order ON sms_logs(order_id);

INSERT OR IGNORE INTO settings (key, value, category, is_secret) VALUES
  ('sms_enabled', '0', 'sms', 0),
  ('sms_provider_name', '', 'sms', 0),
  ('sms_api_url_template', '', 'sms', 1),
  ('sms_api_key', '', 'sms', 1),
  ('sms_sender_id', '', 'sms', 0),
  ('sms_on_order_enabled', '1', 'sms', 0),
  ('sms_on_order_template', 'প্রিয় {name}, আপনার অর্ডার #{order_number} সফলভাবে গ্রহণ করা হয়েছে। মোট: ৳{total} (COD)। ধন্যবাদ — {brand}', 'sms', 0),
  ('sms_on_courier_enabled', '1', 'sms', 0),
  ('sms_on_courier_template', 'প্রিয় {name}, আপনার অর্ডার #{order_number} কুরিয়ারে পাঠানো হয়েছে। ট্র্যাকিং: {tracking_id}। ধন্যবাদ — {brand}', 'sms', 0),
  ('sms_on_delivered_enabled', '1', 'sms', 0),
  ('sms_on_delivered_template', 'প্রিয় {name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। আমাদের সাথে থাকার জন্য ধন্যবাদ — {brand}', 'sms', 0);
