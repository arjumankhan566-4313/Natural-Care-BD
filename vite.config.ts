import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  // Allow any host (preview tunnels / sandbox URLs) — the Meta Pixel itself is protected
  // separately by the host lock (meta_pixel_allowed_hosts), so this does not affect ads.
  server: { allowedHosts: true },
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
