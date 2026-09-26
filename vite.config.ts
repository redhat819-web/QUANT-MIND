/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // 변경 시 playwright.config.ts의 baseURL도 함께 수정할 것
  base: '/QUANT-MIND/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: true,
  },
})
