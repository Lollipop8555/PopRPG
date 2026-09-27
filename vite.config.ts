import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 静态部署配置要点：
// 1. base 用相对路径 './' —— 项目页（https://<user>.github.io/<repo>/）无需知道仓库名，
//    本地 dev / preview 与线上产物完全同构，不会因为仓库改名而 404。
// 2. 路由走 hash（见 src/app/router.tsx）—— GitHub Pages 没有 SPA rewrite，
//    深链到 /build 会 404；hash 路由天然无此问题。
// 3. 产物纯静态：无 SSR、无服务端中间层、无运行时外部接口。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
