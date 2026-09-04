-- Browser-Pixel fix: create the Meta Pixel/CAPI setting rows that only ever existed in
-- seed.sql.
--
-- WHY THIS MIGRATION EXISTS
-- The production deploy pipeline (.github/workflows/deploy.yml) runs
-- `wrangler d1 migrations apply --remote` and never runs seed.sql, so on the live database
-- these keys simply did not exist. The most damaging one is `meta_events_enabled`: it is
-- the ONLY gate on the browser Pixel (public/static/landing.js only calls
-- window.fbq('track', ...) for names listed in it) and the server-side CAPI path never
-- reads it. With the row absent -- or saved empty from the admin form, which prefilled
-- nothing -- the browser pixel went completely silent for PageView/ViewContent/
-- InitiateCheckout/Lead/Purchase while CAPI kept sending every one of them. Meta therefore
-- showed server-only events and flagged them as "not deduplicated".
--
-- INSERT OR IGNORE is deliberate: it fills in ONLY missing keys and never overwrites a
-- value an admin has already configured (Pixel ID, token, allowlist, ...).
--
-- The application code no longer depends on these rows being present -- effectiveMetaEvents()
-- in src/lib/helpers.ts and the fail-open allowlist in public/static/landing.js both treat a
-- missing/blank value as "all standard events". This migration just makes the stored state
-- correct and the admin form prefill sensibly instead of blank.
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('meta_pixel_id', '', 'tracking'),
  ('meta_pixel_enabled', '0', 'tracking'),
  ('meta_events_enabled', 'PageView,ViewContent,InitiateCheckout,Lead,Purchase', 'tracking'),
  ('meta_capi_token', '', 'tracking'),
  ('meta_capi_enabled', '0', 'tracking'),
  ('meta_pixel_host_lock', '1', 'tracking'),
  ('meta_pixel_allowed_hosts', 'naturalcarebangladesh.shop,natural-care-bd.pages.dev,localhost,127.0.0.1', 'tracking');
