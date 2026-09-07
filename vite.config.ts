import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relativer Basis-Pfad, damit die App sowohl unter GitHub Pages
// (https://<user>.github.io/steigflug/) als auch lokal aus dist/ läuft.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': Bei autoUpdate übernimmt der neue
      // Service Worker zwar sofort, die offene Seite läuft aber weiter mit dem
      // alten Code — man ist stumm eine Fassung hinterher. So wird stattdessen
      // sichtbar gefragt, und niemandem bricht ein Neuladen die Eingabe ab.
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Steigflug – Miles & More Statuspunkte',
        short_name: 'Steigflug',
        description: 'Flüge eintragen, Statuspunkte berechnen, Frequent Traveller planen.',
        lang: 'de',
        theme_color: '#0b1b2b',
        background_color: '#0b1b2b',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
})
