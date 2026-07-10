import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icons.svg",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],
      manifest: {
        name: "S21 Salon Management System",
        short_name: "S21 Salon",
        description:
          "S21 Salon & Spa ERP - POS, Bookings, Payroll & Inventory",
        theme_color: "#1a1a2e",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/login",
        icons: [
          {
            src: "favicon.svg",
            sizes: "48x48 72x72 96x96 128x128 256x256",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/login/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
