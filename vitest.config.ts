import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * 单测配置（只影响开发期，不进 dist）：
 * - 引擎纯函数跑在 node 环境
 * - UI 冒烟用例跑在 jsdom（会用到 localStorage / DOM）
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
