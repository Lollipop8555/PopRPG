# PopRPG 设计文档 — skin 分节：道具 `item` 与建筑 `building`

> **上层索引**：[`../skin.md`](../skin.md)　**包结构**：[`00-package.md`](00-package.md)　**贴图渲染器**：[`../skin.md`](../skin.md) §3.3
> **设计依据**：原始需求「道具」「建筑」两节 ＋ 2026-09-29 裁决（拆节、衬底结构化、落点、**18：描边为独立设置项**）；
> 现状：`src/play/MapView.tsx:185-230`（地图节点）、`src/play/BagPanel.tsx:45-88` 与 `src/styles/play.css:948-1072`（物品格子）
> **状态**：已实现——`item` 一条全部落地；`building` 的**地图节点**已落地（贴图 ＋ 名称字体字色 ＋ 衬底接管 `rect`），信息视图与组件库见 §六 待确认 1

## 一、为什么拆成两节（已裁决）

原始需求「道具」与「建筑」字段近似同构，但**场景不同**，故**不合并**：

| 维度 | `item`（道具） | `building`（建筑） |
|---|---|---|
| 地图上有无图形 | **无**——道具不出现在地图上 | **有**——地图节点本身要贴图 |
| 地图贴图 | 无 | `img`（可拉伸，多格建筑按格数拉伸） |
| 地图上的文字 | 无 | 有（节点下方名称）：由 `font` / `fontColor` 控制 |
| `icon` 落点 | 背包／穿戴格子、组件库、物品信息视图 | 建筑信息视图、组件库；**地图上被 `img` 取代** |
| 名称／说明文字 | **不在本节配置**：在窗体中展示，沿用窗体的字体与字色 | 地图上的名称用本节 `font` / `fontColor`；对话框内文字同样沿用窗体字体 |
| `background`（衬底） | 有（物品格子衬底） | 有（建筑信息视图衬底；地图节点用 `img`，不用衬底） |

**两条硬规则**：

1. `item` **不得**出现 `img` / `font` / `fontColor`（写了忽略并提示，校验项 `KIB-6`）。
2. `building` 的 `font` / `fontColor` **只作用于地图上的名称文字**；对话框内的文字一律用窗体（[`03-window.md`](03-window.md)）的字体与字色——避免同一处文字两套配置互相打架。

## 二、字段

### 2.1 道具 `item`

```json
"item": {
  "red_potion": {
    "icon": "",
    "background": { "fill": "#FF0000", "stroke": "#8B0000", "img": "" }
  }
}
```

### 2.2 建筑 `building`

```json
"building": {
  "blacksmith": {
    "icon": "",
    "img": "bld/blacksmith.9.png",
    "background": { "fill": "#FF0000", "stroke": "#8B0000", "img": "" },
    "fontColor": "#FFFFFF",
    "font": "font/hand.ttf"
  }
}
```

### 2.3 字段表

| 字段 | 类型 | 适用 | 含义 | 缺省 |
|---|---|---|---|---|
| `icon` | 字符串 | 两者 | 覆盖组件定义中的 `icon`（emoji / 字形） | 组件定义的 `icon` |
| `img` | 字符串 | 建筑 | 地图节点的整体贴图；普通图直接拉伸，`.9.png` 建议配 `slice` | [`04-misc.md`](04-misc.md) §二 `misc.nodes.building`，再缺则程序绘制圆角矩形 |
| `background` | 颜色 **或** 对象 | 两者 | 图标／格子**衬底**。字符串＝`fill` 简写 | 组件定义的 `color`，再缺则主题色 |
| `background.fill` | 颜色 | 两者 | 衬底的**背景填充色** | 同上 |
| `background.stroke` | 颜色 | 两者 | 衬底的**描边色**；**独立设置项，未给即不绘制描边**（裁决 18） | 无（不描边） |
| `background.img` | 字符串 | 两者 | 衬底**背景图**；**优先级高于 `fill`**（`fill` 作其透明区的兜底） | 无 |
| `fontColor` | 颜色 | 建筑 | 地图上建筑名称的文字颜色 | 现为 `var(--ink-soft)`（`MapView.tsx:224`） |
| `font` | 字符串 | 建筑 | 地图上建筑名称的字体：包内字体文件路径（**相对包根**，如 `resource/font/hand.ttf`）**或**浏览器内置字体名（如 `"serif"`） | CSS 默认 |

- **键一律为组件 `id`**（不用显示名，校验项 `KIB-5`）。
- `background` 由「单个颜色」升级为「填充色 ＋ 描边色 ＋ 背景图」三元组（裁决 7）。**背景图存在时不绘制 `fill`，仍绘制 `stroke`**（若 `stroke` 有值）。
- **描边是独立设置项（裁决 18）**：只写 `fill` 而不写 `stroke` 时**不绘制描边**——既不跟随 `fill`，也不保留组件色；`"stroke": "transparent"` 与省略等价。
- 该规则只作用于**素材接管**的情形：某元素整节未接管（无 `background`、无 `icon` / `img`）时，仍按程序绘制形态渲染，即保留现有组件色描边（取舍 `S-11`）。
- `background.img` 的九宫格／拉伸语义与其它素材一致（[`../skin.md`](../skin.md) §3.3）。
- `font` 指向包内文件时，由加载器注入 `@font-face`（字体族名取文件名去扩展名），字体文件失败则回退内置字体（校验项 `KIB-4`）。

## 三、落点（逐处回读实现）

### 3.1 地图节点（`NodeShape`，`src/play/MapView.tsx:185-230`）

- **建筑**：`rect`（`rx=8`、填充＝组件色 α0.42、描边＝组件色 1.8px、`rotate(-0.6°)`）＋ 底部名称 `text`（11px、`var(--ink-soft)`）。
  - 素材接管方式：`img` **替换整个 `rect`**；`font` / `fontColor` 作用于底部名称 `text`。
  - 保留 `-0.6°` 旋转与 3px 内缩（取舍 `S-9`），字号仍由代码固定（`S-10`）。
  - 若未给 `img`：`background.fill` / `background.stroke` 接管现有 `fill` / `stroke`（`fill` 透明度沿用 α0.42；**`stroke` 缺省不绘制**，见裁决 18）。
- **道具**：道具不产生地图节点（`MapView.tsx:218-222` 只对「其它组件节点」绘制居中 `icon`），故 `item` 本节**不影响地图**。

### 3.2 背包与穿戴格子（`src/play/BagPanel.tsx:45-88`）

道具单元＝衬底 ＋ `bag-ico`（`item.icon`，22px）＋ `bag-count`（数量角标，绝对定位）＋ `bag-name`（10.5px、`var(--ink-soft)`）＋ 操作按钮。穿戴区同构（无角标）。

- `background` 的**主落点**：格子衬底（`play.css:948` 的 `.bag-cell`）。
- `bag-name` 的字体与字色**不**由 `item` 配置——沿用窗体的字体与字色（§一 规则 2）。

### 3.3 物品信息／建筑信息视图

原始需求指出 `background`「在对话框的建筑信息、物品信息中会用到」，即此处。**本节只提供两个输入**：

| 输入 | 取自本节 | 说明 |
|---|---|---|
| 衬底（方形，在下） | `background` 三元组 | 填充色 / 描边色 / 背景图 |
| 图标（居中，在上） | `icon` | 与背包格子同一张图 |

两者按**类似应用图标**的方式叠加，组合规则见 [`03-window.md`](03-window.md) §四.2。

- 名称与说明文字**不在本节配置**：一律用窗体自身的字体与字色；`building.font` / `fontColor` **不作用于此处**（只管地图上的名称）。
- **不存在两节交叉配置**：本节管图标与衬底，窗体管容器与文字。

### 3.4 组件库（构建页）

以 `icon` ＋ `background` 渲染卡片（构建页的**编辑控件**本身不接管素材，见 [`../skin.md`](../skin.md) §1.2）。

## 四、校验项（构建页／Creative 模式「清单」，提示不阻断导出）

| 编号 | 检查 | 提示 |
|---|---|---|
| KIB-1 | 键不在本局启用的组件 id 内 | 无效键，忽略 |
| KIB-2 | `img` 带 `.9.png` 后缀但未提供 `slice` | V1 按普通拉伸处理（取舍 `S-1`） |
| KIB-3 | `img` 尺寸与格数不成整倍数 | 多格建筑上会拉伸变形，建议按 `格数 × cellSize` 出图 |
| KIB-4 | `font` 指向包内文件但路径无效 | 回退浏览器内置字体 |
| KIB-5 | 用显示名（`name`）而不是 `id` 作键 | 可能因重名或改名失效 |
| KIB-6 | `item` 写了 `img` / `font` / `fontColor`；或 `background` 对象含未知键 | 忽略该字段 |
| KIB-7 | `background.stroke` 与 `fill` 都为 `transparent`，或整节只有 `img` 且该图全透明 | 衬底不可见，确认是否有意 |
| KIB-8 | 写了 `fill` 但未写 `stroke` | **不绘制描边**（裁决 18）属正常用法，仅在同时存在组件色描边观感差异时提示确认 |

## 五、取舍登记

| 编号 | 取舍 | 后果 |
|---|---|---|
| S-9 | 建筑节点套素材后保留 `-0.6°` 旋转与 3px 内缩 | 素材随之轻微倾斜、四边各缩 3px，出图需留余量 |
| S-10 | 建筑名称字号由代码固定（11px），不可由素材覆盖 | 字体文件需与固定字号试配 |
| S-11 | `background` 结构升级为三元组，但**不**支持九宫格外的独立内边距 | 衬底图需自带留白 |
| S-12 | 道具**没有**地图层，`item` 无法影响地图观感 | 道具若需要地图存在感，只能改用建筑件或等待 `misc` 扩展 |
| S-24 | **描边缺省不绘制**（裁决 18），不设「跟随 `fill`」或「跟随组件色」的第四态 | 素材接管的衬底与程序绘制形态观感不同：接管后必须显式给 `stroke` 才有描边 |

## 六、待确认

1. **建筑信息视图是否在 V1 实现**：若该视图不在 V1，则 `building.background` 在 V1 只在组件库生效（`item.background` 不受影响，背包格子已实现）。**图标与衬底的组合方式已定**（裁决 12 / [`03-window.md`](03-window.md) §四.2），此处仅剩 V1 排期未定。

## 七、实现落点（2026-09-30）

> **`item` 一条全部落地**；`building` 的**地图节点（§3.1）已落地**，§3.3 信息视图与 §3.4 组件库随 [`03-window.md`](03-window.md) §四.2 与构建页排期（§六 待确认 1）。

- **取图** [`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts)：`itemSkinOf(item, id)` / `buildingSkinOf(building, id)`（键一律组件 `id`，**不跨键借用**）；`groundPaint(field, fallback?)`（字符串写法＝只写 `fill`；`fill` 缺省用 `fallback`，调用方再缺即主题色；**三项全空即整节未接管**、返回 `undefined`——判的是**原字段**，兜底色也救不回来）；`buildingImgOf(building, misc, id)`（`building[<id>].img ?? misc.nodes.building`，全篇唯一的跨节回退；节点查不到组件（`id` 为空）时**不拿空串去撞键**，直接走通用件）。
- **衬底落法** [`src/ui/Texture.tsx`](../../../src/ui/Texture.tsx) 的 `groundStyle(paint, assets, fit = 'stretch')`：`img` → `background-image`（`100% 100%` / no-repeat / center，V1 一律拉伸）、`fill` → `background-color`、`stroke` → `border-color`。**未给 `stroke` 时写 `transparent` 而非摘掉边框**——只为不改盒尺寸（`S-24` 只改观感、不改布局）。整节未接管返回 `undefined`，调用方**不传 `style`**、CSS 纸面照旧（`S-11`）。
- **道具落点**：渲染件 [`src/ui/ItemGlyph.tsx`](../../../src/ui/ItemGlyph.tsx)——有素材出**行内层** `InlineTexture`（尺寸交给所在处的 `.bag-ico` / `.equip-ico` 字号、等比内缩），否则原样输出组件 `icon` 字形；取图走唯一入口 `textureProps()`，故「包里缺这张图」「皮肤未启用」自动落到字形。三处落点：[`src/play/BagPanel.tsx`](../../../src/play/BagPanel.tsx) 的背包格与穿戴格（`.bag-cell` 衬底 ＋ 图标）、[`src/play/EquipPanel.tsx`](../../../src/play/EquipPanel.tsx) 的穿戴行与**更换气泡候选**。`fill` 兜底＝组件 `color`，再缺 `fallbackColor(id)`。**`bag-name` 的字体字色不接**（§一 规则 2，仍归窗体；`item` 本就不得写 `font`）。
- **建筑落点** [`src/play/MapView.tsx`](../../../src/play/MapView.tsx) 的 `NodeShape`：`img` 可用时用 **`<g transform="rotate(-0.6° …)">` ＋ `SvgTexture` 整图替换 `rect`**（`x/y + 3`、`w/h − 6`——保留 3px 内缩与倾斜角，`S-9`），该节点的**图标字形不再绘制**（`🧳` 让位给贴图，名称仍留）；未出图时 `background.fill` / `background.stroke` 接管 `rect`（`fill` 沿用 α0.42；**`stroke` 缺省即 `transparent` ＋ `stroke-width: 0`**）；两件都缺则程序绘制形态照旧，含组件色描边（`S-11`）。
- **名称字体字色**：`fill = buildingSkin.fontColor ?? 'var(--ink-soft)'`；`font` 经 [`src/ui/skinFont.ts`](../../../src/ui/skinFont.ts) 的 `usePackFont()`——包内文件（按扩展名 `ttf` / `otf` / `ttc` / `woff` / `woff2` 识别）注入 `@font-face`（**族名取文件名去扩展名**、`font-display: swap`），**内置字体名原样交给 CSS、不注入**，**包里缺该文件即回退内置字体**（`KIB-4`，不写 `font-family`）。字号仍固定 11px（`S-10`）。
- **未接**：§3.3 物品／建筑信息视图、§3.4 组件库、`KIB-1`–`KIB-8` 校验层（`SkinIssueCode` 现只有 `KP-*`）；`misc.nodes.building` 的**九宫格**（`KM-1`）与固定族格子（技能格 / 奖励卡 / 部位标签）上的 `item.background` 落点一并留 **V1.1**——本轮通用件按**普通拉伸**顶替 `building.img`。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **44 个文件 / 504 项**全绿（本轮新增 2 个用例文件 / 33 项：[`engine/skin/__tests__/item-building.test.ts`](../../../src/engine/skin/__tests__/item-building.test.ts) 11 项、[`play/__tests__/itemBuildingSkin.test.tsx`](../../../src/play/__tests__/itemBuildingSkin.test.tsx) 22 项——含**落图**：背包格衬底三件套 / 图标改图与回字形、地图节点整图替换与 3px 内缩 / 名称字色字体 / 缺文件回退）。
