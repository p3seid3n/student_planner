import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Runs the Vercel function locally during `npm run dev`. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ical', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/ical.ts');
        const response: Response = await mod.GET(new Request(`http://localhost${req.originalUrl}`));
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Student Planner',
        short_name: 'Planner',
        description: 'Timetable, tests, homework and grades — synced with your school calendar.',
        theme_color: '#1d1b20',
        background_color: '#141218',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Calendar', url: '/calendar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Desk mode', url: '/desk', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // only the Latin font subset is precached; other scripts load on demand
        globIgnores: ['**/roboto-flex-{cyrillic,cyrillic-ext,greek,vietnamese,latin-ext}-*.woff2'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 12 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/ical'),
            handler: 'NetworkFirst',
            options: { cacheName: 'ical-feeds', networkTimeoutSeconds: 15, expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
