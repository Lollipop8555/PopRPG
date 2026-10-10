# PopRPG 设计文档 — skin 分节：欢迎页与游戏首页 `startup` / `lobby`

> **上层索引**：[`../skin.md`](../skin.md)　**包结构**：[`00-package.md`](00-package.md)　**窗体**：[`03-window.md`](03-window.md)
> **设计依据**：2026-09-29 裁决 5（pp 需覆盖首页与角色选择页，允许不设置、走降级）＋ 裁决 20（原 `pages` 拆为 `startup` / `lobby`；首页封面图归皮肤侧）＋ 裁决 24（出身卡内的**职业立绘**由 [`02-role.md`](02-role.md) `role.portraits` 接管，本节不设字段）
> **现状**：`startup` → `src/play/LoadScreen.tsx:71-151`（封面式主页 B0）；`lobby` → `src/play/StartScreen.tsx:44-129`
> **状态**：已实现——两屏全部落地（整屏背景 `fit` 三档 ＋ 欢迎页三件图形 ＋ 世界简介面板底 ＋ 出身卡含选中态）

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

- 卡片内的**职业图标**（`.class-icon`，取 `cls.icon`）由 [`02-role.md`](02-role.md) §三 `role.classes` 覆盖，**不在本节重复**。
- 卡片内的**职业立绘**（**裁决 24**）：该职业有 `role.portraits.classes.<id>` 时**放大替代** `.class-icon` 的 emoji 并**居中**，无则回退 `cls.icon`；规则（尺寸、`flip`、缺位不占位）见 [`02-role.md`](02-role.md) §4.1 / §4.2，**本节不重复、也不接管**。
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

## 七、实现落点（2026-09-30）

> 两屏**全部落地**：整屏背景（`fit` 三档）＋ 欢迎页三件图形 ＋ 世界简介面板底 ＋ 出身卡（含选中态）。

- **取图** [`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts)：`pageFitOf(bg)`——`cover` / `contain` / `tile`，**非法值与缺省一律回退 `cover`**（`KPG-1` 只提示、不改行为）；`pageBgOf(page)`——欢迎页与首页**各查自己那一节的 `bg`、互不借用**（§2.3 逐节点降级）；`startupArtOf(startup, art)`——`title` / `cover` / `dice` 三键一个入口，未配该键即 `undefined`；`lobbyCardPaint(lobby, selected)`——返回 `{ img, stroke }`，`selected.img` 缺位**沿用卡底**、`stroke` 只在选中态给，`card` 整节没配即 `undefined`。
- **整屏背景的落法**：[`src/ui/Texture.tsx`](../../../src/ui/Texture.tsx) 新增 `pageBgStyle(ref, assets, fit)`，三档各是一种铺法——`cover` → `background-size: cover`、`contain` → `contain`、`tile` → `background-size: auto` ＋ `background-repeat: repeat`，一律居中。与衬底同一条底线：**只写 image 与铺法、不动 `background-color`**（`contain` 留出的两侧边由主题底色兜着，`S-26`）；未启用皮肤 / 没配该键 / 包里缺这张图，一律返回 `undefined` ⇒ 调用方**不传 `style`**、纸面底纹照旧。
- **欢迎页** [`src/play/LoadScreen.tsx`](../../../src/play/LoadScreen.tsx)：`bg` 落在**整屏容器** `.play-shell.no-topbar`（不是内层的 `.load-cover`——那层带着页面留白、铺不满屏）。`title` 走**行内层** `InlineTexture`（盒取 `CSS_SIZED_BOX`；尺寸交给新增的 `.cover-title .cover-title-art`——**高 `0.86em`、宽由素材宽高比推出、绝不拉伸**），**文案不变、落在 `alt="PopRPG"` 上**（`S-14`）。`cover` 用 `SvgTexture` **整块替换洞穴手绘**，复用现成的 `<svg class="cover-cave" viewBox="0 0 120 92">` 当盒（V1 拉伸进盒，`S-1`），出了图就一条 `path` 都不留。`dice` 只给**骰子本体**（`surfaceStyle(…, 'contain')`——与 `misc.dice.body` 同一档落法：等比进盒、绝不拉伸），**骰面复用 `misc.dice`**：装饰骰子直接渲染现成的 `DieFace`（`useDieFace()`），本节**不另设骰面字段**（`KPG-4`）。三颗装饰骰子各成一个 `CoverDie` 小组件（hook 不能写在条件 / 循环里），**没配骰面时仍是程序绘制的数字面**——`.die` 的缺省观感不因皮肤改变。
- **游戏首页** [`src/play/StartScreen.tsx`](../../../src/play/StartScreen.tsx)：`bg` 落在 `.play-shell.start-screen`；`panel` 落 `.panel.scroll`（V1 拉伸，`S-1`）；`card` 落每一张 `.class-card`——`img` 用 `surfaceStyle()` 铺满整卡（V1 拉伸，`KPG-2`），`stroke` **只写在选中那一张**（未选中**不碰** `border-color`、交还给 CSS——与衬底三元组的「描边缺省不绘制」不同，这里是整张卡）。两态各算一次（`useLobbyCardStyle(false | true)`：卡片在 `map` 里、hook 不能写在回调内）再按 `selectedId` 取。
- **接线** [`src/ui/usePageSkin.ts`](../../../src/ui/usePageSkin.ts)：`useStartupBgStyle()` / `useLobbyBgStyle()` / `useLobbyPanelStyle()` / `useLobbyCardStyle(selected)` / `useStartupArt(art, box)` / `useStartupDiceBody()`——只做「取图 → 落图」一次接线，两屏共用一份 store 状态。
- **未接**：封面标语 / 副标题 / 版本号 / 警告条的文字与字体（§2.1 末条、`S-15`）、卡片内的职业图标与立绘（归 [`02-role.md`](02-role.md)）、按钮与徽章（归 [`03-window.md`](03-window.md)）；`card` / `panel` 的 `slice` 九宫格**已随 D3 第十三屏消费**（`surfaceStyle()` 的 DOM 层 `border-image`），`dice` 本体走 `contain` 等比缩放、不吃 `slice`（取舍 `S-1`）。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **46 个文件 / 528 项**全绿（本轮新增 2 个用例文件 / 24 项：[`engine/skin/__tests__/page.test.ts`](../../../src/engine/skin/__tests__/page.test.ts) 10 项——`fit` 非法值回退、两屏互不借用、`selected.img` 缺位沿用卡底；[`play/__tests__/pageSkin.test.tsx`](../../../src/play/__tests__/pageSkin.test.tsx) 14 项——**落图**：`fit` 三档、标题换字形与 `alt`、主视觉替掉 `path`、装饰骰子本体与复用骰面、卡片两态，以及「没配 / 缺图 ⇒ 一个 `style` 都不传」）。
