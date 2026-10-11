import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const backend = 'http://localhost:3000';

/** Unique id for each production build; the server reports it so open tabs can tell they're out of date. */
const buildId = process.env.BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

/** Writes dist/version.json, which the server reads at startup. */
function versionFile(): Plugin {
  return {
    name: 'ttt-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
    },
  };
}

export default defineConfig(({ command }) => ({
  define: { __BUILD_ID__: JSON.stringify(command === 'build' ? buildId : 'dev') },
  plugins: [
    react(),
    versionFile(),
    tailwindcss(),
    VitePWA({
      // The app registers the worker itself (lib/updates.ts) so it can offer a reload when a new version is ready.
      registerType: 'prompt',
      injectRegister: false,
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
}));
