# skin 分节：容器与控件 `window`

> 上层索引：[`../skin.md`](../skin.md)　依据：[`../00b-style.md`](../00b-style.md)、`src/styles/play.css`／`theme.css`、`src/ui/Overlay.tsx`／`Popover.tsx`
> **状态**：已补（由既有游玩态实现推算，待校正）。**容器衬底已接入**（对话框 / 抽屉 / 气泡）、**按钮 `normal` 态已接入**（七个键）、**固定族格子已接入**（技能格 / 奖励卡 / 背包格 / 部位标签）、**条 / 提示条 / 分隔线已接入**（`bars` / `hints` / `rules`，九宫格随 `slice` 生效，见 §八）。
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
    "plain":   "skin/window/btn_plain.png",
    "danger":  "skin/window/btn_danger.png",
    "ghost":   "skin/window/btn_ghost.png",
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

**键按元素角色定，不按 CSS 类名定**（同一个 `.btn small` 可以是 `small` / `icon` / `close`，看它在界面里干的是什么）：

| 键 | 元素角色 | 游玩态的落点 |
|---|---|---|
| `plain` | `.btn` 本身：中性按钮 | 菜单的抽屉项与存档 / 退出、取消、对话次项 |
| `primary` | 本屏主行动 | 开始冒险、出发、掷骰、攻击 / 防御、确认 |
| `danger` | 危险动作 | 交锋里的「不防御」 |
| `ghost` | 低强调按钮（虚线边） | 封面的「其他开始方式」折叠入口 |
| `small` | 行内小动作 | 买下、使用 / 装备 / 卸下、更换、加点 |
| `icon` | 只有图形、无文字的按钮 | 地图顶栏的菜单入口 |
| `close` | 关闭 | 各处标题栏的关闭 |

键名允许自定义：引擎只读上表七个键，其余键配了也静默搁置（与其余各节一致，不报错也不回退到别的键）。

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

### 4.3 格子（`slots`）

**固定族**（§二：像素写死，故整图等比拉伸），四个键按**格子角色**判定：

| 键 | 元素角色 | 尺寸 | 游玩态的落点 |
|---|---|---|---|
| `skill` | 技能格 | 54×54 | HUD 底栏的技能栏与交锋弹层里的技能栏——**两处同吃一个键**，不是两套素材 |
| `reward` | 奖励卡 | 92 | 遭遇弹层「获得」那块里的奖励卡网格（`compact` 浮条不铺） |
| `bag` | 背包格 | — | 背包抽屉的背包格与穿戴格 |
| `equipLabel` | 部位标签 | 44 | 装备抽屉部位行左侧那一列标签 |

- **背包格是唯一的交叠处**：`.bag-cell` 同时也是道具衬底位（`item.background`，[`06-item-building.md`](06-item-building.md) §3.2）。取「**道具衬底优先、格位底纹兜底**」——道具配了 `background` 就整格归它，没配才铺 `slots.bag`。两节因此不会抢同一个落点：**同一个格子上只会出现一层**。
- 键名允许自定义：引擎只读上表四个键，其余键配了也静默搁置（与其余各节一致，不报错也不回退到别的键）。

### 4.4 条与提示（`bars` / `hints` / `rules`）

这三族一句话概括：**同样是「取图 → 铺满」，区别只在铺法**（§二）。因为都**必须九宫格 / 单轴九宫格**（硬拉伸会违反 `KW-3`），所以素材**带 `slice` 才生效**：没带就回落成 V1 的整图拉伸（视觉上不变形但会糊），**不是回落成 CSS**。

**`bars`：单向族**，按**资源档**分键。一档给两张——轨道与填充**各自独立**（填充是百分比宽度，轨道是满宽，两者尺寸不同，合成一张必错）：

| 键 | 元素角色 | 游玩态的落点 |
|---|---|---|
| `hp` | 生命条 | 属性面板 `.bar`（轨道 ＋ `.fill` 填充）、交锋弹层里主角与对手的两条 |
| `mp` | 法力条 | 属性面板 `.bar`（同上一处结构） |

- 只配 `track` 不配 `fill` 是合法的：轨道归素材、填充仍是 CSS 那条实色（`KW-5` 缺省回退的逐条版本）。
- 切片建议**只给左右**（上下给 0）：条只会横向伸缩（§三）。上下给非 0 会在条高度小于切片和时四角重叠（`KW-2`）。

**`hints`：随内容族**，按**语气档**分键——与 `.hintbox` 的四处外观一一对应：

| 键 | 语气 | 对应类名 |
|---|---|---|
| `ok` | 成功 / 确认 | `.hintbox.ok`（绿） |
| `warn` | 警告 / 有代价 | `.hintbox.warn`（黄） |
| `error` | 失败 / 危险 | `.hintbox.error`（红） |

- **中性档没有键**：`.hintbox` 不带修饰符的那一份是中性提示（如「箱内无物品」「不触发任何效果」），语气上不属于上面三档，故**不设键、也不借用任何键**——调用方遇到中性提示**不调 hook**，由 CSS 全权表现。
- **同一个元素可以一格多档**：遭遇弹层的判定框是**一个 `.hintbox` 换三种配色**（`success` → `ok`、`blocked` → `warn`、`fail` → `error`）。hook 不能落在条件分支里，故三档**全部先取**、再按判定挑一份（见 §八「提示条」）。
- 左侧那道 3px 竖线（`.hintbox` 的 `border-left`）**不归素材**：素材只铺底纹（§五）。

**`rules`：单向族**，目前只有一个键：

| 键 | 元素角色 | 游玩态的落点 |
|---|---|---|
| `line` | 手绘分隔线 | 凡是 `.sketch-line`——背包抽屉（「穿戴中」之上）、首页（「这一局的世界」之下）、载入屏（更新记录之上） |

- CSS 那条线是 `repeat-x` 的手绘图（`theme.css` 的 `.sketch-line`）；素材接管后由 **`border-image` 单轴九宫格**铺一条，切片**上下给 0**（线只有左右可伸）。
- §七.2「分隔线是否改用平铺素材（`tile`）」**尚未裁决**：本批只落「单向族 → 单轴九宫格」这一档，未引入第二套字段。

键名允许自定义：引擎只读上表这些键，其余键配了也静默搁置（与其余各节一致，不报错也不回退到别的键）。

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
>
> **排期已定**（D3 第九屏）：`normal` 态已接入（§八「按钮」）；其余三态原定与九宫格**同批**（V1.1）。
>
> **九宫格已提前落地**（D3 第十三屏，§八「九宫格」）：容器 / 按钮 / 格子 / 条 / 提示条 / 分隔线六处**一处改完**，调用方一行不动。
> 于是四态里剩下的 `hover` / `active` / `disabled` 现在是**独立的最后一批**——它要接的是「一个按钮按状态取不同图」，与九宫格无耦合。

## 八、实现落点（2026-09-30）

> **本批落「容器衬底 ＋ 按钮 `normal` 态 ＋ 固定族格子 ＋ 条 / 提示条 / 分隔线」**：三种**随视口族**容器（§二）——对话框 / 抽屉 / 气泡——已接入 `window.surfaces`；
> 七个按钮键（§四）已接入 `window.buttons` 的 `normal` 态；四个**固定族格子**键（§4.3）已接入 `window.slots`；
> **单向族与随内容族**三节（§4.4）已接入 `window.bars` / `window.hints` / `window.rules`。
> **九宫格随本批一并落地**：素材带了 `slice` 就走 `border-image`，没带回落整图拉伸。
> 只余四态里的其余三态（§4.1）尚未接入，原因见文末「未接部分」。

### 取图与落图

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 的 `surfaceOf(win, kind)`——`dialog` / `drawer` / `popover` 各查自己的键，**不跨键借用**（对话框没配就用不回抽屉的图）；`SurfaceKind` 与 §四 字段同名。拿到 `SkinTexture` 后由 `textureRef()` 归一三写法（衬底不需要 `rotate` / `flip`）。
- **落图**：[`src/ui/Texture.tsx`](../../../src/ui/Texture.tsx) 的 `surfaceStyle(ref, assets)`——与 SVG 层 / 行内层 / DOM 层**同吃「取图结果 → 可用地址」**，差别只在落法：**铺满容器的整个背景**（`background-size: 100% 100%`）。尺寸交给 CSS（§二：随视口族「尺寸由窗口决定」，量不出「多大一个盒」，故这里只取 `src`）；**不写 `background-color`**——底纹可以带透明，纸面底色得留给容器的 CSS，衔接处才不露白。
- **接线**：[`src/ui/useSurfaceStyle.ts`](../../../src/ui/useSurfaceStyle.ts) 的 `useSurfaceStyle(kind)` 把 `store/skin` 的两份状态（素材源 ＋ `manifest.window`）接到上面两个纯函数上；**未启用皮肤 / 未配该键 / 包里缺这张图**一律返回 `undefined`，调用方**不传 `style`**，CSS 纸面照旧（§一：皮肤是可选叠加层）。
- **拉伸还是九宫格，由素材自己声明**（§八「九宫格」）：素材带 `slice` → `surfaceStyle()` 内部出 `border-image`；不带 → 整图拉伸（§五的 V1 形态仍然有效，老素材不用改）。**六个调用方一行都不动**。

### 三个落点

| 落点 | 元素 | 文件 | 说明 |
|---|---|---|---|
| 对话框 | `.modal` | [`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx)、[`TalkDialog.tsx`](../../../src/play/TalkDialog.tsx)（重入菜单 / 正常对话两个分支共用一份）、[`EncounterView.tsx`](../../../src/play/EncounterView.tsx)、[`GameScreen.tsx`](../../../src/play/GameScreen.tsx)（菜单弹层与结算弹层）、[`LoadScreen.tsx`](../../../src/play/LoadScreen.tsx)（更新记录） | 凡是 `.modal` 都是对话框 |
| 抽屉 | `.panel` | [`StatusPanel.tsx`](../../../src/play/StatusPanel.tsx)、[`BagPanel.tsx`](../../../src/play/BagPanel.tsx)、[`EquipPanel.tsx`](../../../src/play/EquipPanel.tsx)、[`DiceLog.tsx`](../../../src/play/DiceLog.tsx) | 抽屉的定位壳 `.hud-drawer` 自身没有纸面，故衬底落在卡片上；骰流水也在抽屉里，一并吃同一张 |
| 气泡 | `.popover` | [`Popover.tsx`](../../../src/ui/Popover.tsx) | 固定定位那几项（`position` / `top` / `left` / `minWidth` / `zIndex`）照旧，衬底只补背景 |

- **按组件给、不按类名给**：`.panel` 是通用类名，出身卡网格等其它 `.panel` 各有自己的节，故衬底在各组件里显式设置，不做全局选择器。
- **构建页不接**：`src/build/*` 的 `.modal`（校验清单 / NPC 方案 / 规则页弹层）不铺游玩态底纹，与「构建页画布未接」（[`05-canvas.md`](05-canvas.md) §八）保持一致。
- **加载屏的「页面卡片」不铺纸面底纹**：`LoadScreen` 的 `.load-cover` 是整屏容器、本来就没有卡片外观，该屏封面归 `startup.bg`（[`08-pages.md`](08-pages.md)）。

### 按钮（§四）

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 的 `buttonOf(win, kind)`——七个键（`BUTTON_KINDS`）各查自己的键，**不跨键借用**；四态对象**只取 `normal`**，缺 `normal` 即整颗按钮算没配（老包 / 手写配置不会因为只有 `hover` 就凭空多出一张底图）。
- **落图与接线**：容器那份**原样复用**——[`src/ui/useButtonStyle.ts`](../../../src/ui/useButtonStyle.ts) 的 `useButtonStyle(kind)` 走同一条「`buttonOf()` → `textureRef()` → `surfaceStyle()`」。按钮是**随内容族**（盒随文字量变，§二），交没交 `slice` 决定拉伸还是九宫格（§八「九宫格」），圆角与描边仍归 `.btn` 的 CSS（§五「素材只提供纸面底纹」）。
- **与容器的差别只有一处**：容器取 `surfaces.<键>` 的值，按钮多一步「从四态里挑 `normal`」。九宫格落地时**容器与按钮一体改完**（`surfaceStyle()` 内部换 `border-image`），两侧调用方一行都不动。
- **四态只读 `normal`**（§4.1，`KW-6`）：`hover` / `active` / `disabled` 仍由 CSS 表现——`:disabled { opacity }` 与 `:active { transform }` 照旧生效，`:hover` 变的只是素材**之下**的底色（素材不透明时看不出变化，属 V1 的既定取舍）。

| 文件 | 接入的键 | 元素 |
|---|---|---|
| [`LoadScreen.tsx`](../../../src/play/LoadScreen.tsx) | `primary` / `plain` / `ghost` / `small` / `close` | 开始冒险、构建世界、「其他开始方式」（选中与未选中共用 `plain`）、导出 / 导入组件库、更新记录关闭 |
| [`StartScreen.tsx`](../../../src/play/StartScreen.tsx) | `plain` / `primary` | 换一局、掷骰决定出身、出发 |
| [`GameScreen.tsx`](../../../src/play/GameScreen.tsx) | `icon` / `close` / `plain` / `primary` | 菜单入口、菜单纸张的关闭、六个抽屉项、结算弹层的三项 |
| [`DiceHud.tsx`](../../../src/play/DiceHud.tsx) | `primary` | 掷骰 |
| [`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx) | `primary` / `danger` | 攻击 / 防御 / 下一回合、不防御 |
| [`TalkDialog.tsx`](../../../src/play/TalkDialog.tsx) | `primary` / `plain` | 继续对话 / 继续、重新对话 / 路过、台下的选项 |
| [`EncounterView.tsx`](../../../src/play/EncounterView.tsx) | `primary` / `small` | 标题栏确认、货架行的「买下」 |
| [`BagPanel.tsx`](../../../src/play/BagPanel.tsx) | `small` / `close` | 使用 / 装备 / 卸下、标题栏关闭 |
| [`EquipPanel.tsx`](../../../src/play/EquipPanel.tsx) | `small` / `close` | 更换 / 装备、标题栏关闭 |
| [`StatusPanel.tsx`](../../../src/play/StatusPanel.tsx) | `small` / `close` | 属性行的加点、标题栏关闭 |
| [`DiceLog.tsx`](../../../src/play/DiceLog.tsx) | `close` | 骰流水标题栏关闭 |

- **构建页不接**：`src/build/*` 的 `.btn` 不铺游玩态按钮素材（含 [`ui/RowMenu.tsx`](../../../src/ui/RowMenu.tsx)，它只被组件库用），与「构建页画布未接」（[`05-canvas.md`](05-canvas.md) §八）保持一致。
- **封面的版本号入口不接**：`.cover-version` 是纯文字入口、没有纸面，七个键里没有它对应的角色（要单独控制得先定新键，见 §四「键名允许自定义」）。

### 格子（§4.3）

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 的 `slotOf(win, kind)`——四个键（`SLOT_KINDS`）各查自己的键，**不跨键借用**。
- **落图与接线**：容器那份**原样复用**——[`src/ui/useSlotStyle.ts`](../../../src/ui/useSlotStyle.ts) 的 `useSlotStyle(kind)` 走同一条「`slotOf()` → `textureRef()` → `surfaceStyle()`」。格子是**固定族**（§二：像素写死），**尺寸写死故整图等比拉伸就够**（`KW-4`）；素材若交了 `slice` 也照样走九宫格，圆角与描边仍归格子自己的 CSS（§五「素材只提供纸面底纹」）。
- **与容器 / 按钮的唯一差别**：取的是 `slots.<键>` 的值（按钮多一步挑 `normal`）。九宫格落地时**容器 / 按钮 / 格子一体改完**（`surfaceStyle()` 内部换 `border-image`），三侧调用方一行都不动。
- **背包格的优先级写在调用点**：[`src/play/BagPanel.tsx`](../../../src/play/BagPanel.tsx) 的两处 `.bag-cell` 都用 `cell ?? bagSlot`——`cell` 是道具衬底（`groundStyle(groundPaint(...))`，道具没配 `background` 时为 `undefined`），`bagSlot` 是 `useSlotStyle('bag')`。**hook 本身仍是纯读取、不判别的**：优先级只在这一行表达式里，别的节要复用「格子 ＋ 内容层」时照抄这一行即可。

| 文件 | 接入的键 | 元素 |
|---|---|---|
| [`SkillBar.tsx`](../../../src/play/SkillBar.tsx) | `skill` | HUD 底栏技能栏的 `.skill-slot` |
| [`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx) | `skill` | 交锋弹层操作区的 `.skill-slot`（与上面同键） |
| [`GainNoteView.tsx`](../../../src/play/GainNoteView.tsx) | `reward` | 遭遇弹层「获得」那块里的 `.reward-card`（钩子提到 `compact` 早返回之前，两种密度共用一个键） |
| [`EquipPanel.tsx`](../../../src/play/EquipPanel.tsx) | `equipLabel` | 部位行左侧的 `.equip-slot` |
| [`BagPanel.tsx`](../../../src/play/BagPanel.tsx) | `bag`（兜底） | 背包格与穿戴格的 `.bag-cell`，被 `item.background` 优先覆盖 |

- **构建页不接**：`src/build/*` 不铺游玩态格子底纹，与「构建页画布未接」（[`05-canvas.md`](05-canvas.md) §八）保持一致。

### 条 / 提示条 / 分隔线（§4.4）

三节共用一句实话：**取图逻辑与前三节不同，落图逻辑一模一样**（都落到 `surfaceStyle()`），所以 §八「九宫格」那一处改完，这六处（容器 / 按钮 / 格子 / 条 / 提示条 / 分隔线）一起升级。

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 新增三个——`barOf(win, tone)`（`BAR_TONES = ['hp','mp']`）、`hintOf(win, tone)`（`HINT_TONES = ['ok','warn','error']`）、`ruleOf(win)`（只有 `rules.line`）。同样是「各查自己的键、**不跨键 / 不跨档借用**」。
- **条多一层结构**：`bars.<档>` 一次给两张（`track` / `fill`），故返回值不是单张而是 `SkinBar`；[`src/ui/useBarStyle.ts`](../../../src/ui/useBarStyle.ts) 的 `useBarStyle(tone)` 返回 `{ track?, fill? }`——**两张各自独立**，只配一张不影响另一张（轨道归素材、填充仍是 CSS 那条实色）。
- **提示条逐档调用**：提示条一档一张，返回**单个** `CSSProperties | undefined`；[`src/ui/useHintStyle.ts`](../../../src/ui/useHintStyle.ts) 的 `useHintStyle(tone)`。
- **分隔线**：[`src/ui/useRuleStyle.ts`](../../../src/ui/useRuleStyle.ts) 的 `useRuleStyle()`，无参数（只有一个键）。素材接管后由 `border-image` 单轴铺一条，CSS 那条 `repeat-x` 手绘线让位；没配 / 缺图时**不传 `style`**，手绘线照旧。
- **中性档与 `.hintbox` 的 CSS 边线都不动**：中性提示不调 hook；`border-left` 那道竖线归 CSS（§4.4）。

| 文件 | 接入的键 | 元素 |
|---|---|---|
| [`StatusPanel.tsx`](../../../src/play/StatusPanel.tsx) | `bars.hp` / `bars.mp` | 属性面板的 `.bar`（轨道）与 `.bar > .fill`（填充）——`Bar` 的 `tone` 从 `'hp' \| 'mp'` 放宽为 `BarTone` |
| [`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx) | `bars.hp` | 交锋弹层里对手那条血条（`.bar` ＋ `.fill`）——与属性面板**同键**，不是两套素材 |
| [`GainNoteView.tsx`](../../../src/play/GainNoteView.tsx) | `hints.warn` | 「没拿下」那条 `.hintbox.warn`（中性 `.hintbox` 不铺） |
| [`EncounterView.tsx`](../../../src/play/EncounterView.tsx) | `hints.ok` / `hints.warn` / `hints.error` | 事件判定框——**同一个 `.hintbox` 按 `verdict` 换三档**，故三档全部先取、再挑一份（`success` → `ok`、`blocked` → `warn`、`fail` → `error`） |
| [`LoadScreen.tsx`](../../../src/play/LoadScreen.tsx) | `hints.warn` / `rules.line` | 载入警告条、更新记录之上的分隔线 |
| [`StartScreen.tsx`](../../../src/play/StartScreen.tsx) | `hints.warn` / `rules.line` | 「这一局还没有可选职业」、世界简介与出身卡之间的分隔线 |
| [`BagPanel.tsx`](../../../src/play/BagPanel.tsx) | `rules.line` | 背包格与「穿戴中」之间的分隔线 |

- **构建页不接**：`src/build/*` 的 `.hintbox`（校验清单 / 各编辑器提示）不铺游玩态提示条底纹——那里是作者工具，与「构建页画布未接」（[`05-canvas.md`](05-canvas.md) §八）保持一致。
- **`MapView` 的空态提示不铺**：「这一局没有地图」那一处是中性 `.hintbox`，按 §4.4 本来就没有键。

### 九宫格（§二 / §三）

九宫格**没有独立字段**：它由素材自己声明（`SkinTexture` 的 `slice`），因此**同一个键**可以今天是拉伸、明天是九宫格，而调用方一行都不动——这正是 §五「调用方接口不变」的兑现。

- **判定**：[`src/engine/skin/texture.ts`](../../../src/engine/skin/texture.ts) 的 `surfaceMode(ref)`：素材带 `slice` → `'nine'`，否则 `'stretch'`；`effectiveMode(mode?, slice?)` 再做一次「策略与素材是否齐备」的把关——**`nine` 需要策略与切片同时成立**（只写 `mode: 'nine'` 而没给 `slice` 会回落 `stretch`，不会画出半张九宫格）。
- **落法**：[`src/ui/Texture.tsx`](../../../src/ui/Texture.tsx) 的 `surfaceStyle()` 内部多一个分支——`nine` 时改出 `border-image` 四件套（`borderImageSource` / `Slice` / `Width` / `Repeat`）；`stretch` 时照旧走 `background-size: 100% 100%`。
- **两条硬约束**：
  1. **`Slice` 的语义与 `[上,右,下,左]` 逐字对应**（§三），末带 `fill`（否则中心会被挖空，只剩一圈边框）。
  2. **不写 `borderWidth`**：盒子的尺寸是 CSS 量好的，素材不许改布局——`border-image` 的宽度只取切片值，不参与盒模型。
- **只改 DOM 层**：本批六处落点全在 DOM 层（`surfaceStyle()` 的 `border-image`）；SVG 层（地图 / 画布 / 棋子）**本批不动**——它那侧目前按 `preserveAspectRatio` 出图（[`04-misc.md`](04-misc.md)），要走九宫格得另起切块拼装，属另一批。
- **老素材不受影响**：不带 `slice` 的素材走原路（§五的 V1 形态），故**皮肤包升级不必一次性到位**。
- **本批没接的两条衬底路**：`groundStyle()`（`item.background` / `building.background` 的衬底三件套，[`06-item-building.md`](06-item-building.md) §二）与 `pageBgStyle()`（封面整屏 `bg`，[`08-pages.md`](08-pages.md) §2.1）**仍是整图铺法**——前者是尺寸写死的固定族格子（`KW-4`，拉伸不成问题），后者是整屏铺法（`cover` / `contain` / `tile` 三档，与九宫格无关）。要接九宫格得各自再走一遍 `nineStyle()`，本批不动。

### 未接部分

- **按钮四态**（§4.1）：`normal` 已接入；`hover` / `active` / `disabled` 仍由 CSS 表现（`KW-6`）。九宫格已落地，故这三态现在是**独立的一批**——与九宫格无耦合。
- **`tile` 平铺**：§七.2 的「分隔线是否改用平铺素材」尚未裁决，故**未引入第二套字段**。`effectiveMode` 已认得 `tile`（平铺独立成立，不需要切片），只等裁决后接线。
- **校验项**：`KW-1`（随视口族无 `slice`）与 `KW-5`（路径不存在）的清单提示**尚未落进校验层**（`SkinIssueCode` 目前只有 `KP-*`），等汇总批（D6）统一接。

> **已接**（D3 第十二屏）：固定族格子（§4.3）四个键——技能格 / 奖励卡 / 背包格 / 部位标签。
> **已接**（D3 第十三屏）：条 / 提示条 / 分隔线（§4.4）三个节——`bars`（两档 × 两图）、`hints`（三档）、`rules.line`；**九宫格随本批落地**（素材带 `slice` 即生效）。
> **待接**：`hover` / `active` / `disabled` 三态（§4.1）；`tile` 平铺待 §七.2 裁决。
