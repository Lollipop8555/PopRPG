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

## 版本与总体路线（V1 已冻结 → V2.x 追加改造）

**执行优先级：V2.0（新增 NPC 结构）＞ V2.1（SKIN 基础）＞ V2.2（SKIN 进阶 ＋ 音频）。**

| 版本 | 内容 | 性质 | 状态 |
|---|---|---|---|
| **V1** | Phase 0 基座 / Phase A BUILD / Phase B PLAY | **已冻结口径**：七大类 · 13 项配置 · `encounter` 五选一 | **已完成**（A 首轮 ＋ B 全部 58 项勾选；全量 197 项单测绿） |
| **V2.0** | **新增 NPC 与对话**（第 8 类组件 ＋ **进入建筑后的 NPC 触发节点**） | **追加设定 / 结构改造**（不属于 V1 的阶段性设计） | **已完成**（编辑器侧 E0–E3 ＋ 运行时 E4 ＋ 19 项原子验收；E5 皮肤落点并入 **V2.1**） |
| **V2.1** | **SKIN 基础**：三件套容器 / 贴图渲染器 / 逐屏素材接入 | 叠加层 | **进行中**（D0 类型与取图纯函数 / D1 容器与加载 / D2 贴图渲染器 已落地；**D3 逐屏素材接入进行中**——运行期通道 ＋ `road` ＋ 画布 `background` ＋ `role` 一条（棋子形象 / 立绘四落点 / 受击表现）＋ `window` 容器衬底（对话框 / 抽屉 / 气泡）**已收口**，余下各屏待做） |
| **V2.2** | **SKIN 进阶 ＋ 音频**：Creative 模式 / 九宫格切片消费 / 皮肤校验 / 音频播放 | 叠加层 | V2.1 之后 |

> **V1 口径冻结、不改写**：`task/00-foundation.md` / `task/01-build.md` 里的「七大类 / 13 项 / 五选一」是 **V1 史实**；
> 第 8 类 NPC、14 项配置、六选一行为属 **V2.0 追加设定**，只在 V2.0 的设计与任务里生效。

```
Phase 0  基座      ：脚手架 / 路由 / 类型 / store / 预设库 / .pmod 解析（M0 基本完成，剩路由与类型框架）
   │
Phase A  BUILD     ：构建页（编辑器）—— 一次性把信息架构 / 面板 / 模式 / 属性编辑 / 校验 / 导入导出做完整  ★先做完整
   │
Phase B  PLAY      ：游玩页（引擎 + UI）—— 加载 .pmod → 开局 → 移动/战斗/状态/遭遇/商店 → 存档         ★已完成（58 项勾选）
   │
V2.0     追加改造  ：新增 NPC 与对话（第 8 类组件 ＋ 进入建筑后、建筑事件之前的触发节点）—— 数据模型（**全树同一个结构** `{result?,message,dice?,hit?,items?,give?}`；给道具叫 `give`；进度按实例记 `cursor`/`talkDone`/`deliveredNode`）/ 组件库与组件页 / NPC 模组面板（思维导图，本层掷骰命中 `dice`/`hit`）/ 实例页与校验 / 运行时抽取与弹层（方案锁死、**重入三选项【继续对话】【重新对话】【路过】**、`give` 一次性交付）   ★优先级 ①：E0–E3 只依赖 A（已完成）→ 立即开工；E4 依赖 B
   │
V2.1     SKIN 基础 ：（`.pp` / `.pgame`）容器加载（zip 走 `fflate`）/ 贴图渲染器 / 逐屏素材接入   ★优先级 ②：V2.0 之后
   │
V2.2     SKIN 进阶 ：Creative 模式（含九宫格切分工具）/ 九宫格切片消费 / 皮肤校验 / 音频播放   ★优先级 ③：清单见下
   │
Phase C  收尾      ：手绘视觉打磨 / GitHub Pages 部署（贯穿各阶段，见末尾）
```

**顺序约束**：V1 内部 —— Phase A 不验收不进 Phase B。
**V2.0**：编辑器侧（E0–E3）只依赖 V1 的 Phase A（已完成）→ **可立即开工**；E4（进入建筑后的 NPC 触发与对话弹层）依赖 Phase B 的遭遇流程与对话框壳。
**V2.1 / V2.2**：排在 V2.0 之后；端到端验证依赖 V1 的 Phase B 已渲染的游玩态（其类型 / 取图纯函数 / IO 层可提前动工）。
音频（`audio`）在 **V1 / V2.0 只解析与预留**，播放实现排 **V2.2**（裁决 16）。

---

## 里程碑索引

| 文件 | 里程碑 | 范围 | 状态 |
|------|--------|------|------|
| [task/00-foundation.md](task/00-foundation.md) | Phase 0 基座 | 脚手架 / 路由 / 类型框架 / store / 预设库 / `.pmod` 解析 | **已完成**（2026-09-27 随 Phase A 一并重写） |
| [task/01-build.md](task/01-build.md) | Phase A BUILD（构建页） | 信息架构/数据模型/布局/图层/组件库/模式/画布/属性编辑/引擎纯函数/校验/预设/导入导出 | **已完成首轮实现**（build + 78 项单测全绿） |
| [task/02-play.md](task/02-play.md) | Phase B PLAY（游玩页） | 框架加载/开局/移动回合/战斗UI/骰子公示/技能交互/状态/遭遇/商店/装备背包/存档 | **已完成**（B0–B10 与 B 验收 1–14 全部勾选） |
| [task/03-polish.md](task/03-polish.md) | Phase C 收尾 | 视觉打磨 / GitHub Pages 部署 | 部分已完成 |
| [task/04-skin.md](task/04-skin.md) | **V2.1 / V2.2** SKIN（素材） | 三件套容器 / zip 读写（`fflate`）/ 贴图渲染器 / 皮肤库与单套解压 / 逐屏素材接入 / Creative 模式（含九宫格切分工具）/ 皮肤校验 `KP-1`~`KP-10` | **进行中**（D0 / D1 / D2 已落地；D3 进行中：运行期通道 ＋ `road` ＋ 画布 `background` ＋ `role` 一条 ＋ `window` 容器衬底已接；**优先级 ②**；端到端依赖 B） |
| [task/05-npc.md](task/05-npc.md) | **V2.0** 新增 NPC 与对话（跨 A / B） | NPC 数据模型与对话树（**全树同一个结构**；给道具 `give`；本层掷骰 `dice` / 各项 `hit`）/ 组件库与组件页 / **NPC 模组面板（思维导图，命中覆盖检查）** / 建筑实例页与校验 / 运行时抽取与弹层（掷定锁死 / **重入三选项 ＋ 三标记** / `give` 一次性交付）/ 皮肤侧接口约定 | **已完成**（E0–E3 编辑器侧 ＋ E4 运行时 ＋ 19 项原子验收；E5 皮肤侧接口约定并入 [task/04-skin.md](task/04-skin.md)） |

---

## V2.1 / V2.2 清单（SKIN 版本登记）

> **V2.1 ＝ SKIN 基础**、**V2.2 ＝ SKIN 进阶 ＋ 音频**（见上文版本表）；本节是这两个版本的**唯一登记处**。
> 共性：V1 / V2.0 **不做**、但**字段与结构已定稿**——它们的义务只有"**解析 / 预留不报错**"。

| 版本 | 项 | 内容 | 依据 |
|---|---|---|---|
| **V2.2** | **音频播放** | `audio`（3 个 BGM 场景键 ＋ 9 个音效事件键）：加载 / 解码 / 播放 / 音量与开关——V1 只解析与校验 | 裁决 16；[`docs/design/skin/07-audio.md`](docs/design/skin/07-audio.md) |
| **V2.2** | **贴图 `nine` 策略** | `drawTexture` 增加九宫格拉伸策略；V1 只实现 `stretch`（`.9.png` 按普通拉伸处理） | 裁决 21；[`docs/design/skin.md`](docs/design/skin.md) §四 |
| **V2.2** | **九宫格切片消费** | Creative 切分工具产出的切片（四线切分 / 九张切片）在渲染端启用 | 裁决 21；[`docs/design/skin/09-creative.md`](docs/design/skin/09-creative.md) §2.3 |
| **V2.0 后** | **对话后续扩展** | `chat` 项加 `gate`（条件选项，复用事件门槛）；方案加 `once: true`（**连重播都只给一次**——"走完过一次"已由 `talkDone` 记录、**重播本身永远允许**，复用同一族进度记录） | [`docs/design/06-future.md`](docs/design/06-future.md) §7.6 |
| **V2.1** | **立绘遗留** | 表情 / 受击变体、VS 字样是否素材化、尺寸档位 | `Q30`；[`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §四 |
| **V2.1** | **未决项裁决** | `Q26`（BGM 按地图）、`Q28`（跨包 `extends`）、`Q29`（`pack.json.entry` 语义） | [`docs/design/skin.md`](docs/design/skin.md) §八 |
| **—** | **多项目管理** | `.psave` 之外的多项目 / 多周目切换（Phase B 只做单例） | [`docs/design/06-future.md`](docs/design/06-future.md) §7.3 |

**纪律**：V2.1 / V2.2 **不新增判定、不改骰子模型、不动 V2.0 的六种建筑行为**——上表各项在设计上已落在**既有字段与既有流程**内（依据见上表）。

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
> **2026-09-29 追加三轮共 23 项裁决（素材皮肤 / 三件套）**登记于 [`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.1 / §8.2，未决项汇总于 [`docs/design/skin.md`](docs/design/skin.md) §八；实现任务见 [`task/04-skin.md`](task/04-skin.md)。三轮并列有效，不以上述 12 条覆盖。**2026-09-29 追加（组件库）**：预设定义固定、改过的版本在本地，两者冲突时**重名以本地优先**（同 `id` 已被改过 → 保留本地那一条，不覆盖；同名但不同 `id` → 同样保留本地、该预设不补入，库里不出现两条同名条目），登记于 [`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8「预设与本地冲突：重名以本地优先」；组件库 `⋯` 菜单补回 `复制成新组件`（与行内 `复制` 同一动作，NPC **整条复制**、连整套对话方案一起带走）。末轮 8 项（裁决 14–21）的核心结论：zip 走 `fflate`；皮肤库只记导入过的 `.pp` 且运行时只解压一套；音频 V1 只预留；描边缺省不渲染；包内路径相对包根；`pages` 拆为 `startup` / `lobby`；Creative 提供九宫格切分工具、字体不子集化。补充裁决 22：`.pp` 包内**目录结构不设强制**（强制项只有 `manifest.json` 与可选 `preview.png`），素材位置**以描述文件为准**，`resource` 键废除（`KP-10`）。补充裁决 23：**背景数组为「逐图清单」**——**下标即 pmod 的地图下标、一一对应且无需匹配 key**（`maps` 字段废除），**每张地图只渲染一层**（修订裁决 17 的「多层叠加」），地图数多于层数时越界地图**降级为最后一层**，无可用层即降级为默认配置。补充裁决 24：**新增立绘 `portraits`**（`role` 下的**纯皮肤元素**，`.pmod` 不设任何字段）——落点为底栏 hp/mp 左侧（**替代 `hud-face`**，缺位不占位）、对战对话框顶部 **VS 区**（任一方有即渲染）、出身卡职业立绘、状态面板头部，遭遇 / 商店弹层**仅预留**；**暂不考虑四向**，左右相对由**显式 `flip`** 表达。补充裁决 25：**本引擎为单人游戏、只有一位主人公**——立绘即**唯一形象**（无队伍 / 队友 / 多角色矩阵）；**受击两法**＝皮肤给出 `hurt` 就显示受击图、未提供则改用**形变**（横向 ×1.15、纵向 ×0.9、约 `120ms` 回弹，参数写死）；**立绘按窗口短边 `W` 的比例缩放**（底栏与状态面板 `6%`、对战与对话 VS 区 `18%`、出身卡 `10%`），废弃固定像素档。补充裁决 26：**NPC 与对话系统**——素材库新增 `npcs` 分组、NPC **只出现在建筑里**（入包条件 ＝ 被建筑实例引用，**不走「启用」**）、建筑新增**第六种行为** `encounter: talk`、建筑实例以 `npcs` / `dialog` **两级各掷一次** `talk.dice`（踩到抽定、整场不重掷）、**树状对话**支持多套方案（`chat` 选项分支可嵌套、`prop` 给道具并终止）、编辑器新增 `NPC` 分区与**整页「NPC 模组」思维导图面板**、前置配置新增 `talk.dice` 后总账 **14 项**；对话**不产生结局、不记剧情旗标**，「不做剧情分支树」的立场不变（[`docs/design/06-future.md`](docs/design/06-future.md) §7.6）；实现任务见 [`task/05-npc.md`](task/05-npc.md)。

---

## 明确不做（不是 backlog，别再当需求提）

- 职业专属技能 / 技能树 / 转职——角色先天、路子后天（§1.1）；技能不绑职业
- 技能本身已做（第七类组件，§4.8.3）——别再当"待做"
- 技能冷却/次数/蓄力/范围/改乘数——见 §7.5，MVP 不做，都不破坏判定
- 多结局 / 条件通关 / 剧情分支树——跑团不是剧情 RPG（§1.1 / §7.4）；**建筑内的 NPC 对话树不属此列**（§7.6 / 裁决 26），但它同样**不记旗标、不影响通关条件**
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

**2026-09-30 · D3 第五屏（容器衬底 `window.surfaces` 接入）**
- 取图：[`src/engine/skin/lookup.ts`](src/engine/skin/lookup.ts) 新增 `surfaceOf(win, kind)`——`dialog` / `drawer` / `popover` 各查自己的键，**不跨键借用**；`textureRef()` 归一三写法（衬底不需要 `rotate` / `flip`）。
- 落图：[`src/ui/Texture.tsx`](src/ui/Texture.tsx) 新增 `surfaceStyle(ref, assets)`——与三层渲染器**同吃「取图结果 → 可用地址」**，差别只在落法：**铺满容器整个背景**（`background-size: 100% 100%`）。尺寸交给 CSS（§二：随视口族「尺寸由窗口决定」，量不出「多大一个盒」，故只取 `src`）；**不写 `background-color`**——底纹可以带透明，纸面底色留给 CSS。接线走 [`src/ui/useSurfaceStyle.ts`](src/ui/useSurfaceStyle.ts)：未启用皮肤 / 未配该键 / 包里缺这张图一律 `undefined`，调用方**不传 `style`**。
- 三个落点：`.modal`（战斗 / 对话 / 遭遇 / 菜单 / 结算 / 更新记录）、抽屉里四张 `.panel`（状态 / 背包 / 装备 / 骰流水）、[`src/ui/Popover.tsx`](src/ui/Popover.tsx) 的 `.popover`；**按组件给、不按类名给**（`.panel` 是通用类名，出身卡网格等各有自己的节）；**构建页 `.modal` 与 `LoadScreen` 的 `.load-cover` 不接**（后者封面归 `startup.bg`）。
- 未接：按钮四态（`KW-6`）与随内容族 / 单向族（提示条 / 条 / 分隔线）**必须九宫格**（硬拉伸违反 `KW-3`）、固定族格子与 `item.background` 抢同一落点，一并留到 **V1.1 / `item` 批**；`KW-1` / `KW-5` 的清单提示也要等校验层（`SkinIssueCode` 现只有 `KP-*`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **40 个文件 / 453 项**全绿（本轮新增 2 个用例文件 / 11 项）。设计侧同步 [`docs/design/skin/03-window.md`](docs/design/skin/03-window.md) §八（新增「实现落点」）；任务侧 [`task/04-skin.md`](task/04-skin.md) 的 `window` 条拆出「容器衬底」并勾选。

**2026-09-30 · D3 `role` 收口（受击表现 §4.4）**
- **信号**：新增 [`src/ui/useHitPulse.ts`](src/ui/useHitPulse.ts)——结算里没有「正在挨打」这个字段，故锚 **`hp` 掉下来的那一帧**；`HIT_MS = 120`（与 CSS 回弹同值），`key`（怪物 id）一变只挪基准，换怪物不算挨打。
- **两条路**：`Portrait` 收 `hurt` / `hit`——有 `hurt` 素材换图（`portraitHurtTile()`，只认对象写法、`flip` 跟主图），没有才挂 `.portrait-hit` 走形变（底边基准、`scale(1.15, 0.9)`、约 `120ms` 回弹）；棋子形象没有 `hurt` 字段 ⇒ 恒走形变，`.piece-hit` 用 `transform-box: fill-box` ＋ `transform-origin: 50% 50%` 把基准钉在**格中心**。
- **接线**：对战 VS 区两侧各管各的（怪物锚 `monster.resources.hp` ＋ `monster.id`）、底栏 / 状态面板 / 地图棋子锚同一个主角 `hp`；棋子形变层**只包形象**，绿色定位环不跟着压扁；形象格的文字落点（`RoleGlyph`）不做形变，`dead` 仍不设变体。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **38 个文件 / 437 项**全绿（新增 15 项）。设计侧同步 [`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §十一（新增「受击表现」、撤掉「未落地」）；任务侧 [`task/04-skin.md`](task/04-skin.md) 的 `role` 与受击两条勾选。
- 至此 **`role` 一条（裁决 24 / 25 / 26）全部落地**，D3 余下各屏待做。

**2026-09-30 · D3 第四屏（立绘 `role.portraits` 接入）**
- 渲染件：[`src/ui/Portrait.tsx`](src/ui/Portrait.tsx)（`portraitTile()` ＋ `Portrait`），借**行内层** `InlineTexture` 出图；尺寸全在 CSS——`W = min(视口宽, 视口高)` 即 `100vmin`，故高度档是 `.portrait-hud / -vs / -card` 的 `6 / 18 / 10vmin`，宽度由素材宽高比推出、`max-width: 25%` 为上限（撞上限按比例整体回缩，不拉伸）；默认底边对齐、出身卡居中。`Texture.tsx` 相应抽出 `CSS_SIZED_BOX`（行内层「尺寸交给 CSS」的名义盒，形象格与立绘共用）。
- 四个落点：① 底栏 `.hud-vitals` 内、hp / mp 条左侧（**替代整个 `hud-face`**；血蓝条包进 `.hud-vitals-main` 与立绘底边对齐）、④ 状态面板 `.panel-head`（与 ① 同源同图）、② 对战弹层新增 `.vs-area`（**任一方画得出来即整块渲染**，主角左 / 怪物右，缺侧是空 `<div>`、不补 emoji / 占位图）、⑤ 出身卡 `.class-card-head` 替代 `.class-icon`（逐卡查 `classes.<职业 id>`、缺位先回退 `portraits.player`）。
- 缺位即不占位（§4.3）：`portraitTile()` 给 `undefined` 则 `Portrait` 返回 `null`；落点 ① / ④ 是显式二选一。**NPC 立绘仍不渲染**（`S-29`：对话弹层不设立绘区，NPC 形象只有标题栏那一格 `icon`）。
- 遗留：`max-width: 25%` 的基数是「所在容器」还是「整个底栏 / 对话框」按观感定；**§4.4 受击表现（`hurt` 素材与形变）未接**（需「受击瞬间」信号）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **37 个文件 / 422 项**全绿（新增 16 项）。设计侧同步 [`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §十一（实现落点重写）与 §十 待确认 6；任务侧 [`task/04-skin.md`](task/04-skin.md) 的 `role` 条补立绘落点。

**2026-09-30 · D3 第三屏（棋子形象 `role` 接入）**
- 取图：[`src/engine/skin/lookup.ts`](src/engine/skin/lookup.ts) 的 `roleSprite(role, kind, id)` 按 `02-role.md` §三 四组各查各表（**不跨组借用**），`spriteRef()` 归一三写法、只出形状不碰 IO。
- 地图棋子：[`src/play/MapView.tsx`](src/play/MapView.tsx) 的 `role.player` 按**整格 ＋ 锚点格中心**出图（`x/y = 格 × CELL`、`w/h = CELL`）；**路径取不到图才回到方框 ＋ 职业 `icon` emoji**，绿色定位环与形象无关、照旧画。
- 四处文字落点：新增**行内层** [`src/ui/Texture.tsx`](src/ui/Texture.tsx) `InlineTexture`（跟文字同排，尺寸交给 CSS 的 `1em`）＋ [`src/ui/RoleGlyph.tsx`](src/ui/RoleGlyph.tsx)，接在出身卡职业图标与状态面板标题、底栏、对战弹层标题（`role.monsters.<id>`）、对话弹层标题（`role.npcs.<id>`）；非正方形素材按 `object-fit: contain` 等比内缩（`KR-1` 只提示）。
- **`player` 与 `classes` 是两条独立的链**：地图棋子只认 `player`，不借 `classes.<职业>` 的图（`02-role.md` §三 回退表的字面执行）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **35 个文件 / 406 项**全绿（新增 8 项）。设计侧同步 [`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §十一、[`docs/design/skin.md`](docs/design/skin.md) §四（三层渲染器）、[`docs/DESIGN.md`](docs/DESIGN.md)；任务侧 [`task/04-skin.md`](task/04-skin.md) 的 `role` 条补落点。**立绘（§四）与受击表现（§4.4）未接**，排在 D3 后续批次。

**2026-09-30 · D3 第二屏（画布 `background` 接入）**
- 取层与落位：[`src/engine/skin/canvas.ts`](src/engine/skin/canvas.ts) 的 `backgroundUsable()`（`img` ＋ 正的 `cellSize` 齐备，`KB-1`）、`backgroundOf(bg, mapIndex, available?)`（越界 clamp 到最后一层、采用层不可用向前回退、`available` 判掉 `KB-2`）、`backgroundPlacement()`（倍率 ＝ `屏幕每格 ÷ cellSize`，图点 `(startX,startY)` ≡ 格 `[0,0]` 中心）。
- 渲染：[`src/play/MapView.tsx`](src/play/MapView.tsx) 按 §四 顺序画「底纹色（取采用层 `color`）→ 背景图（`translate/scale` 的 `<g>`）→ 参照线 / 道路」；无可用层即照旧纸面底纹。
- 图片尺寸交给素材自身像素：取图盒新增 `w/h: 'auto'`，SVG 层不写 `width`/`height`（SVG2 auto），**无需解码量尺寸**；`auto` 盒不参与旋转 / 镜像。
- `§3.1` 基准销账：素材拉伸进一个屏幕格的倍率**就是**「屏幕每格像素 ÷ `cellSize`」，与背景图共用同一变换，`road` 侧不用改代码（D3 起步的遗留项随之关闭）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **34 个文件 / 398 项**全绿（新增 12 项）。设计侧同步 [`docs/design/skin/05-canvas.md`](docs/design/skin/05-canvas.md) §八、[`docs/design/skin/01-road.md`](docs/design/skin/01-road.md) §十一、[`docs/DESIGN.md`](docs/DESIGN.md)；任务侧 [`task/04-skin.md`](task/04-skin.md) D3 的 `background` 条勾选。**构建页画布仍未接**；D3 余下各屏待做。

**2026-09-30 · D3 起步（运行期皮肤通道 ＋ `road` 接入）**
- 运行期通道：[`src/store/skin.ts`](src/store/skin.ts) 成为界面侧读皮肤的唯一出口（`activateLayers()` 换两层、`refresh()` 重取用户启用的全局皮肤、`release()` 回程序绘制；换套先撤旧地址，裁决 15）；未启用皮肤时素材源对一切路径回 `undefined`，各屏逐节点回退，**调用方不必判空**。`App.tsx` 启动时 `refresh()` 一次。
- `road` 接入：[`src/play/road.ts`](src/play/road.ts) 折算四邻四角（多格节点按占地全算、按左上格取图）→ [`src/play/MapView.tsx`](src/play/MapView.tsx) 每格 `roadPickAt()` → `textureProps()` → `SvgTexture`，未接管的那一格照旧画 `Footprint`。
- 遗留：地图层基准暂用屏幕 `CELL × CELL`（待 `background` 接入后改用背景层 `cellSize`）；构建页画布仍未接。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **34 个文件 / 386 项**全绿（新增 3 个用例文件 / 22 项）。设计侧同步 [`docs/design/skin/01-road.md`](docs/design/skin/01-road.md) §十一、[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md) §4.4、[`docs/DESIGN.md`](docs/DESIGN.md)；任务侧 [`task/04-skin.md`](task/04-skin.md) D3 的 `road` 条勾选。**D3 余下各屏待做**。

**2026-09-30 · D2 落地（贴图渲染器）**
- 三层落点：纯函数 [`src/engine/skin/texture.ts`](src/engine/skin/texture.ts)（`textureRef` / `spriteRef` 三写法归一、`placeTexture` 落位、`normalizeAngle`、`effectiveMode`）＋ 素材源 [`src/io/skin-assets.ts`](src/io/skin-assets.ts)（`createSkinAssets`：按需建地址、`mimeOf` 认扩展名、`release()` 一次撤）＋ 渲染器 [`src/ui/Texture.tsx`](src/ui/Texture.tsx)（`textureProps()` 唯一入口 ＋ `SvgTexture` / `DomTexture` 两层同接口）。
- **单一入口的退路**：「该节点未被接管 / 包里缺这张图 / 环境给不出地址」三种情形一律返回 `undefined`，调用方据此改画程序图形——业务代码只判断「有没有」，**不判断素材类型**（§四）。
- **两层同接口**：`rotate` / `flip` 由落位结果给出（绕盒心），SVG 层编译成 `transform`、DOM 层编译成 CSS；素材节点不写 `filter`（`S-6`）且统一 `pointerEvents: none`；`nine` / `tile` 在 `effectiveMode()` 统一回落 `stretch`（V2.2 落地时只改这一处）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **31 个文件 / 364 项**全绿（新增 3 个用例文件 / 28 项）。设计侧同步 [`docs/design/skin.md`](docs/design/skin.md) §四（补「实现落点」、表内版本线 `V1.1` → **V2.2**）、[`docs/DESIGN.md`](docs/DESIGN.md)；任务侧 [`task/04-skin.md`](task/04-skin.md) D2 五项勾选。**D3 逐屏接入待做**。

**2026-09-30 · NPC 预设到达老库 ＋ NPC 模组面板直接新建（§6.1 ① / §5.6.1）**
- 缺陷一：`ensureSeeded` 原先只在**首次播种**时补入预设，**V2.0 新增的 NPC 预设因此进不了老用户的组件库**（NPC 面板始终为空）。现引入 **`PRESET_VERSION`**：本地记录已补入到哪一版，**版本推进之后再次补入一次缺失项**（守「重名以本地优先」；同一版内不重复补入）；**改动内置预设必须同时 +1**。同步修 persist `merge` 漏掉的 `npcs` 语义色回填。
- 缺陷二：**NPC 模组面板原先没有新建入口**（空态仅提示"先回组件库新建"）。现左栏「全部 NPC」标题行给「＋ 新建」，**库中无 NPC 时按钮直接位于空态提示框内**，点击即建出一条空 NPC 并选中；**删除**仍归组件库。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **28 个文件 / 336 项**全绿。设计侧同步 [`docs/DESIGN.md`](docs/DESIGN.md)、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1、[`docs/design/05-mvp.md`](docs/design/05-mvp.md) §6.1 ①、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8；任务见 [`task/05-npc.md`](task/05-npc.md)。

**2026-09-29 · 末轮裁决 14–21（素材皮肤 / 三件套）**
- `Q12` zip 能力：**引入 `fflate`**（读＋写，约 8 KB gzip，浏览器端零 Node 依赖）——满足 GitHub Pages 纯静态与离线约束，不自实现 deflate（裁决 14；依赖边界登记于 [`docs/design/08-deploy.md`](docs/design/08-deploy.md) §9）。
- `Q17` 皮肤库与解压：本地只记录**导入过**的 `.pp`（游戏自带皮肤不入库）；**运行时一次只解压一套**，切换皮肤先清空当前解压结果；本地保存 `.pp` 原包体（条目索引进 `localStorage`，**包体进 IndexedDB**）；**不设体积硬上限**；`.psave` **不记录**皮肤名（裁决 15）。
- `Q20` 音频：**不进 V1**——字段与事件清单定稿为预留参数，V1 只解析与校验，播放整体排 **V2.2**（裁决 16）。
- `Q21` 背景：数组**即逐图清单**（**下标即 pmod 的地图下标，无需匹配 key**）——第 `i` 张地图取 `background[i]`，**每张地图只渲染一层**（不叠加）；**地图数多于层数时，越界地图降级为最后一层**（皮肤 2 层、地图 4 张 → 下标 2 / 3 都用下标 1 的图）；无可用层／未配置 → 再次降级为**默认配置**（程序绘制纸面底纹）；画布级 `color` 取**采用层**的值（裁决 17，修订 23）。
- `Q22` 描边：**独立设置项，缺省不渲染**——不跟随 `fill`、不保留组件色，无第四态（裁决 18）。
- `Q23` 包内布局：`.pgame` ＝ `pack.json` ＋ `game.pmod` ＋ `skin/`；`.pp` ＝ `manifest.json` ＋ 可选 `preview.png`（素材目录与命名自由，`resource/` 仅为推荐约定）；**路径一律相对包根**且**以描述文件为准**，`resource` 字段废除（`KP-10`）；版本键 `version` 改名 `format`，新增 `extends`（仅包内继承）与 `theme`（禁改布局 token）（裁决 19 / 22）。
- `Q24` 首页封面图：**归皮肤侧**（`startup.bg` / `lobby.bg`，即原 `pages.home.bg`），`.pmod` 不设封面字段（裁决 20）。
- `Q25` Creative：**提供九宫格切分工具**（V1 渲染仍按拉伸，产出供 **V2.2** 消费）；**字体不做子集化**（裁决 21）。
- `Q30` 立绘：**新增 `role.portraits`**（`player` / `classes.<id>` / `monsters.<id>`，字段 `img` ＋ 可选 `flip`），**纯皮肤元素、`.pmod` 不设字段**；落点＝底栏 hp/mp 左侧（**替代整个 `hud-face`**，无立绘不占位）/ 对战对话框顶部 **VS 区**（任一方有立绘即渲染，缺侧留空）/ 出身卡职业立绘（居中替代 `.class-icon`）/ 状态面板头部（与底栏同源），遭遇 / 商店弹层**仅预留**（V1 不渲染）；**暂不考虑四向**，左右相对仅由**显式 `flip`** 表达；立绘不用 `CELL` 基准、按容器高度等比缩放、底边对齐（裁决 24，[`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §四）。
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

**2026-09-29 · 补充裁决 24（新增立绘 `portraits`）**
- `role` 下新增**立绘**子节点 `portraits`（`player` / `classes.<组件 id>` / `monsters.<组件 id>`；字段 `img` ＋ 可选 `flip`）：**纯皮肤元素——`.pmod` 不设任何字段**（在 pmod 设计之外），无皮肤即整块不出现。
- **落点**：① 底栏 hp/mp **左侧**（**替代整个 `hud-face`**，无立绘时原样保留该位且**不占宽**）；② 对战对话框顶部 **VS 区**（**任一方有立绘即渲染**整区，主角在左、怪物在右，缺侧留空、不补 emoji）；③ 出身卡职业立绘（**居中**替代 `.class-icon`）；④ 状态面板 / 角色详情头部（与底栏**同源同图**）；⑤ 遭遇 / 商店弹层**仅预留**（现状 `EncounterState` 无主体 id，V1 不渲染）。
- **暂不考虑四向**：立绘不设 `n` / `e` / `s` / `w`，左右相对**仅**由**显式 `flip`** 表达（缺省不翻转）；立绘**不用 `CELL` 基准**、按容器高度等比缩放（高度档：底栏 ≈ `hud-face` 高 / VS 区 ≤ 160px / 出身卡 ≈ 64px），**底边对齐**（仅出身卡居中），**缺位一律不占位**。
- 校验项 `KR-5`~`KR-8`（非竖构图 / 无效键 / 数组写法 / 无透明通道），取舍 `S-28`~`S-30`；遗留待确认见 `Q30`（表情·受击变体、VS 字样是否素材化、尺寸档位）。
- 设计侧同步：[`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §一 / §二 / §四（§4.1–§4.3）/ §五 / §六 / §八 / §九 / §十、[`docs/design/skin.md`](docs/design/skin.md) 模块映射 / 逐屏覆盖清单 / §二 尺寸行 / `S-28`~`S-30` / `Q30`、[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md) §三、[`docs/design/skin/03-window.md`](docs/design/skin/03-window.md) §一、[`docs/design/skin/08-pages.md`](docs/design/skin/08-pages.md) §2.2 / 设计依据行、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2、[`docs/DESIGN.md`](docs/DESIGN.md) 模块映射与进度同步；任务侧同步本文件与 [`task/04-skin.md`](task/04-skin.md)。
- 顺序：Phase B 主体完成后开工，D0–D2（类型 / 取图纯函数 / IO）可提前。

**2026-09-29 · 补充裁决 25 / 26（单人唯一主人公 · 受击两法 · 立绘按窗口缩放 · NPC 与对话）**
- **裁决 25**：本引擎为**单人游戏、只有一位主人公**——立绘即**唯一形象**，无队伍 / 队友 / 多角色切换；**受击两法**＝有 `hurt` 素材则显示受击图、未提供则改用**形变**（×1.15 / ×0.9、约 `120ms`）；**立绘按窗口短边 `W` 的比例缩放**（底栏与状态面板 6% / 对战与对话 VS 区 18% / 出身卡 10%），废弃固定像素档；校验项新增 `KR-9` / `KR-10`，取舍新增 `S-31` / `S-32`。
- **裁决 26**：素材库新增 `npcs` 分组；NPC **只出现在建筑里**、**不走「启用」**（入包条件 ＝ 被建筑实例引用）；建筑新增**第六种行为** `encounter: talk`；建筑实例以 `npcs` / `dialog` **两级各掷一次** `talk.dice`（缺省 `1D6`，踩到抽定、整场不重掷）；**树状对话**支持多套方案（节点 `message` ＋ `items`；**后续分支可嵌套、给道具可重复列举＝多份——道具清单的字段名后改为 `give`**，见下方「NPC 追加裁决 3 项」条；**对话结构后归一为全树同一个类型**，见「对话结构归一」条）；编辑器新增 `NPC` 分区与**整页「NPC 模组」思维导图面板**（§5.6.1，不占画布模式条，G7）；前置配置新增 `talk.dice` 后总账 **14 项**；对话**不产生结局、不记旗标、不影响通关条件**。
- 设计侧同步：[`docs/design/02-data-model.md`](docs/design/02-data-model.md) 新增 **§4.9**、[`docs/design/01-pmod.md`](docs/design/01-pmod.md) `### NPC` 段与**八大类** id 表、[`docs/design/04-editor.md`](docs/design/04-editor.md) 分区 ×9 / **§5.6.1** / G7 / 组件页 / 实例页 / 校验项、[`docs/design/03-engine.md`](docs/design/03-engine.md) 与 [`docs/design/05-mvp.md`](docs/design/05-mvp.md) 配置项 **14 项**、[`docs/design/06-future.md`](docs/design/06-future.md) 新增 **§7.6** 并修订 §7.4、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2、[`docs/design/skin/02-role.md`](docs/design/skin/02-role.md)（§二 / §4.2 / §4.4 / §八 / §九 / §十）、[`docs/design/skin.md`](docs/design/skin.md)、[`docs/design/skin/00-package.md`](docs/design/skin/00-package.md)、[`docs/design/skin/03-window.md`](docs/design/skin/03-window.md)、[`docs/DESIGN.md`](docs/DESIGN.md) 模块映射 / 章节映射 / 进度同步。
- 任务侧：新增里程碑 [`task/05-npc.md`](task/05-npc.md)（E0–E5 ＋ 13 项原子验收，后随细化与追加设定扩为 **18 项** → **19 项**）；[`task/04-skin.md`](task/04-skin.md) 立绘条目按裁决 25 / 26 修订；[`task/01-build.md`](task/01-build.md) 与 [`task/02-play.md`](task/02-play.md) 指向本里程碑。

**2026-09-29 · 裁决 26 对话细化（⑨~⑪）**
- **掷定即锁死**：选 NPC / 选方案只要由骰子定过，**本局永久不变**（重踩不重掷、不换人、不换方案），锁在**建筑实例**。
- **本层选项抽取（`dice` ＋ `hit`）**：任意一条记录写 `dice` → 它 `items` 各条**靠掷骰命中**（各条带 `hit` 区间，**未命中再掷**）；不写 `dice` → 玩家**直接点选**。编辑器**检查 `hit` 是否覆盖骰面**（重叠 / 越界也提示），**只提示、不拦截**保存 / 导出。
- **`give` 一次性交付**：交付出带 `give` 的记录后该实例进**终态**，再次对话**只回放那条记录的 `message`**、不再展开它的 `items`、不再发道具（防刷）；与"抽定结果"同源写进 `.psave`。
- 设计侧同步：[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.9.2–§4.9.4、[`docs/design/01-pmod.md`](docs/design/01-pmod.md) `### NPC` 示例、[`docs/design/03-engine.md`](docs/design/03-engine.md) 场景索引（**6 → 7 处骰子**）与 §4.8.6、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1 / §5.7、[`docs/design/06-future.md`](docs/design/06-future.md) §7.6、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2 裁决 26、[`docs/DESIGN.md`](docs/DESIGN.md)；任务侧同步 [`task/05-npc.md`](task/05-npc.md)（原子验收 **13 → 15 → 16 → 18**）；再随「进入 / 重入 / 空宝箱」三条追加设定修订 E3 / E4 口径与校验项（**非 `talk` 挂 NPC 合法不报**、补 **`dialog` 方案名悬空标红** 与 **空宝箱 ＋ NPC 不报"空的"**、E4 新增**进入判定 / 重入选择框 / `.psave` 对话字段**）。**三条裁决（2026-09-29）**：① `dialog` 悬空 → **编辑器标红 ＋ 清单标记，运行时跳过、当没有 NPC**（**导出不剔除**该字段）；② `.psave` 对话状态以**建筑实例 key** 记账（**key 统一 `<地图名>#<ref>@<锚点>`**——**一座建筑 ＝ 一个节点**，多格由节点自带的 `w` / `h` 标记（**缺省 1**；`road` / `start` / `end` 恒 1×1）；**锚点 ＝ 节点自己的坐标**；**相邻的两座同名建筑是两座**、**不按"相邻同种"聚合**；`ref` 保护 ＝ **不做顺序编号 / 删除不回收 / 新增不复用**，地图默认名也**不回收旧编号**；**弱引用**不匹配 → 视为未触发）；③ **重入列表只列已锁定的那一位 NPC**（确认）。 **结构修订（2026-09-29）**：多格建筑 ＝ **一个节点带 `w` / `h`**（解析时非建筑节点**归一为 1×1** ＋ 校验 **`K13`**），引擎**绝不**按"相邻同种"合并；`src/store/project.ts` 的地图默认名由 `maps.length + 1` 改为**"现有最大编号 ＋ 1"**（删中间图后不再重名撞 key）。

**2026-09-29 · 对话结构归一（取消 `chat` / `prop` 判别，全树同一个结构）**
- **纠正结构设计**：原先「节点 `{message, dice?, items, result?}` ＋ 项 `type: 'chat' | 'prop'` 判别联合」把"根节点"与"子节点"当成了两种东西。**修正为只有一种结构**：`{ result?, message, dice?, hit?, items?, give? }` —— **`items` 的元素类型就是它自己**（递归），**根层数组的元素与任意深层的 `items` 元素完全同构**，**没有任何判别字段**。
- **必填只有 `message`**（因此取消"没有台词的道具项"类型）：`result` / `items` / `dice` / `hit` / `give` **全部可省**。语义：`result`（**仅当本条是某个 `items` 的元素时生效** ＝ 玩家答复文本）/ `message`（NPC 台词，逐条展示）/ `items`（说完后的后续选项，缺省即结束）/ `hit`（**父层有 `dice` 时**本条的命中区间）/ `dice`（**本层 `items` 的命中骰**，不写即直接点选）/ `give`（赠予道具，可重复＝多份）。
- **`give` 与 `items` 可并存**（先交付、再继续）；原「道具项为终止项 / 不与选项混排」两条约束**作废**；新增「**`result` 只在选项位生效**，根层写了 → 忽略并提示、导出剔除」。
- **`DialogItem` / `DialogChatItem` / `DialogPropItem` 作废**，`DialogNode` 是唯一类型（E0 已落地）。
- 落点：[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.9.2–§4.9.4、[`docs/design/01-pmod.md`](docs/design/01-pmod.md) `### NPC`、[`docs/design/03-engine.md`](docs/design/03-engine.md) §4.8.12、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1 / §5.7、[`docs/design/05-mvp.md`](docs/design/05-mvp.md) 11i、[`docs/design/06-future.md`](docs/design/06-future.md) §7.6、[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.2 裁决 26 ④⑩⑪ / §8.3 设定 3、8；任务侧同步 [`task/05-npc.md`](task/05-npc.md) E0 / E2 / E3 / E4 与验收 3–5、9–12。

**2026-09-29 · V2.x 版本线上线（NPC ＝ V2.0 追加设定）**
- **版本线定稿**：**V1**（Phase 0 / A / B；七大类 · 13 项配置 · `encounter` 五选一）**冻结**；**V2.0 ＝ 新增 NPC 结构**（**追加设定 / 结构改造**，不属于 V1 的阶段性设计）；**V2.1 ＝ SKIN 基础**（三件套容器 / 贴图渲染器 / 逐屏素材接入）；**V2.2 ＝ SKIN 进阶 ＋ 音频**（Creative 模式 / 九宫格切片消费 / 皮肤校验 / 音频播放）。优先级 **V2.0 ＞ V2.1 ＞ V2.2**——**结构改造先做、再做皮肤**。
- **追加设定（NPC 触发时机）**：**进入建筑之后、建筑事件之前**——踩到建筑 → ① NPC 触发（有 `npcs` 才跑）→ ② 该建筑的 `encounter` 行为；**`npcs` 与 `encounter` 正交**（原「挂了 NPC 却不是对话建筑 → 不生效」校验**作废**）；**`encounter: talk` ＝ 建筑事件阶段留空、以对话为主体**。落点：[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.3、[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.9.3、[`docs/design/03-engine.md`](docs/design/03-engine.md) §4.8.12、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6 / §5.7。
- **V1 口径回退（不覆盖史实）**：[`task/00-foundation.md`](task/00-foundation.md) 的「七大类 / 内置表」恢复 **V1 口径**，NPC（`n_` 前缀）标注为 **V2.0 追加**。
- **06-future 定位**：[`docs/design/06-future.md`](docs/design/06-future.md) 明确为**记录文档**（不是任务依据），§7 标题与说明改回记录口径，权威口径指向 [`docs/design/05-mvp.md`](docs/design/05-mvp.md) / 各 `design/*.md` / 本文件。
- **登记**：「V1.1 清单」改名 **「V2.1 / V2.2 清单」**（加版本列、逐项归位；音频与九宫格归 **V2.2**，立绘遗留与未决项归 **V2.1**）。
- **追加设定补完（进入 / 重入 / 空宝箱）**：NPC 触发**只在「从建筑外踏入该建筑任意一格」那一次**——**建筑内部移动不再触发**（多格建筑是**同一座**、同一 key）；**首次进入一定进对话**，**已触发过的实例再入先弹「选择对话框」**（**不换人、不重掷**；*同日后续裁决细化为【继续对话】/【重新对话】/【路过】三个选项，见下条*）；**`treasure` 空池 ＋ 配了 NPC → 不再提示"什么也没有 / 已经空了"**（**NPC 即内容物**）。落点：[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.3 **设定 2–4**、[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.9.3、[`docs/design/03-engine.md`](docs/design/03-engine.md) §4.8.12 / §4.8.5⑥、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1 / §5.7、[`docs/design/05-mvp.md`](docs/design/05-mvp.md) 11i、[`task/05-npc.md`](task/05-npc.md) E4。

**2026-09-29 · NPC 追加裁决 3 项（重入三选项 / `give` 改名 / 重名地图后缀）**
- **重入 ＝ 三个标记 ＋ 三个选项**（[`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8.3 **设定 3（改）**）：进度按**建筑实例**只记三个标记——`cursor`（**当前停留节点**，每进一个节点就更新；**没有它 ＝ 没有进度**）/ `talkDone`（**对话走完过一次**）/ `deliveredNode`（**已交付**，与前者**分开记**）。**首次进入不弹框**（从根节点开始）；**重入**先弹**选择对话框**（只列已锁定的那一位 NPC）：**未走完**给【**继续对话**】（回到 `cursor` 节点接着走，**没有 `cursor` 就从根开始**）＋【**重新对话**】（从根完整重播）；**已走完**再加【**路过**】（跳过对话、直接跑建筑事件）。【继续】在已交付时**只回放交付节点台词**；【重新】**不重置**标记——**已交付的实例不会重复发道具**（防刷）；【**路过**只在"走完过"之后出现】。
- **给道具的字段叫 `give`**（**设定 8（新）**）：`items` **永远只表示"后续选项"**（同一结构的数组），给玩家的道具清单独立叫 `give`（**字符串数组**、可重复＝多份）——两者不再共用一个 key。
- **重名地图导出时自动加后缀**（**设定 6（改）**，原「地图重名的自动消歧」未决项结案）：编辑器**仍标黄提示、不改名**（改名会让旧档 key 全部不匹配）；**导出与开局时**给第 2 张起加 `名字 (2)` / `名字 (3)`…（第一张保持原名，后缀名被占用就继续顺延）。理由：key 含地图名，**两条出口必须得到同一套 key**，否则同一份 `.psave` 在两处对不上。
- **代码已落地**（本项属跨版本小修，先行实现）：`src/io/pmod.ts` 新增 `uniqueMapNames`（`exportPmod` 返回值加 `renamed`）、`src/play/load.ts` 的 `scenarioFromProject` 共用、`src/build/ioActions.ts` 导出后 toast 提示改名；`src/io/__tests__/pmod.test.ts` 新增 3 个单测（全量单测通过 ＋ `tsc --noEmit` 无错）。
- 设计侧同步：[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.9.2 / §4.9.3、[`docs/design/03-engine.md`](docs/design/03-engine.md) §4.8.12、[`docs/design/01-pmod.md`](docs/design/01-pmod.md) `### NPC` 与地图名段、[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.7、[`docs/design/05-mvp.md`](docs/design/05-mvp.md) 11i、[`docs/design/06-future.md`](docs/design/06-future.md) §7.6、[`docs/DESIGN.md`](docs/DESIGN.md) 进度同步；任务侧同步 [`task/05-npc.md`](task/05-npc.md)（原子验收 **18 → 19 项**，E0 类型 / E0 单测 / E3 引用完整性 / E4 重入与 `.psave` 字段全部改字）。

**2026-09-29 · 链路审计与优先级重排（NPC ＞ skin ＞ V1.1）** *(历史条目：版本号口径已被上一条 V2.x 版本线取代，内容保留)*
- **优先级定稿**：**Phase E（NPC 对话）＞ Phase D（皮肤）＞ V1.1**——编号仅为**稳定标识、不代表先后**。**E0–E3 只依赖已完成的 Phase A → 可立即开工**；E4 依赖 Phase B 的遭遇流程与对话框壳；D 端到端依赖 B（D0–D2 可提前，**与 E0–E3 可并行**）。
- **补链（MVP 口径）**：[`docs/design/05-mvp.md`](docs/design/05-mvp.md) §6「纳入」补 **`T. NPC 与对话`**、`J.` **五种建筑行为 → 六种**；§6.2 补 **`11i` 对话闭环**验收（两级掷骰锁死 / 本层 `dice`+`hit` 未命中再掷 / `give` 一次性交付 / 覆盖检查只提示不拦截）；「暂不纳入」表中**已排入 Phase B** 的项（游玩态 / 骰子 UI / `.psave` / 组件库导入导出 / `version`）去向改为**显式指回 Phase B 任务**。
- **补链（引擎落点）**：[`docs/design/03-engine.md`](docs/design/03-engine.md) 新增 **§4.8.12 对话（`encounter: talk`）** 运行时顺序小节（五步顺序 ＋ 两级抽取骰与节点命中骰的用法）；**场景索引第 7 行**由跨模块引用改为指向本节（体例与 §4.8.3 / §4.8.9 一致）。
- **修正（范围分界）**：[`docs/design/06-future.md`](docs/design/06-future.md) §7 标题与范围说明——**§7.0–§7.3 属 V1（Phase B 的设计依据）**，不再是"非 MVP、仅记录"；§7.4 ＝ 明确不做；V1.1 清单另立本节。
- **修正（Phase 0 残留口径）**：[`task/00-foundation.md`](task/00-foundation.md) 的「七大类」改为**八大类**（Phase 0 落地时按七类口径，第 8 类 NPC 由 Phase E 增补，不影响既有结论）。
- **新增「V1.1 清单（优先级 ③）」**（见上文）：音频播放（裁决 16）/ 贴图 `nine` 策略（裁决 21）/ 九宫格切片消费（裁决 21）/ 对话后续扩展（§7.6）/ 立绘遗留 `Q30` / 未决项 `Q26`·`Q28`·`Q29` / 多项目管理。
- 任务侧同步：[`task/04-skin.md`](task/04-skin.md) 与 [`task/05-npc.md`](task/05-npc.md) 的「前置」行按新优先级重述。

**2026-09-29 · `.pmod` 字符集声明与结构标题英文化**
- **文件头声明字符集**：导出在最前面写入 **UTF-8 BOM（`EF BB BF`）＋ `<!-- charset: utf-8 -->`** —— `.pmod` 是纯文本，浏览器／编辑器有时按 **GBK** 猜编码，中文一旦乱码整段就废；解析前先剥 BOM。
- **结构标题一律英文**：`## Background` / `## Components` / `## Rules` / `## Maps` 与 `### Monsters` / `Items` / `Buildings` / `Roads` / `Classes` / `Skills` / `NPCs` / `Backgrounds`；中文标题同样有乱码匹配失败的风险。**地图名（`### <地图名>`）是内容，照旧中文**。
- **向后兼容**：导入**先按英文匹配、未命中降级中文**，旧写法 `## 设定` / `### 技能` / `### NPC` 照旧能读。
- 代码落地 [`src/io/pmod.ts`](src/io/pmod.ts)（`SECTION_TITLE` / `GROUP_TITLE` / `SECTION_ALIASES` / `GROUP_ALIASES` ＋ 解析前剥 BOM；顺带补上此前**漏导出的 NPC 分组**）与 [`src/io/__tests__/pmod.test.ts`](src/io/__tests__/pmod.test.ts)（新增 3 项：BOM+BOM 解析 / 英文标题 / 中文降级）。
- 设计侧同步：[`docs/design/01-pmod.md`](docs/design/01-pmod.md) §3 / §3.1、[`docs/design/02-data-model.md`](docs/design/02-data-model.md) §4.8 / §4.9、[`docs/design/03-engine.md`](docs/design/03-engine.md) §4.8.6、[`docs/DESIGN.md`](docs/DESIGN.md) 进度同步；任务侧同步 [`task/00-foundation.md`](task/00-foundation.md)。

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

**2026-09-29 · V2.0（NPC 与对话）实现完成**
- 里程碑 [`task/05-npc.md`](task/05-npc.md) 的 **E0–E4** 全部落地并通过 **19 项原子验收**（勾选已同步）：编辑器侧为第 8 类组件与组件页、NPC 模组面板（思维导图，本层 `dice` 与 `hit` 命中覆盖检查、`give` 可重复）、建筑实例页与校验 `K13`–`K19`；运行时侧为进入建筑后的抽取与弹层（两级各掷一次并掷定锁死、重入按 `cursor` / `talkDone` / `deliveredNode` 给【继续对话】【重新对话】【路过】、`give` 一次性交付终态、空宝箱 ＋ NPC 不报空的）。
- 验证：`npx tsc --noEmit` 无错；`npx vitest run` **16 个文件 / 197 项**全绿。
- 余项：**E5 皮肤侧接口约定**（`role.npcs` 棋子形象与 `portraits.npcs` 立绘，立绘唯一落点为对话弹层 VS 区）按该文件说明并入 [`task/04-skin.md`](task/04-skin.md)，随 **V2.1** 实施；下一步按优先级进入 **V2.1（SKIN 基础）**。

**2026-09-29 · NPC 模组左栏修订（列出全部 NPC）与条目排版修复**
- **设计修订**：NPC 模组面板左栏原先「只列本局**被引用**的 NPC」，现改为**列出库里的全部 NPC** —— 引用数是**本局状态标注**，不是能否撰写对话的前提（要挂到建筑上随时可以再补）。被引用者显示 `×N`，未被引用者降透明并标「未引用」，同样可选中、可编辑；面板徽章由「N 条被引用」改为「共 N 条 · 被引用 M 条」，栏目标题由「本局被引用」改为「全部 NPC」；库中没有任何 NPC 时的空态提示随之改写。正文同步 [`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1 与 [`task/05-npc.md`](task/05-npc.md) E2。
- **条目排版修复**：左栏条目补齐内边距与单行排布（名称在左、状态徽章靠右并纵向居中、条目间距 5px），并补上 **`.truncate` 单行截断工具类**（该 class 先前被引用但没有任何样式定义，长名称既不省略号也不换行保护）。代码 [`src/build/NpcModScreen.tsx`](src/build/NpcModScreen.tsx) / [`src/styles/layout.css`](src/styles/layout.css) / [`src/styles/theme.css`](src/styles/theme.css)。
- 验证：`npx tsc --noEmit` 无错；`npx vitest run` **16 个文件 / 207 项**全绿；浏览器实测条目内边距 7px、名称与徽章间距 6px、徽章纵向偏移 0、未被引用条目可选中并正常绘出画布。

**2026-09-29 · 连线虚线偏移与落点判定修复 ＋ NPC 面板文案去口语化**
- **虚线偏移**（bug）：拖拽连线画在 `.dlg-content` 内（与卡片同一坐标系，外层带 `translate + scale`），端点却按**视口坐标**填入，两者差着整个相机平移、缩放后还要再乘 `zoom`。浏览器实测偏出：初始 **41px**、放大到 1.1 时 **63px**、平移后 **171px**。改为**统一换算到内容坐标**后，实测端点压住鼠标误差 ≤ **0.8px**、线头精确落在连接端口中心。
- **落点判定**（bug）：原实现只记「连线时划过哪张卡片」（`mouseenter` 写入、**从不清除**），光标一旦划过某张卡片，之后在空白处松手照样连上它。现在**以松手位置为准**判定光标底下的卡片，并补 `mouseleave` 清除候选。浏览器实测：划过卡片后移开再松手 → 「已取消连线」且卡片数不变；拖到目标卡片上松手 → 正确连接并弹出「已连接」提示。
- **文案**：清除「父子 / 子卡片 / 上一层」等说法与「＝」式口语链条，面板说明、画布提示、悬停说明、确认框统一改为书面表述（**上一级 / 后续项 / 该记录**）。
- 文档同步：[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.6.1（并修正两处与实现不符处 —— 「拖到空白」是取消而非断开、折叠控件位于端口右侧）。测试新增 1 项针对落点判定的回归用例（划过后移开必须取消）；`npx tsc --noEmit` 无错，`npx vitest run` **16 个文件 / 208 项**全绿。

**2026-09-29 · 卡片自带段名 ＋ 「答复骰子」正名 ＋ 清掉面板上的实现细节**
- 卡片四段（命中 / 答复 / 台词 / 答复骰子）原先只有「命中」和末尾那颗骰子带行内标签，答复与台词两块只能靠上下文猜。现在**段名直接写在分隔线上**（`.dlg-sep.titled`，两侧各留一段虚线 → `— 答复 —`），窗口说明里的说法在卡片上原样可见；根卡片没有上一级，故只出现「台词」一段。
- **`item 骰子` 改名「答复骰子」**：该字段管「下面那些答复怎么被选中」，与玩家答复文本（`result`）对应，旧名却在说数据结构（`items`）。
- 面板上的实现细节清掉：方案计数只留「2 套方案 · 等权」（去掉了「（由建筑实例抽定，`talk.dice`）」），新建方案按钮悬停说明只留「新建一套方案」，组件页那句也不再露 `talk.dice`。
- 验证：`npx tsc --noEmit` 无错；`npx vitest run` **16 个文件 / 208 项**全绿（新增段名断言：子卡片 `['答复','台词']`、根卡片 `['台词']`）；浏览器实测 **242 处**可见文字（含 `title` / `placeholder`）已无 `item 骰子` / `talk.dice` / `父子` / `子卡片` / `权重` 残留，4 条连线端点仍压在卡片边上（误差 < 1px），卡片无重叠。

**2026-09-29 · 预设重名以本地优先 ＋ 组件库 `⋯` 菜单补回「复制成新组件」**
- **重名以本地优先**（新登记于 [`docs/design/07-decisions.md`](docs/design/07-decisions.md) §8「预设与本地冲突：重名以本地优先」）：内置预设的**定义固定**（随版本走），用户改过的那一份**存在本地**，两者可能冲突。播种时**同 `id` 已被改过 → 保留本地那一条**（不拿固定定义覆盖，`恢复默认` 仍是回到固定定义的唯一入口）；**同名但不同 `id` → 同样保留本地、该预设不补入**，库里不出现两条同名条目。判定按**名称**而非只看 id：预设换了 id 在屏幕上仍是同一个名字，用户分不出来。代码 [`src/store/library.ts`](src/store/library.ts) `ensureSeeded`（补入缺失预设时按 `id` 与 `name` 双重判重）。
- **`⋯` 菜单补回「复制成新组件」**：行内 `复制` 与它**是同一个动作**（`duplicateOf` 做**整条深拷贝**，NPC 连整套 `dialogs` 一起带走，复制出来的是一条可独立编辑、可独立挂到建筑上的完整 NPC），两个入口都保留，菜单项序恢复与 §5.3 一致（`复制成新组件` · `删除` · `恢复默认`，NPC 另加 `编辑对话`）。代码 [`src/build/KitPanel.tsx`](src/build/KitPanel.tsx)。
- 文档同步：[`docs/design/04-editor.md`](docs/design/04-editor.md) §5.3（菜单项按实现的项序写、补复制整条的语义）、[`docs/design/05-mvp.md`](docs/design/05-mvp.md) §6.1 ①（补重名口径）、[`docs/DESIGN.md`](docs/DESIGN.md) 进度同步。
- 验证：新增单测 [`src/store/__tests__/library.test.ts`](src/store/__tests__/library.test.ts) 3 项（空库全量播种 / 同名自建顶掉同名预设 / 改过的预设不被覆盖）；`npx tsc --noEmit` 无错，`npx vitest run` **17 个文件 / 211 项**全绿。

**2026-09-29 · `S-29` 修订同步（对话弹层不设立绘区）＋ V2.1 D0 落地**
- **`S-29` 修订**（设计侧已改，本次同步任务侧）：NPC 对话弹层**不设立绘区**——原裁决 26「对话弹层启用 `[主角] VS [NPC]`」作废；弹层只有**标题栏 ＋ 台词 ＋ 选项**，NPC 只占标题栏 `icon` 一格（`role.npcs.<id>`，缺位回退该 NPC `icon` emoji）。`portraits.npcs` 当前**无落点**、仍参与 `KR` 校验；遭遇 / 商店弹层的「仅预留」口径不变。立绘高度档随之收敛为**底栏与状态面板 `6% W` / 对战 VS 区 `18% W` / 出身卡 `10% W`**。
- **V2.1 D0 落地**：新增 `src/types/skin.ts`（manifest **16 键** / 三写法 / 衬底三元组 / 15 槽位常量 / 音频键常量 / 主题 token 白名单 / `.pgame` 容器描述）与 `src/engine/skin/`（`road-bits` 位序与槽位、`road-style` 样式集选取、`road` 三写法合成、`canvas` 背景取层、`lookup` 形象与立绘、`theme` token 过滤）；`src/types/index.ts` 与 `src/engine/index.ts` 均已导出。取图全为纯函数，确定性单测见 `src/engine/skin/__tests__/`。
- **角位口径定稿（三条待校正已全部裁决）**：① `cross_*` 系**基准角位确认**为「西北角起、顺时针」（`cross_three_corners` 以缺西南角为基准）；② [`docs/design/skin/01-road.md`](docs/design/skin/01-road.md) §七 **重申路径定义**——`styles[].base` 是**目录前缀**、`tiles` 值是**相对文件名**，示例已改，§十 待确认第 4 条删除；③ 角位改为**「夹角」口径**：某角**两侧的边都有路**才是夹角角块并计入角数 `c`，只挨一条路的**外侧角**忽略，故 `corner` / `tee_corner_*` / `tee_full` 是**运行期可达**槽位（§五 整段改写、§2.1 / §三 / §四 同步）；`tee_corner_nw` / `tee_corner_ne` 基准姿态为**缺口朝南**。代码见 [`src/engine/skin/road-bits.ts`](src/engine/skin/road-bits.ts)。
- 文档同步：[`docs/design/skin.md`](docs/design/skin.md) `S-29` / `Q30` / `Q31`（设计侧修订原文）、[`docs/design/skin/02-role.md`](docs/design/skin/02-role.md) §4.1、[`task/04-skin.md`](task/04-skin.md)（D0 八项勾选、D3 / D7 落点改写、进度同步三条）；本文件任务表中 V2.1 行状态改为**进行中**。
- 验证：`npx tsc --noEmit` 无错，`npx vitest run` **21 个文件 / 258 项**全绿。
