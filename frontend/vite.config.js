import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:6501'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,  // lo registramos manualmente en main.jsx para usar workbox-window
      includeAssets: ['favicon.svg'],
      manifest: {
        id: 'cl.miespejo.calmar',
        name: 'Calmar · Agendamiento',
        short_name: 'Calmar',
        description: 'Reservá con médicos y psicólogos verificados en minutos. Presencial o videollamada.',
        theme_color: '#4f46e5',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es-CL',
        categories: ['health', 'medical', 'lifestyle'],
        icons: [
          // SVG funciona en Android/Chrome/Edge/Firefox. iOS fall-back: apple-touch-icon en index.html.
          // Si después generás PNGs reales (192/512), simplemente agrégalos a /public/icons/ y
          // agregá las entradas correspondientes acá.
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Mis citas',
            short_name: 'Citas',
            url: '/patient/appointments',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
          {
            name: 'Diario emocional',
            short_name: 'Diario',
            url: '/patient/mood',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
          {
            name: 'Buscar profesional',
            short_name: 'Buscar',
            url: '/patient/search',
            icons: [{ src: '/favicon.svg', sizes: 'any' }],
          },
        ],
      },
      workbox: {
        // Solo cachear app shell — datos de API siempre frescos
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/metrics/, /^\/health/],
        runtimeCaching: [
          // Las llamadas a /api/ usan estrategia network-first con fallback a cache
          {
            urlPattern: /^\/api\/.+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'calmar-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24, // 1 día
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fonts externas
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,  // requiere acción del usuario para actualizar (mejor UX)
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 6500,
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true }
    }
  }
})
