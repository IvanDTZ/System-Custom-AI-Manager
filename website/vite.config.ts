import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    // Accept any Host header (ngrok tunnels, LAN hostnames, custom domains).
    // Vite blocks unknown hosts by default as a CSRF defence — fine in pure
    // local dev, but breaks the moment we expose the dev server.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Streaming chat replies (SSE) and `ollama pull` events stay open for
        // minutes. Both timeouts default to 120s in http-proxy — disable them
        // so the proxy never closes a slow inference response mid-stream.
        timeout: 0,
        proxyTimeout: 0,
        ws: true,
      },
    },
  },
})
