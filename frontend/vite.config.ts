import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: '/tecnico/',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Facylitech Técnico',
        short_name: 'Facylitech',
        description: 'Papeleta digital y agenda para técnicos de terreno',
        start_url: '/tecnico/',
        scope: '/tecnico/',
        display: 'standalone',
        background_color: '#f4f4f2',
        theme_color: '#0d1b2a',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // RNF-02: con mala señal se muestran los últimos datos en vez de una pantalla rota.
        // Solo GET (las escrituras nunca se cachean); la red manda si responde en 6 s.
        // Auth: la caché `api-get` guarda datos del usuario con sesión, así que NO se cachea
        // `/auth/*` y la app la vacía (con `evidencias`) al cerrar sesión y al iniciar otra
        // (src/auth/limpiarCaches.ts). No se varía por `Authorization`: workbox no indexa por
        // header y vaciar al cambiar de sesión es más simple y no deja datos ajenos en el celular.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.includes('/api/v1/') &&
              !url.pathname.includes('/api/v1/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-get',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'evidencias',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
