/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, process.cwd(), '').VITE_RECORDS_API_URL || 'http://127.0.0.1:8011'
  const proxy = { '/api': { target, rewrite: (path: string) => path.replace(/^\/api/, '') } }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
