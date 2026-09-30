# skin 分节：容器与控件 `window`

> 上层索引：[`../skin.md`](../skin.md)　依据：[`../00b-style.md`](../00b-style.md)、`src/styles/play.css`／`theme.css`、`src/ui/Overlay.tsx`／`Popover.tsx`
> **状态**：已补（由既有游玩态实现推算，待校正）。**容器衬底已接入**（对话框 / 抽屉 / 气泡，见 §八）。
> **划分原则**：**容器 = 带底纹或边框、且尺寸由内容或视口决定的元素**。内容自适应与九宫格强相关，因此单独成节。

## 一、覆盖范围（按游玩态屏划分）

| 屏 | 容器元素 | 依据 |
|---|---|---|
| 加载屏 | 页面卡片、导入 / 示例 / 去构建页按钮 | `LoadScreen.tsx:104-131` |
| 开局屏 | 出身卡网格（列宽 `minmax(210px)`）、加点控件、掷骰按钮 | `StartScreen.tsx`、`play.css:887` |
| 地图 | 顶栏（标题余宽省略）、底栏（含 **hp/mp 左侧立绘位**）、抽屉 `min(440px,100%)` | `GameScreen.tsx:181`、`play.css` |
| 战斗 | 战斗对话框 `min(560px,100%)`、**顶部 VS 立绘区**、战况流水区（余宽）、技能格、血蓝条 | `BattleDialog.tsx` |
| **NPC 对话** | 对话框 `min(560px,100%)`、**标题栏只有 NPC 的 `icon` ＋ 名字**（无 VS 立绘区）、台词区（**聊天记录：双方的对话与选择都留着**（NPC 靠左 / 玩家挑的那条靠右）、**只往后追加**（逐条 ＋ 继续），自身滚动、自动滚到最新一句；**气泡宽度按内容自适应**、最长到台词区的 86% —— 不拉满一整行；记录与选项之间拉**一条虚线** —— 上面是"说过的话"、下面是"轮到你做的事"，实线会糊成一只框）、选项按钮列表；**掷骰层**（节点带 `dice` 时）＝ **本层答复共用一只框**（行与行之间只用**虚线分割线**，框上不写任何说明文字）**＋ 一枚点了才掷的骰子**（命中那一条提亮 ＋ 左侧一道红边，未命中可再掷——[`../02-data-model.md`](../02-data-model.md) §4.9.2） | `BattleDialog.tsx` 的对话框壳 ＋ 新的对话内容区 |
| 遭遇 | 对话框 `min(620px,100%)`、提示条、奖励卡网格、**顶部立绘位（V1 仅预留）** | `EncounterView.tsx`、`play.css:369` |
| **获得浮条** | 顶中一条浮条（`max-width: min(420px, 100vw - 24px)`、轻微歪斜、落下即现）：一行来源小字（`对话：🧒走失的孩子`）＋ 一行一件「获得了什么」；**压在一切弹层之上**（`z-index: 70`）—— 对话开着的时候选完那条就得当场看见。**与遭遇弹层里那块「获得」是同一份数据、同一处措辞、同一个组件**（§[`../07-decisions.md`](../07-decisions.md) 设定 9）；带揭晓弹层的场合**不叠这条浮条**，同一样东西只提示一次 | `HeroNotice.tsx`、`GainNoteView.tsx`、`play.css` `.gain-pop` |
| 面板 | 状态 / 背包 / 装备抽屉、更换气泡 `minWidth` 160/180/220、部位行、**头部主角立绘位** | `StatusPanel` / `BagPanel` / `EquipPanel` |
| 全局 | 提示条 `hintbox`（三档 tone）、手绘分隔线 `sketch-line` | `play.css`、`theme.css:392` |

> 物品 / 建筑信息视图在遭遇、商店与战斗的**对话框内弹出**：其容器沿用对话框，**图标组合**规则见 §四.2（裁决 12）。

> **立绘不在本节（裁决 24）**：上表中的立绘位只由本节给出**容器位置**，其取图、尺寸档、`flip` 镜像与「无立绘不占位」规则全归 [`02-role.md`](02-role.md) §四；本节**不设**任何立绘字段，也不在立绘缺位时补 emoji 占位。

## 二、四族划分（决定拉伸策略）

| 族 | 判定 | 策略 | 元素 |
|---|---|---|---|
| **随视口** | 尺寸由窗口决定 | 九宫格 `nine` | 对话框、抽屉、气泡、页面卡片 |
| **随内容** | 尺寸由文字或条目数决定 | **禁止拉伸**（九宫格或纯 CSS） | 按钮、徽章、芯片、提示条、角标、列表行 |
| **固定** | 像素写死 | 整图等比 `stretch` | 技能格 54×54、奖励卡 92、部位标签 44、菜单按钮 44 |
| **单向** | 一端固定一端伸缩 | 单轴九宫格 | 血蓝条轨道与填充、分隔线、进度条 |

## 三、九宫格切片规范

- 切片顺序 `[上, 右, 下, 左]`（[`../skin.md`](../skin.md) §3.3）。
- 建议值：随视口族 **12px**（四角各 12）；单向族 **6px**（仅左右或仅上下）。
- 约束：**任一维切片之和必须小于该元素最小渲染尺寸**，否则四角互相重叠（校验项 `KW-2`）。

## 四、字段与示例

```json
"window": {
  "surfaces": {
    "dialog":  { "img": "skin/window/paper.png", "slice": [12, 12, 12, 12] },
    "drawer":  { "img": "skin/window/paper.png", "slice": [12, 12, 12, 12] },
    "popover": { "img": "skin/window/pop.png",   "slice": [10, 10, 10, 10] }
  },
  "buttons": {
    "primary": {
      "normal":   "skin/window/btn_primary.png",
      "hover":    "skin/window/btn_primary_hover.png",
      "active":   "skin/window/btn_primary_active.png",
      "disabled": "skin/window/btn_primary_disabled.png"
    },
    "danger":  "skin/window/btn_danger.png",
    "small":   "skin/window/btn_small.png",
    "icon":    "skin/window/btn_icon.png",
    "close":   "skin/window/btn_close.png"
  },
  "slots": {
    "skill":      "skin/window/slot_skill.png",
    "reward":     "skin/window/slot_reward.png",
    "bag":        "skin/window/slot_bag.png",
    "equipLabel": "skin/window/slot_equip_label.png"
  },
  "bars": {
    "hp": { "track": "skin/window/bar_track.png", "fill": "skin/window/bar_hp.png" },
    "mp": { "track": "skin/window/bar_track.png", "fill": "skin/window/bar_mp.png" }
  },
  "hints": { "ok": "…", "warn": "…", "error": "…" },
  "rules": { "line": "skin/window/rule.png" }
}
```

按钮可写四态对象（上例 `primary`）或单张字符串（上例 `danger`，等价于只写 `normal`）。

### 4.1 按钮四态（结构定稿，实现顺序可后置）

| 态 | 语义 | 素材缺省时的回退 |
|---|---|---|
| `normal` | 常态；**唯一必填** | 该条缺失即整颗按钮走程序绘制 |
| `hover` | 指针悬停 | 回落 `normal` ＋ CSS 表现 |
| `active` | 按下 | 回落 `normal` ＋ CSS 表现 |
| `disabled` | 不可用 | 回落 `normal` ＋ 现状的 `opacity` 表达 |

- **字段名与回退链现在定稿**，配置里可以写；引擎**接入顺序可后置**——先只读 `normal`，其余三态暂由现有 CSS 表现，读到素材字段时忽略并在清单提示（`KW-6`）。
- 与配置纪律（[`../07-decisions.md`](../07-decisions.md) §8「配置里出现的字段必须是已实现的」）的关系：该纪律禁止的是**没有语义**的字段；本表已定义四态语义，且**缺省回退链保证「未接入」时的行为与现状完全一致**，因此不构成无效字段，接入只是排期问题，不会返工。
- 这样安排的收益：美术可一次性按四态出图，引擎分批接入。

### 4.2 信息图标（道具 / 建筑的展示组合）

物品信息视图与建筑信息视图中的图标，按**类似应用图标**的方式组合：

| 层 | 来源 |
|---|---|
| 衬底（在下） | `item` / `building` 的 `background` 三元组（[`06-item-building.md`](06-item-building.md) §二） |
| 图标（在上、居中） | 组件的 `icon` |
| 名称与说明文字 | **窗体自身**的字体与字色，与素材配置无关 |

- **不存在交叉配置**：`06-item-building.md` 只回答「图标与衬底怎么画」，本节回答「容器与文字怎么画」。本节**不读** `building.font` / `fontColor`——那两个字段只作用于**地图上**的建筑名称。
- 衬底缺省时回退组件 `color`（再缺则主题色）；图标缺省时回退组件定义中的 `icon`。

## 五、V1 策略（重要）

V1 不解析九宫格，因此：

- **边框仍由 CSS / SVG 绘制，素材只提供「纸面底纹」**，底纹可自由拉伸不变形。
- **V1 交付素材必须满足「无边框、四边可自由拉伸」**；带硬边框的面板图推迟到 V1.1。
- V1.1 起由九宫格接管边框，素材替换为含边框的完整面板图，调用方接口不变。

## 六、校验项（清单提示，不阻断导出）

| 编号 | 检查 | 提示 |
|---|---|---|
| KW-1 | 随视口族素材无 `slice` | V1 将整体拉伸，边框圆角会变形 |
| KW-2 | 任一边切片之和 ≥ 该元素最小渲染尺寸 | 四角会重叠，需减小切片或放弃九宫格 |
| KW-3 | 随内容族素材含可拉伸中段 | 该族禁止拉伸，需改为九宫格或保持 CSS 绘制 |
| KW-4 | 固定族素材非正方形 | 会按容器比例压缩变形，需提供等比尺寸 |
| KW-5 | 素材路径不存在 | 回退程序绘制形态 |
| KW-6 | 按钮写了 `hover` / `active` / `disabled`，但该态尚未接入引擎 | 该态暂由 CSS 表现；字段语义已定稿（§四.1） |
| KW-7 | 按钮四态素材尺寸不一致 | 悬停或按下时会出现位移、缩放跳变 |

## 七、待确认

1. 窄屏 `≤880px` 抽屉满宽时，是否需要单独的「宽面板」素材，还是与随视口族共用一张？
2. 手绘分隔线 `sketch-line` 是否改用平铺素材（平铺策略见 [`04-misc.md`](04-misc.md) §五）？
3. 按钮四态素材的**接入排期**：是否与九宫格（V1.1）同批实现？（结构已定稿，见 §四.1）

> **已裁决（13）**：按钮 `hover` / `active` / `disabled` 三态**结构现在就定稿**（§四.1：字段名 ＋ 缺省回退链），**实现顺序可后置**。

## 八、实现落点（2026-09-30）

> **本批只落「容器衬底」**：三种**随视口族**容器（§二）——对话框 / 抽屉 / 气泡——已接入 `window.surfaces`。
> 按钮四态（§4.1）与其余三族（格子 / 条 / 提示条 / 分隔线）**尚未接入**，原因见文末「未接部分」。

### 取图与落图

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 的 `surfaceOf(win, kind)`——`dialog` / `drawer` / `popover` 各查自己的键，**不跨键借用**（对话框没配就用不回抽屉的图）；`SurfaceKind` 与 §四 字段同名。拿到 `SkinTexture` 后由 `textureRef()` 归一三写法（衬底不需要 `rotate` / `flip`）。
- **落图**：[`src/ui/Texture.tsx`](../../../src/ui/Texture.tsx) 的 `surfaceStyle(ref, assets)`——与 SVG 层 / 行内层 / DOM 层**同吃「取图结果 → 可用地址」**，差别只在落法：**铺满容器的整个背景**（`background-size: 100% 100%`）。尺寸交给 CSS（§二：随视口族「尺寸由窗口决定」，量不出「多大一个盒」，故这里只取 `src`）；**不写 `background-color`**——底纹可以带透明，纸面底色得留给容器的 CSS，衔接处才不露白。
- **接线**：[`src/ui/useSurfaceStyle.ts`](../../../src/ui/useSurfaceStyle.ts) 的 `useSurfaceStyle(kind)` 把 `store/skin` 的两份状态（素材源 ＋ `manifest.window`）接到上面两个纯函数上；**未启用皮肤 / 未配该键 / 包里缺这张图**一律返回 `undefined`，调用方**不传 `style`**，CSS 纸面照旧（§一：皮肤是可选叠加层）。
- **V1 一律拉伸**（§五）：`nine` 落地（V1.1）时只改 `surfaceStyle()` 内部出 `border-image`，三个调用方一行都不动。

### 三个落点

| 落点 | 元素 | 文件 | 说明 |
|---|---|---|---|
| 对话框 | `.modal` | [`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx)、[`TalkDialog.tsx`](../../../src/play/TalkDialog.tsx)（重入菜单 / 正常对话两个分支共用一份）、[`EncounterView.tsx`](../../../src/play/EncounterView.tsx)、[`GameScreen.tsx`](../../../src/play/GameScreen.tsx)（菜单弹层与结算弹层）、[`LoadScreen.tsx`](../../../src/play/LoadScreen.tsx)（更新记录） | 凡是 `.modal` 都是对话框 |
| 抽屉 | `.panel` | [`StatusPanel.tsx`](../../../src/play/StatusPanel.tsx)、[`BagPanel.tsx`](../../../src/play/BagPanel.tsx)、[`EquipPanel.tsx`](../../../src/play/EquipPanel.tsx)、[`DiceLog.tsx`](../../../src/play/DiceLog.tsx) | 抽屉的定位壳 `.hud-drawer` 自身没有纸面，故衬底落在卡片上；骰流水也在抽屉里，一并吃同一张 |
| 气泡 | `.popover` | [`Popover.tsx`](../../../src/ui/Popover.tsx) | 固定定位那几项（`position` / `top` / `left` / `minWidth` / `zIndex`）照旧，衬底只补背景 |

- **按组件给、不按类名给**：`.panel` 是通用类名，出身卡网格等其它 `.panel` 各有自己的节，故衬底在各组件里显式设置，不做全局选择器。
- **构建页不接**：`src/build/*` 的 `.modal`（校验清单 / NPC 方案 / 规则页弹层）不铺游玩态底纹，与「构建页画布未接」（[`05-canvas.md`](05-canvas.md) §八）保持一致。
- **加载屏的「页面卡片」不铺纸面底纹**：`LoadScreen` 的 `.load-cover` 是整屏容器、本来就没有卡片外观，该屏封面归 `startup.bg`（[`08-pages.md`](08-pages.md)）。

### 未接部分

- **按钮四态**（§4.1）：`window.buttons` 结构已定稿，本批不接——除 `normal` 外三态仍由 CSS 表现（`KW-6`）。
- **随内容族与单向族**（§二：提示条 / 条 / 分隔线）**必须九宫格 / 单轴九宫格**，V1 硬拉伸会违反「随内容族禁止拉伸」（`KW-3`），故整批留到 V1.1：提示条与分隔线继续由 CSS 绘制。
- **固定族格子**（技能格 / 奖励卡 / 部位标签）：尺寸固定、可整图等比拉伸，留到 **`item` / `building` 批**一并接——它们与 `item.background` 会落在同一类元素上，避免两节抢同一个落点。
- **校验项**：`KW-1`（随视口族无 `slice`，V1 会整体拉伸）与 `KW-5`（路径不存在）的清单提示**尚未落进校验层**（`SkinIssueCode` 目前只有 `KP-*`），等汇总批（D6）统一接。
