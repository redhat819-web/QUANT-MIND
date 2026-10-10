import { defineConfig } from 'vitest/config'

/** 실제 Supabase 대상 통합 테스트(tests/integration). npm test에는 포함되지 않는다 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
