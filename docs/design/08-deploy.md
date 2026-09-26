# PopRPG 设计文档 — 模块：08-deploy

> 本文件从原 `DESIGN.md` 按章节切片而来，作为独立模块阅读。文中交叉引用保留原章节号（如 §4.8），可在根 `DESIGN.md` 索引的「章节→模块映射」查到对应文件。

## 9. 部署（GitHub Pages）

- **纯静态 SPA，无后端、无服务端能力**。所有数据走 `localStorage` + 浏览器文件导入/导出（`Blob` 下载 / `<input type="file">` 读取），不依赖任何服务器接口。
- 构建：`npm run build` 产出 `dist/`（HTML/JS/CSS/字体），可直接静态托管。
- **base 路径**：Vite `base` 设为仓库项目页路径（如 `/<repo>/`）或自定义域；用项目页必须配置，否则资源 404。
- **路由**：优先单页（用视图状态切换 Build/Play，不用 URL 路由），从根本避免 GH Pages 深链 404；若确需路由用 `HashRouter`。
- **依赖边界**：仅使用能**打包进静态产物**的库（React / Vite / Zustand / lucide-react / 解析库）。不使用任何需要运行时服务器的组件、SSR、服务端存储、外部 API。
- **字体**：手写体优先**自托管**（`.woff2` 放进仓库 `/public/fonts` 并用 `@font-face` 引用），避免运行时依赖外部 CDN，也保证离线可用；如接受外部 CDN 也可用 Google Fonts，但非必须。
- 可选：`.github/workflows/deploy.yml` 用 GitHub Actions 构建并发布到 `gh-pages` 分支（纯配置，不引入服务器）。

## 10. 视觉风格（纸张 + 手绘）

- **整体基调**：暖色纸张（米黄 / 羊皮纸），模拟纸纹与手绘。
- **纸纹**：内联 SVG `feTurbulence` 噪声滤镜做颗粒质感（data URI 背景），叠加轻微暖色渐变；无需外部图片资源。
- **手绘线条**：边框 / 分隔 / 网格线用 SVG 位移滤镜（`feTurbulence` + `feDisplacementMap`）做出轻微抖动的不规则手绘感；或 CSS 不规则 `border-radius` + 微小旋转。避免引入 rough.js 等额外库（除非后续确认）。
- **字体**：标题 / 正文用手写体；拉丁文用 Caveat / Patrick Hand 类，中文用手写体（如马善政 / 龙藏 / 字芒行等），自托管。
- **图标**：lucide 矢量图标可套同一手绘滤镜柔化；自定义 / 内容继续用 Emoji。
- **网格**：构建态网格线呈手绘铅笔线，每 10 格加粗且略带颜色深浅变化；游玩态去网格、留细坐标参照线（同样手绘风）。
- **组件放置**：地图上的建筑 / 怪物以"贴在纸上的手绘便签 / 涂鸦"观感呈现（轻微阴影 + 不规则边）。
