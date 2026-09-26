# PopRPG 设计文档 — 模块：AI 实现守则（防止做出"一坨"）

> **本模块是给执行实现任务的 AI 的硬约束与开工顺序。** 设计文档再好，若实现时跳读、堆文件、擅自改决策，就会做出乱七八糟的东西。本守则优先级高于任何"省事"的冲动。任何实现任务开工前必须先读本文件。

## 一、开工前必读顺序（不要跳、不要凭记忆）

1. [`design/00-overview.md`](design/00-overview.md) — 产品定位 / 三条立场 / 明确不做
2. [`design/00b-style.md`](design/00b-style.md) — **视觉全局基调（纸张+手绘+涂鸦），贯穿所有 UI**
3. [`design/04-editor.md`](design/04-editor.md) — §5 操作模式标准表（G1–G6），构建态交互铁律
4. [`design/02-data-model.md`](design/02-data-model.md) — §4.0–§4.7 七大类类型定义
5. [`design/03-engine.md`](design/03-engine.md) — §4.8 规则引擎纯函数
6. [`design/05-mvp.md`](design/05-mvp.md) — §6 预设最小清单 + 验收原子项
7. [`design/07-decisions.md`](design/07-decisions.md) — §8 已确认决策（不可擅自改）
8. 对应里程碑的 `task/` 分文件 checklist

> 没读完 00b-style 和 04-editor 就写界面/交互，等于没看需求就动工。

## 二、禁止事项（红线，违反任一条都是"做烂"的根源）

- ❌ **不要把一个页面/功能堆进一个超大组件或文件**（如单一 `App.tsx` 上千行）。按 `task/01-build.md` 的 A1–A6 把构建页拆为 Layout(栅格) / LayerPanel / KitPanel / ModeBar / Canvas / Inspector（组件页/实例页/规则页）等。
- ❌ **不要跳过 §5.4 操作模式标准表直接写交互**。所有鼠标/键盘行为必须能在表里找到出处；找不到先改 §5.4 再写代码。
- ❌ **不要擅自改 §8 已确认决策**（保底对语义、tick 顺序、交锋结构、怪物回退等）。要改先问用户。
- ❌ **不要引入后端 / 服务端 / 外部在线接口**（纯静态约束，见根索引）。
- ❌ **不要引入 rough.js 等额外绘图库**（除非用户确认）；手绘感用 SVG 滤镜 / CSS 实现（见 00b-style）。
- ❌ **不要把组件定义写进 project**（组件库与内容分离，见 §4.0 / §4.7）。
- ❌ **不要把规则引擎逻辑写进 UI 组件**；纯函数放 `engine/`，UI 只调用（见 §4.8）。
- ❌ **不要在没读 00b-style.md 的情况下写任何样式**（视觉是全局基调，不是收尾补）。
- ❌ **不要自作主张加"高级功能"**（技能树/冷却/多结局/难度评估等明确不做的项，见 §1.1 / §7.4 / §7.5）。

## 三、代码组织约定

- **状态分层**：Zustand store 分库 store / 项目 store / 游玩态 store，不混成一个巨大对象；持久化各自独立 key。
- **引擎与 UI 分离**：所有结算 / 掷骰 / 判定是纯函数（输入→输出、无副作用），放 `engine/`；UI 组件只渲染与派发，不直接算数值。
- **组件拆分粒度**：构建页至少拆为 Layout / LayerPanel / KitPanel / ModeBar / Canvas / Inspector 等；游玩页拆为 MapView / CombatView / DiceLog / SkillBar / StateBar 等（详见对应 task 里程碑）。
- **每个里程碑完成跑 `npm run build`（tsc 无错）再进下一个**；不要攒一堆错误最后一起修。

## 四、验收原子化

- 每个验收项（`design/05-mvp.md` §6.2 / `task/` checklist）应是"可独立运行、可肉眼或单测验证"的原子项，**不要用"能玩""能编辑"这种模糊概括**。
- 引擎纯函数（`resolveSkill` / `tickStates` / `applyEffects` 等）必须有单测边界（见 `task/01-build.md` A8 单测边界全集），先过单测再接 UI。

## 五、视觉贯穿

- 任何新增界面（面板、按钮、弹层、网格、地图组件）第一版就要符合 `design/00b-style.md`：纸张底、手绘线条、手写体、便签/涂鸦观感。**不要先写"能跑但丑"的版本再补风格**——丑版本一旦合进来就会被后续依赖，越改越乱。
