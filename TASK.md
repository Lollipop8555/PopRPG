# PopRPG 任务清单 (TASK.md)

> **如何使用本文件**：每次开始工作前先读 [`docs/DESIGN.md`](docs/DESIGN.md)（设计依据）和本文件（当前该做什么）。
> 每完成一项，把对应 `[ ]` 改成 `[x]` 并简短备注。上下文丢失时，本文件 + DESIGN.md 即可恢复进度。
>
> **铁律**：§8 已确认决策不要擅自改；要改先和用户确认。

---

## 当前阶段：MVP — 构建闭环（Build Closure）

目标：能建项目、摆组件、画地图、导出/导入 `.pmod`，形成 round-trip 闭环。

---

## 已完成

- [x] 产品定位 / 技术栈 / 文件格式 / 数据模型 / 编辑器设计 对齐（讨论）
- [x] 写 `docs/DESIGN.md`（设计文档）
- [x] 补 `README.md`

---

## 待办（MVP）

### 1. 脚手架
- [ ] 初始化 React + TS + Vite 项目（目录结构、`index.html`、`vite.config.ts`、`tsconfig`）
- [ ] 安装依赖：`zustand`、`lucide-react`、`remark` / 轻量 Markdown 解析（导入用）
- [ ] 三栏布局骨架（顶栏 / 左套件面板 / 中地图 / 右属性）
- [ ] Zustand store：`project` 根对象 + 各实体增删改

### 2. 数据模型与序列化
- [ ] 定义 TS 类型：`Monster / Class / Item(equipment|consumable) / Building(encounter+mimic) / Road / Map / Project`
- [ ] 导出 `.pmod`：拼 Markdown + ```` ```yaml ```` 围栏（严格对照 DESIGN §3）
- [ ] 导入 `.pmod`：解析还原为内存模型（round-trip 无丢失）
- [ ] localStorage 自动保存 / 读取（单项目单例）

### 3. 套件面板（左栏）
- [ ] 六大分组折叠面板：背景 / 怪物 / 道具 / 建筑 / 道路 / 职业
- [ ] 组件列表展示（预设 lucide 图标；自定义 Emoji/分类图标）+ 选中态
- [ ] DIY 新建 / 编辑表单（按分类渲染字段）
- [ ] 属性编辑分支：道具 `kind` 切换（装备=槽位+五维加值 / 消耗品=usable+effects）；建筑 `encounter` + 勾选"宝箱怪物"展开 mimic

### 4. 地图画布（中栏）
- [ ] 网格 + 每 10 格加粗线 + 中心 `[0, 0]`（坐标域 `[-10000, 10000]`）
- [ ] 平移（拖空白）/ 缩放（滚轮/按钮，视口虚拟化，只渲可见格）
- [ ] 放置交互：先做"点选组件 → 点格放置"（拖拽后续）
- [ ] 起 / 终点标记 + 每张图强制唯一校验
- [ ] 节点删除
- [ ] 多地图 Tab：增删 / 切换 / 排序

### 5. 最小预设（开箱即玩）
- [ ] 怪物：哥布林、史莱姆
- [ ] 道具：红瓶（consumable, hp）、蓝瓶（consumable, mp）、铁剑（equipment, weapon, patk）
- [ ] 建筑：宝箱屋（treasure + mimic 示例）
- [ ] 道路：小路
- [ ] 职业：骑士、法师（含 buff 示例）

### 6. 验收
- [ ] 导出 `.pmod` 文件内容符合 DESIGN §3 结构
- [ ] 重新导入后与导出前编辑器状态一致（round-trip）
- [ ] 刷新页面数据不丢失

---

## 后续阶段（Backlog，非 MVP，未动工）

- **游玩态**：去网格线留坐标参照；正交移动（对角线不可走，每步 1 格，可原路返回）；踩节点触发 treasure/monster/mimic 揭晓；简化战斗（五维 + 职业 buff）；装备穿戴（多槽/挤占规则）；消耗品在对战/前进使用；开局按 `class_pool` 随机/固定职业
- **骰子系统**：预设全类型（d4/d6/d8/d10/d12/d20/d100）；组件自带合适骰子；转盘/幸运转盘 UI；点击投掷
- **`.psave` 进度存档**：与 `.pmod` 分离，存已揭晓奖励/骰子结果/位置，支持多周目
- **首页 / 多项目管理**：项目列表、打开/切换（目前 localStorage 单例）
- **丰富预设库**：专项补充更多怪物/道具/建筑/职业（MVP 仅最小可用）

---

## 关键约定 / 决策速查（详见 DESIGN §8）

- 技术栈：React+TS+Vite + Zustand + lucide/Emoji
- 文件格式：散文 Markdown + ```` ```yaml ```` 围栏
- 存档分离：`.pmod` 仅场景；进度存 `.psave`（后续）
- MVP：先构建闭环（不做游玩/骰子/多项目）
- 宝箱怪物 = 宝箱屋的可选 `mimic` 属性（概率伪装，战胜有奖）
- 放置交互：先点选→点格，拖拽后续
- 数值：五维 hp/patk/matk/pdef/mdef；装备占 头手脚身武 槽；消耗品改数值
- 部署：GitHub Pages 纯静态，**无后端**；仅用可打包进静态产物的库；字体自托管
- 视觉：纸张质感 + 手绘风格（暖色纸纹 / 手绘线条 / 手写体，尽量不引额外库）

---

## 约束：纯静态，无服务器（GitHub Pages）

- **禁止**任何需要运行服务器的能力：后端 API、SSR、服务端存储、外部在线接口。
- 数据只走 `localStorage` + 浏览器文件导入/导出（`Blob` 下载 / `<input type="file">` 读取）。
- 依赖只选能打包进 `dist/` 的库；不确定某库是否"额外/不支持"时，先确认它能纯静态打包再用。
- Vite `base` 按项目页路径配置；优先单页（视图状态切换），避免深链 404。

---

## 待办（部署 & 视觉，贯穿各阶段）

- [ ] Vite `base` 按 GitHub Pages 项目页配置（或自定义域）
- [ ] 全局纸张主题：暖色纸纹背景（内联 SVG `feTurbulence` data URI）+ 手写体字体（自托管 `@font-face`）
- [ ] 手绘线条工具：SVG 位移滤镜（`feTurbulence`+`feDisplacementMap`）或直接 CSS 不规则边，用于边框/分隔/网格
- [ ] 地图网格手绘化：构建态铅笔线网格 + 每 10 格加粗；游玩态细坐标参照线
- [ ] 组件放置观感：手绘便签/涂鸦风格（轻阴影 + 不规则边）
- [ ] 可选：`.github/workflows/deploy.yml` 自动构建发布到 `gh-pages`
