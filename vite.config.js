import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Устанавливаем порт 3000
    host: true, // Разрешаем доступ извне
    strictPort: true, // Если порт 3000 занят, выдаст ошибку вместо выбора другого порта
  },
  base: "/Abrikosochka.github.io/",
})