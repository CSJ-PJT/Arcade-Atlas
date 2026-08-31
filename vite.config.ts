import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/arcade/',
  plugins: [react()],
  server: {
    proxy: {
      '/arcade/ws': { target: 'ws://127.0.0.1:4188', ws: true, rewrite: () => '/ws' },
    },
  },
  preview: {
    proxy: {
      '/arcade/ws': { target: 'ws://127.0.0.1:4188', ws: true, rewrite: () => '/ws' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.mjs'],
    css: true,
  },
})
