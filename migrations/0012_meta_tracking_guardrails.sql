-- Durable diagnostics for Meta Pixel/CAPI contract violations and automatic fallbacks.
-- The event pipeline also writes every warning to Workers console logs immediately.
CREATE TABLE IF NOT EXISTS tracking_diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  code TEXT NOT NULL,
  source TEXT NOT NULL,
  event_name TEXT,
  event_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_created
  ON tracking_diagnostics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_code_created
  ON tracking_diagnostics(code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_diagnostics_event_id
  ON tracking_diagnostics(event_id);
