# PopRPG 设计文档

> 状态：MVP（构建闭环）设计已对齐，待评审。游玩态、骰子 UI、进度存档等仅做规划，未纳入首版。

---

## 1. 产品定位

PopRPG 是一个**单人跑团（Solo TTRPG）** Web App，整体分为两个阶段：

- **构建（Build）**：像思维导图工具，左侧分组面板拖放组件（背景/怪物/道具/建筑/道路/职业），在方格地图上按格摆位，设定数值区间。
- **游玩（Play）**：消费构建结果，去网格线、只留坐标参照，按格正交移动、掷骰、揭晓随机奖励，跑通一场冒险。

核心乐趣 = **"预设套件 + 随机揭晓"**（模式 B+C）：你摆了宝箱屋但不知道里面是药水还是空的，靠骰子 + 奖励池制造惊喜，与"自己画自己玩"结合。

- 跨端：手机 + 电脑，响应式。
- 分享：整套场景导出为单个 **`.pmod`** 文件（内部 Markdown），可读、可再编辑、可分享。

---

## 2. 技术栈

| 关注点 | 选型 | 说明 |
|---|---|---|
| 框架 | React + TypeScript + Vite | 生态最成熟，网格/画布、Markdown 解析资料多 |
| 状态管理 | Zustand | 轻量，适合多面板共享大状态 |
| 图标 | lucide-react + Emoji | 分类/预设用矢量图标；自定义与内容用 Emoji |
| Markdown | 导出模板拼接；导入 remark/轻量解析 | 散文正文 + ```yaml 围栏还原为内存模型 |
| 本地存储 | localStorage（单项目单例） | 编辑自动保存；`.pmod` 仅是导出/分享格式 |
| 地图渲染 | 视口虚拟化（只渲可见格） | 坐标域 ±10000，不能全量渲染 |

> 地图渲染优先 SVG（交互元素易点击），视口外不渲染；缩放改变格像素尺寸 + 组件标识缩放。

---

## 3. `.pmod` 文件格式

单文件 Markdown，后缀 `.pmod`：

- **一级标题 `#`** = 游戏名
- **二级标题 `##`** = 模块（背景 / 设定 / 骰子配置 / 地图）
- **三级标题 `###`** = 分组（怪物 / 道具 / 建筑 / 道路 / 职业）或每张地图
- **散文段**（背景）= 普通 Markdown 正文，游玩时直接渲染
- **结构化数据**（怪物/道具/地图等）= ```` ```yaml ```` 围栏块，保证人读 + 机解析都稳

### 3.1 完整结构示例

```markdown
# 哥布林地穴

## 背景
你是一名误入地穴的冒险者，空气中弥漫着霉味……
（多段纯文本，游玩时直接展示）

## 设定

### 怪物
```yaml
- id: goblin
  name: 哥布林
  icon: 👺
  stats: { hp: [10, 20], patk: [3, 6], matk: [0, 2], pdef: [1, 3], mdef: [1, 2] }
  dice: 1D6
  desc: 洞穴里常见的小怪。
- id: mimic_chest
  name: 伪装宝箱
  icon: 🦞
  stats: { hp: [15, 25], patk: [5, 8], matk: [0, 0], pdef: [2, 4], mdef: [2, 3] }
  dice: 1D6
  desc: 伪装成宝箱的怪物。
```

### 道具
```yaml
# 持续性 = 装备
- id: iron_sword
  name: 铁剑
  icon: 🗡️
  kind: equipment
  slots: [weapon]
  modifiers: { hp: 0, patk: 5, matk: 0, pdef: 0, mdef: 0 }
# 一次性 = 消耗品
- id: red_potion
  name: 红瓶
  icon: 🧪
  kind: consumable
  usable: [battle, move]
  effects:
    - target: self
      stat: hp
      delta: 15
- id: blue_potion
  name: 蓝瓶
  icon: 🔵
  kind: consumable
  usable: [battle, move]
  effects:
    - target: self
      stat: mp
      delta: 15
```

### 建筑
```yaml
- id: chest_room
  name: 宝箱屋
  icon: 📦
  encounter: treasure            # empty | treasure | monster
  dice: 1D6
  reward_pool: [red_potion, iron_sword, gold]
  mimic:                         # 可选：勾选"宝箱怪物"后出现
    chance: 0.2                  # 概率变成怪物屋
    monster: mimic_chest
    reward: [red_potion, iron_sword]
  desc: 你不知道里面有什么。
```

### 道路
```yaml
- id: path
  name: 小路
  icon: 🛤️
```

### 职业
```yaml
- id: knight
  name: 骑士
  icon: 🛡️
  stats: { hp: [20, 30], patk: [5, 8], matk: [0, 2], pdef: [4, 6], mdef: [2, 3] }
  buffs: { patk: 100, matk: 100 }
- id: mage
  name: 法师
  icon: 🧙
  stats: { hp: [12, 18], patk: [1, 3], matk: [6, 10], pdef: [0, 2], mdef: [3, 5] }
  buffs: { patk: 80, matk: 120 }   # 百分比，默认 100 = 无变化
```

## 骰子配置
```yaml
dice: [1D4, 1D6, 1D20]
class_pool: [knight, mage]        # 长度 1 = 固定职业；>1 = 开局随机
```

## 地图
### 地下城入口
```yaml
start: [0, 0]
end: [5, 5]
nodes:
  - { x: 0, y: 0, type: start }
  - { x: 1, y: 0, type: road }
  - { x: 2, y: 0, type: building, ref: chest_room }
  - { x: 3, y: 1, type: road }
  - { x: 5, y: 5, type: end }
```
### 下层墓室
（起点自动接上一张终点 [5, 5]）

### 3.2 实体 ID 与引用规则
- 所有结构化实体（怪物/道具/建筑/道路/职业）都有全局唯一 `id`：定义段里定义一次，地图节点用 `ref` 引用，保证同一建筑可放在多个格子而只维护一份定义。
- **预设**使用固定可读 id（如 `chest_room`、`goblin`）。
- **用户自定义**实体在创建时生成**稳定唯一 id**（类型前缀 + 随机串，如 `b_3kf9`、`m_a1z2`），**不做顺序编号**——顺序编号会在删除/重排后错位、破坏地图引用。
- 显示 `name` 与 `id` 分离：`name` 可随时改名而不影响地图引用；高级用户可在编辑器里手动改 `id`（默认隐藏）。


---

## 4. 数据模型

所有结构化实体都有 `id`（全局唯一，引用用 id）、`name`、`icon`。

### 4.1 怪物 `monster`
- `stats`: 五维范围 `hp / patk / matk / pdef / mdef`，各为 `[min, max]`
- `dice`: 该怪物适用的骰子（如 `1D6`）
- `desc`: 背景文本

### 4.2 职业 `class`（主角基类）
- `stats`: 同怪物五维范围，作为主角随机基础值来源
- `buffs`: 各维乘法系数（百分比，默认 100 = 无变化），如法师 `patk:80, matk:120`
- `class_pool`（顶层列表）：控制开局职业；长度 1 = 固定，>1 = 随机
- 装备无职业限制

### 4.3 道具 `item`
统一分组，用 `kind` 区分：

**持续性 = 装备 `equipment`**
- `slots`: 占用的槽位，取自 `head / hands / feet / body / weapon`，可多槽
- `modifiers`: 对五维的加值 `{ hp, patk, matk, pdef, mdef }`（任意整数，可正可负，不强制平衡）
- **槽位冲突规则**：新装备若与已装备项在任一槽重叠，旧的那件**整体被卸下**

**一次性 = 消耗品 `consumable`**
- `usable`: `[battle, move]` 子集，表示对战 / 前进时可用
- `effects`: `[{ target: self | opponent, stat, delta }]`，可加/减任意数值一项或多项的 self 或 opponent

### 4.4 建筑 `building`
- `encounter`: `empty | treasure | monster`（基础行为）
- `dice`: 揭晓/战斗用骰子
- `reward_pool`: 道具 id 列表（treasure 普通奖励，可混装备与消耗品）
- `monster_ref`: 怪物 id（encounter=monster 时）
- `mimic`（可选）：`{ chance: 0~1, monster: id, reward: [itemId] }`
  - **宝箱怪物机制**：在宝箱屋（encounter=treasure）下勾选后出现；按 `chance` 判定——命中则实为伪装怪物（先战斗），战胜从 `reward` 取奖；未命中按普通 `treasure` 从 `reward_pool` 揭晓
- `desc`

### 4.5 道路 `road`
- 本质是可走节点，仅 `id / name / icon`

### 4.6 地图 `map`
- `name`
- `start: [x, y]`、`end: [x, y]`（每张图强制恰好一个）
- `nodes`: 每格一个映射 `{ x, y, type, ref? }`；`type ∈ start | end | road | building`，`building` 需带 `ref` 指向建筑段里的 `id`
- **可走图 = 已放置节点集合**（road + building + start + end），未放置格视为不可通行
- 多图有序；导出/游玩时上一张 `end` 自动成为下一张 `start`

### 4.7 项目 `project`（内存根对象）
- `name`（= 游戏名）
- `background`（散文）
- `settings`: `{ monsters, items, buildings, roads, classes }`
- `diceConfig`: `{ dice: [...], class_pool: [...] }`
- `maps`: `map[]`

---

## 5. 编辑器设计（构建态）

### 5.1 布局
- **顶栏**：项目名、地图 Tab（增删/切换/排序）、导出 `.pmod` / 导入 `.pmod` 按钮
- **左栏**：六大分组折叠面板（背景 / 怪物 / 道具 / 建筑 / 道路 / 职业），每类含预设条目 + "新建/DIY"按钮
- **中栏**：方格地图画布
- **右栏/弹层**：选中组件或地图节点的属性表单

### 5.2 套件面板
- 预设条目带 lucide 图标；自定义条目用 Emoji 或分类通用图标
- 每类可 DIY：在对应分类内新建自定义条目，字段同该分类

### 5.3 地图画布交互
- 网格 + **每 10 格加粗线**（尺寸/距离参照）
- 中心 `[0, 0]`，四向扩展，坐标域 `[-10000, 10000]`（即 20000×20000）
- **平移**：拖拽空白处；**缩放**：滚轮/按钮，改变格像素尺寸 + 组件标识缩放
- 放置交互：**先做"点选组件 → 点格放置"**；拖拽放置后续补
- 起/终点：放置模式下标记；每张图强制校验存在且唯一
- 删除节点：选中后删除
- 多地图：Tab 管理，顺序可调整

### 5.4 属性编辑
按类型渲染字段表单，含：
- 怪物/职业：五维范围输入、骰子选择、描述
- 道具：kind 切换 → 装备（槽位多选 + 五维加值）/ 消耗品（usable + effects 编辑器）
- 建筑：encounter 选择 + dice + reward_pool 多选；勾选"宝箱怪物"展开 mimic（chance / monster / reward）

---

## 6. MVP 范围：构建闭环

### 纳入
- A. **脚手架**：React+TS+Vite，三栏布局骨架
- B. **编辑器**：顶栏 + 左套件面板 + 中地图 + 右属性；六大分组；DIY 新建
- C. **地图画布**：网格/十格粗线/[0,0]/平移缩放/点选放置/起终点/删除/多地图 Tab 与校验
- D. **序列化**：导出 `.pmod`（拼 Markdown + YAML 围栏）；导入解析还原（**round-trip 闭环**）
- E. **内置最小预设**：见 6.1

### 暂不纳入（后续阶段）
- 游玩态：去网格线、正交移动、骰子、奖励揭晓、mimic 判定、战斗、装备穿戴、消耗品使用
- 骰子 UI（转盘等）
- `.psave` 进度存档（与 `.pmod` 分离）
- 首页 / 多项目管理（localStorage 单例即可）
- 丰富预设库（首版仅最小可用，后期专项补充）
- 手绘形象美术资源（MVP 用 Emoji 占位）

### 6.1 最小预设清单（开箱即玩）
- 怪物：哥布林、史莱姆（各五维范围 + dice）
- 道具：红瓶（consumable, hp+）、蓝瓶（consumable, mp+）、铁剑（equipment, weapon, patk+）
- 建筑：宝箱屋（treasure + mimic 示例）
- 道路：小路
- 职业：骑士、法师（含 buff 示例）

### 6.2 验收标准
1. 新建项目 → 放组件到地图 → 设起终点 → 多地图有序
2. 导出 `.pmod`，文件内容符合第 3 节结构
3. 重新导入该 `.pmod`，编辑器状态与导出前一致（round-trip 无丢失）
4. 刷新页面数据不丢失（localStorage 自动保存）

---

## 7. 后续阶段规划（非 MVP，仅记录）

### 7.1 游玩态
- 去掉网格线，保留每 10 格细坐标参照线
- 移动：当前格四邻（上下左右）正交可达，对角线不可走；每步 1 格，允许原路返回消耗步数
- 踩到 `building` 节点触发：treasure→按 dice/reward_pool 揭晓；monster→战斗；mimic→先判定伪装
- 战斗：五维 + 职业 buff 的简化结算；装备穿戴（含多槽/挤占规则）；消耗品在对战/前进时使用
- 职业：开局按 `class_pool` 随机或固定

### 7.2 骰子系统
- 预设全类型（d4/d6/d8/d10/d12/d20/d100）
- 组件自带"合适骰子"，保存地图提示所需骰组
- UI：转盘/幸运转盘等形式，点击投掷；合适时机提供合适骰子

### 7.3 存档与分享
- `.pmod` 静态场景；`.psave` 单独存游玩进度（已揭晓奖励、骰子结果、位置），可重开多周目
- 导入/导出两份文件

---

## 8. 已确认决策记录

| 项 | 决策 |
|---|---|
| 技术栈 | React + TS + Vite + Zustand + lucide/Emoji |
| 文件格式 | 混合：散文 Markdown 正文 + 结构化 ```yaml 围栏 |
| 存档分离 | `.pmod` 仅场景定义；进度存独立 `.psave`（后续） |
| MVP 范围 | 先构建闭环（编辑器 + 套件 + 地图 + 导出/导入） |
| 建筑宝箱怪物 | 宝箱屋的可选 `mimic` 属性（概率伪装怪物，战胜有奖） |
| 图标来源 | lucide 矢量 + Emoji 占位（手绘后续） |
| 放置交互 | 先做"点选→点格"，拖拽后续 |
| 预设范围 | 最小可用预设先跑通闭环，后期专项补充 |
| 项目管理 | 先单项目（localStorage 单例） |
| 数值体系 | 五维（hp/patk/matk/pdef/mdef）；装备占 头手脚身武 槽；消耗品改数值 |
| 部署目标 | GitHub Pages 纯静态；无后端/无服务端；仅用可打包进静态产物的库 |
| 视觉风格 | 纸张质感 + 手绘风格（暖色纸纹、手绘线条、手写体，尽量不引额外库） |

---

## 9. 部署（GitHub Pages）

- **纯静态 SPA，无后端、无服务端能力**。所有数据走 `localStorage` + 浏览器文件导入/导出（`Blob` 下载 / `<input type="file">` 读取），不依赖任何服务器接口。
- 构建：`npm run build` 产出 `dist/`（HTML/JS/CSS/字体），可直接静态托管。
- **base 路径**：Vite `base` 设为仓库项目页路径（如 `/<repo>/`）或自定义域；用项目页必须配置，否则资源 404。
- **路由**：优先单页（用视图状态切换 Build/Play，不用 URL 路由），从根本避免 GH Pages 深链 404；若确需路由用 `HashRouter`。
- **依赖边界**：仅使用能**打包进静态产物**的库（React / Vite / Zustand / lucide-react / 解析库）。不使用任何需要运行时服务器的组件、SSR、服务端存储、外部 API。
- **字体**：手写体优先**自托管**（`.woff2` 放进仓库 `/public/fonts` 并用 `@font-face` 引用），避免运行时依赖外部 CDN，也保证离线可用；如接受外部 CDN 也可用 Google Fonts，但非必须。
- 可选：`.github/workflows/deploy.yml` 用 GitHub Actions 构建并发布到 `gh-pages` 分支（纯配置，不引入服务器）。

## 10. 视觉风格（纸张 + 手绘）

- **整体基调**：暖色纸张（米黄 / 羊皮纸），模拟纸纹与手绘。
- **纸纹**：内联 SVG `feTurbulence` 噪声滤镜做颗粒质感（data URI 背景），叠加轻微暖色渐变；无需外部图片资源。
- **手绘线条**：边框 / 分隔 / 网格线用 SVG 位移滤镜（`feTurbulence` + `feDisplacementMap`）做出轻微抖动的不规则手绘感；或 CSS 不规则 `border-radius` + 微小旋转。避免引入 rough.js 等额外库（除非后续确认）。
- **字体**：标题 / 正文用手写体；拉丁文用 Caveat / Patrick Hand 类，中文用手写体（如马善政 / 龙藏 / 字芒行等），自托管。
- **图标**：lucide 矢量图标可套同一手绘滤镜柔化；自定义 / 内容继续用 Emoji。
- **网格**：构建态网格线呈手绘铅笔线，每 10 格加粗且略带颜色深浅变化；游玩态去网格、留细坐标参照线（同样手绘风）。
- **组件放置**：地图上的建筑 / 怪物以"贴在纸上的手绘便签 / 涂鸦"观感呈现（轻微阴影 + 不规则边）。
