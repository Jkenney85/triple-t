import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const backend = 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // A separate registerSW.js file (not an inline script) keeps strict CSPs happy.
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        name: 'Triple T — TikTok Tracker',
        short_name: 'Triple T',
        description: 'Kanban board for tracking TikTok Shop products',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1d2125',
        theme_color: '#5b4bdb',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell only. API calls, thumbnails and websockets always hit the network.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/healthz/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/healthz': backend,
      '/socket.io': { target: backend, ws: true },
    },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
