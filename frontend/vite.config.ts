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
        background_color: '#f3f4f6',
        theme_color: '#1e2a78',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
