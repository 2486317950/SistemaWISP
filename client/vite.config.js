import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // En producción servimos el SPA principal bajo /sistema,
  // pero también lo usamos para /portal e /investor.
  // Los assets se referencian desde /sistema/assets/...
  base: process.env.NODE_ENV === 'production' ? '/sistema/' : '/',
  build: {
    sourcemap: false
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Permitir acceso desde la red local
    allowedHosts: [
      'sistemacdcom.ngrok.dev',
      '.ngrok.dev',
      '.ngrok-free.app',
      'localhost'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})

