# PopRPG 任务清单 (TASK.md)

> ## ⛔ 铁律零 · 全程书面语（最高优先级，置于所有规则之前）
>
> **本项目所有文本一律使用书面语（标准书面中文），禁用一切口语、江湖话、黑话、下九流、代号、自嘲、调侃、感叹与网络语。**
>
> **适用范围（不分位置、不分新旧）：** 设计文档（`docs/DESIGN.md` 与 `docs/design/*`）、任务文档（本文件与 `task/*`）、代码内所有注释、产品内所有界面文案（标签 / 提示 / 占位符 / 错误提示 / 徽标 / 按钮 / 说明 / 预览 / 导出文本 / 预设 `desc`）。
>
> **判定标准：**
> - 禁用词示例（含但不限于）：牌面、打人、打谁、打不了架、等死、顶着 debuff、发到的牌、砸（分点义）、砍人、背着（折扣义）、打八折、倒给、凭空发明、白送、硬来、硬扛、嗑药、耗瓶子、吃一张、稀烂、半套、没谱、堆（分点义）、碰出来、走出来、反手打你一下、多挨一次毒、扛得过去、污染、不配、你代码写了没、亏、费力、量小/量大、最糟、丢（丢弃义）、打不动、纯属浪费时间、下九流、黑话、代号、别、咋、啦、咱们、搞定、颗、这颗。
> - **规则说明讲清"掷什么骰、得到什么、作用到哪"，不靠俏皮话、比喻、江湖比喻替代陈述。** 例如不写"职业只给初始牌面，不给技能"、不写"纯靠物攻属性打人，技能本身什么都不加"。
>
> **执行要求：** 任何改动文案 / 注释 / 文档后，必须全量复查确认无口语残留，否则当没改完。本规则优先级高于一切"省事""生动"的冲动。

> **如何使用**：每次开工前先读 [`docs/DESIGN.md`](docs/DESIGN.md)（设计依据）和本文件（该做什么）。
> 本文件只放**要点 + 里程碑索引**；每个里程碑的详细 checklist 在 [`task/`](task/) 下分文件，专注当前任务本身。
> 每完成一项，把对应文件里的 `[ ]` 改成 `[x]` 并简短备注。上下文丢失时，本文件 + DESIGN.md 即可恢复进度。
>
> **两条铁律**：① DESIGN §8 已确认决策不要擅自改，要改先和用户确认；② 任何交互必须能在 DESIGN §5.4「操作模式标准表」找到出处，找不到先改 §5.4 再加代码。

---

## 总体路线（先 BUILD，后 PLAY）

```
Phase 0  基座      ：脚手架 / 路由 / 类型 / store / 预设库 / .pmod 解析（M0 基本完成，剩路由与类型框架）
   │
Phase A  BUILD     ：构建页（编辑器）—— 一次性把信息架构 / 面板 / 模式 / 属性编辑 / 校验 / 导入导出做完整  ★先做完整
   │
Phase B  PLAY      ：游玩页（引擎 + UI）—— 加载 .pmod → 开局 → 移动/战斗/状态/遭遇/商店 → 存档         ★build 完成后做
   │
Phase C  收尾      ：手绘视觉打磨 / GitHub Pages 部署（贯穿，见末尾）
   │
Phase D  皮肤      ：素材皮肤（`.pp` / `.pgame`）—— 容器加载（zip 走 `fflate`）/ 贴图渲染器 / 逐屏素材接入 / Creative 模式（含九宫格切分工具）   ★B 主体完成后做
```

**顺序约束**：Phase A 不验收不进 Phase B。Phase B 的引擎核心（`resolveSkill`/`tickStates`/`applyEffects` 等纯函数）在 A8 作为"规则结算"实现并单测，但真实 UI 与游玩循环在 Phase B。Phase D 的端到端验证依赖 Phase B 已渲染的游玩态；其类型、取图纯函数与 IO 层（D0–D2）可提前动工。音频（`audio`）在 V1 **只解析与预留**，播放实现排入 V1.1（裁决 16）。

---

## 里程碑索引

| 文件 | 里程碑 | 范围 | 状态 |
|------|--------|------|------|
| [task/00-foundation.md](task/00-foundation.md) | Phase 0 基座 | 脚手架 / 路由 / 类型框架 / store / 预设库 / `.pmod` 解析 | **已完成**（2026-09-27 随 Phase A 一并重写） |
| [task/01-build.md](task/01-build.md) | Phase A BUILD（构建页） | 信息架构/数据模型/布局/图层/组件库/模式/画布/属性编辑/引擎纯函数/校验/预设/导入导出 | **已完成首轮实现**（build + 78 项单测全绿） |
| [task/02-play.md](task/02-play.md) | Phase B PLAY（游玩页） | 框架加载/开局/移动回合/战斗UI/骰子公示/技能交互/状态/遭遇/商店/装备背包/存档 | 待做（A 后） |
| [task/03-polish.md](task/03-polish.md) | Phase C 收尾 | 视觉打磨 / GitHub Pages 部署 | 部分已完成 |
| [task/04-skin.md](task/04-skin.md) | Phase D 皮肤（素材） | 三件套容器 / zip 读写（`fflate`）/ 贴图渲染器 / 皮肤库与单套解压 / 逐屏素材接入 / Creative 模式（含九宫格切分工具）/ 皮肤校验 `KP-1`~`KP-10` | 待做（B 后；D0–D2 可提前） |

---

## 最新核对决策（2026-09-26 末轮，已落 DESIGN §4.8 / §7 / §8）

1. **路由**：默认 `/` = 游玩页，`/build` = 构建页；两路由同应用（§7.0）。
2. **怪物登场掷骰（反对"每回合摇"）**：每次"踩怪格实例化一只新怪"时，先掷选怪骰（`monster_pool` 抽哪只）再用 `stat_dice` 摇属性区间→具体值；**同一只怪整场不重摇**；**不同遭遇各自独立摇**（A 哥布林与 B 哥布林是两只实例，都重新随机）。属性浮动默认共用 `stat_dice`，进阶可各属性独立骰。
3. **交锋 = 两回合结构（玩家主动 + 怪物反击）**：玩家【点攻击】→ 引擎 `atk_roll` + 怪物电脑 `def_roll`；**换防**，怪物电脑 `pick_dice` 选技能 + `atk_roll`，玩家【点"防御"或主动选"不防御"】。单人游戏无倒计时，**引擎等待玩家操作**。
4. **落空不终止交锋**：`target:opponent` 不命中 → 仅本次施放不生效、effects 不执行，仍进怪物反击回合。
5. **死亡不对称**：玩家 `hp≤0` 只在"回合【开始】存活判定"才败北（给缓冲吃药）；怪物 `hp≤0` 伤害作用时**即时败北** → 玩家击杀怪物当下交锋直接结束、不进反击。
6. **tick 前移 + 新状态延后**：每回合【开始】先判存活、再 tick 一次；**本回合刚挂状态不参与本次 tick，下回合开始才首次扣**（1 滴血中毒仍能先吃药救活的基石）。
7. **`mp` 由技能自身 `cost` 决定**：保底对 `basic_attack`/`basic_magic` 的 `cost` 为空只是"默认模板"选择，作者可改成非空或删除。
8. **保底对 = 默认模板角色的安全网**：默认模板开局技能栏含 `['basic_attack','basic_magic']`；**作者可移除/改 `cost`，自创角色不受影响**。怪物回退用引擎内建 `basic_attack` 常量，与玩家保底对组件无关。
9. **怪物回退**：`attack_weights` 选中技能 `cost` 不足 → 回退同表 `cost` 为空的技能；根本没配 `attack_weights` → 引擎内建 `basic_attack`（与保底对组件解耦）。
10. **怪物只有三 `op`**：`add_stat`/`add_tag`/`remove_tag`（命中玩家时施加）；**不 `learn_skill`/`forget_skill`**。五 op 共用仅限消耗品/技能/事件 + 怪物三 op。
11. **「清单」按钮（构建页）**：§5.7 所有校验 K1~Kn 的一键汇总视图，导出/试玩前一口气查漏。
12. **玩家"不防御"= 自杀按钮**：玩家主动选"不防御" → 不掷 `def_roll`，防值走固有数值（属性+装备+职业%+状态mod，无骰浮动，非 0）；怪物作为 AI 始终积极防御（总掷 `def_roll`）。两者不超时。

> 完整决策速查（约 30 条铁律）见 DESIGN §8；上述 12 条是对之前版本的修正/补充，相关任务以这里为准。
> **2026-09-29 追加三轮共 23 项裁决（素材皮肤 / 三件套）**登记于 [`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.1 / §8.2，未决项汇总于 [`docs/design/skin.md`](docs/design/skin.md) §八；实现任务见 [`task/04-skin.md`](task/04-skin.md)。三轮并列有效，不以上述 12 条覆盖。末轮 8 项（裁决 14–21）的核心结论：zip 走 `fflate`；皮肤库只记导入过的 `.pp` 且运行时只解压一套；音频 V1 只预留；描边缺省不渲染；包内路径相对包根；`pages` 拆为 `startup` / `lobby`；Creative 提供九宫格切分工具、字体不子集化。补充裁决 22：`.pp` 包内**目录结构不设强制**（强制项只有 `manifest.json` 与可选 `preview.png`），素材位置**以描述文件为准**，`resource` 键废除（`KP-10`）。补充裁决 23：**背景数组为「逐图清单」**——**下标即 pmod 的地图下标、一一对应且无需匹配 key**（`maps` 字段废除），**每张地图只渲染一层**（修订裁决 17 的「多层叠加」），地图数多于层数时越界地图**降级为最后一层**，无可用层即降级为默认配置。

---

## 明确不做（不是 backlog，别再当需求提）

- 职业专属技能 / 技能树 / 转职——角色先天、路子后天（§1.1）；技能不绑职业
- 技能本身已做（第七类组件，§4.8.3）——别再当"待做"
- 技能冷却/次数/蓄力/范围/改乘数——见 §7.5，MVP 不做，都不破坏判定
- 多结局 / 条件通关 / 剧情分支树——跑团不是剧情 RPG（§1.1 / §7.4）
- 难度评估 / 平衡性警告——编辑器不下定义（§1.1 / §7.4）
- 独立货币/背包系统——货币=一件道具（`tags:[货币]`），背包=职业上一个数字

---

## 约束：纯静态，无服务器（GitHub Pages）

- 禁止任何需运行服务器的能力（后端 API/SSR/服务端存储/外部在线接口）
- 数据走 `localStorage` + 浏览器文件导入导出（`Blob` 下载 / `<input type="file">`）；**二进制资产（皮肤包 `.pp`）走 IndexedDB**——`localStorage` 只存字符串且配额约 5 MB，不适合包体（裁决 15，[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md) §4.4）
- 依赖只选能打包进 `dist/` 的库；**zip 读写统一用 `fflate`**（裁决 14，[`docs/design/08-deploy.md`](docs/design/08-deploy.md) §9）
- Vite `base` 按项目页路径配置；优先单页避免深链 404

---

## 进度同步

**2026-09-29 · 末轮裁决 14–21（素材皮肤 / 三件套）**
- `Q12` zip 能力：**引入 `fflate`**（读＋写，约 8 KB gzip，浏览器端零 Node 依赖）——满足 GitHub Pages 纯静态与离线约束，不自实现 deflate（裁决 14；依赖边界登记于 [`docs/design/08-deploy.md`](docs/design/08-deploy.md) §9）。
- `Q17` 皮肤库与解压：本地只记录**导入过**的 `.pp`（游戏自带皮肤不入库）；**运行时一次只解压一套**，切换皮肤先清空当前解压结果；本地保存 `.pp` 原包体（条目索引进 `localStorage`，**包体进 IndexedDB**）；**不设体积硬上限**；`.psave` **不记录**皮肤名（裁决 15）。
- `Q20` 音频：**不进 V1**——字段与事件清单定稿为预留参数，V1 只解析与校验，播放整体排 V1.1（裁决 16）。
- `Q21` 背景：数组**即逐图清单**（**下标即 pmod 的地图下标，无需匹配 key**）——第 `i` 张地图取 `background[i]`，**每张地图只渲染一层**（不叠加）；**地图数多于层数时，越界地图降级为最后一层**（皮肤 2 层、地图 4 张 → 下标 2 / 3 都用下标 1 的图）；无可用层／未配置 → 再次降级为**默认配置**（程序绘制纸面底纹）；画布级 `color` 取**采用层**的值（裁决 17，修订 23）。
- `Q22` 描边：**独立设置项，缺省不渲染**——不跟随 `fill`、不保留组件色，无第四态（裁决 18）。
- `Q23` 包内布局：`.pgame` ＝ `pack.json` ＋ `game.pmod` ＋ `skin/`；`.pp` ＝ `manifest.json` ＋ 可选 `preview.png`（素材目录与命名自由，`resource/` 仅为推荐约定）；**路径一律相对包根**且**以描述文件为准**，`resource` 字段废除（`KP-10`）；版本键 `version` 改名 `format`，新增 `extends`（仅包内继承）与 `theme`（禁改布局 token）（裁决 19 / 22）。
- `Q24` 首页封面图：**归皮肤侧**（`startup.bg` / `lobby.bg`，即原 `pages.home.bg`），`.pmod` 不设封面字段（裁决 20）。
- `Q25` Creative：**提供九宫格切分工具**（V1 渲染仍按拉伸，产出供 V1.1 消费）；**字体不做子集化**（裁决 21）。
- 设计侧同步：[`docs/design/00a-formats.md`](docs/design/00a-formats.md)、[`docs/design/skin.md`](docs/design/skin.md) 与 `skin/00-package.md` / `05-canvas.md` / `06-item-building.md` / `07-audio.md` / `08-pages.md`（由 `pages` 改写为 `startup` / `lobby`）/ `09-creative.md`、[`docs/design/02-data-model.md`](docs/design/02-data-model.md)、[`docs/design/08-deploy.md`](docs/design/08-deploy.md)、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) 与 [`docs/DESIGN.md`](docs/DESIGN.md) 入口块；任务侧同步本文件与 [`task/04-skin.md`](task/04-skin.md)。
- 未决项：`Q26`（BGM 按地图）、`Q28`（跨包 `extends`）、`Q29`（`pack.json.entry` 语义），汇总见 [`docs/design/skin.md`](docs/design/skin.md) §八。

**2026-09-29 · 补充裁决 22（`.pp` 包内目录不设强制结构）**
- 强制结构收敛为两项：`manifest.json`（必须在包根）与可选 `preview.png`（存在时须在包根）。素材的目录名（含 `resource/`）、层级、文件名与扩展名**一律自由**，按分节命名的 `resource/<节>/` 降为**推荐约定**，加载器不得依赖。
- **素材位置一律以描述文件内各字段所写的路径为准**（相对包根）：逐条按路径取包内条目，不推断前缀、不假设目录约定——调整目录结构无需改动加载代码（扩展性与兼容性）。
- 草案的 `resource` 顶层键**废除**，读到即忽略并提示，校验项新增 **`KP-10`**。
- 设计侧同步：[`docs/DESIGN.md`](docs/DESIGN.md) 基本设计块与进度同步、[`docs/design/00a-formats.md`](docs/design/00a-formats.md) §2.1 / §2.3 / §六、[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md) §2.1 / §2.2 / §三 / §六、[`docs/design/skin.md`](docs/design/skin.md) §二 / §八 / §九、[`docs/design/skin/01-road.md`](docs/design/skin/01-road.md)（`KS-2`）、[`docs/design/skin/07-audio.md`](docs/design/skin/07-audio.md)、[`docs/design/skin/09-creative.md`](docs/design/skin/09-creative.md)、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2；任务侧同步本文件与 [`task/04-skin.md`](task/04-skin.md)。

**2026-09-29 · 补充裁决 23（背景按下标一一对应、单层渲染）**
- `background` 数组**不是叠加层序，而是与 pmod 地图顺序一一对应的逐图清单**：**下标即地图下标**（第 `i` 张地图取 `background[i]`），**不需要任何匹配 key**——`maps` 字段废除。
- **越界降级**：地图数多于背景层数时，超出的地图**降级为使用最后一张**（皮肤背景长度 2、pmod 地图 4 张 → 下标 2 / 3 的第三、四张地图都用下标 1 的图）。
- **每张地图只渲染一层**（每次只取一层，不再叠加）；采用层素材不可用时向更靠前的层回退；`background` 缺失／为空／全部不可用 → 本节未接管，按皮肤优先级降级，全部落空即**再次降级为默认配置**（程序绘制纸面底纹）。
- 画布级 `color` 只取**实际采用层**的值；校验项 `KB-6`（无可用背景 → 默认配置）/ `KB-7`（层数多于地图数 → 末尾层永不被采用）/ `KB-8`（不会被采用的层写了 `color`）/ `KB-9`（相邻两层基准不一致 → 切图跳变）与取舍 `S-19` 按新语义改写。
- 设计侧同步：[`docs/design/skin/05-canvas.md`](docs/design/skin/05-canvas.md) §一 / §二（含示例、字段、取值规则、§2.1 / §2.2）/ §四 / §五 / §六 / §七、[`docs/design/skin.md`](docs/design/skin.md) 模块映射 / `S-19` / `Q13` / `Q21` / §九 修正表、[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md) §三 / 状态行、[`docs/design/skin/07-audio.md`](docs/design/skin/07-audio.md) §七、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2（裁决 17 标注修订 ＋ 新增裁决 23）、[`docs/DESIGN.md`](docs/DESIGN.md) 模块映射与进度同步；任务侧同步本文件与 [`task/04-skin.md`](task/04-skin.md)。

**2026-09-29 · 入口结构澄清与设计变更同步义务**
- [`docs/DESIGN.md`](docs/DESIGN.md) 入口补充说明：索引之前列有若干**入口强制强调块**（铁律零 / 两条铁律 / 基本设计 / 全局基调 / 实现守则），属于给 AI 的开工前提，**结构保持不变**、与索引同页强制强调，不得下沉到 `design/` 分模块内。
- 新增**设计变更同步义务**（登记于 [`docs/DESIGN.md`](docs/DESIGN.md) 入口与 [`docs/design/00c-guidelines.md`](docs/design/00c-guidelines.md) §一）：设计变更后须同步模块映射表、章节映射、入口强调块、最新核对决策四处，并同步本文件的里程碑索引与「进度同步」；任一侧缺失视为变更未完成。
- 修正根任务文件名的大小写：`task.md` → `TASK.md`（涉及 `docs/DESIGN.md` 与本文件，以及 `task/` 全部分文件的「上层索引」链接）。

**2026-09-29 · 素材皮肤（skin）轮次落地任务清单**
- 新增里程碑 [`task/04-skin.md`](task/04-skin.md)（Phase D）：三件套容器 / zip 读写（`fflate`）/ 贴图渲染器 `drawTexture` / 皮肤库与单套解压 / 逐屏素材接入 / Creative 模式（含九宫格切分工具）/ 皮肤校验 `KP-1`~`KP-9`，含 D0–D8 与 18 条原子验收项。
- 本轮设计侧产出：新增 [`docs/design/00a-formats.md`](docs/design/00a-formats.md)（三件套**基本设计**，前置必读）与 [`docs/design/skin.md`](docs/design/skin.md) ＋ `skin/` 十节；三轮共 21 项裁决登记于 [`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.1 / §8.2。
- 顺序：Phase B 主体完成后开工，D0–D2（类型 / 取图纯函数 / IO）可提前。

**2026-09-27 · Phase 0 + Phase A 首轮实现（代码从零重写）**
- 旧实现（HY3 产出、不符合文档）已删除，按 `docs/design/` 重新落地：类型全集 → 引擎纯函数 → store 分层 → .pmod → 构建页 UI。
- 依赖与产物按 **GitHub Pages 纯静态**约束：Vite `base: './'`（不耦合仓库名）、**hash 路由**避免深链 404、官方 Actions 部署、无后端 / 无外部运行时接口。
- 验证：`npm run build`（tsc 无错）+ `npx vitest run`（78 项：引擎边界 / .pmod round-trip / 构建页冒烟）。
- 已知边界：玩法流程（加点界面、挪格子、交锋、存档）属 Phase B；`npm run dev` 人工手测待执行一次。
- 详细清单与备注见 `task/00-foundation.md` / `task/01-build.md` 末尾的「进度同步」。

**2026-09-26 · 任务清单拆分：根 TASK.md 索引化，里程碑分散到 task/**
- 根 `TASK.md`：要点 + 里程碑索引 + 12 条最新核对决策 + 明确不做 + 约束
- `task/00-foundation.md`：Phase 0 基座 checklist
- `task/01-build.md`：Phase A BUILD 完整 checklist（A0–A11 + 12 条验收 + 单测边界）
- `task/02-play.md`：Phase B PLAY 完整 checklist（B0–B10 + 14 条验收）
- `task/03-polish.md`：Phase C 收尾（视觉/部署）
- 融入末轮 12 条核对决策（选怪每遭遇摇 / 交锋两回合 / 落空不终止 / 死亡不对称 / tick 前移+新状态延后 / mp 由 cost / 保底对模板默认可删 / 怪物回退内建 / 怪物三 op / 清单按钮 / 不防御=自杀按钮 / 路由）
- 顺序：先完整 build，再 play
