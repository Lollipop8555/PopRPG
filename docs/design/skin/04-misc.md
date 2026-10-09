# skin 分节：标记、骰子与图标 `misc`

> 上层索引：[`../skin.md`](../skin.md)　依据：[`../00b-style.md`](../00b-style.md)、`src/ui/Marker.tsx`（起终点）、`src/ui/Footprint.tsx`（道路脚印）、`src/play/DiceLog.tsx`（骰面）、`src/play/MapView.tsx`（节点与引导线）
> **状态**：已补（由既有游玩态实现推算，待校正）。**地图标记与骰子已接入**（§十）。
> **收容范围**：不属于形象（`role`）、不属于容器（`window`）的其余全部可见图形。

## 一、覆盖范围

| 族 | 元素 | 依据 |
|---|---|---|
| 地图标记 | 起点旗、终点藏宝图 X、道路脚印、建筑多格节点 | `Marker.tsx:16-37`、`Footprint.tsx:14`、`MapView.tsx:204` |
| 骰子 | 骰子本体（三档尺寸）、骰面点阵、掷骰中动画态 | `DiceLog.tsx:11-44`、`play.css:484` |
| 图标 | lucide 矢量图标、内容 emoji（职业 / 道具 / 怪物 / 技能）、兜底字形 | 见 §四 |
| 引导 | 每 10 格坐标参照线（游玩态无网格线） | `MapView.tsx:98-125` |
| 色调 | 日志行四档 tone、提示条三档 tone、徽章与芯片 | `play.css:454` |

## 二、地图标记族

| 节点 | 尺寸 | 策略 | 兜底 |
|---|---|---|---|
| `mark.start` | 1 格 | 整图，居中，不旋转 | 程序绘制三角旗（`00b-style`） |
| `mark.end` | 1 格 | 整图，居中，不旋转 | 程序绘制藏宝图 X |
| `mark.footprint` | 1 格 | 整图（道路素材缺失时使用，见 [`01-road.md`](01-road.md) §一） | 程序绘制脚印 |
| `node.building` | **随格数 `w × h` 拉伸** | 九宫格（[`03-window.md`](03-window.md) §三） | 圆角矩形：描边 100% alpha ＋ 填充 30% alpha |
| `node.npcSlot`（**V2.4**，裁决 66） | 1 格 | 程序绘制**圆环**——**皮肤缺失时的兜底**（[`02-role.md`](02-role.md) §4.3）；配了皮肤则由 `role.npcs` 形象覆盖（**不是**两张图叠加） | **槽位色圆环**：颜色 = **槽号 → 固定调色板**（与构建页该槽位行同色），越界**循环取色**（`KM-4`） |

```json
"misc": {
  "marks": { "start": "…", "end": "…", "footprint": "…" },
  "nodes": { "building": { "img": "…", "slice": [12, 12, 12, 12] } }
}
```

- 起点与终点**已有明确的手绘 SVG 定义**（[`../00b-style.md`](../00b-style.md)「起点 / 终点的图形」），程序绘制为主、**素材可覆盖**；两者均不使用 emoji。
- `node.building` 是游玩态唯一会**随格数拉伸**的地图图形，必须按九宫格交付，否则多格建筑的圆角会变形。

## 三、骰子族

| 节点 | 尺寸 | 说明 |
|---|---|---|
| `die.body` | 46（HUD）/ 38（掷骰中）/ 34（流水） | 三档尺寸共用一张等比缩放；不拉伸 |
| `die.face.d1`–`d6` | 随本体 | 骰面点阵，>6 面沿用数字文本，另设 `die.face.numeric` 可选 |

**骰面复用是镜像的正式例外**：[`../skin.md`](../skin.md) §3.2 规定镜像不默认启用，骰面点阵须显式启用镜像与旋转，各面复用关系如下：

| 面 | 复用方式 | 需交付张数 |
|---|---|---|
| `d1` / `d4` / `d5` | 自身对称 | 各 1 张 |
| `d2` / `d3` | 主对角 ↔ 副对角，镜像 1 张 | 各 1 张 |
| `d6` | 竖列 ↔ 横列，旋转 90° | 1 张 |

合计 **6 张**覆盖全部骰面朝向。掷骰中动画态（`spinning`）V1 沿用 `🎲` 兜底，素材可选 `die.rolling`（待确认 2）。

## 四、图标与兜底

- **lucide 矢量图标**（加载屏 `Sword` / `Hammer` / `FileDown` / `FileUp` / `LibraryBig`，顶栏 `Menu` / `Flag`，骰子 `StepForward`，各面板关闭 `X`）：沿用 lucide，可套手绘滤镜；允许按图标名提供替换素材 `misc.icons.<图标名>`——**已接入**（[`GameIcon.tsx`](../../../src/ui/GameIcon.tsx)，见 §十「落点」表末条）：配了该名就换素材，没配 / 缺图 / 无皮肤一律原样回退 lucide 元件。
- **内容 emoji**（职业 `icon`、道具 `icon`、怪物 `icon`、技能 `icon`）：由组件定义驱动，游玩态**直接以文本绘制、无独立衬底**（与组件库中的圆角矩形衬底不同）；素材替换顺序为「专用素材 → emoji」。
- **兜底字形**：`🙂`（玩家）、`✦`（技能）、`❔`（奖励）、`🎲`（骰子）、`🔒`（门槛徽章）。**兜底字形不可被素材覆盖**——它是素材缺失时的最终保底，若可覆盖则失去保底意义。
- 游玩态**不为图标增加衬底**，与 [`../00b-style.md`](../00b-style.md) 「非地图件在组件库里衬圆角矩形」的规则区分开。

## 五、引导线（定位线，平铺策略）

- 游玩态**只保留每 10 格的坐标参照线**，无网格线（[`06-future.md`](../06-future.md) §7.1）。
- **它是叠在地图之上的辅助层，不属于任何贴图（裁决 27）**：每 10 格一条细虚线只作**读数定位**用；**道路 / 背景 / 格子等贴图本身不含间距与分割线**，网格感不靠素材画进去。游玩态在**菜单**里给这一层一个开 / 关（`GameScreen` 的「定位线」项 → `MapView` 的 `guides`）。
- 参照线沿视口铺满，属**平铺**而非拉伸：`drawTexture` 增加策略 `tile`（[`../skin.md`](../skin.md) §四）——`tile` 的**唯一候选就是本条**（分隔线**已裁决不走平铺**，裁决 29，见 [`03-window.md`](03-window.md) §4.4）。
- 若改用素材，素材必须**四边可无缝拼接**（校验项 `KM-2`）。

## 六、手绘滤镜

- 全局手绘滤镜 `#poprpg-sketch`（`feTurbulence` ＋ `feDisplacementMap`）在应用根节点统一挂载；目前仅起点 / 终点标记使用。
- **规则**：程序绘制的图形与 lucide 图标套滤镜；**位图素材不套滤镜**——滤镜会使其边缘模糊，且素材本身已是手绘产物。

## 七、色调 token（不是素材）

以下一律用色彩 token 表达，不交付贴图：

| 用途 | 档位 |
|---|---|
| 日志行 `logline` | `good` / `bad` / `dice` / `item`（左侧竖条着色） |
| 提示条 `hintbox` | `ok` / `warn` / `error` |
| 徽章 `badge` | 默认 / `on` / `warn` |
| 芯片 `chip` | `state` / `good` / `on` |

色值以 `src/styles/theme.css` 与 `play.css` 现有变量为准，本规范只固定**语义档位**，不重复声明色值。

## 八、校验项（清单提示，不阻断导出）

| 编号 | 检查 | 提示 |
|---|---|---|
| KM-1 | `node.building` 未提供九宫格切片 | 多格建筑的圆角会随格数拉伸变形 |
| KM-2 | 引导线素材四边不可拼接 | 平铺后出现可见接缝 |
| KM-3 | 骰面少于 6 张且未声明复用方式 | 提示按 §三 的镜像 / 旋转关系补齐 |
| KM-4 | **NPC 槽位数超过调色板色数**（**V2.4**，裁决 66） | 槽号越界时**循环取色**（`slot0` 与 `slotN` 会撞色）；提示"这栋楼槽位多，两个槽的颜色会一样"——只提示、不改行为 |

## 九、待确认

1. ~~起点 / 终点是否接受素材覆盖（当前为程序绘制 SVG，[`../00b-style.md`](../00b-style.md) 已定形态）？~~ **已定**：接受覆盖（§二 表已写「程序绘制为主、**素材可覆盖**」），实现见 §十——**缺图时照旧画程序图形**，故覆盖是纯加法。
2. 掷骰中动画是否需要专属素材，或沿用 `🎲` 兜底？
3. `node.building` 的填充与描边比例（现有为描边 100% alpha ＋ 填充 30% alpha）在套素材后是否保留？

## 十、实现落点（2026-09-30）

> **本批落「地图标记 ＋ 骰子」两组**：起点 / 终点 / 脚印三键与骰子本体 / 骰面已接入 `misc`。
> **图标随后一批接入**（D3 第十屏）：`misc.icons.<图标名>` 已落到九个 lucide 图标上，见「取图与落图」末条与「落点」表末条。
> **引导线尚未接入**，`node.building` 与骰子动画态按原因后置，见文末「未接部分」。

### 取图与落图

- **取图**：[`src/engine/skin/lookup.ts`](../../../src/engine/skin/lookup.ts) 的三条查表——`markOf(misc, kind)`（`start` / `end` / `footprint` 各查自己的键、**不跨键借用**）、`dieBodyOf(misc)`（本体一张通吃三档、**不分尺寸档**）、`dieFaceOf(misc, pips)`（`1`–`6` → 点阵 `d1`–`d6`；**其余点数一律交给 `numeric`**：`2D6` 的合计值、以及流程里的异常值都走这一条）。三条都只出形状、不碰 IO，「缺位」一律是 `undefined`——如包里只有 `d1` / `d6` 时 `d2` 取不到 → **那一面自己回退程序点阵，不倒借别的面**。
- **落图**（三种落法各归其位）：
  - **标记**走 **SVG 层**（`textureProps` ＋ `SvgTexture`）：盒＝**整格**，与道路同一约定（[`01-road.md`](01-road.md) §3.1）——素材按 `cellSize × cellSize` 正方形交付、图形**自己居中留白**。原先程序绘制时旗 / 叉占格 86%、脚印占格 60%，素材接管后**内缩比例由素材自己决定**。多格节点取短边居中，与道路一致。
  - **骰子本体**走 **CSS 背景**（`surfaceStyle(…, 'contain')`）：`.die` 盒已有尺寸、底色与描边，素材**等比缩放进盒、绝不拉伸**（§三「不拉伸」）；描边与圆角照旧归 CSS（[`03-window.md`](03-window.md) §五「素材只提供纸面底纹」的同一规矩）。
  - **骰面**走 **行内层**（`InlineTexture` ＋ `.die-face` 的 `100% × 100%`）：尺寸随本体、**交给 CSS**，`contain` 沿用行内层的等比规矩。
- **§三 的镜像 / 旋转复用关系由包里显式声明**：写对象式（如 `"d6": { "img": "d6.png", "rotate": 90 }`），运行期经 `textureRef()` 归一后照此落图——**默认不启用镜像**（[`../skin.md`](../skin.md) §3.2），`d2` / `d3` 想复用就得在包里写出来。
- **接线**：[`src/ui/useDieSkin.ts`](../../../src/ui/useDieSkin.ts) 的 `useDieBodyStyle()` / `useDieFace(pips)`；标记三键在 `MapView` 里就地接线（与 `road` / `background` 同一处读 `store/skin`，不另设 hook）。三条链都遵循同一条底线：**未启用皮肤 / 未配该键 / 包里缺图 → `undefined`**，于是标记交回 `<MapMarker>` / `<Footprint>`，骰面交回程序点阵或数字文本（§二、§三 的「兜底」列即此）。
- **不套手绘滤镜**（§六）：贴图是位图，`SvgTexture` 不给画笔加滤镜；程序图形与 lucide 照旧套。
- **图标**走**行内层**（`InlineTexture`）：与「内容 emoji」同一档——不套手绘滤镜、不加衬底（§四）。素材按 lucide 那档的 `size` 占 `size × size` 的盒、`object-fit: contain` 等比内缩，**换与不换都不动布局**（`GameIcon` 的 `size` 同时喂给 lucide 与素材）。接线 [`src/ui/useIconSkin.ts`](../../../src/ui/useIconSkin.ts) 的 `useIconTexture(name)`（`iconOf()` → `textureRef()` → `textureProps()`，与其余各链同一条底线）。

### 落点

| 落点 | 键 | 文件 | 说明 |
|---|---|---|---|
| 起点 / 终点 | `mark.start` / `mark.end` | [`MapView.tsx`](../../../src/play/MapView.tsx) | 游玩态地图；缺图回退手绘旗 / 藏宝图 X |
| 道路脚印 | `mark.footprint` | 同上 | **只在 `road` 素材缺失时**顶替程序脚印（[`01-road.md`](01-road.md) §一）；该格有道路图就轮不到它 |
| 骰子本体 | `die.body` | [`DiceHud.tsx`](../../../src/play/DiceHud.tsx)（46）、[`BattleDialog.tsx`](../../../src/play/BattleDialog.tsx)（38 掷骰中 / 30 定格）、[`TalkDialog.tsx`](../../../src/play/TalkDialog.tsx)（34）、[`DiceLog.tsx`](../../../src/play/DiceLog.tsx)（34 流水） | 五处 `.die` 盒共用一张；`🎲` 兜底时**也铺**（本体属于那个空骰盒，不属于某一次点数） |
| 骰面 | `die.face.d1`–`d6` / `numeric` | [`DiceLog.tsx`](../../../src/play/DiceLog.tsx) 的 `DieFace` | 四个调用处（HUD / 对话 / 对战 / 流水）共用同一份骰面逻辑，换面只此一处 |
| lucide 图标 | `misc.icons.<图标名>` | 入口 [`GameIcon.tsx`](../../../src/ui/GameIcon.tsx)；调用 [`LoadScreen.tsx`](../../../src/play/LoadScreen.tsx)（`Sword` 22 / `Hammer` 16 / `FileDown` 14、13 / `FileUp` 14 / `LibraryBig` 13）、[`GameScreen.tsx`](../../../src/play/GameScreen.tsx)（`Menu` 18 / `Flag` 16）、[`DiceHud.tsx`](../../../src/play/DiceHud.tsx)（`StepForward` 13）、[`DiceLog.tsx`](../../../src/play/DiceLog.tsx) / [`BagPanel.tsx`](../../../src/play/BagPanel.tsx) / [`EquipPanel.tsx`](../../../src/play/EquipPanel.tsx) / [`StatusPanel.tsx`](../../../src/play/StatusPanel.tsx)（`X` 14） | 键即 **lucide 图标名**（清单 `ICON_NAMES` 九个，[`lookup.ts`](../../../src/engine/skin/lookup.ts)）；缺图 / 缺位一律回退 lucide 原件 |

- **`mark.end` 与 `mark.footprint` 的「不共用」是刻意的**：脚印只在道路缺图的格子上出现，与终点标记无缘，故两者绝不会在同一格上争位。
- **图标按名给、不跨名借用**：配了 `Sword` 不会让同屏的 `Hammer` 跟着出图；**清单外的名字**（含 `🙂` / `✦` / `❔` / `🎲` / `🔒` 这五个兜底字形）配了也没有落点，静默搁置（§四）。

### 未接部分

- **内容 emoji 与兜底字形**（§四）：这两样**不是「未接」**——内容 emoji（职业 / 道具 / 怪物 / 技能）走 `role` / `item` 各节替换，兜底字形（`🙂` / `✦` / `❔` / `🎲` / `🔒`）按 §四 **永远不可覆盖**，与 `misc.icons` 无关。lucide 图标本批**已接**，见上表末条。
- **`node.building`**（§二）：**随格数拉伸**，必须九宫格（`KM-1`），V1 的 `drawTexture` 还没有 `slice` → 留到 **V1.1**（与容器衬底的九宫格同一批）。
- **NPC 槽位标记 `node.npcSlot`**（**V2.4**，裁决 66）：游玩态在建筑格上绘制 —— `role.npcs` 命中画皮肤、否则画**槽号色圆环**；**调色板是构建页与游玩态共用的一份**（[`../04-editor.md`](../04-editor.md) §5.6），保证"编辑页看到的颜色 ＝ 游玩态的颜色"。绘制层在棋子层之下（[`02-role.md`](02-role.md) §十一）。
- **引导线**（§五）：属**平铺**（`tile` 策略），V1 没有该策略 → 留到 **V2.2**。**当前的每 10 格定位线是程序绘制的虚线**，已在游玩菜单里给出开 / 关（裁决 27）。
- **骰子动画态 `die.rolling`**（§三）：**待确认 2 未裁决**，暂时沿用 `🎲` 兜底。
- **构建页**：`src/build/Canvas.tsx` 的起终点与脚印**不接**（与构建页画布 `background`、构建页 `.modal` 同一处理）。
- **加载屏封面的三枚装饰骰**（`.cover-die`，写死数字、并非 `DieFace`）**不接本体**：它们尺寸虽也是 46，却属于封面插画那一张图的事，归 `startup.bg`（[`08-pages.md`](08-pages.md)）；`die.body` 只管真正会变点数的骰盒。
- **校验项**：`KM-1` / `KM-2` / `KM-3` 都没落进校验层（`SkinIssueCode` 目前只有 `KP-*`），等汇总批统一接。
