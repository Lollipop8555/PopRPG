# PopRPG 设计文档 — skin 分节：首页与出身选择页 `pages`

> **上层索引**：[`../skin.md`](../skin.md)　**包结构**：[`00-package.md`](00-package.md)　**窗体**：[`03-window.md`](03-window.md)
> **设计依据**：2026-09-29 裁决 5（pp 需覆盖首页与角色选择页，允许不设置、走降级）
> **现状**：首页 `src/play/LoadScreen.tsx:71-151`（封面式主页 B0）；出身选择页 `src/play/StartScreen.tsx:44-129`
> **状态**：新增（含 2 处待确认）

## 一、范围

`pages` 覆盖**进入游戏之前**的两屏：

| 键 | 屏 | 现状实现 |
|---|---|---|
| `pages.home` | **首页**（封面式主页） | `LoadScreen.tsx`：封面标语、标题、副标题、主视觉（洞穴手绘 SVG ＋ 三颗骰子）、主按钮组、「其他开始方式」折叠区、底部版本号 |
| `pages.start` | **出身选择页**（角色选择） | `StartScreen.tsx`：顶栏场景名、世界简介、统计徽章、「选择出身」卡片网格、掷骰／出发按钮 |

- **两屏均可整体缺省**：不设置即整屏走降级（现有 CSS 手绘封面），不报错。
- 这两屏**不在**游玩态 shell 内（`.play-shell.start-screen` / `.no-topbar`），故 `window` 分节中的顶栏、抽屉等不适用；但**按钮、徽章、提示条直接复用 [`03-window.md`](03-window.md) 的 `buttons` / `chips` / `bars`**，不在本节重复定义。

## 二、字段

```json
"pages": {
  "home": {
    "bg": { "img": "home/bg.jpg", "fit": "cover" },
    "title": { "img": "home/title.png" },
    "cover": { "img": "home/cave.png" },
    "dice": { "img": "misc/die.png", "slice": [12, 12, 12, 12] }
  },
  "start": {
    "bg": { "img": "start/bg.jpg", "fit": "cover" },
    "card": { "img": "start/card.9.png", "slice": [14, 14, 14, 14], "selected": { "stroke": "#B4552F" } },
    "panel": { "img": "start/scroll.9.png", "slice": [16, 16, 16, 16] }
  }
}
```

### 2.1 `pages.home`

| 字段 | 类型 | 含义 | 缺省 |
|---|---|---|---|
| `bg` | 素材对象 | 全屏背景；`fit` 取 `cover`（裁切铺满，缺省）/ `contain`（完整可见，两侧留主题底色）/ `tile`（平铺） | 纸面底纹（CSS） |
| `title` | 素材对象 | 标题图形，替换文字「PopRPG」；**只替换字形，不改文案** | 文字「PopRPG」 |
| `cover` | 素材对象 | 主视觉图形，替换洞穴手绘 SVG | 现洞穴 SVG（`LoadScreen.tsx:79-96`） |
| `dice` | 素材对象 | 主视觉上的装饰骰子贴图；骰面复用 [`04-misc.md`](04-misc.md) §三 `misc.dice` | 程序绘制骰子（`.die`） |

- 封面标语（`.cover-tag`）、副标题（`.cover-sub`）、版本号（`.cover-version`）、警告条（`.hintbox`）**均为文字**：文案不随皮肤改变，字体与字色沿用主题（[`00b-style.md`](../00b-style.md)），本节不提供字色字段。
- 首页按钮组（开始冒险／构建世界／其他开始方式／导入导出）**全部**取 [`03-window.md`](03-window.md) 的按钮素材。

### 2.2 `pages.start`

| 字段 | 类型 | 含义 | 缺省 |
|---|---|---|---|
| `bg` | 素材对象 | 同 `home.bg` | 纸面底纹 |
| `panel` | 素材对象 | 「这一局的世界」正文面板的底（对应 `.panel.scroll`） | 现 `.panel` 纸面 |
| `card` | 素材对象 | **出身卡片**底（`.class-card`），按内容高度拉伸 | 现手绘卡片 |
| `card.selected` | 对象 | 选中态差异：`{ img, slice, stroke }`，`img` 缺省时只改描边 | 现 `.class-card.selected` 描边 |

- 卡片内的**职业图标**（`.class-icon`，取 `cls.icon`）由 [`02-role.md`](02-role.md) §二 `role.classes` 覆盖，**不在本节重复**。
- 卡片内的属性徽章、家当文字、顶栏场景名：沿用主题与 [`03-window.md`](03-window.md) 的徽章素材；本节不接管字体。

### 2.3 与降级的关系（逐节点）

`pages` 的每个字段都独立降级：只给 `home.bg` 时，标题仍是文字、主视觉仍是程序绘制——**半素材化是正常状态**（[`../skin.md`](../skin.md) §1.1）。

## 三、皮肤选择的落点是程序绘制（重要）

「在首页手动选择皮肤」（原始需求 §加载）这一交互**不受皮肤控制**——它出现在「其他开始方式」折叠区内，由程序绘制，只消费 `manifest.meta`（名称／作者／`thumbnail`）。否则会出现「必须先选皮肤才能显示出选皮肤的界面」的循环。

## 四、校验项（构建页／Creative 模式「清单」）

| 编号 | 检查 | 提示 |
|---|---|---|
| KPG-1 | `bg.fit` 取值非法 | 回退 `cover` |
| KPG-2 | `card` 给了 `img` 但未给 `slice` | V1 按普通拉伸（取舍 `S-1`） |
| KPG-3 | `title.img` 尺寸与标题区比例不符（高宽比偏离 `~6:1`） | 会被压缩，建议按该比例出图 |
| KPG-4 | `dice.img` 给了图但 `misc.dice` 未给骰面 | 主视觉有骰子外壳、内部仍是程序绘制点数 |
| KPG-5 | 出现 `buttons` / `chips` / 字体类字段 | 本节不接管，应写到 `window` / 主题侧；忽略 |

## 五、取舍登记

| 编号 | 取舍 | 后果 |
|---|---|---|
| S-13 | `pages` 只覆盖首页与出身选择页两屏，**不覆盖**构建页与 Creative 模式自身的编辑器 UI | 编辑器观感不随皮肤变化（见 [`../skin.md`](../skin.md) §1.2） |
| S-14 | `title` 只替换字形，不改文案 | 需要其它文案时只能改 `.pmod` 的场景名 |
| S-15 | 字体与字色不由本节接管 | 封面文字的观感依赖主题，皮肤能改的只有图形 |

## 六、待确认

1. **首页是否需要「场景封面图」**：`.pmod` 有 `background`（散文），未来若支持场景封面图，是放 `.pmod`（游戏数据）还是 `pages.home`（皮肤）？当前按前者预留、本节不设字段。
2. **`pages` 是否需要覆盖「加载中」过程屏**：现开局是同步构造场景，无独立加载屏（加载条见 [`03-window.md`](03-window.md)）；若将来引入异步加载，需要 `pages.loading`。
