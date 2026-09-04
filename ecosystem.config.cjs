// PM2 config for running the built Worker locally (sandbox/dev only — production is `wrangler deploy`).
// Uses the same wrangler.jsonc (main + assets + D1 local + cron) as production.
module.exports = {
  apps: [
    {
      name: 'natural-care-bd',
      script: 'npx',
      args: 'wrangler dev --ip 0.0.0.0 --port 3000 --test-scheduled',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        WRANGLER_SEND_METRICS: 'false'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
