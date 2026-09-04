-- Browser-Pixel FAIL-OPEN (2026-09-05): turn the browser Pixel ON wherever a Pixel ID is
-- already configured.
--
-- WHY THIS MIGRATION EXISTS
-- Migration 0009 seeded `meta_pixel_enabled = '0'`, and the code gated the browser Pixel
-- on `meta_pixel_enabled === '1'`. The browser Pixel is the ONLY thing gated by that flag —
-- the server-side CAPI path has its own `meta_capi_enabled` toggle. So a shop that set the
-- Pixel ID + event list (and enabled CAPI) but never noticed the separate "Pixel চালু (1/0)"
-- box got a fully working CAPI and a completely SILENT browser Pixel: the base code never
-- rendered in <head> and window.fbq() never existed. That is the exact reported symptom
-- ("CAPI working perfectly, browser pixel not firing").
--
-- The code is now fail-open (`meta_pixel_enabled !== '0'` means ON; only an explicit '0'
-- disables), so NEW saves can't hit this again. This migration repairs the EXISTING rows:
-- wherever a Pixel ID is configured, flip the stale default '0' to '1'. A shop that truly
-- wants browser-only-off (CAPI-only) can still save '0' afterwards — but a configured Pixel
-- ID + '0' is, in practice, always the silent bug, never a deliberate choice.
UPDATE settings
SET value = '1'
WHERE key = 'meta_pixel_enabled'
  AND TRIM(value) = '0'
  AND EXISTS (
    SELECT 1 FROM settings s2
    WHERE s2.key = 'meta_pixel_id'
      AND s2.value IS NOT NULL
      AND REPLACE(s2.value, ' ', '') != ''
  );
