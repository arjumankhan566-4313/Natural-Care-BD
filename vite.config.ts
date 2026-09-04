import build from '@hono/vite-build/cloudflare-workers'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  // Allow any host (preview tunnels / sandbox URLs) — the Meta Pixel itself is protected
  // separately by the host lock (meta_pixel_allowed_hosts), so this does not affect ads.
  server: { allowedHosts: true },
  plugins: [
    // Cloudflare Workers target: emits ./dist/index.js (the `main` in wrangler.jsonc).
    // Static files stay in ./public and are uploaded as Workers Static Assets by wrangler —
    // they are NOT copied into dist, so the Worker bundle only contains server code.
    build({
      entry: 'src/index.tsx',
      output: 'index.js',
      outputDir: './dist',
      emptyOutDir: true
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ],
  // The build plugin only serves the SSR bundle; never copy ./public into dist
  // (wrangler uploads it separately as assets).
  build: { copyPublicDir: false }
})
