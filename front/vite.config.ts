import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // .env общий на весь монорепозиторий и лежит в корне (его же читают
  // docker compose и back) — поэтому поднимаемся на уровень выше.
  envDir: '..',
  server: {
    // true = 0.0.0.0: иначе порт не виден за пределами контейнера.
    host: true,
    port: Number(process.env.FRONT_PORT) || 5173,
    // За гейтвеем Host приходит чужой — адрес гейтвея или домен туннеля,
    // который меняется при каждом рестарте. Без этого vite отвечает 403.
    allowedHosts: true,
    watch: {
      // Инотифай-события не проходят через bind-mount с macOS в контейнер,
      // поэтому в Docker переключаемся на опрос.
      usePolling: true,
    },
    // Ни proxy, ни hmr здесь не задаются намеренно. /api до vite не доходит —
    // его забирает гейтвей, он же держит front и back на одном origin. Клиент
    // HMR берёт хост и порт сокета из адреса страницы, то есть из гейтвея,
    // и через HTTPS-туннель сам уходит на wss; переопределение это сломает.
  },
})
