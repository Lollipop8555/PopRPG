# Phase C — 收尾（视觉 / 部署）

> **里程碑范围**：手绘视觉打磨 / GitHub Pages 部署（贯穿各阶段，本文件集中收尾项）。
> **上层索引**：[`../TASK.md`](../TASK.md)　**设计依据**：[`../docs/design/08-deploy.md`](../docs/design/08-deploy.md)(§9 部署/§10 视觉)（索引见 [`../docs/DESIGN.md`](../docs/DESIGN.md)）　**前置**：A / B 主体完成。

---

## C1 部署（M0 已完成骨架）

- [x] Vite `base: './'`
- [x] `.github/workflows/deploy.yml` → `gh-pages`
- [ ] 手写体字体自托管（`.woff2` 放 `/public/fonts` + `@font-face`，避免外链）
- [ ] 实跑一次 CI：push 后 `gh-pages` 可访问、深链 `/build` 不 404（单页方案验证）

## C2 视觉打磨（手绘风，贯穿）

- [x] 纸张主题（SVG `feTurbulence` 纸纹 + 手写体栈）
- [x] 手绘风：CSS 不规则圆角 + 纸纹；网格铅笔线 + 每 10 格加粗；便签/涂鸦组件
- [ ] 构建页（编辑态）视觉统一：面板/模式条/属性表单手绘化一致
- [ ] 游玩态视觉打磨（战斗/骰子/状态 UI 手绘化）
- [ ] 骰子公示组件：手绘转盘 / 幸运转盘点击投掷，结果可读

## C3 收尾自检

- [ ] 构建页导出的 `.pmod` 能被游玩页加载开玩（A→B 串联）
- [ ] 移动端 `≤880px` 布局（抽屉 + 底部模式条）实测无破版
- [ ] 刷新/重开数据不丢失（库、项目、`.psave` 各自持久化）
- [x] README / 上手说明（**根 [`../README.md`](../README.md) 已建**；另含根 [`../Guide.md`](../Guide.md) 与 [`../guide/`](../guide/) 格式手册，2026-10-08 落盘）

> 全链路（基座→BUILD→PLAY→收尾）完成后，本项目里程碑闭环。

---

## 进度同步

**2026-10-09 · Phase C 回填（部署骨架 / 视觉基调 / 文档缺失补正）**
- **本档补「进度同步」段**：本文件为 `task/` 下唯一缺该段的档（`00` / `01` / `04` / `05` / `06` 均有，`02` 之进度记录见文件末尾「Phase B 实现完成」整段）。此前 Phase C 已多次落盘却无登记，现按实据补正。
- **C1 部署（部分完成）**：Vite [`base: './'`](../index.html) 与 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) 骨架已落地；**手写体字体自托管未做**——仓库无 `public/` 目录、无 `@font-face`、无外部字体外链（`googleapis` / `gstatic` 均无），字体全部经 [`src/styles/theme.css`](../src/styles/theme.css) 的 `var(--font-cn)` / `var(--font-hand)` / `var(--font-ui)` 回退**系统字体栈**，故 C1-3 项保持未勾（与裁决 / [`docs/design/08-deploy.md`](../docs/design/08-deploy.md) §9 的「自托管优先」口径一致，属**设计待定**而非遗漏）；CI 实跑（C1-4）未做。
- **C2 视觉（部分完成）**：纸张主题（SVG `feTurbulence` 纸纹 ＋ 手写体栈）与手绘风（CSS 不规则圆角、纸纹、铅笔格）已落地（[`src/styles/theme.css`](../src/styles/theme.css) / [`src/styles/play.css`](../src/styles/play.css) / [`src/styles/layout.css`](../src/styles/layout.css)）；编辑态一致化、游玩态打磨、骰子公示组件三项未收口。
- **C3 自检（部分完成）**：根 [`../README.md`](../README.md)（284 行，含流程图 / 版本表 / 快速上手）与 [`../Guide.md`](../Guide.md)、[`../guide/pmod.md`](../guide/pmod.md) / [`../guide/pp.md`](../guide/pp.md) 于 2026-10-08 落盘，故 C3-4 改勾并加备注；A→B 串联（C3-1）与移动端实测（C3-2）未执行。本轮为 C3-4 补正、未触碰其余项。
- **未改 `src/` 代码；本档仅补登记。**
