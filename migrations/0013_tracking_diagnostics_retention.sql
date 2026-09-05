-- Keep operational diagnostics useful and bounded. A given event/code/source is recorded once,
-- and old entries are pruned automatically whenever a new diagnostic arrives.
DELETE FROM tracking_diagnostics
WHERE event_id IS NOT NULL
  AND id NOT IN (
    SELECT MAX(id) FROM tracking_diagnostics
    WHERE event_id IS NOT NULL
    GROUP BY source, code, event_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_diagnostics_event_code_source
  ON tracking_diagnostics(source, code, event_id)
  WHERE event_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_tracking_diagnostics_retention
AFTER INSERT ON tracking_diagnostics
BEGIN
  DELETE FROM tracking_diagnostics
  WHERE created_at < datetime('now', '-90 days');
END;
