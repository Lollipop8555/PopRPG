# Phase D — 素材皮肤（`.pp` / `.pgame`）与三件套

> **里程碑范围**：三件套容器（读取 / 导出 / 降级）＋ 素材取图与贴图渲染 ＋ 逐屏素材接入 ＋ Creative 模式 ＋ 皮肤校验（`KP-1`~`KP-6`）。
> **上层索引**：[`../TASK.md`](../TASK.md)　**设计依据**：[`../docs/design/00a-formats.md`](../docs/design/00a-formats.md)（三件套**上位规范**）、[`../docs/design/skin.md`](../docs/design/skin.md) ＋ `skin/` 各分节、[`../docs/design/07-decisions.md`](../docs/design/07-decisions.md) §8.1 / §8.2
> **前置**：Phase B 主体完成（地图 / 战斗 / 面板已在游玩态渲染），端到端验证才有对象；**D0–D2 为类型、纯函数与 IO 层，可提前动工**。
> **纪律**：素材是**可选叠加层**——任何一屏缺素材都必须照常渲染（[`../docs/design/skin.md`](../docs/design/skin.md) §一）；业务代码不得判断素材类型；取图必须是纯函数。

---

## D0 类型与取图纯函数（无 IO）

- [ ] `src/types/skin.ts`：manifest 顶层 11 键——`version` / `meta` / `background` / `item` / `building` / `road` / `role` / `window` / `misc` / `pages` / `audio`（[`skin/00-package.md`](../docs/design/skin/00-package.md) §三），并在 `src/types/index.ts` 导出
- [ ] 素材字段三写法类型：`string | { img, rotate? } | string[]`；数组顺序固定 `N / E / S / W`，不得省略中间项（[`skin.md`](../docs/design/skin.md) §五）
- [ ] 衬底三元组 `background: { fill?, stroke?, img? }`，**`img` 优先于 `fill`**（`fill` 作透明区兜底）；字符串写法等价于只写 `fill`（[`skin/06-item-building.md`](../docs/design/skin/06-item-building.md) §二）
- [ ] 画布 `background` 为**数组**，按 `maps` **命中择一**（裁决 8；多层叠加见 `Q21`，未裁决前不做）（[`skin/05-canvas.md`](../docs/design/skin/05-canvas.md)）
- [ ] 取图纯函数置于 `src/engine/skin/`：`(格子状态, 素材表) → 素材标识 | 程序绘制形态`，无副作用、可单测（[`00c-guidelines.md`](../docs/design/00c-guidelines.md) §三）
- [ ] 确定性单测：同一格子状态恒取同一张素材；并列时按各节兜底顺序（道路样式标签优先级＝非空优先 → 命中标签数降序 → 声明顺序，[`skin/01-road.md`](../docs/design/skin/01-road.md) §六）

## D1 容器与加载（`.pp` / `.pgame`）

- [ ] zip 读取能力（`Q12`：引库或自实现最小解析，仅需 store / deflate 读取；受纯静态与体积约束）
- [ ] `.pp` 解析：`manifest.json` **必须在包根**；素材路径**相对 `resource/`**（[`00a-formats.md`](../docs/design/00a-formats.md) §2.1）
- [ ] `.pgame` 解析：`game.pmod` 原文本 ＋ `skin/` 子目录；缺少 `skin/` 时按「无皮肤」处理（§2.2）
- [ ] 路径约束校验 `KP-4`：拒绝绝对路径 / `..` / `http(s)://` 外部地址
- [ ] 版本迁移：`manifest.version` 为整数、缺省视为 `1`；读到更高版本照常渲染并在控制台警告一次（对齐 `src/io/pmod.ts` 的 `PMOD_VERSION` 处理）
- [ ] 其余校验项：`KP-1`（包根无 manifest → 整包忽略）、`KP-2`（路径不存在 → 逐节点降级）、`KP-3`（版本过高）、`KP-5`（组件 id 无效键）、`KP-6`（缩略图无效 → 回退文件名）
- [ ] 降级链按**单个素材节点**回落：本局 `.pp` → 用户全局 pp（裁决 5）→ 程序绘制；同屏混用素材与程序绘制**不算缺陷**
- [ ] 二进制选择与导出：`src/io/download.ts` 的 `pickTextFile` 只读文本，新增二进制选择入口；导出走 `Blob` 下载
- [ ] 皮肤**不写入** `.psave`（皮肤是渲染层，不进存档语义域）（[`skin/00-package.md`](../docs/design/skin/00-package.md) §4.3）

## D2 贴图渲染器

- [ ] `drawTexture(target, src, box, opts)` 单一抽象；`opts = { mode: 'stretch' | 'nine' | 'tile', slice?, rotate?, flip? }`（[`skin.md`](../docs/design/skin.md) §四）
- [ ] V1 只实现 `stretch`（`<image preserveAspectRatio="none">`）；`nine` / `tile` 仅预留参数位，V1 不解析九宫格（取舍 `S-1`）
- [ ] 渲染器为**纯函数 + 单一入口**：业务代码内**禁止**判断素材类型（不写 `if (is9Patch)`）
- [ ] DOM 层（面板 / 弹窗）与 SVG 层共用同一调用接口（两侧实现可不同）
- [ ] 位图素材**不套手绘滤镜**（`S-6`）；纸纹与手绘分隔线仍由 CSS 承担，素材接管时不得双层叠加（[`skin.md`](../docs/design/skin.md) §3.4）

## D3 逐屏素材接入

> 覆盖清单逐屏对照 [`skin.md`](../docs/design/skin.md) §「覆盖清单（逐屏）」。每接入一屏，用同一份 `.pp` 验证「有素材 / 无素材」两种形态。

- [ ] `road`：15 槽位 / 47 姿态 / 样式标签优先级（**已定稿**，按 [`skin/01-road.md`](../docs/design/skin/01-road.md) 实现）；缺图回退脚印 `src/ui/Footprint.tsx`
- [ ] `role`：玩家棋子 / 职业形象 / 怪物形象（单格、无朝向，[`skin/02-role.md`](../docs/design/skin/02-role.md)）
- [ ] `window`：对话框 / 抽屉 / 气泡 / 按钮 / 格子 / 条 / 提示条；**按钮四态**结构定稿、接入可后置——先只读 `normal`，其余三态暂由 CSS 表现并在清单提示 `KW-6`（裁决 13 / [`skin/03-window.md`](../docs/design/skin/03-window.md) §四.1）
- [ ] `window` §四.2 **信息图标组合**（裁决 12）：`background` 衬底在下 ＋ `icon` 居中在上；名称与说明文字走**窗体自身**字体字色，**不读** `building.font` / `fontColor`
- [ ] `misc`：起点终点标记 / 建筑节点 / 骰子与骰面 / 图标兜底 / 引导线（[`skin/04-misc.md`](../docs/design/skin/04-misc.md)；游玩态内容图标无独立衬底）
- [ ] `background`（画布）：多地图命中择一 / 图点与格 `[0,0]` 中心对齐 / 跟随 `cellSize` 缩放 / 图外填充色（[`skin/05-canvas.md`](../docs/design/skin/05-canvas.md)）
- [ ] `item` / `building`：背包与穿戴格衬底（`.bag-cell`）、组件库与信息视图、建筑地图贴图 `img`、地图名称 `font` / `fontColor`（字号固定 11px，取舍 `S-10`）（[`skin/06-item-building.md`](../docs/design/skin/06-item-building.md) §3.3）
- [ ] `pages`：首页与出身选择页（字体与字色**不由** `pages` 接管，[`skin/08-pages.md`](../docs/design/skin/08-pages.md)；`Q24` 场景封面图未裁决前不做）
- [ ] `audio`：BGM 与事件音效（[`skin/07-audio.md`](../docs/design/skin/07-audio.md)；**`Q20` V1 是否实现音频未裁决，未裁决前不动工**）

## D4 Creative 模式（第三个顶层模式）

- [ ] 路由与模式入口：`src/app/router.ts` 现为 `play` / `build` 两支，扩为三支，`Route` 类型同步
- [ ] 新建：空白骨架；或**从 `.pmod` 生成骨架**（读出该局启用组件与地图用到的全部道路 flag，逐槽位生成空值待填条目）
- [ ] 打开：`.pp`（zip）或本地目录；导入：与用户皮肤**逐节点**合并（同名以导入者为准）
- [ ] 导出：`.pp`；或 `.pgame`（当前 `.pmod` ＋ 当前 `.pp` 打包）
- [ ] 素材绑定：拖入图片按 `<元素>_<变体>.<ext>` 自动匹配槽位，未识别者进「未绑定素材」暂存区；绑定即写回 manifest、不复制文件内容；同屏显示预览缩略图与尺寸比
- [ ] 命中检查：**已命中 / 走通用 / 程序绘制**三类清单，「程序绘制」列为缺图清单并给出建议文件名；道路另给 `16 × 16` flag 矩阵视图（可直接绑定素材）
- [ ] 预览：被编辑 `.pp` ＋ 靶子 `.pmod`；「只看素材」开关；道路「按 flag / 按姿态」两种视图
- [ ] Creative 编辑器自身 UI **不接管素材**（避免自举循环，取舍 `S-18`）
- [ ] 存储：编辑中的工程与素材 blob 与 build 项目同级存本地，导出时才打包；打开高版本包时保存**不降级**版本号
- [ ] 不内置图片编辑（裁剪 / 抠图 / 改色 / 生成 `.9.png`，`S-16`）；`Q25` 九宫格切分器与字体子集化当前不做

## D5 build 模式加载 pp（仅预览）

- [ ] build 加载 `.pp`：**仅地图视图与预览用组件**按素材渲染，用于验证「素材与地图是否对得上」
- [ ] **不改导出结果**：加载 pp 前后导出的 `.pmod` 完全一致（回归项）

## D6 校验接入「清单」

- [ ] `KP-1`~`KP-6` 接入 `src/check/validate.ts`，在 `src/build/Checklist.tsx` 汇总显示；**全部为提示，不阻断导出**
- [ ] 各节明细校验项登记：道路 `KR` / 角色 `KS` / 窗体 `KW` / 标记与骰子 `KM` / 道具与建筑 `KIB` / 页 `KPG`
- [ ] 皮肤校验只在加载了 `.pp` 时出现；未加载皮肤时清单内容与现状一致

## D7 验收（原子项）

- [ ] 完全不加载 `.pp`：全流程渲染与现状一致，无报错、无空白
- [ ] 只有 `road` 一节的 `.pp`：地图道路走素材，其余元素仍程序绘制
- [ ] `item.background.img` 生效：背包格显示衬底图（`img` 覆盖 `fill`）
- [ ] `manifest.json` 缺失的 `.pp`：整包被忽略并提示 `KP-1`，游戏照常渲染
- [ ] `KP-4`：含 `../` 或 `http://` 的素材路径被拒绝并提示
- [ ] `.pgame` 一次加载游戏与皮肤；缺少 `skin/` 子目录时按「无皮肤」启动
- [ ] 本局 `.pp` 与用户全局 pp 并存：被覆盖节点取本局，未覆盖节点取全局
- [ ] 按钮配置写有 `hover` / `active` / `disabled`：运行时只读 `normal`，清单出现 `KW-6` 提示
- [ ] 建筑信息视图：`building.background` 生效，文字仍为窗体字体字色（裁决 12 回归项）
- [ ] Creative 全链路：从 `.pmod` 生成骨架 → 绑定素材 → 导出 `.pp` → 在 play 加载，观感与预览一致
- [ ] `npm run build`（tsc 无错）＋ `npx vitest run` 全绿
- [ ] `npm run dev` 人工手测一次：zip 读取、`.pp` / `.pgame` 导出下载在真浏览器可用

## D8 未决项（未裁决前不动工）

- `Q12` zip 能力引入方式；`Q17` 皮肤体积上限与存档是否记录皮肤名；`Q20` 音频是否进 V1；`Q21` 背景是否多层叠加；`Q22` 描边是否为第四态；`Q23` 用户全局 pp 存放形态与 `.pgame` 内部布局；`Q24` 首页场景封面图；`Q25` 九宫格切分器与字体子集化。
- 汇总见 [`../docs/design/skin.md`](../docs/design/skin.md) §八；三件套侧的同源项见 [`../docs/design/00a-formats.md`](../docs/design/00a-formats.md) §七（任一项裁决后两处必须同步）。

---

## 进度同步

（尚未开工）
