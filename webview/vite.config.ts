import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/', // This prefix matches the static assets route in your TPA
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['live-translation.ngrok.dev', 'isaiah-webview.ngrok.app', 'localhost', 'translation.mentra.glass'],
  },
  preview: {
    allowedHosts: ['live-translation.ngrok.dev', 'isaiah-webview.ngrok.app', 'localhost', 'translation.mentra.glass', "https://webview-10410-4a24a192-ojqv695t.onporter.run"],
  },
})