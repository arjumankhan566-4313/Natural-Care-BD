-- Pixel host lock: allow the Worker's own workers.dev URL (2026-09-05).
--
-- The new Worker is served at `natural-care-bd.<random-account-subdomain>.workers.dev`, but
-- the default allowlist (naturalcarebangladesh.shop, natural-care-bd.pages.dev, localhost,
-- 127.0.0.1) did NOT include workers.dev — so every visit through the workers.dev URL had
-- the browser Pixel base-code suppressed and every CAPI event skipped ("host ... not in
-- meta_pixel_allowed_hosts"). Subdomain matching in isPixelHostAllowed() means the single
-- entry `workers.dev` covers ANY *.workers.dev host.
--
-- This migration appends `workers.dev` to an existing allowlist row (preserving whatever
-- extra hosts the admin already added) and only if it isn't already present. If the row is
-- missing entirely, the code falls back to DEFAULT_PIXEL_ALLOWED_HOSTS (which now also
-- includes workers.dev) — but we insert it explicitly so the admin form prefills correctly.

INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('meta_pixel_allowed_hosts',
   'naturalcarebangladesh.shop,natural-care-bd.pages.dev,localhost,127.0.0.1,workers.dev',
   'tracking');

UPDATE settings
SET value = replace(value, ' ', '') || ',workers.dev'
WHERE key = 'meta_pixel_allowed_hosts'
  AND instr(',' || replace(value, ' ', '') || ',', ',workers.dev,') = 0;
