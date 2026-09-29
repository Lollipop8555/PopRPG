# PopRPG 设计文档 — skin 分节：欢迎页与游戏首页 `startup` / `lobby`

> **上层索引**：[`../skin.md`](../skin.md)　**包结构**：[`00-package.md`](00-package.md)　**窗体**：[`03-window.md`](03-window.md)
> **设计依据**：2026-09-29 裁决 5（pp 需覆盖首页与角色选择页，允许不设置、走降级）＋ 裁决 20（原 `pages` 拆为 `startup` / `lobby`；首页封面图归皮肤侧）
> **现状**：`startup` → `src/play/LoadScreen.tsx:71-151`（封面式主页 B0）；`lobby` → `src/play/StartScreen.tsx:44-129`
> **状态**：新增（含 1 处待确认）

## 一、范围

`startup` / `lobby` 覆盖**进入游戏之前**的两屏：

| 键 | 屏 | 现状实现 |
|---|---|---|
| `startup` | **APP 欢迎页**（启动画面／封面主页，属应用层） | `LoadScreen.tsx`：封面标语、标题、副标题、主视觉（洞穴手绘 SVG ＋ 三颗骰子）、主按钮组、「其他开始方式」折叠区、底部版本号 |
| `lobby` | **游戏首页／选角页面**（世界简介 ＋ 出身选择） | `StartScreen.tsx`：顶栏场景名、世界简介、统计徽章、「选择出身」卡片网格、掷骰／出发按钮 |

- 键名为两屏各自的**完整字段集**（裁决 20）；原草案的单一 `pages` 键已废弃，读到旧键按 `KPG-6` 提示迁移。
- **两屏均可整体缺省**：不设置即整屏走降级（现有 CSS 手绘封面），不报错。
- 这两屏**不在**游玩态 shell 内（`.play-shell.start-screen` / `.no-topbar`），故 `window` 分节中的顶栏、抽屉等不适用；但**按钮、徽章、提示条直接复用 [`03-window.md`](03-window.md) 的 `buttons` / `chips` / `bars`**，不在本节重复定义。
- **首页封面图归本节（裁决 20）**：`.pmod` **不设**封面图字段——封面/场景图是纯表现层素材，与「`.pmod` 不含任何 UI 定义」的分工一致（[`00a-formats.md`](../00a-formats.md) §一）。

## 二、字段

```json
"startup": {
  "bg":    { "img": "resource/home/bg.jpg", "fit": "cover" },
  "title": { "img": "resource/home/title.png" },
  "cover": { "img": "resource/home/cave.png" },
  "dice":  { "img": "resource/misc/die.png", "slice": [12, 12, 12, 12] }
},
"lobby": {
  "bg":    { "img": "resource/start/bg.jpg", "fit": "cover" },
  "card":  { "img": "resource/start/card.9.png", "slice": [14, 14, 14, 14],
             "selected": { "stroke": "#B4552F" } },
  "panel": { "img": "resource/start/scroll.9.png", "slice": [16, 16, 16, 16] }
}
```

### 2.1 `startup`（APP 欢迎页）

| 字段 | 类型 | 含义 | 缺省 |
|---|---|---|---|
| `bg` | 素材对象 | 全屏背景（**即该屏的封面图**）；`fit` 取 `cover`（裁切铺满，缺省）/ `contain`（完整可见，两侧留主题底色）/ `tile`（平铺） | 纸面底纹（CSS） |
| `title` | 素材对象 | 标题图形，替换文字「PopRPG」；**只替换字形，不改文案** | 文字「PopRPG」 |
| `cover` | 素材对象 | 主视觉图形，替换洞穴手绘 SVG | 现洞穴 SVG（`LoadScreen.tsx:79-96`） |
| `dice` | 素材对象 | 主视觉上的装饰骰子贴图；骰面复用 [`04-misc.md`](04-misc.md) §三 `misc.dice` | 程序绘制骰子（`.die`） |

- 封面标语（`.cover-tag`）、副标题（`.cover-sub`）、版本号（`.cover-version`）、警告条（`.hintbox`）**均为文字**：文案不随皮肤改变，字体与字色沿用主题（[`00b-style.md`](../00b-style.md)），本节不提供字色字段。
- 首页按钮组（开始冒险／构建世界／其他开始方式／导入导出）**全部**取 [`03-window.md`](03-window.md) 的按钮素材。

### 2.2 `lobby`（游戏首页／选角页面）

| 字段 | 类型 | 含义 | 缺省 |
|---|---|---|---|
| `bg` | 素材对象 | 同 `startup.bg` | 纸面底纹 |
| `panel` | 素材对象 | 「这一局的世界」正文面板的底（对应 `.panel.scroll`） | 现 `.panel` 纸面 |
| `card` | 素材对象 | **出身卡片**底（`.class-card`），按内容高度拉伸 | 现手绘卡片 |
| `card.selected` | 对象 | 选中态差异：`{ img, slice, stroke }`，`img` 缺省时只改描边 | 现 `.class-card.selected` 描边 |

- 卡片内的**职业图标**（`.class-icon`，取 `cls.icon`）由 [`02-role.md`](02-role.md) §二 `role.classes` 覆盖，**不在本节重复**。
- 卡片内的属性徽章、家当文字、顶栏场景名：沿用主题与 [`03-window.md`](03-window.md) 的徽章素材；本节不接管字体。

### 2.3 与降级的关系（逐节点）

两屏的每个字段都独立降级：只给 `startup.bg` 时，标题仍是文字、主视觉仍是程序绘制——**半素材化是正常状态**（[`../skin.md`](../skin.md) §1.1）。

## 三、皮肤选择的落点是程序绘制（重要）

「在首页手动选择皮肤」（原始需求 §加载）这一交互**不受皮肤控制**——它出现在「其他开始方式」折叠区内，由程序绘制，只消费 manifest 的顶层 `name` / `author` 与包根 `preview.png`（[`00-package.md`](00-package.md) §3.1）。否则会出现「必须先选皮肤才能显示出选皮肤的界面」的循环。

## 四、校验项（构建页／Creative 模式「清单」）

| 编号 | 检查 | 提示 |
|---|---|---|
| KPG-1 | `bg.fit` 取值非法 | 回退 `cover` |
| KPG-2 | `card` 给了 `img` 但未给 `slice` | V1 按普通拉伸（取舍 `S-1`） |
| KPG-3 | `title.img` 尺寸与标题区比例不符（高宽比偏离 `~6:1`） | 会被压缩，建议按该比例出图 |
| KPG-4 | `dice.img` 给了图但 `misc.dice` 未给骰面 | 主视觉有骰子外壳、内部仍是程序绘制点数 |
| KPG-5 | 出现 `buttons` / `chips` / 字体类字段 | 本节不接管，应写到 `window` / 主题侧；忽略 |
| KPG-6 | 出现旧键 `pages` | 已拆为 `startup` / `lobby`（裁决 20），旧键忽略并提示迁移 |

## 五、取舍登记

| 编号 | 取舍 | 后果 |
|---|---|---|
| S-13 | 本节只覆盖欢迎页与游戏首页两屏，**不覆盖**构建页与 Creative 模式自身的编辑器 UI | 编辑器观感不随皮肤变化（见 [`../skin.md`](../skin.md) §1.2） |
| S-14 | `title` 只替换字形，不改文案 | 需要其它文案时只能改 `.pmod` 的场景名 |
| S-15 | 字体与字色不由本节接管 | 封面文字的观感依赖主题，皮肤能改的只有图形 |
| S-26 | 封面图**只由皮肤侧承担**（`bg`），`.pmod` 不设字段（裁决 20） | 同一份 `.pmod` 在不同皮肤下的封面完全由皮肤决定；不带皮肤时用纸面底纹 |

## 六、待确认

1. **是否需要覆盖「加载中」过程屏**：现开局是同步构造场景，无独立加载屏（加载条见 [`03-window.md`](03-window.md)）；若将来引入异步加载，需要新增 `loading` 键（与 `startup` / `lobby` 同级）。
