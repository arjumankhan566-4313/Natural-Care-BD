-- Steadfast Auto Status Sync — schema additions
-- Reuses existing orders.consignment_id / orders.tracking_id (order_number IS the invoice
-- sent to Steadfast's create_order call — see admin-orders.ts /transfer handler), so we do
-- NOT duplicate those. Only add the fields that don't already exist.

ALTER TABLE orders ADD COLUMN courier_status TEXT DEFAULT '';           -- raw Steadfast delivery_status (e.g. 'in_review','delivered')
ALTER TABLE orders ADD COLUMN courier_status_label TEXT DEFAULT '';     -- Bangla friendly label, derived from courier_status
ALTER TABLE orders ADD COLUMN courier_last_synced_at DATETIME;          -- last time we successfully talked to the courier API
ALTER TABLE orders ADD COLUMN courier_sync_error TEXT DEFAULT '';       -- last error message (kept until next successful sync)
ALTER TABLE orders ADD COLUMN courier_sync_attempts INTEGER DEFAULT 0;  -- consecutive failed attempts (reset to 0 on success)

-- Every *actual* courier status change (old != new) gets one row here — used for the
-- Admin Panel "Status History" timeline and the sync dashboard counters.
CREATE TABLE IF NOT EXISTS courier_status_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  courier TEXT NOT NULL,          -- e.g. 'Steadfast'
  old_status TEXT,
  new_status TEXT NOT NULL,
  raw_status TEXT,                -- exact string returned by the courier API (== new_status here, kept for forward-compat)
  source TEXT NOT NULL DEFAULT 'api', -- 'api' (auto/manual poll) — never 'manual_edit', admin cannot type a fake status
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_courier_status_logs_order ON courier_status_logs(order_id);

-- Lightweight lock row to prevent two overlapping sync batches (Cloudflare Workers are
-- single-threaded per request, but two admin requests can still race). One row, id=1.
CREATE TABLE IF NOT EXISTS courier_sync_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked_at DATETIME,
  last_run_at DATETIME,
  last_run_stats TEXT DEFAULT ''  -- JSON: {checked, updated, errors}
);
INSERT OR IGNORE INTO courier_sync_lock (id, locked_at, last_run_at) VALUES (1, NULL, NULL);
