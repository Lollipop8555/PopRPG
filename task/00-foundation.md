# Phase 0 — 基座 (Foundation)

> **里程碑范围**：脚手架 / 路由 / 组件库 store / 项目瘦身 / 6 属性骨架 / 类型框架 / `.pmod` 解析 / 来源派生 / 标签反查。
> **上层索引**：[`../task.md`](../task.md)（总体路线与里程碑索引）　**设计依据**：[`../docs/DESIGN.md`](../docs/DESIGN.md) §3.3 / §4.0 / §4.7 / §7.0
> **前置**：无　**顺序**：本阶段是后续 BUILD/PLAY 的地基，M0 项已基本完成，剩路由与类型框架待收尾。

---

## 0.1 脚手架（M0，已完成）

- [x] React + TS + Vite 脚手架、`tsconfig`、`index.html`、`vite.config`
- [x] 依赖：`zustand` / `lucide-react` / `js-yaml`
- [x] Zustand store（localStorage 持久化、撤销/重做）
- [x] 最小预设套件
- [x] `.pmod` 导出/导入 round-trip
- [x] 纸张主题 + 手绘风 + 网格
- [x] `.github/workflows/deploy.yml`

## 0.2 路由约定（§7.0，待做）

- [ ] **`/`（默认）= 游玩页**；**`/build` = 构建页**。两路由同应用：游玩页加载 `.pmod` 开玩，构建页产出/编辑 `.pmod`
- [ ] Vite `base` 按页路径配置，**优先单页避免深链 404**

## 0.3 拆出组件库 store（独立 localStorage key `poprpg_library`，跨项目存活）

- [ ] 库条目 = `{ 预设（播种一次）＋ 用户自建 }`，两者同权（可改 / 删 / 复制；预设可「恢复默认」）
- [ ] `initLibraryIfEmpty()`：首次启动播种内置预设；之后只追加用户自建

## 0.4 项目瘦身

- [ ] `project` 只留 `name / background / enabledIds / rules / maps`，**不再存组件定义**
- [ ] 组件定义一律来自组件库；项目只记"启用哪些 + 铺设到哪"

## 0.5 6 属性骨架

- [ ] `StatKey = 'hp' | 'mp' | 'patk' | 'matk' | 'pdef' | 'mdef'`
- [ ] `RESOURCE_KEYS = ['hp','mp']`（有当前值、可消耗/恢复）
- [ ] `ABILITY_KEYS = ['patk','matk','pdef','mdef']`（只是输入）
- [ ] `Stats = Record<StatKey, [number, number]>`（怪物区间） / `StatValues = Record<StatKey, number>`（结算后具体值）
- [ ] **完整类型全集（七大类 + 规则 + 效果）见 [`task/01-build.md`](./01-build.md) A0**（含 `SkillDef` / `EffectOp` / `Gate` / `PoolRef` / `EventBlock` 等全部字段定义）

## 0.6 `.pmod` 自包含与解析

- [ ] 导出：算出"本局用到的组件"（启用 ∪ 铺设 ∪ 传递引用）**快照**写入 `## 设定`；只装用到的，**不写来源字段**
- [ ] 导入：定义**并入组件库**（同 id 内容不同时另生成新 id 并提示），启用 / 铺设还原到项目
- [ ] 旧文件缺 `rules` / 残留 `diceConfig` 时用 `DEFAULT_RULES` 兜底并提示（规则兜底逻辑在 A7 落地）

## 0.7 来源派生工具

- [ ] `isPreset(id)` = `id ∈ 内置预设表`；内置表按**七大类**分别维护
- [ ] `resetToPreset(id)` 从内置表取原始定义

## 0.8 store actions

- [ ] `toggleEnabled(id)`、`duplicateComponent(id)`、`removeComponent(id)`（带"被 N 处使用"确认）、`usageCount(id)`（铺设 / 被引用计数派生）

## 0.9 标签反查工具

- [ ] `componentsWithTag(tag)` / `gatesUsingTag(tag)` —— 给编辑器的双向反查用（§5.6）

---

## 0 验收（基座就绪判据）

- [ ] 应用能启动；`/` 与 `/build` 两路由可达
- [ ] 刷新页面库与项目数据不丢失
- [ ] 组件库与项目分离：改库定义对用到它的局立即生效；项目文件不含组件定义
- [ ] `.pmod` 导出→导入 round-trip 一致（定义 / 启用 / 铺设 / 地图顺序）
- [ ] 七大类来源判定（预设/自建）由 `id` 派生，无冗余字段

> 完成后进入 [`task/01-build.md`](./01-build.md)（BUILD 阶段）。
