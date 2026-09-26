import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让资源走相对路径，GitHub Pages 项目页/自定义域都能直接用，无需配置仓库名。
export default defineConfig({
  base: './',
  plugins: [react()],
});
