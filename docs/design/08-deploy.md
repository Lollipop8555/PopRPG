# PopRPG 设计文档 — 模块：08-deploy

> 本文件从原 `DESIGN.md` 按章节切片而来，作为独立模块阅读。文中交叉引用保留原章节号（如 §4.8），可在根 `DESIGN.md` 索引的「章节→模块映射」查到对应文件。

## 9. 部署（GitHub Pages）

- **纯静态 SPA，无后端、无服务端能力**。所有数据走 `localStorage` + 浏览器文件导入/导出（`Blob` 下载 / `<input type="file">` 读取），不依赖任何服务器接口。
  - **二进制资产的例外（裁决 15）**：皮肤包 `.pp` 等二进制走 **IndexedDB**（`localStorage` 只能存字符串、且配额约 5 MB，不适合包体；base64 还会额外膨胀三分之一）；条目索引等小体量 JSON 仍在 `localStorage`。仍无后端、仍离线可用，见 [`design/skin/00-package.md`](design/skin/00-package.md) §4.4。
- 构建：`npm run build` 产出 `dist/`（HTML/JS/CSS/字体），可直接静态托管。
- **base 路径**：Vite `base` 设为仓库项目页路径（如 `/<repo>/`）或自定义域；用项目页必须配置，否则资源 404。
- **路由**：优先单页（用视图状态切换 Build/Play，不用 URL 路由），从根本避免 GH Pages 深链 404；若确需路由用 `HashRouter`。
- **依赖边界**：仅使用能**打包进静态产物**的库（React / Vite / Zustand / lucide-react / 解析库 / **`fflate`**）。不使用任何需要运行时服务器的组件、SSR、服务端存储、外部 API。
  - **zip 能力（裁决 14）**：`.pp` / `.pgame` 的读写统一由 **`fflate`** 承担（约 8 KB gzip，浏览器端零 Node 依赖）；不自实现 deflate，也不引入需要 Node 内置模块或服务端的 zip 库。GH Pages 下与其它 npm 依赖同等对待——打进产物，不在运行时请求外部地址。
- **字体**：手写体优先**自托管**（`.woff2` 放进仓库 `/public/fonts` 并用 `@font-face` 引用），避免运行时依赖外部 CDN，也保证离线可用；如接受外部 CDN 也可用 Google Fonts，但非必须。
- 可选：`.github/workflows/deploy.yml` 用 GitHub Actions 构建并发布到 `gh-pages` 分支（纯配置，不引入服务器）。

## 10. 视觉风格（已前置）

> 视觉风格（纸张 + 手绘 + 涂鸦）作为**全局基调**已前置到 [`design/00b-style.md`](design/00b-style.md)。所有 UI 任务（构建页 / 游玩页 / 面板 / 按钮 / 网格 / 地图组件）开工前必读该模块，本处不再重复定义。
