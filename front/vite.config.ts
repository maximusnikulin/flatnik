import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // .env общий на весь монорепозиторий и лежит в корне (его же читают
  // docker compose и back) — поэтому поднимаемся на уровень выше.
  envDir: '..',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // В dev обращения к /api уходят в NestJS, поэтому CORS не нужен
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
