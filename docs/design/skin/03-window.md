# skin 分节：容器与控件 `window`

> 上层索引：[`../skin.md`](../skin.md)　依据：[`../00b-style.md`](../00b-style.md)、`src/styles/play.css`／`theme.css`、`src/ui/Overlay.tsx`／`Popover.tsx`
> **状态**：已补（由既有游玩态实现推算，待校正）。
> **划分原则**：**容器 = 带底纹或边框、且尺寸由内容或视口决定的元素**。内容自适应与九宫格强相关，因此单独成节。

## 一、覆盖范围（按游玩态屏划分）

| 屏 | 容器元素 | 依据 |
|---|---|---|
| 加载屏 | 页面卡片、导入 / 示例 / 去构建页按钮 | `LoadScreen.tsx:104-131` |
| 开局屏 | 出身卡网格（列宽 `minmax(210px)`）、加点控件、掷骰按钮 | `StartScreen.tsx`、`play.css:887` |
| 地图 | 顶栏（标题余宽省略）、底栏（含 **hp/mp 左侧立绘位**）、抽屉 `min(440px,100%)` | `GameScreen.tsx:181`、`play.css` |
| 战斗 | 战斗对话框 `min(560px,100%)`、**顶部 VS 立绘区**、战况流水区（余宽）、技能格、血蓝条 | `BattleDialog.tsx` |
| **NPC 对话** | 对话框 `min(560px,100%)`、**顶部 VS 立绘区**、台词区（逐条 + 继续）、选项按钮列表 / **掷骰按钮**（节点带 `dice` 时用它替代选项列表，未命中可再掷——[`../02-data-model.md`](../02-data-model.md) §4.9.2） | `BattleDialog.tsx` 的对话框壳 ＋ 新的对话内容区 |
| 遭遇 | 对话框 `min(620px,100%)`、提示条、奖励卡网格、**顶部立绘位（V1 仅预留）** | `EncounterView.tsx`、`play.css:369` |
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
