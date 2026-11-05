import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // we ship our own public/manifest.json
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        // If network is slow, fall back to cache fast instead of hanging
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Entry/media API: fast offline + slow-network fallback (5s timeout inside SW)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/entries') || url.pathname.startsWith('/api/media'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'diary-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // Allows accessing from phone via local WiFi IP
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
