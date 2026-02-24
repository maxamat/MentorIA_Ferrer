import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  publicDir: 'public', // Asegura que Vite copie archivos de public/ a dist/
  build: {
    assetsInlineLimit: 0 // No inline de assets grandes como videos
  }
});
