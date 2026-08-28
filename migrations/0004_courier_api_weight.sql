-- Courier API integration: weight + consignment tracking
ALTER TABLE courier_transfers ADD COLUMN weight REAL DEFAULT 0;
ALTER TABLE courier_transfers ADD COLUMN consignment_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN consignment_id TEXT DEFAULT '';

-- Ensure Steadfast courier has correct API base URL + tracking template
UPDATE couriers SET
  base_url = CASE WHEN base_url IS NULL OR base_url = '' THEN 'https://portal.packzy.com/api/v1' ELSE base_url END,
  tracking_url_template = CASE WHEN tracking_url_template IS NULL OR tracking_url_template = '' THEN 'https://steadfast.com.bd/t/{tracking_id}' ELSE tracking_url_template END,
  has_api = 1
WHERE (name LIKE '%Steadfast%' OR name LIKE '%steadfast%' OR name LIKE '%স্টেডফাস্ট%') AND is_deleted = 0;
