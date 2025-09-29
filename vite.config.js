// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ❗️ REPO_ADI'ni github’daki repo adınla AYNI yap
export default defineConfig({
  plugins: [react()],
  base: '/', // örn: '/algoritma-akis/'
})
