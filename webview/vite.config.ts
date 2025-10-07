import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import tailwindcss from '@tailwindcss/vite'
import Terminal from 'vite-plugin-terminal'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), 
    react(),
    Terminal({
      output: ['terminal', 'console']
    })
  ],
  base: '/', // This prefix matches the static assets route in your TPA
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['live-translation.ngrok.dev', 'isaiah-webview.ngrok.app', 'webview.ngrok.dev', 'localhost', 'translation.mentra.glass', 'translation-app.ngrok.app', 'webview-11555-4a24a192-lcc2p59i.onporter.run'],
  },
  preview: {
    allowedHosts: ['live-translation.ngrok.dev', 'isaiah-webview.ngrok.app', 'webview.ngrok.dev', 'localhost', 'translation.mentra.glass', "https://webview-10410-4a24a192-ojqv695t.onporter.run", ' webview-11555-4a24a192-lcc2p59i.onporter.run'],
  },
})