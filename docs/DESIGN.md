# PopRPG 设计文档（索引）

> ## ⛔ 铁律零 · 全程书面语（最高优先级，置于所有规则之前）
>
> **本项目所有文本一律使用书面语（标准书面中文），禁用一切口语、江湖话、黑话、下九流、代号、自嘲、调侃、感叹与网络语。**
>
> **适用范围（不分位置、不分新旧）：**
> - 设计文档（本文件及 `docs/design/*` 全部模块）；
> - 任务文档（`TASK.md` 与 `task/*` 全部里程碑）；
> - 代码内所有注释；
> - 产品内所有界面文案（标签、提示、占位符、错误提示、徽标、按钮、说明、预览、导出文本、预设 `desc`）。
>
> **判定标准：**
> - 禁用词示例（含但不限于）：牌面、打人、打谁、打不了架、等死、顶着 debuff、发到的牌、砸（分点义）、砍人、背着（折扣义）、打八折、倒给、凭空发明、白送、硬来、硬扛、嗑药、耗瓶子、吃一张、稀烂、半套、没谱、堆（分点义）、碰出来、走出来、反手打你一下、多挨一次毒、扛得过去、污染、不配、你代码写了没、亏、费力、量小/量大、最糟、丢（丢弃义）、打不动、纯属浪费时间、下九流、黑话、代号、别、咋、啦、咱们、搞定、颗、这颗。
> - **规则说明讲清"掷什么骰、得到什么、作用到哪"，不靠俏皮话、比喻、江湖比喻替代陈述。** 例如：不写"职业只给初始牌面，不给技能"，而写"职业只提供先天的属性配置（属性起点 + 开局自由点 + 优劣百分比 + 背包 + 家当），不提供技能"；不写"纯靠物攻属性打人，技能本身什么都不加"，而写"普通攻击完全依赖物攻属性进行攻击，技能自身不提供额外加值"。
>
> **执行要求：** 任何改动文案 / 注释 / 文档后，必须全量复查确认无口语残留，否则当没改完。本规则优先级高于一切"省事""生动"的冲动。

> **本文件是设计文档的索引入口**。完整设计已按章节切片到 [`design/`](design/) 下分模块，AI 执行时**按需读取单个模块**，避免一次性读取超大文件。
> 文中交叉引用（如"见 §4.8"）保留原章节号，下表可查到对应模块文件。
> 索引之前另列有若干**入口强制强调块**（铁律零、两条铁律、基本设计、全局基调、实现守则）。这些块**不属于索引用途**，而是给 AI 的开工前提：必须与索引同页、置于入口强制强调，不得因"本文件只是索引"而跳过，也不得只留在 `design/` 分模块内。
> **设计变更同步义务**：每次设计变更（新增模块、修订裁决、调整入口块）完成后，必须回到本文件同步整理四处——模块映射表、章节映射、入口强调块、最新核对决策——并同步 [`TASK.md`](../TASK.md) 的里程碑索引与「进度同步」；任一处未同步视为变更未完成（流程见 [`design/00c-guidelines.md`](design/00c-guidelines.md) §一）。
> 任务清单见根 [`TASK.md`](../TASK.md) 与其 [`task/`](../task/) 分文件。

## 两条铁律

1. **DESIGN 已确认决策不要擅自改**：要改先和用户确认（决策全在 [`design/07-decisions.md`](design/07-decisions.md)）。
2. **任何交互必须能在 [`design/04-editor.md`](design/04-editor.md) §5.4「操作模式标准表」找到出处**，找不到先改 §5.4 再加代码。
3. **UI 文案一律书面语（铁律）**：所有界面文字禁用口语 / 调侃 / 感叹 / 方言 / 江湖话 / 网络语；**新建组件 / 控件也不例外**；每次改完文案须全量复查确认无口语残留（见 [`design/00c-guidelines.md`](design/00c-guidelines.md) §六）。

## ⚠️ 基本设计：三件套（`.pmod` / `.pp` / `.pgame`）

**基本设计**指「这份设计最终交付成什么文件形态」，先于一切界面与玩法细节：

| 文件 | 形态 | 承载 |
|---|---|---|
| `.pmod` 游戏模组 | 单文件 Markdown（散文 ＋ YAML 围栏） | 地图、组件、规则、玩法——**不含任何 UI 定义** |
| `.pp` 皮肤模组 | zip 容器（`manifest.json` ＋ 可选 `preview.png`；**素材目录与命名自由**） | 纯渲染：背景 / 路径 / 角色 / 道具 / 建筑 / 窗体 / 主题 token / 音频（V1 只预留） |
| `.pgame` 整体分发 | zip 容器（`pack.json` ＋ `game.pmod` ＋ `skin/`） | `.pmod` ＋ 皮肤（`.pp` 内容）打包，作为整体分发与加载 |

三者相互独立：`.pmod` 与 `.pp` 均可单独导出、单独加载；`.pp` 是可选增强，缺失时游戏照常渲染；`.pgame` 只是前两者的容器。加载优先级为「游戏配置 ＞ 用户配置 ＞ 程序绘制」，逐素材节点降级。包内**强制结构只有 `manifest.json` 与可选 `preview.png`**，素材的目录名与层级自由，位置**一律由描述文件写明、相对包根**（如 `resource/road/x.png`，写法仅为示例）；用户**导入过**的 `.pp` 进本地皮肤库（**游戏自带皮肤不入库**），**运行时只解压当前生效的一套**，切换皮肤即先清空再解压（裁决 15 / 19 / 22）。

**完整定义（容器布局 / 加载入口 / 优先级 / 版本迁移 / 校验项）见 [`design/00a-formats.md`](design/00a-formats.md)。**

## ⚠️ 全局基调：视觉风格（手绘 / 涂鸦）贯穿所有 UI

**视觉风格不是收尾才考虑的事，是全局基调。** 任何界面（构建页、游玩页、属性面板、按钮、网格、地图组件、弹层）都必须从一开始就遵循「纸张 + 手绘 + 涂鸦」观感。AI 开工任何 UI 任务前，**必须先读 [`design/00b-style.md`](design/00b-style.md)**，并贯穿实现始终；不要等 Phase C 才补。

## ⚠️ 全局基调：UI 文案一律书面语（贯穿所有界面）

**文案风格不是收尾才润色的事，是全局基调，和视觉风格同级。** 任何界面（构建页、游玩页、属性面板、控件提示、占位符、错误提示、标签、徽标、新建组件 / 控件）的文字都必须用**书面语**：陈述规则与结果，不使用口语、调侃、感叹、方言或江湖话。新建带文案的组件第一版就写书面语，不要先写口语版再补。每次改完 / 新增文案，必须全量搜索复查确认无口语残留，否则当没改完。禁令、关键词清单与复查步骤见 [`design/00c-guidelines.md`](design/00c-guidelines.md) §六。

## 🛠 AI 实现守则（开工前必读）

任何**实现**任务开工前，额外先读 [`design/00c-guidelines.md`](design/00c-guidelines.md)：必读顺序、禁止事项（不许堆大文件 / 不许跳过操作模式 / 不许擅自改决策 / 不许引后端或额外绘图库）、代码组织约定、验收原子化、视觉贯穿。这是防止做出"一坨"的直接约束。

## 模块映射（文件 → 覆盖原章节）

| 文件 | 覆盖原章节 | 主题 |
|------|-----------|------|
| [design/00-overview.md](design/00-overview.md) | §1–§2 | 产品定位 / 技术栈 / 三条立场 |
| [design/00a-formats.md](design/00a-formats.md) | 新增（前置） | **三件套（`.pmod` / `.pp` / `.pgame`）基本设计**：分工 / 容器布局 / 加载入口 / 三层优先级 / 版本迁移 |
| [design/00b-style.md](design/00b-style.md) | §10（前置） | **视觉风格（纸张+手绘+涂鸦）全局基调** |
| [design/00c-guidelines.md](design/00c-guidelines.md) | 新增 | **AI 实现守则（必读顺序/禁止事项/代码组织）** |
| [design/01-pmod.md](design/01-pmod.md) | §3 | `.pmod` 文件格式（含完整示例） |
| [design/02-data-model.md](design/02-data-model.md) | §4.0–§4.7 / §4.9 | 八大类组件（含 **NPC 与对话**）+ 项目 + 组件库总纲 |
| [design/03-engine.md](design/03-engine.md) | §4.8 | 规则引擎（前置配置 **14 项**，含 `talk.dice`） |
| [design/04-editor.md](design/04-editor.md) | §5 | 编辑器设计（构建态） |
| [design/05-mvp.md](design/05-mvp.md) | §6 | MVP 范围：预设 + 验收 |
| [design/06-future.md](design/06-future.md) | §7 | 后续阶段：游玩/骰子/存档/**NPC 与对话（已落地形态）**/明确不做 |
| [design/07-decisions.md](design/07-decisions.md) | §8 | 已确认决策记录 |
| [design/08-deploy.md](design/08-deploy.md) | §9 | 部署（GitHub Pages） |
| [design/skin.md](design/skin.md) | 新增 | **素材皮肤规范总纲（索引）**：素材存放 / 旋转镜像九宫格复用 / 贴图渲染器接口 / 三层优先级 / 覆盖边界 / 跨节取舍登记 |
| [design/skin/00-package.md](design/skin/00-package.md) | 新增 | 皮肤包 `.pp` / `.pgame`（**皮肤包视角**；上位规范见 `design/00a-formats.md`）：包结构与路径规则 / manifest 顶层键（`format`/`preview.png`/`extends`/`theme`）/ 五条加载入口 / 三层优先级 / 皮肤库与单套解压 / 版本迁移 |
| [design/skin/05-canvas.md](design/skin/05-canvas.md) | 新增 | 画布背景 `background`（**数组下标即地图下标、逐图对应，越界用最后一层，每张地图只渲染一层**）：`cellSize` / `startX` / `startY` / 图外填充色 / 坐标映射 |
| [design/skin/06-item-building.md](design/skin/06-item-building.md) | 新增 | 道具 `item` 与建筑 `building` **分节**：图标 / 衬底三元组 `{fill, stroke, img}`（**描边为独立设置项，缺省不绘制**）/ 建筑地图贴图 / 地图文字字体字色 |
| [design/skin/07-audio.md](design/skin/07-audio.md) | 新增 | 音频 `audio`：3 个 BGM 场景键 / 9 个音效事件键 / 播放约束（字段定稿为预留，**V1 只解析不播放**，**V2.2** 实现） |
| [design/skin/08-pages.md](design/skin/08-pages.md) | 新增 | 欢迎页与游戏首页 `startup` / `lobby`：封面背景（封面图归皮肤）、标题图形、主视觉、出身卡片（可缺省、走降级） |
| [design/skin/09-creative.md](design/skin/09-creative.md) | 新增 | Creative 模式：新建／打开／编辑／导出 `.pp`（zip 走 `fflate`），**九宫格切分工具**，以 `.pmod` 为靶子的命中检查与预览 |
| [design/skin/01-road.md](design/skin/01-road.md) | 新增 | 道路 `road` 分节：位模式（8 位顺时针）与 256 查表 / 15 槽位 / 47 姿态 / 样式标签优先级 |
| [design/skin/02-role.md](design/skin/02-role.md) | 新增 | 形象 `role` 分节：玩家棋子 / 职业、怪物与 **NPC 形象 `npcs`**（无朝向）／**受击：素材优先、缺了形变**／**尺寸按窗口尺度 `W` 缩放**／**立绘 `portraits`**（纯皮肤元素，`.pmod` 不设字段）
| [design/skin/03-window.md](design/skin/03-window.md) | 新增 | 容器与控件 `window` 分节：四族划分 / 九宫格切片 / V1 底纹策略 |
| [design/skin/04-misc.md](design/skin/04-misc.md) | 新增 | 标记与骰子 `misc` 分节：地图标记 / 建筑节点 / 骰子与骰面 / 图标兜底 / 引导线 |

## 章节 → 模块 快速映射

```
§1,§2   → 00-overview
（三件套 → 00a-formats，基本设计，前置，无原 § 编号，新增）
§10     → 00b-style（全局基调，前置）
§3      → 01-pmod
§4.0–4.7→ 02-data-model
§4.9    → 02-data-model（NPC 与对话，第 8 类组件）
§4.8    → 03-engine
§5      → 04-editor
§6      → 05-mvp
§7      → 06-future
§8      → 07-decisions
§9      → 08-deploy
（实现守则 → 00c-guidelines，无原 § 编号，新增）
（素材皮肤 → skin，无原 § 编号，新增；分节在 skin/）
```

## 最新核对决策（2026-09-26 末轮，12 条修正/补充）

完整 30 条铁律见 `design/07-decisions.md`；下列 12 条是对之前版本的修正，相关任务以这里为准（亦见 [`../TASK.md`](../TASK.md)「最新核对决策」）：

1. 路由：默认 `/`=游玩页，`/build`=构建页（§7.0）。
2. 怪物登场掷骰（反对每回合摇）：每次踩怪格实例化一只新怪时摇选怪骰+属性骰；同一只怪整场不重摇；不同遭遇各自独立摇（§4.8）。
3. 交锋=两回合（玩家攻击+怪物反击），无倒计时、引擎等待玩家（§4.8 / §5.4）。
4. 落空不终止交锋：仅本次施放失效，仍进反击（§4.8）。
5. 死亡不对称：玩家回合开始才判死；怪物即时死、击杀即结束交锋不反击（§4.8）。
6. tick 前移+新状态延后：每回合开始先判存活再 tick；本回合新挂状态下回合才首次 tick（§4.8）。
7. `mp` 由技能自身 `cost` 决定；保底对 cost 空只是默认模板选择（§4.8.3）。
8. 保底对=默认模板安全网，作者可删改，自创角色不受影响（§4.8.3）。
9. 怪物回退：attack_weights 选中 cost 不足→回退同表 cost 空技能；无配置→引擎内建 basic_attack（§4.8）。
10. 怪物只有三 op（add_stat/add_tag/remove_tag）；不 learn_skill/forget_skill（§4.8）。
11. 「清单」按钮：构建页一键汇总 K1~Kn 校验（§5.7）。
12. 玩家"不防御"=自杀按钮（走固有数值，非0）；怪物始终积极防御（§4.8 / §5.4）。

## 约束：纯静态，无服务器

禁止后端 API/SSR/服务端存储/外部在线接口；数据只走 `localStorage` + 浏览器文件导入导出；依赖只选可打包进 `dist/` 的库；Vite `base` 按页路径配置，优先单页避免深链 404（详见 `design/08-deploy.md`）。

## 进度同步

**2026-09-29 · 新增素材皮肤模块（skin）**
- 新增 [`design/skin.md`](design/skin.md)（总纲索引）与 [`design/skin/01-road.md`](design/skin/01-road.md)（道路分节）：素材是可选增强、缺位回退程序绘制；旋转 / 镜像 / 九宫格复用三件套；贴图渲染器 `drawTexture` 统一接口；道路 15 槽位 / 47 姿态 / 15 张素材；样式标签优先级（空标签通配、非空优先、命中数降序、声明顺序兜底）。
- 三条用户已确认取舍同步登记到 [`design/07-decisions.md`](design/07-decisions.md) §8.1：素材定位、`tee` 系列定名（`tee_corner_nw` / `tee_corner_ne`）、角位只认夹角（外侧角不细分）、道路样式优先级。
- `skin/02-role.md` / `03-window.md` / `04-misc.md` 三节按其覆盖范围补齐（依据为对 `src/play/*` 与 `src/ui/*` 的只读调研），游玩态可见 UI 已在 `design/skin.md`「覆盖清单（游玩态逐屏）」中逐屏对齐；九项待确认汇总于 `design/skin.md` §八 与各分节末节。
- 按原始需求「主题模式」整理并新增六节：`skin/00-package.md`（`.pp` / `.pgame` 包结构、manifest 顶层、三层优先级「游戏 ＞ 用户 ＞ 缺省」、五条加载入口）、`skin/05-canvas.md`（背景**数组下标即地图下标、逐图对应、单层渲染**与多地图适配、坐标映射）、`skin/06-item-building.md`（道具与建筑**分节**、衬底三元组、建筑地图贴图与地图文字）、`skin/07-audio.md`（BGM 与音效事件钩子，V1 只预留）、`skin/08-pages.md`（欢迎页与游戏首页 `startup` / `lobby`）、`skin/09-creative.md`（Creative 模式：构建、九宫格切分、命中检查与预览 `.pp`）。
- 2026-09-29 用户裁决 10 项已全部并入：`tag` 匹配按现有算法、`tee_corner_nw` 正向命名、`dpi → cellSize`、`item` / `building` 拆开、用户配置＝本地全局 pp、`background` 落点为背包与信息视图、衬底升级为 `{fill, stroke, img}`、`background` 升级为数组、build 模式可加载 pp 预览、新增 Creative 模式；原始需求笔误修正留档于 `design/skin.md` §九。
- 2026-09-29 末轮裁决 8 项（14–21）已并入：zip 走 `fflate`；皮肤库只记录导入过的 `.pp`、运行时**一次只解压一套**；`audio` V1 只解析预留（**V2.2** 实现）；背景~~多层叠加~~（**已由裁决 23 改为按下标一一对应、单层渲染，越界用最后一层**）；描边**缺省不渲染**；包内**路径相对包根**与 `format` / `extends` / `theme`；`pages` 拆为 `startup` / `lobby` 且封面图归皮肤；Creative 提供**九宫格切分工具**、字体不子集化。未决项汇总于 `design/skin.md` §八（余 Q26 / Q28 / Q29 等）。
- 2026-09-29 追加裁决 3 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.2）：**三件套**定义前置为「基本设计」并新增总纲 [`design/00a-formats.md`](design/00a-formats.md)（`skin/00-package.md` 保留皮肤包视角的具体定义）；物品 / 建筑信息视图的图标按**应用图标式**组合（衬底 ＋ 图标，文字走窗体自身字体字色，不存在交叉配置）；按钮 `hover` / `active` / `disabled` **四态结构定稿、实现顺序可后置**。
- 2026-09-29 追加裁决 1 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.2）：`.pp` 包内**不设强制目录结构**——强制项只有 `manifest.json` 与可选 `preview.png`，素材的目录名 / 层级 / 文件名自由，位置**一律以描述文件为准**（提高扩展性与兼容性）；草案的 `resource` 键**废除**，新增校验项 `KP-10`。
- 2026-09-29 追加裁决 1 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.2）：**背景数组改为「逐图清单」**——**下标即 pmod 的地图下标，一一对应、无需匹配 key**（`maps` 字段废除），**每张地图只渲染一层**（不再叠加）；**地图数多于层数时，越界的地图降级为使用最后一层**（皮肤 2 层、地图 4 张 → 下标 2 / 3 都用下标 1 的图）；无可用层／未配置时**再次降级为默认配置**（程序绘制纸面底纹）；`color` **每层各自携带**、随采用层生效，该层漏写即**降级为全局主题色**（**颜色不做层级回退**）（[`design/skin/05-canvas.md`](design/skin/05-canvas.md) §二）。
- 2026-09-29 本轮的**实现任务**已落地为 [`task/04-skin.md`](../task/04-skin.md)（Phase D：三件套容器 / zip 读取 / 贴图渲染器 / 逐屏素材接入 / Creative 模式 / 皮肤校验，含 D0–D8 与 12 条原子验收），并在 [`TASK.md`](../TASK.md) 里程碑索引与「最新核对决策」登记。
- 2026-09-29 追加裁决 1 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.2）：**新增立绘 `portraits`（裁决 24）**——`role` 下的**纯皮肤元素**（`.pmod` 不设任何字段）；**暂不考虑四向**，左右相对仅由**显式 `flip`** 表达；落点为底栏 hp/mp 左侧（**替代 `hud-face`**，缺位不占位）、对战对话框顶部 **VS 区**（任一方有即渲染）、出身卡职业立绘、状态面板头部，遭遇 / 商店弹层**仅预留**（[`design/skin/02-role.md`](design/skin/02-role.md) §四）。
- 2026-09-29 追加裁决 2 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.2）：**裁决 25**（**单人游戏、唯一主人公**——立绘即唯一形象、无队伍 / 多角色矩阵；**受击两法**＝有素材用 `hurt`、无素材用**形变**；**立绘按窗口短边比例缩放**，废弃固定像素档）；**裁决 26**（**NPC 与对话系统**——素材库新增 `npcs` 分组、NPC **只出现在建筑里**、建筑新增第六种行为 `encounter: talk`、建筑实例的 `npcs` / `dialog` **两级掷骰**、**树状对话**支持多套方案、编辑器新增 `NPC` 分区与**整页「NPC 模组」思维导图面板**、前置配置新增 `talk.dice` 后总账 **14 项**）。
- 2026-09-29 正文同步：新增 [`design/02-data-model.md`](design/02-data-model.md) **§4.9 NPC 与对话（第 8 类组件）**；[`design/01-pmod.md`](design/01-pmod.md) 加 `### NPC` 段、id 表改**八大类**并增 NPC 启用条件；[`design/04-editor.md`](design/04-editor.md) 分区 ×8 → ×9、新增 **§5.6.1「NPC 模组面板的操作」**与 **G7**、组件库 / 实例页 / 校验项同步；[`design/06-future.md`](design/06-future.md) 新增 **§7.6「NPC 与对话：已落地形态」**并在 §7.4 划清「**对话树在范围内、剧情分支树不做**」；[`design/03-engine.md`](design/03-engine.md) 与 [`design/05-mvp.md`](design/05-mvp.md) 配置项 **13 → 14**；皮肤侧 [`design/skin/02-role.md`](design/skin/02-role.md) / [`design/skin.md`](design/skin.md) / [`design/skin/00-package.md`](design/skin/00-package.md) / [`design/skin/03-window.md`](design/skin/03-window.md) 同步。实现任务见 [`task/05-npc.md`](../task/05-npc.md)。
- 2026-09-29 对话细化（并入裁决 26 ⑨~⑪）：**方案掷定即锁死**（本局不换人 / 不换方案，锁在建筑实例）；**本层选项抽取**——任意一条记录写 `dice` 则它 `items` 各条靠**掷骰命中**（各条带 `hit` 区间，**未命中再掷**），不写 `dice` 则**玩家直接点选**；**`give` 一次性交付**——交付后该实例进**终态**，再次对话**只回放那条记录的 `message`**、不再赠予道具。编辑器 **NPC 模组面板**新增卡片 `dice` 下拉与各项 `hit` 输入，并做**命中覆盖检查（只提示、不拦截）**。正文同步 [`design/02-data-model.md`](design/02-data-model.md) §4.9.2 / §4.9.3 / §4.9.4、[`design/01-pmod.md`](design/01-pmod.md) `### NPC` 示例、[`design/03-engine.md`](design/03-engine.md) 场景索引（**6 → 7 处骰子**）与 §4.8.6、[`design/04-editor.md`](design/04-editor.md) §5.6.1 / §5.7、[`design/06-future.md`](design/06-future.md) §7.6；任务见 [`task/05-npc.md`](../task/05-npc.md)。
- 2026-09-29 **对话结构归一**（修订上一条的口径）：对话树**只有一个结构** —— `{ result?, message, dice?, hit?, items?, give? }`，**`items` 的元素类型就是它自己**（递归），**根层数组的元素与任意深层的 `items` 元素完全同构**，**没有 `type` 判别**（`DialogItem` / `DialogChatItem` / `DialogPropItem` 作废，旧包的 `type` 字段忽略）。**必填只有 `message`**；`result` 仅当该条是某个 `items` 的元素（玩家选项）时才生效；`items` **缺省 / 空 ＝ 说完就结束**；`dice` 是本层 `items` 的命中骰（每一层都能写）；`hit` 是父层有 `dice` 时本条的命中区间；`give` 是赠予道具（可重复＝多份，**与 `items` 可并存**——先交付再继续）。原「道具项为终止项 / 不与选项混排」两条约束**作废**。正文同步 [`design/02-data-model.md`](design/02-data-model.md) §4.9.2–§4.9.4、[`design/01-pmod.md`](design/01-pmod.md) `### NPC`、[`design/03-engine.md`](design/03-engine.md) §4.8.12、[`design/04-editor.md`](design/04-editor.md) §5.6.1 / §5.7、[`design/05-mvp.md`](design/05-mvp.md) 11i、[`design/06-future.md`](design/06-future.md) §7.6、[`design/07-decisions.md`](design/07-decisions.md) §8.2 裁决 26 ④⑩⑪ 与 §8.3 设定 3 / 8；任务见 [`task/05-npc.md`](../task/05-npc.md) E0 / E2 / E3 / E4。
- 2026-09-29 链路审计（NPC ＞ skin ＞ V1.1）：**补链** —— [`design/03-engine.md`](design/03-engine.md) 新增 **§4.8.12 对话（`encounter: talk`）** 运行时顺序小节，场景索引第 7 行由跨模块引用改为指向本节；[`design/05-mvp.md`](design/05-mvp.md) §6「纳入」补 **NPC 与对话**、`J` 五种行为 → **六种**、§6.2 补 **11i 对话闭环**验收，「暂不纳入」表中已排入 Phase B 的项去向改为显式指回 Phase B。**修正** —— [`design/06-future.md`](design/06-future.md) §7 范围分界：**§7.0–§7.3 属 V1（Phase B 设计依据）**，不再是"非 MVP、仅记录"。**登记** —— [`TASK.md`](../TASK.md) 新增「**V1.1 清单**」一节（音频播放 / 贴图 `nine` / 九宫格切片消费 / 对话后续扩展 / 立绘遗留 / 未决项 / 多项目管理）与执行优先级声明。*(历史登记：其中的「V1.1 清单」已改名「V2.1 / V2.2 清单」，见下条)*
- 2026-09-29 **版本线（V1 冻结 → V2.x 追加改造）**：**V2.0 ＝ 新增 NPC 结构**（**追加设定**：NPC 触发在**进入建筑之后、建筑事件之前**，`npcs` 与 `encounter` **正交**、旧「挂了 NPC 却不是对话建筑 → 不生效」校验作废，`encounter: talk` ＝ 建筑事件阶段留空、以对话为主体）；**V2.1 ＝ SKIN 基础**；**V2.2 ＝ SKIN 进阶 ＋ 音频**。优先级 **V2.0 ＞ V2.1 ＞ V2.2**（结构改造先做、再做皮肤）。**旧文档里的「V1.1」一律读作 V2.2**（音频播放 / 贴图 `nine` 策略 / 九宫格切片消费）。正文同步：[`design/07-decisions.md`](design/07-decisions.md) **§8.3（新增）**、[`design/02-data-model.md`](design/02-data-model.md) §4.9.3、[`design/03-engine.md`](design/03-engine.md) §4.8.12、[`design/04-editor.md`](design/04-editor.md) §5.6 / §5.7；[`design/06-future.md`](design/06-future.md) 明确为**记录文档**；[`task/00-foundation.md`](../task/00-foundation.md) 恢复 **V1 七大类**口径；[`TASK.md`](../TASK.md) 路线图改为版本线，清单改名「**V2.1 / V2.2 清单**」。**追加设定补完**：NPC 触发**只在「从建筑外踏入」那一次**（**建筑内部移动不触发**）、**首次进入一定进对话**、**重入先弹「选择对话框」**、**`treasure` 空池 ＋ NPC 不再报"什么也没有"**（`07-decisions.md` §8.3 设定 2–4）。*（同日后续裁决把「重入选择框」细化为【继续对话】/【重新对话】/【路过】三个选项，见下条）*
- 2026-09-29 追加裁决 3 项（登记于 [`design/07-decisions.md`](design/07-decisions.md) §8.3 **设定 3（改）/ 6（改）/ 8（新）**）：① **重入 ＝ 三个标记 ＋ 三个选项**——进度按**建筑实例**只记 `cursor`（**当前停留的那条记录**）/ `talkDone`（**走完过一次**）/ `deliveredNode`（**已交付**，与前者分开记）；**首次进入不弹框**，**重入**给【**继续对话**】【**重新对话**】（**走完过**再加【**路过**】），【继续】回到 `cursor` 节点（**没有 `cursor` 就从根开始**）、【重新】从根完整重播且**不重置标记**（已交付**不会重复发道具**，防刷）。② **赠予道具的清单改名为 `give`**——`items` 永远只表示"**后续选项**"，两者不再共用一个 key（一个对象数组、一个字符串数组，只能靠 `type` 分支区分，写包必错）。（**后由 2026-09-29「对话结构归一」条修订**：连 `type` 分支本身也取消了。）③ **重名地图导出时自动加后缀**——编辑器**仍只标黄、不改名**（改名会让旧档 key 全部不匹配），但**导出与开局时**给第 2 张起加 `名字 (2)` / `名字 (3)`…（第一张保持原名），**两条出口共用 `uniqueMapNames`** 以得到同一套建筑实例 key；**代码已落地**（`src/io/pmod.ts` / `src/play/load.ts` / `src/build/ioActions.ts` ＋ `pmod.test.ts` 三个单测）。正文同步：[`design/02-data-model.md`](design/02-data-model.md) §4.9.2 / §4.9.3、[`design/03-engine.md`](design/03-engine.md) §4.8.12、[`design/01-pmod.md`](design/01-pmod.md) `### NPC` 与地图名段、[`design/04-editor.md`](design/04-editor.md) §5.7、[`design/05-mvp.md`](design/05-mvp.md) 11i 与 §6.2、[`design/06-future.md`](design/06-future.md) §7.6；任务见 [`task/05-npc.md`](../task/05-npc.md)（验收 **18 → 19 项**）。
- 2026-09-29 **`.pmod` 字符集与结构标题**：文件头新增 **UTF-8 BOM ＋ `<!-- charset: utf-8 -->`** —— `.pmod` 是纯文本，浏览器/编辑器有时按 **GBK** 猜编码，中文一乱码整段就废；结构标题**一律英文化**（`## Background` / `## Components` / `## Rules` / `## Maps`，`### Monsters` / `Items` / `Buildings` / `Roads` / `Classes` / `Skills` / `NPCs` / `Backgrounds`），**地图名是内容、照旧中文**；导入**先按英文匹配、未命中降级中文**（旧写法 `## 设定` / `### 技能` 照旧能读，向后兼容）。代码落地 [`src/io/pmod.ts`](../src/io/pmod.ts)（`SECTION_TITLE` / `GROUP_TITLE` / `*_ALIASES` ＋ 解析前剥 BOM）与 [`src/io/__tests__/pmod.test.ts`](../src/io/__tests__/pmod.test.ts)（新增 3 项）；正文同步 [`design/01-pmod.md`](design/01-pmod.md) §3 / §3.1、[`design/02-data-model.md`](design/02-data-model.md) §4.8 / §4.9、[`design/03-engine.md`](design/03-engine.md) §4.8.6、[`task/00-foundation.md`](../task/00-foundation.md)。
- 2026-09-29 **NPC 模组左栏列出全部 NPC（修订 §5.6.1）**：左栏原先「只列本局**被引用**的 NPC」，现改为**列出库里的全部 NPC** —— **引用数是本局状态标注，不是能否撰写对话的前提**；被引用者显示 `×N`、未被引用者降透明并标「未引用」，同样可选中编辑；面板徽章改为「共 N 条 · 被引用 M 条」。同轮修复条目排版：补上被引用却**没有样式定义**的 `.truncate` 单行截断类，并给条目补内边距与单行排布（名称在左、状态徽章靠右并纵向居中）。正文同步 [`design/04-editor.md`](design/04-editor.md) §5.6.1；代码 [`src/build/NpcModScreen.tsx`](../src/build/NpcModScreen.tsx) / [`src/styles/layout.css`](../src/styles/layout.css) / [`src/styles/theme.css`](../src/styles/theme.css)；任务见 [`task/05-npc.md`](../task/05-npc.md)。
- 2026-09-29 **NPC 模组：连线虚线坐标系与落点判定修复 ＋ 面板文案去口语化**
  1. **虚线位置偏移**：拖拽连线画在 `.dlg-content` 里（与卡片同一坐标系，外层带 `translate + scale`），端点却按**视口坐标**填入 —— 两者差着整个相机平移，缩放后还要再乘 `zoom`。实测偏出：初始 **41px**、放大到 1.1 时 **63px**、平移后 **171px**。改为**统一换算到内容坐标**（以 `.dlg-content` 实时矩形 ＋ `camera.zoom` 为基准），实测端点压住鼠标的误差 ≤ **0.8px**、线头精确落在端口中心。
  2. **松手落点判定**：原实现只记「连线时划过哪张卡片」（`mouseenter` 写入、**从不清除**），光标一旦划过某张卡片，之后在空白处松手照样连上它。现在**以松手位置为准**（按光标底下的卡片判定），并补 `mouseleave` 清除候选；环境不支持该 API 时才回退。
  3. **文案去口语化**：删除「父子 / 子卡片 / 上一层」等说法与「＝」式口语链条，面板说明、画布提示、悬停说明与确认框一律改为书面表述（统一用**上一级 / 后续项 / 该记录**）。
  正文同步 [`design/04-editor.md`](design/04-editor.md) §5.6.1（并修正该表两处与实现不符处：「拖到空白」是取消而非断开；折叠控件位于端口右侧）；代码 [`src/build/npc/DialogCanvas.tsx`](../src/build/npc/DialogCanvas.tsx) / [`DialogCard.tsx`](../src/build/npc/DialogCard.tsx) / [`NpcModScreen.tsx`](../src/build/NpcModScreen.tsx)；任务见 [`task/05-npc.md`](../task/05-npc.md)。
- 2026-09-29 **NPC 模组：卡片自带段名 ＋ 「答复骰子」正名**
  1. **卡片上的段名**：四段（命中 / 答复 / 台词 / 答复骰子）原先只有「命中」和末尾那颗骰子带行内标签，中间的答复、台词两块只能靠上下文猜。现在把段名**直接写在分隔线上**（`.dlg-sep.titled`，两侧各留一段虚线，读起来是 `— 答复 —`），窗口说明里那套说法在卡片上原样可见；根卡片没有上一级，故只有「台词」一段（不出现「答复」）。
  2. **`item 骰子` → 「答复骰子」**：这个字段管的是「下面那些答复怎么被选中」，与玩家的答复文本（`result`）直接对应，旧名却在说数据结构（`items`）。卡片标签、悬停说明、窗口说明与设计文档统一改名。
  3. **清掉面板上的实现细节**：方案计数只留「2 套方案 · 等权」（去掉「（由建筑实例抽定，`talk.dice`）」）；新建方案按钮的悬停说明只留「新建一套方案」（去掉「（方案名不写权重）」）；组件页那句同样不再露 `talk.dice` 字段名。浏览器实测：面板 **242 处**可见文字（含 `title` / `placeholder`）中已无 `item 骰子` / `talk.dice` / `父子` / `子卡片` / `权重` 等残留。
  校验：段名分隔线使卡片增高约 11px，**估高常量同步**（`estimateHeight`，实操仍以实测高度优先）；浏览器实测 4 条连线端点仍压在卡片边上（误差 < 1px，为卡片 `-0.35deg` 倾斜的固有残差），卡片之间无重叠。正文同步 [`design/04-editor.md`](design/04-editor.md) §5.6 / §5.6.1（并把「节点骰子在卡片顶部」改正为**紧邻后续项之上**）与 [`design/02-data-model.md`](design/02-data-model.md) §4.9.2；代码 [`src/build/npc/DialogCard.tsx`](../src/build/npc/DialogCard.tsx) / [`src/styles/theme.css`](../src/styles/theme.css) / [`NpcModScreen.tsx`](../src/build/NpcModScreen.tsx) / [`inspector/ComponentPage.tsx`](../src/build/inspector/ComponentPage.tsx)；任务见 [`task/05-npc.md`](../task/05-npc.md)。

**2026-09-29 · 预设重名以本地优先 ＋ 组件库 `⋯` 菜单补回「复制成新组件」（§5.3 / §6.1 ①）**
- **预设与本地冲突：重名以本地优先**（新登记于 [`design/07-decisions.md`](design/07-decisions.md) §8）：内置预设的**定义固定**（随版本走），用户改过的那一份**存在本地**；播种时 **同 `id` 已被改过 → 保留本地那一条**（不拿固定定义覆盖），**同名但不同 `id` → 同样保留本地、该预设不补入**——库里不出现两条同名条目。`恢复默认` 仍是回到固定定义的唯一入口。代码 [`src/store/library.ts`](../src/store/library.ts) 的 `ensureSeeded`（补入缺失预设时按 `id` 与 `name` 双重判重）；新增单测 [`src/store/__tests__/library.test.ts`](../src/store/__tests__/library.test.ts)（空库全量播种 / 同名自建顶掉同名预设 / 改过的预设不被覆盖）。
- **`⋯` 菜单补回「复制成新组件」**：行内 `复制` 与它**是同一个动作**（`duplicateOf` 做**整条深拷贝**——NPC 连整套 `dialogs` 一起带走，复制出来的是一条可独立编辑、可独立挂到建筑上的完整 NPC），两个入口都保留，菜单恢复与 §5.3 一致的项序。正文同步 [`design/04-editor.md`](design/04-editor.md) §5.3（菜单项改按实现的项序写、补复制语义）、[`design/05-mvp.md`](design/05-mvp.md) §6.1 ①（补重名口径）；[`TASK.md`](../TASK.md) 已登记。

**2026-09-29 · 游玩态对话弹层：删掉顶上的「你 VS 他」对比区（§4.9.2 / `skin/02-role.md` 落点 3）**
- **问题**：弹层内容顶部有一块**双方对比**——左「骑士」、中「VS」、右「守墓人」，两侧还画着斜纹占位框。对话框里做对比是**交锋的语汇**：玩家读到的第一行像是"要开打"，而这里只是说话。
- **改法**：整块删除（含两侧斜纹占位框与中间「VS」），弹层只剩 **标题栏 ＋ 台词 ＋ 选项**；标题栏写 **NPC 的 `icon` ＋ 名字**（那一格即 `role.npcs` 素材的落点）。**玩家的职业名不再出现在对话里**——跟自己说话的人是自己，报一遍幕没有意义。`.talk-vs` / `.talk-side` / `.talk-portrait` / `.talk-who` / `.talk-mid` 五条样式一并删净。
- **文档**：对话弹层的 VS 区**作废**，改写 [`design/07-decisions.md`](design/07-decisions.md) 裁决 26 ⑦；同步 [`design/skin/02-role.md`](design/skin/02-role.md)（§4.1 落点 3、§4.2 高度档、`S-29`、§十-5 / §十-7）与 [`design/skin.md`](design/skin.md)（地图两行、`S-29`、`Q30`、`Q31`）。**对战对话框的 VS 区不受影响**（那是真的要对打）。
- 代码 [`src/play/TalkDialog.tsx`](../src/play/TalkDialog.tsx) / [`src/styles/theme.css`](../src/styles/theme.css)。
- 验证：[`src/play/__tests__/talkDialog.test.tsx`](../src/play/__tests__/talkDialog.test.tsx) 断言弹层里没有「VS」、没有 `.talk-vs`、NPC 名字只出现一次、连玩家职业名也不出现；`npx tsc --noEmit` 无错，`npx vitest run` **17 个文件 / 212 项**全绿。

**2026-09-29 · 游玩态对话弹层：不把「方案名」给玩家看（§4.9.2 / §7.6）**
- **问题**：弹层标题栏右侧那颗 `.badge` 渲染的是 `talk.dialog` —— 即**作者侧的方案名**（`Mod1` / `Mod2`…，NPC 模组的「＋ 方案」生成的那套编号）。游玩态把它摆在玩家眼前，等于把编辑器的内部标识当内容交付。
- **改法**：标题栏**只留 NPC 名字**（重入的选择对话框是「又要交谈？」），`line` / `choose` 与 `menu` 两处 `talk.dialog` 角标一并删除；右侧已无内容，`panel-head` 上凑数的 `space-between` 同步去掉。口径写在 [`src/play/TalkDialog.tsx`](../src/play/TalkDialog.tsx) 文件头：**弹层不显示方案名**。
- 验证：[`src/play/__tests__/talkDialog.test.tsx`](../src/play/__tests__/talkDialog.test.tsx) 补断言「正片与重入弹层里都查不到 `talk.dialog`」；`npx tsc --noEmit` 无错，`npx vitest run` **17 个文件 / 212 项**全绿。

**2026-09-29 · 底部三枚按钮统一款式尺寸 ＋ NPC 模组里直接改「描述 / 颜色」（§5.6 / §5.6.1）**
- **底部一行三枚同款式同尺寸**：上一轮把它们并进一行，却各带各的样式（`＋ 选项` 是 `.btn.small`、端口是 26×14 的圆角小框、折叠是虚线 `.ghost`），一排三种长相三种高矮——现在三枚的**尺寸与款式全部由 `.dlg-foot-row > *` 一处给**（等宽 52×20、同一描边与圆角），只把端口的光标换成十字以示可拖；`.dlg-port` 退化成纯挂钩，`.btn` / `.ghost` 变体类从这两颗按钮上摘掉，`.dlg-card-foot` 一并删净。
- **NPC 的「描述 / 颜色」在 NPC 模组里就能改**：`desc` / `color` 属 `ComponentBase` 公共字段，原先只有组件页能改，而 NPC 模组**盖住整屏**（组件页根本看不见）——改这两个字段得先关页面再回左栏找这条 NPC。现在右侧顶部加了「描述」（两行文本框）＋「颜色」（取色器 ＋ 随机 / 清除），写的是**同一份库定义**（`upsert('npc', …)`）。
- **取色器切成胶囊**：原生 `input[type=color]` 的色块是**直角矩形**，摆在满屏手绘风里格外生硬；新增 `.color-input`（42×24、`border-radius: 999px`、与旁边 `.btn.small` 同高），NPC 模组与组件页的「颜色」共用这一个类。
- 代码：[`src/styles/theme.css`](../src/styles/theme.css)、[`src/build/npc/DialogCard.tsx`](../src/build/npc/DialogCard.tsx)、[`src/build/NpcModScreen.tsx`](../src/build/NpcModScreen.tsx)、[`src/build/inspector/ComponentPage.tsx`](../src/build/inspector/ComponentPage.tsx)。
- 正文同步 [`design/04-editor.md`](design/04-editor.md) §5.6（NPC 模组布局加「描述 ＋ 颜色」、底部三枚说明）与 §5.6.1 表新增「改描述 / 颜色」一行。
- 验证：[`src/build/__tests__/npcMod.test.tsx`](../src/build/__tests__/npcMod.test.tsx) 补断言「底部一行里不出现 `.btn` 变体类」以及新用例「描述与颜色写回库里那条 NPC」（含预设原文回填与「清除」回落兜底色）；`npx tsc --noEmit` 无错，`npx vitest run` **17 个文件 / 212 项**全绿。

**2026-09-29 · NPC 模组卡片：右上角是「断开 ＋ 删除」，底部一行为「＋ 选项」＋ 端口 ＋ 折叠（§5.6 / §5.6.1）**
- **按钮归位**：卡片右上角并排的是 **`断开`（在左）＋ `删除`（在右）**；**连接端口**回到卡片**底部一行**（上一轮误把它放进了右上角，此处改正）。`断开` 只对**有上一级的卡片**显示（根卡片没有可断开的关系）。
- **「＋ 选项」并入底部一行**：它原先自占一行，现与**连接端口**、**折叠箭头**同排，次序为「＋ 选项」→ 端口 → 折叠箭头——**三者都只作用于后续项**（直接新增一条 / 拖出后续关系 / 折叠挂在底部的子树），故排在同一行；`.dlg-card-foot` 整个节点与其样式一并删除。
- 代码 [`src/build/npc/DialogCard.tsx`](../src/build/npc/DialogCard.tsx)（`.dlg-card-ops` 装断开、`.dlg-foot-row` 装「＋ 选项」＋ 端口 ＋ 折叠）与 [`src/styles/theme.css`](../src/styles/theme.css)（新增 `.dlg-card-cut`，与 `.dlg-card-del` 共用一套样式；删除 `.dlg-card-foot`）；估高同步 [`src/lib/dialogTree.ts`](../src/lib/dialogTree.ts)（断开绝对定位、不占正文行；两行合一后底部只计一行）。
- 正文同步 [`design/04-editor.md`](design/04-editor.md) §5.6（卡片底部一行 ＋ 右上角两颗按钮）与 §5.6.1 的「断开」/「加后续项」两行；任务见 [`task/05-npc.md`](../task/05-npc.md)。
- 验证：[`src/build/__tests__/npcMod.test.tsx`](../src/build/__tests__/npcMod.test.tsx) 的卡片排布用例改为断言「断设在删除左侧」「＋ 选项在端口左侧、端口在折叠左侧」；`npx tsc --noEmit` 无错，`npx vitest run` **17 个文件 / 211 项**全绿。

**2026-09-26 · 文档防烂加固**
- 视觉风格从末尾 §10 **前置**为 `design/00b-style.md`（全局基调，开工 UI 前必读）。
- 新增 `design/00c-guidelines.md`（AI 实现守则）：必读顺序 / 禁止事项（不许堆大文件、不许跳过操作模式、不许擅自改决策、不许引后端或额外绘图库）/ 代码组织约定（store 分层、引擎UI分离、组件拆分粒度、每里程碑 build 通过）/ 验收原子化 / 视觉贯穿。
- 根索引两条铁律 + 全局基调块 + 实现守则块已接入；模块映射表与章节映射同步更新。
- 背景：一次按文档的实现产出混乱代码（已删除），复盘认定文档缺失"实现守则/代码组织红线"是主要可改进点，故补此模块从源头约束。
