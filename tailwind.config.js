/** Tailwind config — scans server-rendered HTML (src) and client-rendered JS templates (public/static)
 *  so the production build only ships the utility classes actually used across the site. */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './public/static/*.js'
  ],
  safelist: [
    // Classes toggled dynamically via string concatenation that the scanner may miss
    'opacity-100', 'opacity-0', 'z-10', 'z-0', 'bg-white', 'bg-white/50',
    'active', 'bg-emerald-500', 'bg-gray-200', 'text-gray-900', 'text-gray-400',
    'bg-red-500', 'bg-emerald-600', 'bg-emerald-700', 'text-white', 'bg-gray-100'
  ],
  theme: {
    extend: {}
  },
  plugins: []
}
