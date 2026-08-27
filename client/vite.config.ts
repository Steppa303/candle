import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3011',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2015',
    cssTarget: 'chrome61'
  }
})
