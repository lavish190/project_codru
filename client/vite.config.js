import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 🚨 The Updated PWA Plugin configuration
    VitePWA({
      strategies: 'injectManifest', // Tells Vite: "I have my own Service Worker!"
      srcDir: 'src',                // Look in the 'src' folder
      filename: 'sw.js',            // The file is named 'sw.js'
      registerType: 'autoUpdate', 
      includeAssets: ['favicon.png', 'logo192.png', 'logo512.png'], 

      manifest: {
        name: 'Curious Team Learning Dashboard',
        short_name: 'CuTe Learning',
        description: 'The Curious Team Learning Platform',
        theme_color: '#ffffff',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: '/logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      // 🚨 Renamed from 'workbox' to 'injectManifest'
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10000000
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10000000, // 10 MB
      },
      devOptions: {
        enabled: true, 
        type: 'module' // 🚨 Crucial for custom Service Workers in Dev mode!
      }
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "https://codru-server.vercel.app/api",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), 
        secure: true,
      },
    },
  },
});