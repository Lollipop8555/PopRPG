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

任何**实现**任务开工前，额外先读 [`design/00c-guidelines.md`](design/00c-guidelines.md)：必读顺序、禁止事项（不许把大量代码集中在单个文件 / 不许跳过操作模式 / 不许擅自改决策 / 不许引后端或额外绘图库）、代码组织约定、验收原子化、视觉贯穿。这是防止代码堆砌失控的直接约束。

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
| [design/state-pool.md](design/state-pool.md) | 新增 | **全局状态池（V2.x 结构改造）**：全局唯一键值表 / 三类型（`string` / `number` / `boolean`）/ **`engine-` 与 `usr-` 双空间前缀隔离（声明侧强制补 `usr-`，防覆写）** / **存储不分空间、读写接口按 `space` 参数化（仅用于自动追加前缀）** / **主角六维属性并入池**，引擎变量扩充（**累计步数 / 位置 / 道具件数**）/ 读算子与写算子两个维度（写不提供读反馈）/ **判定两类：回合判定（每回合开始、**按来源自然排序**：`pmod` 业务 → `state` buff → **`engine` 内置基础判定（存活 / 死亡）最后**；批内别名 ＋ 依赖（可多条）＋ 拓扑排序、匿名后置、缺依赖忽略、禁止回环）与触发判定（就地内联）** / `.pmod` 顶级段 `## Pool`（`pool` ＋ `checks`）/ 对话（**`if` if-else 链、可嵌套**）与门锁的接入 / 定义面板（表格列 `key` · 说明 · 类型 · 引用数 · **空间 tag**，**内置变量打「引擎」tag**，含自动推荐与自动收录）/ 校验 `K20`–`K34` |
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
（全局状态池 → state-pool，无原 § 编号，新增）
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

**2026-10-08 · 全局状态池定义细化（设计侧，未开工）**
- 新增模块 [design/state-pool.md](design/state-pool.md)（**唯一权威口径**）与决策 [design/07-decisions.md](design/07-decisions.md) §8.5（**裁决 31–49**）。
- 第一轮定稿要点：**双空间前缀隔离**（`.pmod` 声明一律强制补 `usr-`，`engine-aaa` 亦落为 `usr-engine-aaa`，作者**不可能**声明或覆写引擎键）；**主角六维属性整体并入池**（`engine-hpValue` / `engine-hpMax` / `engine-mpValue` / `engine-mpMax` ＋ 四能力，旧的两处存储退役）；**读与写是两个维度**（写算子无返回值，`if (set(...))` 这种写法在设计上不存在）；`.pmod` 新增**顶级段 `## Pool`** 声明定义与默认值，使用处**内联**读写；编辑器在**工具栏开独立面板**（表格化 ＋ **自动推荐** ＋ **自动收录**）。
- **第二轮细化（判定机制 ＋ 引擎变量扩充）**：
  - **引擎变量扩充**：新增**累计真实步数 `engine-steps`**（与"本回合剩余步数"分列两键，区分绕圈时的真实步数与位置差异）、**玩家位置 `engine-pos`**（粒度"地图-XY"，串 `"<地图>-<x>,<y>"`）、**各道具持有件数 `engine-item.<道具 id>`**（缺省读 `0`；**货币作为预设道具同走此键族**）；三者全局可读，步数 / 位置只读、道具件数可写。**存储不分空间、读写接口按 `space` 参数化**（仅用于自动追加前缀，裁决 40 修订）。
  - **判定两类**：**所有操作都依赖状态池的判定**——**回合判定**（每回合开始触发一次，**按来源自然排序**：`pmod` 业务 → `state` buff tick → **`engine` 内置基础判定（存活 / 死亡）强制最后**；批内：**别名 ＋ 前置依赖（可多条），拓扑排序，匿名判定批内最后**，依赖成环在编辑页面警告并**禁止保存 / 导出**，**缺依赖仅忽略该条**，裁决 47）与**触发判定**（事件触发时就地内联，NPC 对话 / 建筑触发 / 门锁）。
  - **对话链路条件判断升级为 if-else 结构、允许嵌套**：条件字段由 `when` 升级为 **`if`**；同层取第一条成立者、命中即停，末尾无 `if` 记录为 `else`；`if` 与 `dice` / `hit` 同层二选一。
  - **观察登记**：使用处按其 `if` / `pool` 引用键自动推导 `watch`，池键写入即通知（"NPC 注册观察道具数量"的落点）。
  - **编辑器**：变量表格**并列展示内置变量并打「引擎」tag**（只读），新增「回合判定」页签（依赖图 ＋ 回环警告）。
- 与既有裁决的关系：裁决 26 ⑧ 与「明确不做」**均不作废**——池表达的是**由状态引起的反馈变化**，**不判定通关、不产生结局**，门锁 `pool` 属**空间可达性**而非通关条件。
- 任务侧：本文件里程碑索引与 [TASK.md](../TASK.md) 已登记；**实现任务尚未开工**（用户明确要求先落文档）。待裁决 10 项见 `state-pool.md` §十二。

**2026-09-30 · D4 靶子来源补齐 ＋ 创意模式文案回到设计名词（铁律零复查）**
- **靶子来源补齐**：§五·待确认 1 原先只落地「在 Creative 内临时选择一份 `.pmod`」；现进 Creative 且本工程没存过靶子时，用 `loadTargetFromProject()` 把**构建页当前工程**导出成 `.pmod` 当靶子（工程里没启用组件、地图上也没铺任何件时不接管），顶栏更多菜单另有「用当前构建工程当靶子」可随时改回；**Creative 自己存下的靶子优先**。§五·待确认 1 两侧均已落地，原文已标注。
- **文案回到设计名词**：左栏暂存区与按钮改用 §2.2 原文「**未绑定素材 / 绑定到选中位置**」，徽章与中栏三类名统一为 §2.4 原文「**已命中 / 走通用 / 程序绘制 / 可留空**」；右栏类型名去掉术语堆叠与冗余修饰；全量复查并清除 `颗` / `面骰` / `认领` / `放好` / `回捞` / `顶替` / `顺手` / `跟着变` 等口语（含注释）。
- 设计侧同步：[`design/skin/09-creative.md`](design/skin/09-creative.md) §五·待确认 1（标注落地）与 §六（改写 ＋ 新增「靶子来源」一行）；任务侧同步 [`TASK.md`](../TASK.md) 与 [`task/04-skin.md`](../task/04-skin.md)。验证：`npx tsc --noEmit` 无错，`npx vitest run` **55 个文件 / 669 项**全绿，真浏览器实测自动取靶子生效且无 console 报错。

**2026-09-30 · D4 Creative 模式接线（第三个顶层模式可用，[`design/skin/09-creative.md`](design/skin/09-creative.md) 状态改「已落地」）**
- **从「未实现」到「可用」**：模块代码（`src/creative/*` 11 个文件 ＋ `src/store/creative.ts`）此前已写好但**无装配、无路由**；本次接上——[`src/app/router.ts`](../src/app/router.ts) 扩为 `Route = 'play' | 'build' | 'creative'`（`#/creative`），[`src/app/App.tsx`](../src/app/App.tsx) 三支渲染，入口挂[构建页顶栏](../src/build/TopBar.tsx)菜单。
- **页面**：[`src/creative/CreativeApp.tsx`](../src/creative/CreativeApp.tsx) 依 §2.1 出三栏（顶栏 / 左栏槽位 / 中栏「预览 · 还缺哪些图 · 路面填图板」三页 / 右栏检视器 ＋ 底部提示条），窄屏抽屉；编辑器自身只用程序绘制样式与 lucide 图标（`S-18`）。
- **预览＝真渲染、非示意**：[`src/creative/CreativePreview.tsx`](../src/creative/CreativePreview.tsx) 把靶子 `.pmod` 起一局后，把本工程 manifest 与素材源**作为入参覆盖**顶进 [`src/play/MapView.tsx`](../src/play/MapView.tsx)（**不写全局皮肤**，游玩页 / 构建页一格不改）；`MapView` 新增三个**可选**入参 `manifest` / `assets` / `onlyAssets`，并把 `onStep` 改为可省（省掉即**只读预览**）。「只看素材」＝脱掉程序绘制兜底，画面剩下的就是这份皮肤**真正提供了什么**。
- **打开本地目录**（D4「`.pp` 或本地目录」的另一半）：`pickDirectory()` ＋ [`package.ts`](../src/creative/package.ts) `readSkinDirectory()`（剥公共顶层目录后走同一条 `readSkinEntries()`）；**导入即入皮肤库**（裁决 15）落到代码，导出产物不自动入库。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **54 个文件 / 658 项**全绿；`npm run build` 通过；真浏览器实测三路由可渲染且无 console 报错。
- **两处留白（不臆造数据 / 不越设计）**：① 检视器「目标尺寸 / 是否成整倍数」需要设计侧一份**目标尺寸表**（文档只有尺寸行，无机器可读数据），当前只给缩略图 ＋ 原始尺寸；② 九宫格面板的**分区高亮实时预览**与「可拖尺寸的拉伸预览框」未落地（拖线 / 填数 / 黑边识别 / 成对校验 / 另存九张已在）。两项记于 [`task/04-skin.md`](../task/04-skin.md) D4 顶部与 [`design/skin/09-creative.md`](design/skin/09-creative.md) §六「已知边界」。

**2026-09-30 · 收口裁决：定位线开关 ＋ 朝向基准 ＋ 可缩放素材（[`design/07-decisions.md`](design/07-decisions.md) §8.4）**
- **裁决 27 · 每 10 格那条线是「定位线」**：它是**叠在地图之上的辅助层**、只作读数定位用，**贴图本身不含间距与分割线**；游玩态在**菜单**里给这一层一个开 / 关（默认开）。同批把绘图口径定死——**全局朝向基准：上北下南、左西右东**，素材只按基准朝向画一次、其余朝向旋转复用；[`design/skin/01-road.md`](design/skin/01-road.md) §四 拆出 **§4.1 逐槽位基准朝向表**（尽端路基准＝**连通面朝南**，遇到连通面在北的就**旋转 180°**），与 [`src/engine/skin/road-bits.ts`](../src/engine/skin/road-bits.ts) 的 `roadTileOf()` 逐格对齐——规则本就如此，这次只是写成**作图口径**。
- **代码**：[`src/play/MapView.tsx`](../src/play/MapView.tsx) 新增 `guides?: boolean`（默认 `true`，关掉即整层不画）；[`src/play/GameScreen.tsx`](../src/play/GameScreen.tsx) 菜单新增「定位线 开 / 关」（走中性 `plain` 档，不关菜单、可连点）。验收：`npx tsc --noEmit` 无错；`npx vitest run` **53 个文件 / 644 项**全绿（[`mapView.test.tsx`](../src/play/__tests__/mapView.test.tsx) 新增 1 项开关断言、[`windowButtons.test.tsx`](../src/play/__tests__/windowButtons.test.tsx) 菜单项数 6 → 7）。
- **裁决 28 · 需拉伸的素材一律是「可缩放素材」**：窗体 / 面板 / 按钮 / 建筑 / 色块这一族**原图尺寸可以很小**，运行期靠九宫格 / 拉伸铺满，**不为窄屏单独出图**——[`design/skin/03-window.md`](design/skin/03-window.md) §七.1 的「窄屏宽面板」**作废**（看着像问题，只是开发没做完）。Creative 模式的 **`.9.png` / 九宫格切片设置面板**写进 [`design/skin/09-creative.md`](design/skin/09-creative.md) §2.3（四根参考线与四个数值框双向联动、黑边只读识别、实时预览、写回 `slice` ＋ `fill`）；**注**：Creative 模式已于 2026-09-30 接线落地（[`src/app/router.ts`](../src/app/router.ts) 三支 `play` / `build` / `creative`），见下文进度同步。
- **裁决 29 · 分隔线不走平铺**：`rules.line` 保持**单轴九宫格**、不引入 `tile` 第二套字段；`tile` 的唯一候选收敛为坐标参照线（定位线）。
- **裁决 30 · 兜底永远是「纸笔涂鸦风格」**：素材缺位时的程序绘制形态是**正式观感、不是占位**；据此 [`src/styles/theme.css`](../src/styles/theme.css) 按钮四态的**三处 `!important` 保留**（作用域只有该按钮自身两条声明，无功能与后期隐患）。

**2026-09-30 · D3 第十四屏：按钮 `hover` / `active` / `disabled` 三态接入（[`design/skin/03-window.md`](design/skin/03-window.md) §4.1 / §八）**
- **四态各查自己的态**（[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts)）：新增 `ButtonState` / `BUTTON_STATES` 与 `buttonStatesOf(win, kind)`，**只交出真写了的态**——某态没写就**不在这张表里**，而不是预先替它补一份 `normal`（否则「写了却缺图」与「根本没写」就分不开了）；缺 `normal` 即**整颗按钮算没配**（只写 `hover` 不会凭空多出一张底图）。`buttonOf()` 退化成「取 `normal` 那一项」，老调用点一行不动。
- **四态分两种落法**（[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `buttonStyle(states, assets)`）：`normal` 仍是**行内**属性（与容器 / 格子同档）；另三态落成行内写下的**一对 CSS 变量**（`--sk-<态>-bg` 整图拉伸 / `--sk-<态>-bi` 九宫格简写，后者由新增的 `nineShorthand()` 出、与 `nineStyle()` 的四条长写同义）。**各态按自己那张图的铺法算**（带 `slice` 走九宫格、否则整图拉伸），与 `normal` 无关。
- **为什么只能走变量**：行内样式写不出伪类，而 `.btn:hover` / `:active` / `:disabled` 是 CSS 的原生状态——[`src/styles/theme.css`](../src/styles/theme.css) 新增三条规则按状态取用，`!important` 用于压过 `normal` 那份行内样式（**全文件仅此三处**）。缺省链就写在规则里：`var(--sk-hover-*, var(--sk-normal-*))`——**该态没配、或该态的图不在包里都自然回落 `normal`**，与 §4.1 表格逐行对应；`.btn:disabled` 那条排在最后，故禁用按钮被悬停时仍取禁用图 / `normal`。
- **接线与调用方不变**：变量与 `normal` 那份行内属性在**同一个 `style` 对象**里，[`src/ui/useButtonStyle.ts`](../src/ui/useButtonStyle.ts) 的 `useButtonStyle(kind)` 原样返回，四处落点 `style={x}` 一行不动。未启用皮肤 / 没配该键 / 缺 `normal` 时三条规则一律取到 `none`，与纸面 `.btn` 等价——**构建页同样一处不受影响**。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **53 个文件 / 643 项**全绿（[`src/play/__tests__/windowButtons.test.tsx`](../src/play/__tests__/windowButtons.test.tsx) 补 5 项落点、[`src/ui/__tests__/texture.test.tsx`](../src/ui/__tests__/texture.test.tsx) 补 5 项 `buttonStyle`、[`src/engine/skin/__tests__/window.test.ts`](../src/engine/skin/__tests__/window.test.ts) 补 6 项 `buttonStatesOf`）。文档侧 [`design/skin/03-window.md`](design/skin/03-window.md) §4.1 改为「四态都已接入」、§六 的 `KW-6` 作废、§七.3 收口、§八「按钮」重写；任务侧 [`task/04-skin.md`](../task/04-skin.md) 拆出「按钮三态」并勾选、D7 回归项改为四态实测。
- 同屏结论：`window` 这一节的**可接项至此全部接完**——只余 `KW-*` 校验层（D6 汇总批）；`tile` 平铺**已裁决移出本节**（裁决 29：分隔线不走平铺，唯一候选＝定位线）。

**2026-09-30 · D3 第十三屏：条 / 提示条 / 分隔线接入 ＋ 九宫格提前落地（[`design/skin/03-window.md`](design/skin/03-window.md) §4.4 / §八）**
- **D3「`window` 其余」的第二项落地**：三节六键——`bars`（`hp` / `mp`，各两张）、`hints`（`ok` / `warn` / `error`）、`rules.line`。这三族**必须九宫格 / 单轴九宫格**（硬拉伸违反 `KW-3`），原本整批留到 V2.2；本批把**九宫格一并提前落地**，故六键在 V2.1 内**全部收口**。
- **九宫格没有新字段**：由素材自己声明（`SkinTexture` 的 `slice`）——[`src/engine/skin/texture.ts`](../src/engine/skin/texture.ts) 新增 `surfaceMode(ref)`（素材带 `slice` → `nine`，否则 `stretch`），`effectiveMode(mode?, slice?)` 把关「`nine` 要策略 ＋ 切片齐备才成立」（只写 `mode: 'nine'` 而没给 `slice` 回落 `stretch`，不画半张九宫格）；[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `surfaceStyle()` 内部多一个分支——`nine` 出 `border-image` 四件套（`Source` / `Slice` / `Width` / `Repeat`，`slice` 末带 `fill`），**不写 `borderWidth`**（素材不许改布局）。**容器 / 按钮 / 格子 / 条 / 提示条 / 分隔线六处一次升级，调用方一行不动**（§五「调用方接口不变」的兑现）。SVG 层（地图 / 画布 / 棋子）本批不动；`tile` 待接线（后由裁决 29 收敛为「唯一候选＝定位线」）。
- **取值新增三个纯函数**（[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts)）：`barOf(win, tone)`（`BAR_TONES = ['hp','mp']`）、`hintOf(win, tone)`（`HINT_TONES = ['ok','warn','error']`）、`ruleOf(win)`（只有 `rules.line`）——一律**不跨键 / 不跨档借用**。**条多一层结构**：`bars.<档>` 一次给两张（`track` / `fill`），故 [`src/ui/useBarStyle.ts`](../src/ui/useBarStyle.ts) 返回 `{ track?, fill? }`，**两张各自独立**（只配一张不影响另一张）；提示条 [`src/ui/useHintStyle.ts`](../src/ui/useHintStyle.ts) 返回**单个**样式；分隔线 [`src/ui/useRuleStyle.ts`](../src/ui/useRuleStyle.ts) 无参。
- **六个落点**：[`StatusPanel.tsx`](../src/play/StatusPanel.tsx) 属性面板血蓝条（`Bar` 的 `tone` 由 `'hp' | 'mp'` 放宽为 `BarTone`）、[`BattleDialog.tsx`](../src/play/BattleDialog.tsx) 交锋弹层对手血条（与属性面板**同键**，不是两套素材）、[`GainNoteView.tsx`](../src/play/GainNoteView.tsx) 的「没拿下」`.hintbox.warn`、[`EncounterView.tsx`](../src/play/EncounterView.tsx) 的事件判定框（**同一个 `.hintbox` 按 `verdict` 换三档** → `success` / `blocked` / `fail`；hook 不落条件分支，故三档**全部先取**再挑一份）、[`LoadScreen.tsx`](../src/play/LoadScreen.tsx) 与 [`StartScreen.tsx`](../src/play/StartScreen.tsx) 的警告条 ＋ 分隔线、[`BagPanel.tsx`](../src/play/BagPanel.tsx) 背包与「穿戴中」之间的分隔线。
- **中性档不设键也不借用**：裸 `.hintbox`（中性提示，如 `MapView` 的空态「这一局没有地图」）语气上不属于三档，调用方**不调 hook**，由 CSS 全权表现；构建页的 `.hintbox`（校验清单 / 编辑器提示）**不接**，与「构建页画布未接」一致。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **53 个文件 / 627 项**全绿（新增 [`src/play/__tests__/windowParts.test.tsx`](../src/play/__tests__/windowParts.test.tsx) 11 项落点 ＋ [`src/ui/__tests__/texture.test.tsx`](../src/ui/__tests__/texture.test.tsx) 补 5 项 `surfaceStyle`、[`src/engine/skin/__tests__/texture.test.ts`](../src/engine/skin/__tests__/texture.test.ts) 改写 `effectiveMode` 断言并新增 4 项「策略 ＋ 切片齐备 / 平铺独立 / 拉伸缺省 / `surfaceMode`」）。设计侧同步 [`docs/design/skin/03-window.md`](design/skin/03-window.md) 新增 §4.4 与 §八「条 / 提示条 / 分隔线」「九宫格」、[`docs/design/skin.md`](design/skin.md) §3.3 / §四 / `S-1` 三处改口径；任务侧 [`task/04-skin.md`](../task/04-skin.md) 勾掉「`window` 其余」条并把九宫格从 V2.2 线移到本批。
- 同屏遗留：**按钮 `hover` / `active` / `disabled` 三态**（§4.1）——九宫格落地后它已成**独立的一批**，与九宫格无耦合（**已由 D3 第十四屏收口**）。

**2026-09-30 · D3 第十二屏：固定族格子 `window.slots` 接入（[`design/skin/03-window.md`](design/skin/03-window.md) §4.3 / §八）**
- **D3「`window` 其余」的第一项落地**：四个**固定族格子**键——技能格 / 奖励卡 / 背包格 / 部位标签——接入 `window.slots`。固定族尺寸写死（§二：技能格 54 / 奖励卡 92 / 部位标签 44），故 V1 走**整图等比拉伸**，不需要九宫格，这一项因此能在 V2.1 内完成。
- **与容器 / 按钮同一条取图链**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `SLOT_KINDS` / `slotOf(win, kind)`（四键**不跨键借用**）→ [`src/ui/useSlotStyle.ts`](../src/ui/useSlotStyle.ts) 的 `useSlotStyle(kind)` 复用 `surfaceStyle()`。V1.1 接九宫格时**容器 / 按钮 / 格子一处改完**（`surfaceStyle()` 内部换 `border-image`），三侧调用方一行不动。
- **四个落点**：[`SkillBar.tsx`](../src/play/SkillBar.tsx) 与 [`BattleDialog.tsx`](../src/play/BattleDialog.tsx) 的 `.skill-slot`（**两处共用 `skill`**，不是两套素材）、[`GainNoteView.tsx`](../src/play/GainNoteView.tsx) 的 `.reward-card`、[`EquipPanel.tsx`](../src/play/EquipPanel.tsx) 的 `.equip-slot`、[`BagPanel.tsx`](../src/play/BagPanel.tsx) 的背包格与穿戴格 `.bag-cell`。未配该键 / 包里缺图 / 未启用皮肤一律不传 `style`，CSS 纸面照旧。
- **背包格的交叠已定**（原文留待 V1.1 的唯一原因）：`.bag-cell` 同时是道具衬底位（[`06-item-building.md`](design/skin/06-item-building.md) §3.2），取「**道具衬底优先、格位底纹兜底**」——调用点写 `cell ?? bagSlot`（`cell` 为 `undefined` 即道具没配 `background`），**hook 本身仍是纯读取、不判别**，两节因此不会抢同一个落点、同一格上只出现一层。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **52 个文件 / 608 项**全绿（新增 1 个用例文件 / 16 项：[`src/play/__tests__/slotSkin.test.tsx`](../src/play/__tests__/slotSkin.test.tsx) 12 项落点（含背包格两半的优先级）、[`src/engine/skin/__tests__/window.test.ts`](../src/engine/skin/__tests__/window.test.ts) 补 4 项取值，且旧的「整节没接管 → 一个行内样式都不传」不变量未回归）。任务侧 [`task/04-skin.md`](../task/04-skin.md) 拆出已勾选的「固定族格子」条。

**2026-09-30 · D3 第十一屏：音频 `audio` 解析与校验接入（[`design/skin/07-audio.md`](design/skin/07-audio.md) §五 / §八）**
- **承接裁决 16 的「V1 只解析预留、不播放」**：本批把 `audio` 这一节的**解析与校验**接上——识别字段、校验事件键与 `volume`、给加载期提示；**不建 `AudioContext`、不请求 / 解码素材、不播放**，播放（含 `KA-5` 曲目时长）整体留 V2.2。
- **取值与校验归纯函数**：[`src/engine/skin/audio.ts`](../src/engine/skin/audio.ts) 新增 `bgmOf()` / `sfxOf()`（原值）、`bgmTrackOf()` / `sfxTrackOf()`（收成 `{ file, loop?, volume }`，把字符串 / 对象两写法、缺省、越界一次算清）、`clampVolume()`（越界夹回 0–1，不静音不换算）；缺省常量 `BGM_DEFAULT_VOLUME = 0.5` / `BGM_DEFAULT_LOOP = true` / `SFX_DEFAULT_VOLUME = 0.8`。**场景 / 事件各查自己的键、不跨键借用**。
- **报码**：`unknownSfxEvents()` 出 `KA-2`（§三 清单外的 `sfx` 事件键、忽略），`outOfRangeVolumes()` 出 `KA-3`（`volume` 越界项的出处，形如 `audio.bgm.map.volume`）。
- **`KA-4` 落 IO 层**：[`src/io/pp.ts`](../src/io/pp.ts) 新增 `checkAudio()`——单文件体积要读**包内条目长度**（`engine/skin/audio.ts` 不碰 zip）；路径**先去重**，同一个文件被多处引用只报一次；阈值 `AUDIO_MAX_BYTES = 2 MB`。
- **码表**：`SkinIssueCode` 新增 `KA-2` / `KA-3` / `KA-4`，与包级 `KP-*` 同一码空间；**`KA-1`（路径不存在）不单列**——由包级 `KP-2` 的通用收集（按扩展名认音频）判，单列会让同一条缺失在清单里出现两遍；`KA-5` 待 V2.2。
- **类型收紧**：`SkinAudio.sfx` 的值由 `SkinTexture` 收紧为 `string | SkinSfxObject`（音效不吃贴图对象）。
- **已知边界**：越界音量只在**已知事件键**上判——写在清单外的键整体已被 `KA-2` 忽略，其音量**不另判**。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **51 个文件 / 592 项**全绿（本轮新增 2 个用例文件 / 31 项：[`src/engine/skin/__tests__/audio.test.ts`](../src/engine/skin/__tests__/audio.test.ts) 18 项纯函数、[`src/io/__tests__/pp-audio.test.ts`](../src/io/__tests__/pp-audio.test.ts) 13 项加载期，含「`KA-1` 不与 `KP-2` 重复报」不变量）。里程碑状态：[`task/04-skin.md`](../task/04-skin.md) 的 `audio` 条勾选；设计侧 [`design/skin/07-audio.md`](design/skin/07-audio.md) 新增 §八 实现落点、§五 补状态列与 `KA-1` 说明。

**2026-09-30 · D3 第十屏：图标按名替换接入（[`design/skin/04-misc.md`](design/skin/04-misc.md) §四 / §十）**
- **承接 `misc` 的地图标记 ＋ 骰子那一批**：本批落 §四 的 **lucide 图标按名替换**——键即 lucide 图标名，清单 `ICON_NAMES` 九个（`Sword` / `Hammer` / `FileDown` / `FileUp` / `LibraryBig` / `Menu` / `Flag` / `StepForward` / `X`），正好是游玩态实际写到的那九个；**构建页不接**。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `ICON_NAMES` / `IconName` 与 `iconOf(misc, name)`——**按名各查自己的名、不跨名借用**（配了 `Sword` 不会让同屏的 `Hammer` 跟着出图）；`misc` 整节缺位不抛；**清单外的名字**照样照读但静默搁置（清单声明的是落点，不是白名单）。
- **入口组件**：[`src/ui/GameIcon.tsx`](../src/ui/GameIcon.tsx) 把各处原来直接写的 `<Sword size={22} />` 统一成 `<GameIcon name="Sword" size={22} icon={Sword} />`——配了该名就出素材，没配 / 缺图 / 未启用皮肤就原样交给 `icon` 那一个 lucide 元件，**业务代码不判断素材类型**。
- **落图**走**行内层** `InlineTexture`（与「内容 emoji」同一档）：**不套手绘滤镜**（位图，不给画笔加滤镜）、**不加衬底**（§四；与组件库的圆角矩形衬底区分开）。素材按 lucide 那档的 `size` 占 `size × size` 的盒、`object-fit: contain` 等比内缩，**换与不换都不动布局**。接线 [`src/ui/useIconSkin.ts`](../src/ui/useIconSkin.ts) 的 `useIconTexture(name)`（`iconOf()` → `textureRef()` → `textureProps()`，与各链同一条底线）。
- **落点**（八个文件、九个名字）：[`LoadScreen.tsx`](../src/play/LoadScreen.tsx)（`Sword` 22 / `Hammer` 16 / `FileDown` 14、13 / `FileUp` 14 / `LibraryBig` 13）、[`GameScreen.tsx`](../src/play/GameScreen.tsx)（`Menu` 18 菜单入口 / `Flag` 16 结算弹层标题）、[`DiceHud.tsx`](../src/play/DiceHud.tsx)（`StepForward` 13）、[`DiceLog.tsx`](../src/play/DiceLog.tsx) / [`BagPanel.tsx`](../src/play/BagPanel.tsx) / [`EquipPanel.tsx`](../src/play/EquipPanel.tsx) / [`StatusPanel.tsx`](../src/play/StatusPanel.tsx)（`X` 14 关闭）。
- **两处明确不归这里**（§四）：**内容 emoji**（职业 / 道具 / 怪物 / 技能）由组件定义驱动、走 `role` / `item` 各节替换；**兜底字形**（`🙂` / `✦` / `❔` / `🎲` / `🔒`）是素材缺失时的最终保底，**永远不可覆盖**——可覆盖就失去保底意义。故给它们配 `misc.icons` 也没有落点。
- **未接**：`node.building`（**必须九宫格**，`KM-1` → V1.1，与容器衬底同批）、引导线（属**平铺** `tile`，V1 无该策略 → V2.2）、`die.rolling`（待确认 2 未裁决）；`KM-1`–`KM-3` 的清单提示等校验层（`SkinIssueCode` 现只有 `KP-*`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **49 个文件 / 561 项**全绿（本轮新增 2 个用例文件 / 17 项：[`src/engine/skin/__tests__/misc-icons.test.ts`](../src/engine/skin/__tests__/misc-icons.test.ts) 6 项纯函数——按名读、不跨名借用、`misc` 缺位不抛、清单外的名照样照读、`ICON_NAMES` 定序、兜底字形与内容 emoji 都不在清单里；[`src/play/__tests__/miscIcons.test.tsx`](../src/play/__tests__/miscIcons.test.tsx) 11 项落点——封面两键各取各的、折叠区三种图标、素材按 `size` 占盒且走行内层、不跨名借用、HUD `StepForward` 与菜单 `Menu`、面板 `X` 一处配置三处生效、结算 `Flag`、没配 / 缺图 / 未启用皮肤一律回退 lucide、清单外的名没有落点）。里程碑状态：[`task/04-skin.md`](../task/04-skin.md) 的 `misc` 条拆出「图标（按名索引）」并勾选；设计侧 [`design/skin/04-misc.md`](design/skin/04-misc.md) §四 补接入说明、§十 补「图标」取图 / 落图 / 落点，并把「未接部分」的图标一条改写为「内容 emoji 与兜底字形不归 `misc.icons`」。

**2026-09-30 · D3 第九屏：按钮 `normal` 态接入（[`design/skin/03-window.md`](design/skin/03-window.md) §四 / §四.1 / §八）**
- **承接容器衬底那一批**：`window` 的「随视口族」（容器）已落，本批落 §四 的**七个按钮键**——`plain` / `primary` / `danger` / `ghost` / `small` / `icon` / `close`，**按元素角色给、不按类名给**；按钮属「随内容族」（盒随文字量变，§二），V1 与容器同档走**整体拉伸**。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `ButtonKind` 与 `BUTTON_KINDS`（七键的定序清单，清单 / 遍历用）、`buttonOf(win, kind)`——**七键各查自己的键、不跨键借用**；四态对象**只取 `normal`**，**缺 `normal` 即整颗按钮算没配**（老包 / 手写配置不会因为只写了 `hover` 就凭空多出一张底图），字符串写法等价于只写 `normal`。
- **落图与接线**：容器那份**原样复用**——[`src/ui/useButtonStyle.ts`](../src/ui/useButtonStyle.ts) 的 `useButtonStyle(kind)` 走同一条「`buttonOf()` → `textureRef()` → `surfaceStyle()`」。与容器的差别**只有一处**：容器取 `surfaces.<键>` 的值，按钮多一步「从四态里挑 `normal`」；故 **V1.1 接九宫格时容器与按钮一处改完**（`surfaceStyle()` 内部换 `border-image`），两侧调用方一行都不动。**未启用皮肤 / 没配该键 / 包里缺这张图一律 `undefined`** ⇒ 调用方**不传 `style`**、CSS 纸面照旧。
- **四态只读 `normal`**（§4.1，`KW-6`）：`hover` / `active` / `disabled` 仍由 CSS 表现——`:disabled { opacity }` 与 `:active { transform }` 照旧生效，`:hover` 变的只是素材**之下**的底色（素材不透明时看不出变化，属 V1 既定取舍）；**禁用按钮照样拿 `normal` 那张图**。
- **落点**：各屏按钮按角色接键——战斗 / 对话 / 遭遇 / 结算的确定键走 `primary`、取消 / 次项走 `plain`、`不防御`走 `danger`（自杀语义）；地图顶栏菜单入口走 `icon`、抽屉项走 `plain`、标题栏关闭走 `close`；小尺寸加点 / 次级按钮走 `small`；封面「开始冒险」`primary` / 「构建世界」`plain` / 「其他开始方式」`ghost`；首页「出发」`primary` / 「换一局」`plain`。**构建页 `.btn` 不接**（含 [`src/ui/RowMenu.tsx`](../src/ui/RowMenu.tsx)，只被组件库用）。
- **未接**：`hover` / `active` / `disabled` 三态（与九宫格**同批** → V1.1，两者落法都在 `surfaceStyle()` 内部、分两批要改两遍同一个函数；**已由 D3 第十四屏收口**）、固定族格子（技能格 / 奖励卡 / 部位标签）、提示条 / 条 / 分隔线（**必须九宫格**，`KW-3`）；`KW-1` / `KW-5` / `KW-6` / `KW-7` 的清单提示等校验层（`SkinIssueCode` 现只有 `KP-*`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **47 个文件 / 544 项**全绿（本轮新增 1 个用例文件 / 16 项：[`src/play/__tests__/windowButtons.test.tsx`](../src/play/__tests__/windowButtons.test.tsx) 11 项**专盯落图**——攻击 / 防御共用 `primary` 而不防御走 `danger`、缺键不借图、掷骰 `primary` 与菜单 `icon` 各取各的、抽屉 `plain` 与关闭 `close`、面板 `small` / `close`、封面三键、首页两键、未配 / 缺图一颗都不传 `style`、禁用仍拿 `normal`、七键互不借用；[`src/engine/skin/__tests__/window.test.ts`](../src/engine/skin/__tests__/window.test.ts) 补 5 项纯函数用例——字符串＝只写 `normal`、四态缺 `normal` 取不到、七键不借用、`window` 节缺位不抛、`BUTTON_KINDS` 定序）。里程碑状态：[`task/04-skin.md`](../task/04-skin.md) 的 `window` 条拆出「按钮 `normal` 态」并勾选；设计侧 [`design/skin/03-window.md`](design/skin/03-window.md) §八 补「按钮」实现落点、§4.1 排期行定稿为 **D3 第九屏接入 `normal`**、其余三态与九宫格**同批**（V1.1）。

**2026-09-30 · D3 第八屏：欢迎页 `startup` ＋ 游戏首页 `lobby` 接入（[`design/skin/08-pages.md`](design/skin/08-pages.md) §2.1 / §2.2 / §七）**
- **两屏全落**：整屏背景（`fit` 三档）＋ 欢迎页三件图形（标题字形 / 主视觉 / 装饰骰子）＋ 世界简介面板底 ＋ 出身卡（含选中态）。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `pageFitOf(bg)`——`cover` / `contain` / `tile`，**非法值与缺省一律回退 `cover`**（`KPG-1` 只提示、不改行为）；`pageBgOf(page)`——**两屏各查自己那一节的 `bg`、互不借用**（§2.3 逐节点降级）；`startupArtOf(startup, art)`——`title` / `cover` / `dice` 三键一个入口，未配该键即 `undefined`；`lobbyCardPaint(lobby, selected)`——`CardPaint = { img, stroke }`，`selected.img` 缺位**沿用卡底**、`stroke` 只在选中态给，`card` 整节没配即 `undefined`。
- **整屏背景的落法**：[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 新增 `pageBgStyle(ref, assets, fit)`，三档各是一种铺法——`cover` → `background-size: cover`、`contain` → `contain`、`tile` → `background-size: auto` ＋ `background-repeat: repeat`，一律居中。与衬底同一条底线：**只写 image 与铺法、不动 `background-color`**（`contain` 留出的两侧边由主题底色兜着，取舍 `S-26`）；未启用皮肤 / 没配该键 / 包里缺这张图，一律返回 `undefined` ⇒ 调用方**不传 `style`**、纸面底纹照旧（半素材化是正常状态）。
- **欢迎页** [`src/play/LoadScreen.tsx`](../src/play/LoadScreen.tsx)：`bg` 落在**整屏容器** `.play-shell.no-topbar`——不是内层的 `.load-cover`，那层带着页面留白、铺不满屏。`title` 走**行内层** `InlineTexture`（盒取 `CSS_SIZED_BOX`；尺寸交给新增的 `.cover-title .cover-title-art`——**高 `0.86em`、宽由素材宽高比推出、绝不拉伸**），**文案不变、落在 `alt="PopRPG"` 上**（取舍 `S-14`）。`cover` 用 `SvgTexture` **整块替换洞穴手绘**，复用现成的 `<svg class="cover-cave" viewBox="0 0 120 92">` 当盒（V1 拉伸进盒，取舍 `S-1`），出了图就一条 `path` 都不留。`dice` 只给**骰子本体**（`surfaceStyle(…, 'contain')`——与 `misc.dice.body` 同一档落法：等比进盒、绝不拉伸），**骰面复用 `misc.dice`**：装饰骰子直接渲染现成的 `DieFace`（`useDieFace()`），本节**不另设骰面字段**（`KPG-4`）。三颗装饰骰子各成一个 `CoverDie` 小组件（hook 不能写在条件 / 循环里），**没配骰面时仍是程序绘制的数字面**——`.die` 的缺省观感不因皮肤改变。
- **游戏首页** [`src/play/StartScreen.tsx`](../src/play/StartScreen.tsx)：`bg` 落在 `.play-shell.start-screen`；`panel` 落 `.panel.scroll`（V1 拉伸）；`card` 落每一张 `.class-card`——`img` 用 `surfaceStyle()` 铺满整卡（V1 拉伸，`KPG-2`），`stroke` **只写在选中那一张**（未选中**不碰** `border-color`、交还给 CSS——与衬底三元组的「描边缺省不绘制」不同，这里是整张卡）。两态各算一次（`useLobbyCardStyle(false | true)`：卡片在 `map` 里、hook 不能写在回调内）再按 `selectedId` 取。
- **接线** [`src/ui/usePageSkin.ts`](../src/ui/usePageSkin.ts)：`useStartupBgStyle()` / `useLobbyBgStyle()` / `useLobbyPanelStyle()` / `useLobbyCardStyle(selected)` / `useStartupArt(art, box)` / `useStartupDiceBody()`——只做「取图 → 落图」一次接线，两屏共用一份 store 状态。
- **未接**：封面标语 / 副标题 / 版本号 / 警告条的文字与字体（§2.1 末条、取舍 `S-15`）、卡片内的职业图标与立绘（归 [`design/skin/02-role.md`](design/skin/02-role.md)）、按钮与徽章（归 [`design/skin/03-window.md`](design/skin/03-window.md)）；`card` / `panel` / `dice` 的 `slice` 九宫格随取舍 `S-1`（V1 一律拉伸 → V1.1）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **46 个文件 / 528 项**全绿（新增 2 个用例文件 / 24 项：`engine/skin/__tests__/page.test.ts` 10 项 ＋ `play/__tests__/pageSkin.test.tsx` 14 项——**落图**：`fit` 三档、标题换字形与 `alt`、主视觉替掉 `path`、装饰骰子本体与复用骰面、卡片两态，以及「没配 / 缺图 ⇒ 一个 `style` 都不传」）。里程碑状态：[`task/04-skin.md`](../task/04-skin.md) 的 `startup` / `lobby` 条勾选；设计侧新增 [`design/skin/08-pages.md`](design/skin/08-pages.md) §七「实现落点」。

**2026-09-30 · D3 第七屏：道具 `item` ＋ 建筑 `building` 接入（[`design/skin/06-item-building.md`](design/skin/06-item-building.md) §二 / §3.1 / §3.2 / §七）**
- **`item` 一条全落、`building` 落地图节点**：背包／穿戴格子的**图标 ＋ 衬底**与地图建筑节点（贴图、名称字体字色、衬底接管 `rect`）已接；物品／建筑**信息视图**与**组件库**按原因后置，见文末。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `itemSkinOf()` / `buildingSkinOf()`（键一律组件 `id`、**不跨键借用**）、`groundPaint(field, fallback?)`（衬底三元组：字符串写法＝只写 `fill`；`fill` 缺省用组件 `color`、再缺主题色；**三项全空即整节未接管**——判的是**原字段**、兜底色救不回来）、`buildingImgOf(building, misc, id)`（`building[<id>].img ?? misc.nodes.building`，**全篇唯一的一处跨节回退**；节点查不到组件（`id` 为空）时**不拿空串去撞键**，直接走通用件）。
- **衬底一种落法吃三处**：[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `groundStyle(paint, assets)`——`img` → `background-image`（`100% 100%` / no-repeat / center，V1 一律拉伸）、`fill` → `background-color`、`stroke` → `border-color`。**未给 `stroke` 时写 `transparent` 而不是摘掉边框**，只为**不改盒尺寸**（裁决 18「描边缺省不绘制」＋ 取舍 `S-24` 明确只改观感、不改布局）；整节未接管返回 `undefined`，调用方**不传 `style`**、CSS 纸面照旧（`S-11`——素材是可选叠加层）。
- **道具**：渲染件 [`src/ui/ItemGlyph.tsx`](../src/ui/ItemGlyph.tsx)——有素材出**行内层** `InlineTexture`（尺寸交给所在处的 `.bag-ico` / `.equip-ico` 字号、等比内缩），否则原样输出组件 `icon` 字形；取图沿用唯一入口 `textureProps()`，故「包里缺这张图」「皮肤没启用」自动落到字形、调用方**不判断素材类型**。三处落点：[`src/play/BagPanel.tsx`](../src/play/BagPanel.tsx) 的背包格与穿戴格（`.bag-cell` 衬底，`fill` 兜底＝组件 `color` → `fallbackColor(id)`）、[`src/play/EquipPanel.tsx`](../src/play/EquipPanel.tsx) 的穿戴行与**更换气泡候选**。**`bag-name` 的字体字色不接**（§一 规则 2：名称／说明文字一律归窗体，`item` 本就不得写 `font` / `fontColor`）。
- **建筑**：[`src/play/MapView.tsx`](../src/play/MapView.tsx) 的 `NodeShape`——`img` 可用即用 **`<g transform="rotate(-0.6° …)">` ＋ `SvgTexture` 整图替换 `rect`**（`x/y + 3`、`w/h − 6`：**保留 3px 内缩与倾斜角**，取舍 `S-9`；字号仍由代码固定 11px，`S-10`），该节点的**图标字形不再绘制**（`🧳` 让位给贴图、名称仍留）；未出图时 `background.fill` / `background.stroke` 接管 `rect`（`fill` 沿用 α0.42；**`stroke` 缺省即 `transparent` ＋ `stroke-width: 0`**）；两件都缺则程序绘制形态照旧，**含组件色描边**（`S-11`）。
- **名称字体字色**：`fill = buildingSkin.fontColor ?? 'var(--ink-soft)'`；`font` 走 [`src/ui/skinFont.ts`](../src/ui/skinFont.ts) 的 `usePackFont()`——包内文件（按扩展名 `ttf` / `otf` / `ttc` / `woff` / `woff2` 识别）注入 `@font-face`（**族名取文件名去扩展名**、`font-display: swap`），**内置字体名原样交给 CSS、不注入**，**包里缺该文件即回退内置字体**（`KIB-4`，不写 `font-family`）。
- **未接**：§3.3 物品／建筑**信息视图**与 §3.4 **组件库**（等 [`design/skin/03-window.md`](design/skin/03-window.md) §四.2 的图标 ＋ 衬底组合件与构建页排期）；`KIB-1`–`KIB-8` 校验层（`SkinIssueCode` 现只有 `KP-*`）；**`misc.nodes.building` 的九宫格**（`KM-1`，V1 无 `slice` → **V1.1**；本轮它只作 `building.img` 缺位的回退通用件、按**普通拉伸**顶替）与**固定族格子**（技能格 / 奖励卡 / 部位标签）上 `item.background` 的落点（→ V1.1）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **44 个文件 / 504 项**全绿（新增 2 个用例文件 / 33 项：`engine/skin/__tests__/item-building.test.ts` 11 项 ＋ `play/__tests__/itemBuildingSkin.test.tsx` 22 项，后者专盯**落图**——背包格衬底三件套 / 图标改图与回字形、地图节点整图替换与 3px 内缩 / 名称字色字体 / 缺文件回退）。里程碑状态：[`task/04-skin.md`](../task/04-skin.md) 的 `item` / `building` 条勾选；设计侧新增 [`design/skin/06-item-building.md`](design/skin/06-item-building.md) §七「实现落点」。

**2026-09-30 · D3 第六屏：`misc` 地图标记 ＋ 骰子接入（[`design/skin/04-misc.md`](design/skin/04-misc.md) §二 / §三 / §十）**
- **两组一起落**：起点 / 终点 / 脚印（地图标记族）与骰子本体 / 骰面（骰子族）已接 `misc`；**图标与引导线未接**、`node.building` 与骰子动画态按原因后置，见文末。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `markOf(misc, kind)`（`start` / `end` / `footprint` 各查自己的键、**不跨键借用**）、`dieBodyOf(misc)`（本体**一张通吃 46 / 38 / 34 三档**、不分尺寸档）、`dieFaceOf(misc, pips)`（`1`–`6` → 点阵 `d1`–`d6`；**其余点数一律 `numeric`**——`2D6` 的合计值与流程里的异常值都走这条）。缺位一律 `undefined`：包里只有 `d1` / `d6` 时 `d2` 取不到，**那一面自己回退程序点阵、不倒借别的面**。
- **三种落法各归其位**：**标记**走 SVG 层（`textureProps` ＋ `SvgTexture`），盒＝**整格**、与道路同一约定（[`design/skin/01-road.md`](design/skin/01-road.md) §3.1）——素材按 `cellSize × cellSize` 正方形交付、图形自己居中留白，原先程序绘制旗 / 叉占格 86%、脚印占格 60%，**素材接管后内缩比例由素材自己定**；**骰子本体**走 **CSS 背景**、`surfaceStyle(…, 'contain')`（等比缩放进 `.die` 盒、**绝不拉伸**，§三「不拉伸」；描边与圆角照旧归 CSS，同 §五「素材只提供纸面底纹」的规矩）；**骰面**走**行内层**（`InlineTexture` ＋ 新增 `.die-face` 的 `100% × 100%`，尺寸随本体、交给 CSS）。
- **镜像 / 旋转复用由包里显式声明**（§三 的 `d2` / `d3` 镜像、`d6` 旋转）：写对象式如 `"d6": { "img": "d6.png", "rotate": 90 }`，运行期经 `textureRef()` 归一后照此落图——**默认不启用镜像**（[`design/skin.md`](design/skin.md) §3.2）。
- **落点**：起点 / 终点 / 脚印在 [`src/play/MapView.tsx`](../src/play/MapView.tsx)（**脚印只在 `road` 缺图时**顶替 `<Footprint>`；该格有道路图就轮不到它）；**五处 `.die` 盒**共用本体一张（HUD 46 / 对战 38 掷骰中 ＋ 30 定格 / 对话 34 / 流水 34，`🎲` 兜底时**也铺**——本体属于那个空骰盒，不属于某一次点数）；骰面由 [`src/play/DiceLog.tsx`](../src/play/DiceLog.tsx) 的 `DieFace` 一处收口（四个调用处共用）。接线 [`src/ui/useDieSkin.ts`](../src/ui/useDieSkin.ts)；标记三键在 `MapView` 就地接线。**缺图一律回退程序图形**（旗 / 藏宝图 X / 脚印 / 点阵 / 数字文本）；**贴图不套手绘滤镜**（§六）。
- **构建页不接**：`src/build/Canvas.tsx` 的起终点与脚印照旧程序绘制（与构建页画布 `background`、构建页 `.modal` 同一处理）。
- **未接**：`node.building` **随格数拉伸、必须九宫格**（`KM-1`，V1 无 `slice` → **V1.1**）；**图标**（lucide 与内容 emoji 要一个按名索引的入口组件，兜底字形 `🙂` `✦` `❔` `🎲` `🔒` 按 §四**永远不可覆盖**）；**引导线**属**平铺**（`tile` → **V2.2**）；`die.rolling`（**待确认 2** 未裁决，暂用 `🎲`）；`KM-1`–`KM-3` 等校验层（`SkinIssueCode` 现只有 `KP-*`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **42 个文件 / 471 项**全绿（新增 2 个用例文件 / 18 项：`engine/skin/__tests__/misc.test.ts`、`play/__tests__/miscSkin.test.tsx`）。里程碑状态：V2.1 行与 [`task/04-skin.md`](../task/04-skin.md) 的 `misc` 条拆分并勾选；§九 待确认 1（起终点是否接受素材覆盖）由实现定下——**接受、缺图照旧画程序图形**。

**2026-09-30 · D3 第五屏：容器衬底 `window.surfaces` 接入（[`design/skin/03-window.md`](design/skin/03-window.md) §二 / §四 / §八）**
- **先落「随视口族」那一族**：对话框 / 抽屉 / 气泡（§二「尺寸由窗口决定」）已接 `window.surfaces`；其余三族（随内容 / 单向 / 固定）要么必须九宫格、要么会与 `item.background` 抢同一个落点，见文末。
- **取图**：[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 新增 `surfaceOf(win, kind)`——`dialog` / `drawer` / `popover` 各查自己的键、**不跨键借用**（对话框没配就用不回抽屉的图）；`textureRef()` 归一三写法（衬底不需要 `rotate` / `flip`）。
- **落图**：`drawTexture` 家族多一种落法——[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `surfaceStyle(ref, assets)`：与三层渲染器**共用「取图结果 → 可用地址」**，但**不摆坐标、不量盒**，而是**铺满容器的整个背景**（`background-size: 100% 100%`）。尺寸交给 CSS（随视口族量不出「多大一个盒」，故这里只取 `src`）；**不写 `background-color`**——底纹可以带透明，纸面底色得留给容器的 CSS，衔接处才不露白；圆角 / 描边 / 阴影仍归容器自己的 CSS（§五「素材只提供纸面底纹」）。接线 [`src/ui/useSurfaceStyle.ts`](../src/ui/useSurfaceStyle.ts)：未启用皮肤 / 未配该键 / 包里缺这张图一律 `undefined`，调用方**不传 `style`**（§一：皮肤是可选叠加层）。
- **三个落点**：`.modal`（战斗 / 对话 / 遭遇 / 菜单 / 结算 / 更新记录）、抽屉里四张 `.panel`（状态 / 背包 / 装备 / 骰流水）、[`src/ui/Popover.tsx`](../src/ui/Popover.tsx) 的 `.popover`。**按组件给、不按类名给**——`.panel` 是通用类名，出身卡网格等各有自己的节，故不做全局选择器。**构建页 `.modal` 不接**（与构建页画布一致）；`LoadScreen` 的「页面卡片」`.load-cover` 是整屏容器、本来没有卡片外观，该屏封面归 `startup.bg`（[`design/skin/08-pages.md`](design/skin/08-pages.md)）。
- **未接**：按钮四态（`KW-6`，**已由 D3 第十四屏收口**）、随内容族（提示条）与单向族（条 / 分隔线）**必须九宫格**（硬拉伸违反 `KW-3`）、固定族格子与 `item.background` 抢同一类元素——一并留到 **V1.1 / `item` 批**；`KW-1` / `KW-5` 的清单提示也要等校验层（`SkinIssueCode` 现只有 `KP-*`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **40 个文件 / 453 项**全绿（新增 2 个用例文件 / 11 项：`engine/skin/__tests__/window.test.ts`、`play/__tests__/windowSurfaces.test.tsx`）。里程碑状态：V2.1 行与 [`task/04-skin.md`](../task/04-skin.md) 的 `window` 条拆出「容器衬底」并勾选；其余各屏待做。

**2026-09-30 · 建筑实例加「允许重新对话」开关，`dialog` 收成一个对象（[`design/07-decisions.md`](design/07-decisions.md) §8.3 设定 10）**
- **问题**：反复进入同一栋建筑，玩家总能选择【重新对话】——对"只说一次"的剧情（遗言 / 警告 / 一次性交代）是破坏性的，作者需要一种**不收走内容、只收走"重播"**的手段。
- **载体合并**：地图节点上的 `dialog` 从**裸方案名**改成**对象 `{ mod?, retalk? }`**（[`src/types/project.ts`](../src/types/project.ts) 新增 `NodeDialog`）——"写死哪套方案"与"是否允许重新对话"说的都是同一个实例的对话，分成两个并列字段会让人以为可以只留一半。**旧包的裸方案名照旧能读**（导入即升级成 `{ mod }`）；`{}` / `{ retalk: true }` 视同没写。归一逻辑 `normalizeNodeDialog()` 在**导入与导出两侧共用同一份**（[`src/io/pmod.ts`](../src/io/pmod.ts) ＋ [`src/lib/dialog.ts`](../src/lib/dialog.ts)），**导出只在关闭（`retalk: false`）时写出**。
- **运行时**：`retalkAllowed()`（[`src/lib/dialog.ts`](../src/lib/dialog.ts)）是唯一判定口 —— 关掉后 `talkView().canRestart` 为假、[`src/play/TalkDialog.tsx`](../src/play/TalkDialog.tsx) 的选择对话框**不渲染**【重新对话】；**未走完**的实例此时菜单只剩【继续】一项 → `openTalk()` **不弹"仅一个按钮"的空框，直接从 `cursor` 续上**（已走完的另有【路过】，仍照旧弹框）；`talkMenu('restart')` 对直接传入的请求**一律按【继续】处理**（兜底旧 UI / 手改存档）。抽出来的 `continuePath()` 让"直接续上"与点【继续对话】走同一条路。
- **编辑器**：实例页「NPC / 对话」块里、方案下拉**下方**新增 **「允许重新对话」开关**（`[`src/build/inspector/InstancePage.tsx`](../src/build/inspector/InstancePage.tsx)`，复用 `Toggle`），默认开；改方案与改开关都通过同一个 `setDialog(mod, retalk)` 写回，**两个字段都没内容时整个 `dialog` 不写**。校验 `K16` 改看 `dialog.mod`（[`src/check/validate.ts`](../src/check/validate.ts)）。
- **不是为了防刷**：`give` 的交付终态本来就不受【重新】影响（设定 3 / 8）——这是**叙事开关**。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **38 个文件 / 442 项**全绿（新增 5 项：`talk.test.ts` 3、`talkDialog.test.tsx` 1、`pmod.test.ts` 1，另改 5 处旧断言）。

**2026-09-30 · D3 `role` 收口：受击表现（[`design/skin/02-role.md`](design/skin/02-role.md) §4.4 / §十一）**
- **「受击瞬间」怎么判**：结算全在纯函数里、会话里没有「正在挨打」字段，故信号取自 **`hp` 掉下来的那一帧**——新增 [`src/ui/useHitPulse.ts`](../src/ui/useHitPulse.ts)（`useHitPulse(anchor, key?)`，`HIT_MS = 120`）：回血 / 原地不动不发作，`key`（怪物 id 之类）一变只挪基准，**换怪物不算挨打**。
- **两条路在渲染件里收口**：[`src/ui/Portrait.tsx`](../src/ui/Portrait.tsx) 的 `Portrait` 收 `hurt` ＋ `hit`——有 `hurt` 素材（`portraitHurtTile()`，只认对象写法、`flip` 跟主图）且正挨打就**改显示那张图**，没有才挂 `.portrait-hit` 走**形变**；棋子形象没有 `hurt` 字段（§三 写法里没有这一项），故**恒走形变**。一次受击动作 ＝ 这一拍 `HIT_MS`。
- **基准与幅度全在 CSS**（[`src/styles/theme.css`](../src/styles/theme.css)）：`.portrait` 以底边 `50% 100%` 为变换基准、约 `120ms` 回弹，`.portrait-hit` 是 `scale(1.15, 0.9)`；棋子那一层是 `.piece-hit`，用 `transform-box: fill-box` ＋ `transform-origin: 50% 50%` 把基准钉在**格中心**（按元素自身外框算，与格大小无关）。
- **接线**：对战 VS 区两侧**各管各的**（主角锚 `player.resources.hp`、怪物锚 `monster.resources.hp` ＋ `monster.id`）；底栏、状态面板、地图棋子锚**同一个主角 `hp`**（地图上看得到的场合是回合开始的持续效果扣血）。棋子形变层**只包形象**——绿色定位环在它外面、不跟着压扁；形象格的文字落点（`RoleGlyph`）不做形变，`dead` 变体仍不设。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **38 个文件 / 437 项**全绿（新增 15 项：`hitPulse.test.tsx` 3、`portrait.test.tsx` 5、`portraitLandings.test.tsx` 4、`mapView.test.tsx` 3）。
- 至此 **`role` 一条（裁决 24 / 25 / 26）全部落地**；D3 余下各屏（`window`、`misc`、`item` / `building`、`startup` / `lobby`、`audio`）待做。

**2026-09-30 · D3 第四屏：立绘 `role.portraits` 接入（[`design/skin/02-role.md`](design/skin/02-role.md) §4.1 / §十一）**
- 渲染件：[`src/ui/Portrait.tsx`](../src/ui/Portrait.tsx)（`portraitTile()` ＋ `Portrait`），借**行内层** `InlineTexture` 出图——立绘只吃 `src` / `flip`，尺寸全部交给 CSS：`W = min(视口宽, 视口高)` 本就是 `100vmin`，于是高度档是 `.portrait-hud / -vs / -card` 的 `6 / 18 / 10vmin`，宽度由素材宽高比推出、`max-width: 25%` 为上限（撞上限由替换元素规则**按比例整体回缩**，故不拉伸），默认底边对齐、出身卡 `.portrait-center` 居中。`Texture.tsx` 抽出 `CSS_SIZED_BOX`（行内层「尺寸交给 CSS」的名义盒）供形象格与立绘共用。
- 四个落点（[`design/skin/02-role.md`](design/skin/02-role.md) §4.1）：① [`src/play/GameScreen.tsx`](../src/play/GameScreen.tsx) 底栏 `.hud-vitals` 内、hp / mp 条左侧（**替代整个 `hud-face`**，血蓝条包进 `.hud-vitals-main` 与之底边对齐）、④ [`src/play/StatusPanel.tsx`](../src/play/StatusPanel.tsx) 面板头（与 ① 同源同图）、② [`src/play/BattleDialog.tsx`](../src/play/BattleDialog.tsx) 新增 `.vs-area`（**任一方画得出来即整块渲染**，主角左 / 怪物右，缺侧留空、不补 emoji）、⑤ [`src/play/StartScreen.tsx`](../src/play/StartScreen.tsx) 出身卡 `.class-card-head` 替代 `.class-icon`（逐卡查职业、缺位先回退 `portraits.player`）。
- 缺位即不占位（§4.3）：没配或包里缺图 → `Portrait` 返回 `null`；落点 ① / ④ 是显式二选一，落点 ② 整块条件渲染。**NPC 立绘仍不渲染**（`S-29`：对话弹层不设立绘区，NPC 形象只有标题栏那一格 `icon`）。
- 遗留：`max-width: 25%` 的基数（所在容器 vs 整个底栏 / 对话框）按观感定；**§4.4 受击表现（`hurt` 素材与形变）未接**——需「受击瞬间」信号。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **37 个文件 / 422 项**全绿（新增 16 项）。

**2026-09-30 · D3 第三屏：棋子形象 `role` 接入（[`design/skin/02-role.md`](design/skin/02-role.md) §十一）**
- 取图：`roleSprite(role, kind, id)`（[`src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts)）按 §三 四组各查各表、**不跨组借用**（职业 / 怪物 / NPC 缺位即回退该组自己的 `icon` emoji）；`spriteRef()` 承担三写法归一，两者都只出形状、不碰 IO。
- 地图棋子：[`src/play/MapView.tsx`](../src/play/MapView.tsx) 的 `role.player` 按**整格大小 ＋ 锚点格中心**出图（`x/y = 格 × CELL`、`w/h = CELL`，四周留白由素材自画）→ SVG 层 `SvgTexture`；**取不到图才回到方框 ＋ 职业 `icon` emoji**。绿色定位环是「你在这儿」的标记、与棋子形象无关，故照旧画。
- 三处文字落点（外加底栏共四处）新增**行内层**：[`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `InlineTexture`（跟文字同排，尺寸由所在处 CSS 的 `1em` 决定）＋ [`src/ui/RoleGlyph.tsx`](../src/ui/RoleGlyph.tsx)，接在出身卡职业图标与状态面板标题、底栏（`role.classes.<职业 id>`）、对战弹层标题（`role.monsters.<怪物 id>`）、对话弹层标题（`role.npcs.<NPC id>`）；非正方形素材按 `object-fit: contain` 等比内缩（`KR-1` 只提示、不改行为）。渲染层由**两层**变**三层**，共用一份 `TextureProps`（[`design/skin.md`](design/skin.md) §四 已改）。
- **`player` 与 `classes` 是两条独立的链**：地图棋子只认 `player`，不借 `classes.<职业>` 的图（§三 回退表的字面执行）；要做「按职业出棋子」需先改规范（§十 待确认 2）。
- 未落地：立绘（§四，含 §4.1 四落点、`W` 比例缩放与 25% 宽度上限）与受击表现（§4.4 的 `hurt` 与形变），排在 D3 后续批次。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **35 个文件 / 406 项**全绿（新增 8 项）。

**2026-09-30 · D3 第二屏：画布 `background` 接入（[`design/skin/05-canvas.md`](design/skin/05-canvas.md) §八）**
- 取层与落位：[`src/engine/skin/canvas.ts`](../src/engine/skin/canvas.ts) 的 `backgroundUsable()`（`img` ＋ 正的 `cellSize` 齐备）、`backgroundOf(bg, mapIndex, available?)`（下标越界 clamp 到最后一层；采用层不可用即向前回退；`available` 由调用方传入以判掉「路径在包内取不到」，只问「有没有」不建地址）、`backgroundPlacement()`（倍率 ＝ 屏幕每格像素 ÷ `cellSize`；图点 `(startX,startY)` ≡ 格 `[0,0]` 中心）。
- 渲染：[`src/play/MapView.tsx`](../src/play/MapView.tsx) 按 §四 顺序——底纹 `<rect>` 的 `fill` 取**采用层**的 `color`（漏写即 `var(--paper-card)`）→ 背景图放在 `translate(x y) scale(s)` 的 `<g>` 里 → 参照线 / 道路；未取到可用层则一字不改，照旧纸面底纹。
- **图片尺寸交给素材自身像素**：取图盒新增 `w/h: 'auto'`（[`src/engine/skin/texture.ts`](../src/engine/skin/texture.ts)），SVG 层据此不写 `width` / `height`、由浏览器按 SVG2 的 auto 取素材原始像素——无需解码图片量尺寸；`auto` 盒量不出盒心，故不参与旋转 / 镜像。
- 遗留销账：屏幕一格恒为 `CELL`，素材拉伸进一个屏幕格的倍率**就是**「屏幕每格像素 ÷ `cellSize`」，与背景图共用同一变换——[`design/skin/01-road.md`](design/skin/01-road.md) §3.1 的共同基准已是现状（D3 起步的「暂用 `CELL` 基准」关闭）。构建页画布（`src/build/Canvas.tsx`）仍未接。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **34 个文件 / 398 项**全绿（新增 12 项）。

**2026-09-30 · D3 起步：运行期皮肤通道 ＋ 道路接入（[`design/skin/00-package.md`](design/skin/00-package.md) §4.4 / [`01-road.md`](design/skin/01-road.md)）**
- 新增运行期入口 [`src/store/skin.ts`](../src/store/skin.ts)：界面侧读皮肤的唯一出口（生效皮肤 ＋ 素材源 ＋ 提示），`activateLayers({ game, user })` 整体换两层、`refresh()` 从皮肤库重取用户启用的全局皮肤（本局层不冲掉）、`release()` 回到全部程序绘制；换套时**先撤旧地址再交新的**（裁决 15）。未启用皮肤时素材源对一切路径回 `undefined`，各屏**逐节点**回退程序绘制，调用方不必判空。启动时 `App.tsx` 调一次 `refresh()`。
- 道路接入：新增 [`src/play/road.ts`](../src/play/road.ts)（格子 → 四邻四角 → `roadFlag`；多格节点按占地全算、按左上格取图），[`src/play/MapView.tsx`](../src/play/MapView.tsx) 每格 `roadPickAt()` → `textureProps()` → `SvgTexture`，**该格未接管即照旧画脚印**。设计侧同步 [`design/skin/01-road.md`](design/skin/01-road.md) §十一 与 [`design/skin/00-package.md`](design/skin/00-package.md) §4.4 的「实现落点」。
- 遗留：地图层素材基准暂用屏幕 `CELL × CELL`，待 `background`（[`design/skin/05-canvas.md`](design/skin/05-canvas.md)）接入后改用背景层 `cellSize`；构建页画布仍未接（画脚印）。验收：`npx tsc --noEmit` 无错，`npx vitest run` **34 个文件 / 386 项**全绿。

**2026-09-30 · D2 落地（贴图渲染器，[`design/skin.md`](design/skin.md) §四）**
- `skin.md` §四 补「**实现落点（React）**」：`drawTexture(target, src, box, opts)` 在本工程里由 [`src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `textureProps(ref, assets, box, extra)` 承担唯一入口（取图 → 落位 → 换地址，**画不出来返回 `undefined`**，调用方据此改画程序图形），`target` 体现为**选用哪个渲染器**（`SvgTexture` / `DomTexture`，props 完全相同）而非运行期分支；几何归纯函数 [`src/engine/skin/texture.ts`](../src/engine/skin/texture.ts)，素材地址归 [`src/io/skin-assets.ts`](../src/io/skin-assets.ts)（按需建、`release()` 一次撤）；`nine` / `tile` 在 `effectiveMode()` 统一回落 `stretch`，V2.2 落地时只改这一处。
- 同节表内版本线 `V1.1` 更正为 **V2.2**（与 2026-09-29 版本线定义一致；`S-1` 的取舍描述不受影响）。
- 里程碑状态：[`TASK.md`](../TASK.md) V2.1 行与 [`task/04-skin.md`](../task/04-skin.md) 索引改为「D0 / D1 / D2 已落地，D3 待做」；D2 五项勾选。验收：`npx tsc --noEmit` 无错，`npx vitest run` **31 个文件 / 364 项**全绿。

**2026-09-30 · NPC 预设到达老库 ＋ NPC 模组面板直接新建（§6.1 ① / §5.6.1）**
- **新增预设的到达机制**：`ensureSeeded` 原先只在**首次播种**时补入预设（`seeded` 为真即跳过），
  致使 V2.0 才加入的 NPC 预设**永远不会出现在老用户的组件库中**（NPC 面板始终为空，现象近似"预设 JSON 没有被读取"）。
  现引入**预设集版本** `PRESET_VERSION`（[`src/presets/index.ts`](../src/presets/index.ts)）：本地记录**已补入到哪一版**，
  **版本推进之后再次补入一次缺失项**——仍守「重名以本地优先」，同一版内不重复补入（用户主动删除的预设不会自行出现）。
  **改动内置预设必须同时把该版本号 +1**。代码 [`src/store/library.ts`](../src/store/library.ts) 的 `ensureSeeded` 与 persist `merge`
  （后者原先漏了 `npcs` 的语义色回填）；单测 [`src/store/__tests__/library.test.ts`](../src/store/__tests__/library.test.ts)
  （旧库补入 / 同版内不重复补入 / 改过的预设不被覆盖）。
- **NPC 模组面板可直接新建**：左栏「全部 NPC」标题行新增「＋ 新建」，**库中一条 NPC 都没有时同一按钮直接给在空态提示框内**，
  一次点击即建出一条空 NPC 并选中（与组件库「＋ 新建」同一构造 `blankComponent`），取消「先到组件库新建、再回到本页写对话」的多余往返；
  **删除**仍归组件库（与其它组件一致）。代码 [`src/build/NpcModScreen.tsx`](../src/build/NpcModScreen.tsx)；
  单测 [`src/build/__tests__/npcMod.test.tsx`](../src/build/__tests__/npcMod.test.tsx)。
- 正文同步：[`design/04-editor.md`](design/04-editor.md) §5.6.1（操作表新增一行）、
  [`design/05-mvp.md`](design/05-mvp.md) §6.1 ①（补入时机与版本号义务）、
  [`design/07-decisions.md`](design/07-decisions.md) §8（「预设与本地冲突」一行补「补入时机」）；
  任务见 [`task/05-npc.md`](../task/05-npc.md) 与 [`TASK.md`](../TASK.md)。

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
- 新增 `design/00c-guidelines.md`（AI 实现守则）：必读顺序 / 禁止事项（不许把大量代码集中在单个文件、不许跳过操作模式、不许擅自改决策、不许引后端或额外绘图库）/ 代码组织约定（store 分层、引擎UI分离、组件拆分粒度、每里程碑 build 通过）/ 验收原子化 / 视觉贯穿。
- 根索引两条铁律 + 全局基调块 + 实现守则块已接入；模块映射表与章节映射同步更新。
- 背景：一次按文档的实现产出混乱代码（已删除），复盘认定文档缺失"实现守则/代码组织红线"是主要可改进点，故补此模块从源头约束。
