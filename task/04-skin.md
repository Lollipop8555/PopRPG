# V2.1 / V2.2 — 素材皮肤（`.pp` / `.pgame`）与三件套

> **里程碑范围**：三件套容器（读取 / 导出 / 降级）＋ 素材取图与贴图渲染 ＋ 逐屏素材接入 ＋ Creative 模式 ＋ 皮肤校验（`KP-1`~`KP-10`）。
> **上层索引**：[`../TASK.md`](../TASK.md)　**设计依据**：[`../docs/design/00a-formats.md`](../docs/design/00a-formats.md)（三件套**上位规范**）、[`../docs/design/skin.md`](../docs/design/skin.md) ＋ `skin/` 各分节、[`../docs/design/07-decisions.md`](../docs/design/07-decisions.md) §8.1 / §8.2（**裁决 14–22 为本里程碑定稿依据**）
> **前置与优先级**：**V2.1 / V2.2，优先级 ②（低于 [`05-npc.md`](./05-npc.md) 的 V2.0）**。
> **版本切分**：**D0–D3 ＝ V2.1（SKIN 基础）**；**D4–D6 ＝ V2.2（SKIN 进阶：Creative 模式 / build 预览 pp / 校验清单）**；**D7–D8 ＝ 两版共用的验收与未决项**。
> 端到端验证依赖 Phase B 主体完成（地图 / 战斗 / 面板已在游玩态渲染）；**D0–D2 为类型、纯函数与 IO 层，可提前动工**，
> 与 V2.0 的编辑器侧（E0–E3）**无依赖、可并行**。
> **纪律**：素材是**可选叠加层**——任何一屏缺素材都必须照常渲染（[`../docs/design/skin.md`](../docs/design/skin.md) §一）；业务代码不得判断素材类型；取图必须是纯函数。

---

## D0 类型与取图纯函数（无 IO）

- [x] `src/types/skin.ts`：manifest 顶层 **16 项**——`format` / `name` / `author` / `description` / `startup` / `lobby` / `extends` / `theme` / `background` / `road` / `role` / `item` / `building` / `window` / `misc` / `audio`（裁决 19：`version → format`、`meta` 三键上提、`pages → startup / lobby`；裁决 22：`resource` 键废除；[`skin/00-package.md`](../docs/design/skin/00-package.md) §三），并在 `src/types/index.ts` 导出
- [x] 素材字段三写法类型：`string | { img, rotate? } | string[]`；数组顺序固定 `N / E / S / W`，不得省略中间项（[`skin.md`](../docs/design/skin.md) §五）
- [x] 衬底三元组 `background: { fill?, stroke?, img? }`，**`img` 优先于 `fill`**（`fill` 作透明区兜底）；字符串写法等价于只写 `fill`；**描边为独立设置项，未给 `stroke` 即不渲染**（裁决 18；[`skin/06-item-building.md`](../docs/design/skin/06-item-building.md) §二）
- [x] 画布 `background` 为**数组即逐图清单**：**第 `i` 张地图取 `background[i]`（无匹配 key）**，**只渲染这一层**；**地图数多于层数时越界地图降级为最后一层**；采用层素材不可用则向更靠前的层回退，全部不可用则本节未接管（继续按皮肤优先级降级，最终为默认配置）；画布级 `color` 只取**采用层**的值（裁决 17，修订 23；[`skin/05-canvas.md`](../docs/design/skin/05-canvas.md)）
- [x] `theme` 类型：CSS 变量名 → 值的映射；**布局 token（`--gap` / `--topbar-h` / `--play-topbar-h`）不允许覆盖**（裁决 19，取舍 `S-23`；[`skin/00-package.md`](../docs/design/skin/00-package.md) §3.3）
- [x] 取图纯函数置于 `src/engine/skin/`：`(格子状态, 素材表) → 素材标识 | 程序绘制形态`，无副作用、可单测（[`00c-guidelines.md`](../docs/design/00c-guidelines.md) §三）
- [x] 确定性单测：同一格子状态恒取同一张素材；并列时按各节兜底顺序（道路样式标签优先级＝非空优先 → 命中标签数降序 → 声明顺序，[`skin/01-road.md`](../docs/design/skin/01-road.md) §六）
- [x] **立绘 `portraits`（裁决 24 / 25 / 26）**：`role` 下新增 `portraits` 子节点（`player` / `classes.<组件 id>` / `monsters.<组件 id>` / **`npcs.<NPC 的 name>`**；字段 `img` ＋ 可选 `flip` ＋ 可选 **`hurt`**（受击图），**不接受数组**——**变体只认 `hurt` 一个具名字段、不做表情变体**）——**纯皮肤元素、`.pmod` 不设字段**；取图纯函数覆盖「职业立绘缺位 → 回退 `portraits.player` → 回退 emoji」链，怪物与 **NPC** 缺位**不跨同类借用**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §四）。**（V2.4 修订，裁决 66）**：`portraits.npcs` 的键由**组件 `id`** 改为 **NPC 的 `name`** ＋ 支持**通配键 `"*"`**（命中顺序 **精确 `name` → `"*"` → 不渲染**）；`npcs` 键与任一 `name` 都不重名却配了图 → 新增 **`KR-11`**
- [x] **NPC 棋子形象 `role.npcs`（裁决 26）**：`role` 下新增 `npcs` 子节点（结构与 `monsters` 一致、**不接受数组**）；缺位回退该 NPC `icon` emoji（[`skin/02-role.md`](../docs/design/skin/02-role.md) §三）。**（V2.4 改写，裁决 66）**：键由**组件 `id`** 改为 **NPC 的 `name`** ＋ 支持**通配键 `"*"`**（命中顺序 **精确 `name` → `"*"` → `icon` emoji**）；~~**地图上不绘制 NPC**~~ **作废**——**V2.4 起 NPC 有地图落点**（`skin/02-role.md` §4.1 **落点 6**）：`role.npcs` 命中 → 画**皮肤**，**未命中 → 画槽位色圆环**（颜色 ＝ 构建页该槽位行颜色，调色板**构建页与游玩态共用**，越界循环取色 **`KM-4`**，**不回退 emoji**）；绘制层在棋子层之下
- [x] **受击两法（裁决 25）**：`hurt` 素材优先；未提供则**形变**——棋子以**格中心**为基准、立绘以**底边**为基准，横向 ×1.15 / 纵向 ×0.9、约 `120ms` 回弹；**参数写死、不做逐素材配置**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.4）——**已接**：信号＝[`../src/ui/useHitPulse.ts`](../src/ui/useHitPulse.ts)（`hp` 掉下来的那一帧、`HIT_MS = 120`；换主体只挪基准），两条路在 [`../src/ui/Portrait.tsx`](../src/ui/Portrait.tsx) 的 `hurt` / `hit` 上收口，形变与基准在 [`../src/styles/theme.css`](../src/styles/theme.css) 的 `.portrait-hit` / `.piece-hit`（棋子用 `transform-box: fill-box` 把基准钉在格中心）
- [x] **立绘尺寸按窗口尺度（裁决 25）**：以**窗口短边** `W = min(视口宽, 视口高)` 为唯一尺度——底栏与状态面板 `6% W`、对战 VS 区 `18% W`、出身卡 `10% W`；宽度由素材宽高比推出并受「可用宽度 25%」上限约束；**固定像素档与 `@media` 断点均不再使用**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.2）

## D1 容器与加载（`.pp` / `.pgame`）

- [x] zip 读写能力：**引入 `fflate`**（裁决 14，`zipSync` / `unzipSync`，约 8 KB gzip，浏览器端零 Node 依赖）；**不自实现 deflate**；收口在 `src/io/zip.ts`（唯一接触 `fflate` 的文件），依赖边界登记于 [`../docs/design/08-deploy.md`](../docs/design/08-deploy.md) §9
- [x] `.pp` 解析（`src/io/pp.ts` 的 `readSkin`）：**强制项只有** `manifest.json`（**必须在包根**）与可选 `preview.png`（存在时须在包根）；**包内目录名 / 层级 / 文件名一律自由**，加载器按 manifest 各字段所写的**相对包根**路径逐条取条目——**不推断前缀、不假设目录约定**（裁决 19 / 22；[`00a-formats.md`](../docs/design/00a-formats.md) §2.1）
- [x] `.pgame` 解析（`src/io/pgame.ts` 的 `readPGame`）：`pack.json`（`format` / `kind` / `name` / `pmod` / `skin` / `entry`）＋ `game.pmod` ＋ `skin/`；**缺 `pack.json`** 时按约定文件名回退并提示 `KP-7`；缺少 `skin/` 时按「无皮肤」处理（裁决 19；§2.2 / §2.3）
- [x] `extends`（`pp.ts` 的 `manifestChain`）：**仅包内继承**（值为包内相对包根的 manifest 路径），逐节点覆盖（深合并、数组与标量整体替换），支持链式；环或路径不存在时忽略并提示 `KP-8`（§3.2）
- [x] `theme` 注入（`src/io/skin-theme.ts` 的 `applySkinTheme`）：加载时写到 `document.documentElement` 的内联样式（最高优先级），卸载时**逐键移除**；未知 token 与布局 token 忽略并提示 `KP-9`（§3.3）
- [x] 路径约束校验 `KP-4`（`src/io/skin-paths.ts`）：拒绝绝对路径 / `..` / `http(s)://` 外部地址；违规路径不再重复计入 `KP-2`
- [x] 版本迁移：`manifest.format` 为整数、缺省视为 `1`；读到更高版本照常渲染并在控制台警告一次（对齐 `src/io/pmod.ts` 的 `PMOD_VERSION` 处理）
- [x] 其余校验项：`KP-1`（包根无 manifest → 整包忽略）、`KP-2`（路径不存在 → 逐节点降级）、`KP-3`（`format` 过高）、`KP-6`（`preview.png` 无法解码 → 回退文件名）、`KP-9`（`theme` 无效键）、`KP-10`（含已废除的 `resource` 键 → 忽略该键，路径以各字段自身为准，裁决 22）；**`KP-5` 待 D6**——它需要「本局启用组件 id」，属跨模块上下文
- [x] 降级链按**单个素材节点**回落（`src/io/skin-runtime.ts`）：本局 `.pp` → 用户全局 pp（裁决 5）→ 程序绘制；同屏混用素材与程序绘制**不算缺陷**
- [x] **皮肤库（裁决 15）**：`src/io/skin-library.ts`（条目索引进 `localStorage`：`poprpg_skins`）＋ `src/io/idb.ts`（**包体二进制进 IndexedDB**，无 IndexedDB 时降级内存）；**游戏自带（`.pgame` 内）皮肤不入库**
- [x] **一次只解压一套（裁决 15 / 19）**：`skin-runtime.ts` 激活时先释放上一套，两层解压后立刻合并成**一份**条目表，中间结果不再被引用；切换即丢弃
- [x] 二进制选择与导出：`src/io/download.ts` 新增 `pickBinaryFile`（与 `pickTextFile` 共用一次弹窗）与 `downloadBlob`；导出走 `Blob` 下载
- [x] 皮肤**不写入** `.psave`（皮肤是渲染层；**不记录皮肤名**，裁决 15）（[`skin/00-package.md`](../docs/design/skin/00-package.md) §4.3）——D7 回归项

## D2 贴图渲染器

- [x] `drawTexture(target, src, box, opts)` 单一抽象；`opts = { mode: 'stretch' | 'nine' | 'tile', slice?, rotate?, flip? }`（[`skin.md`](../docs/design/skin.md) §四）——**落点**：`src/ui/Texture.tsx` 的 `textureProps(ref, assets, box, extra)` 为唯一入口（取图 → 落位 → 换地址，画不出来返回 `undefined`）；`target` 在 React 里体现为**选用哪个渲染器**，不做运行期分支
- [x] V1 只实现 `stretch`（`<image preserveAspectRatio="none">`）；`nine` / `tile` 仅预留参数位，V1 不解析九宫格（取舍 `S-1`；**切分工具**在 D4，但 V1 渲染不变，裁决 21）——**落点**：`src/engine/skin/texture.ts` 的 `effectiveMode()`（`nine` 要「策略 ＋ 切片」齐备才成立、否则回落 `stretch`；`tile` 独立成立）。**DOM 层的 `nine` 已提前落地**（D3 第十三屏）：新增 `surfaceMode(ref)`（素材带 `slice` → `nine`）＋ `src/ui/Texture.tsx` 的 `nineStyle()` 出 `border-image`，容器 / 按钮 / 格子 / 条 / 提示条 / 分隔线六处一次升级、调用方一行不动（[`skin/03-window.md`](../docs/design/skin/03-window.md) §八「九宫格」）；`tile` **已裁决不进本节**（裁决 29：分隔线走单轴九宫格，唯一候选＝定位线，见 `misc` 条）；**SVG 层（地图 / 画布 / 棋子）本批不动**
- [x] 渲染器为**纯函数 + 单一入口**：业务代码内**禁止**判断素材类型（不写 `if (is9Patch)`）——**落点**：几何与取图归纯函数 `src/engine/skin/texture.ts`（三写法归一 `spriteRef` / 单张 `textureRef`、绕心旋转镜像 `placeTexture`、角度归一），地址归 `src/io/skin-assets.ts`（按需建、`release()` 一次撤，裁决 15）；业务侧只拿 `TextureProps`
- [x] DOM 层（面板 / 弹窗）与 SVG 层共用同一调用接口（两侧实现可不同）——**落点**：同一份 `TextureProps` 两个实现——`SvgTexture`（`<image>`，绕盒心 `transform`）与 `DomTexture`（`<img>` 绝对定位，`rotate` / `scaleX(-1)` ＋ `transform-origin: center`，要求父元素 `position: relative`）
- [x] 位图素材**不套手绘滤镜**（`S-6`）；纸纹与手绘分隔线仍由 CSS 承担，素材接管时不得双层叠加（[`skin.md`](../docs/design/skin.md) §3.4）——**落点**：素材节点一律不写 `filter`（手绘滤镜只由程序绘制的图形显式加 `url(#poprpg-sketch)`），并统一 `pointerEvents: none`（素材不参与点击命中）

## D3 逐屏素材接入

> 覆盖清单逐屏对照 [`skin.md`](../docs/design/skin.md) §「覆盖清单（逐屏）」。每接入一屏，用同一份 `.pp` 验证「有素材 / 无素材」两种形态。

- [x] `road`：15 槽位 / 47 姿态 / 样式标签优先级（**已定稿**，按 [`skin/01-road.md`](../docs/design/skin/01-road.md) 实现）；缺图回退脚印 `src/ui/Footprint.tsx`——**落点**：邻接折算 `src/play/road.ts`（格子 → 四邻四角 → `roadFlag`，多格节点按占地全算、按左上格取图）、取图 `roadPickAt()`（标签取自道路定义，走 `pickRoadStyle`）、渲染 `src/play/MapView.tsx`（每格 `roadPickAt` → `textureProps` → `SvgTexture`，该格未接管即照旧画脚印；素材按 `cellSize` 正方形居中；屏幕一格恒为 `CELL`，**拉伸进一个屏幕格的倍率就是「屏幕每格像素 ÷ `cellSize`」**，与背景图（`05-canvas.md` §八）共用同一变换，故无需另算基准）。**构建页画布（`src/build/Canvas.tsx`）本轮未接**，仍画脚印
- [x] `role`：玩家棋子 / 职业形象 / 怪物形象 / **NPC 形象 `npcs`**（单格、无朝向；**~~地图上不绘制 NPC，其形象唯一落点是对话弹层~~ → V2.4 作废，见 D0 与 D7**：键按 NPC **`name`** ＋ 通配 `"*"`、新增**地图落点**（有皮肤画皮肤 / 无皮肤画**槽位色圆环**））＋ **立绘 `portraits`**（裁决 24 / 25 / 26）：底栏 hp/mp 左侧（**替代整个 `hud-face`**，缺位不占宽）、对战对话框顶部 **VS 区**（**任一方有立绘即渲染**，主角在左 / 怪物在右，缺侧留空、不补 emoji）、**对话弹层不设立绘区**（`S-29` 2026-09-29 修订，原裁决 26 的对话 VS 区作废；NPC 只占标题栏 `icon` 一格，取 `role.npcs.<NPC name>`——**V2.4 起为 `name` ＋ 通配 `"*"`**，`<id>` 口径作废；**地图上的 NPC 另按新落点绘制**，与本条无关）、出身卡职业立绘（**居中**替代 `.class-icon`）、状态面板头部（与底栏**同源同图**）；遭遇 / 商店弹层**仅预留不渲染**（`S-29`）；立绘按**窗口短边 `W`** 的比例缩放、**底边对齐**（仅出身卡居中）、**不用 `CELL` 基准**、**不套手绘滤镜**、**不参与点击命中**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §四）——**棋子形象与立绘均已接**：取图 `roleSprite()` / `portraitOf()` → `spriteRef()` / `textureRef()`；地图棋子 `role.player` 在 [`../src/play/MapView.tsx`](../src/play/MapView.tsx) 按**整格 ＋ 锚点格中心**出图（缺图仍画方框 ＋ 职业 `icon` emoji，**不借 `classes` 的图**；绿色定位环与形象无关、照旧画）；职业 / 怪物 / NPC 三处文字落点走**行内层** [`../src/ui/RoleGlyph.tsx`](../src/ui/RoleGlyph.tsx)（`.inline-texture` 的 `1em` 方框、`object-fit: contain` 等比内缩）；**立绘四落点**走 [`../src/ui/Portrait.tsx`](../src/ui/Portrait.tsx)——尺寸全在 CSS（`W = 100vmin` ⇒ `.portrait-hud/vs/card` 的 `6/18/10vmin`、宽度按素材宽高比、`max-width: 25%` 上限、默认底边对齐 / 出身卡居中），落点 ① 底栏 `.hud-vitals`（替代 `hud-face`；血蓝条包进 `.hud-vitals-main`）、④ 状态面板头（与 ① 同源同图）、② 对战 `.vs-area`（任一方有即整块渲染、缺侧留空）、⑤ 出身卡 `.class-card-head`（逐卡按职业查表、缺位回退 `player`），取不到图即 `null`（**不占位、不回退 emoji**）；**NPC 立绘仍不渲染**（`S-29`）；**受击表现**见下一条（`useHitPulse()` ＋ `.portrait-hit` / `.piece-hit`）
- [x] **受击表现**（裁决 25）：棋子与立绘**同一套规则**——有 `hurt` 素材即改显示 `hurt`，未提供则形变（基准：棋子＝格中心、立绘＝底边）；**`dead`（倒下）不设变体**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.4）——**已接**：对战 VS 区两侧**各管各的**（怪物锚 `monster.resources.hp` ＋ `monster.id`），底栏 / 状态面板 / 地图棋子锚**同一个主角 `hp`**；棋子那一层的形变**只包形象**，绿色定位环不跟着压扁；形象格的文字落点（`RoleGlyph`）不做形变
- [x] `window` **容器衬底**：对话框 / 抽屉 / 气泡三种**随视口族**容器（裁决 13 / [`skin/03-window.md`](../docs/design/skin/03-window.md) §二、§八）——**落点**：取图 `surfaceOf(win, kind)`（`src/engine/skin/lookup.ts`，`dialog` / `drawer` / `popover` 三键**不跨键借用**）、落图 `src/ui/Texture.tsx` 的 `surfaceStyle()`（**铺满容器背景**、`background-size: 100% 100%`、**不写 `background-color`**：底纹可带透明，纸面底色留给 CSS）、接线 `src/ui/useSurfaceStyle.ts`（`store/skin` 的素材源 ＋ `manifest.window` → 两个纯函数）；**三个落点**：`.modal`（战斗 / 对话 / 遭遇 / 菜单 / 结算 / 更新记录）、抽屉里四张 `.panel`（状态 / 背包 / 装备 / 骰流水）、`ui/Popover.tsx` 的 `.popover`；**未配该键或包里缺这张图即不传 `style`**、CSS 纸面照旧；按**组件**给不按类名给（`.panel` 是通用类名，出身卡网格等各有自己的节）；V1 一律拉伸，`nine` 落地时只改 `surfaceStyle()` 内部；**构建页 `.modal` 与 `LoadScreen` 的 `.load-cover` 不接**（后者封面归 `startup.bg`，已落地）
- [x] `window` **按钮 `normal` 态**（[`skin/03-window.md`](../docs/design/skin/03-window.md) §四、§八）：七个键按**元素角色**给、不按类名给、**不跨键借用**；四态对象以 `normal` 为必填，**缺 `normal` 即整颗按钮算没配**（其余三态的落法见下一条）——**落点**：取图 `buttonOf(win, kind)`（`src/engine/skin/lookup.ts`，键集合 `BUTTON_KINDS`）、落图**复用容器那份** `surfaceStyle()`（V1 与容器同档：`background-size: 100% 100%` 整体拉伸，圆角与描边仍归 `.btn` 的 CSS、§五「素材只提供纸面底纹」）、接线 `src/ui/useButtonStyle.ts`（`buttonOf()` → `textureRef()` → `surfaceStyle()`，与容器衬底**同一条取图链**、只多一步「从四态里挑 `normal`」）；**未配该键 / 包里缺这张图 / 未启用皮肤一律 `undefined`**、调用方**不传 `style`**、CSS 纸面照旧。**九宫格已落地**（素材带 `slice` 即走 `border-image`，`surfaceStyle()` 内部一处改完，两侧调用方一行不动）；**构建页 `.btn` 不接**
- [x] `window` **固定族格子**（技能格 / 奖励卡 / 背包格 / 部位标签；[`skin/03-window.md`](../docs/design/skin/03-window.md) §4.3、§八）：四个键按**格子角色**给、**不跨键借用**——**落点**：取图 `slotOf(win, kind)`（`src/engine/skin/lookup.ts`，键集合 `SLOT_KINDS`）、落图**复用容器那份** `surfaceStyle()`（固定族尺寸写死 → V1 整图等比拉伸，圆角与描边仍归格子自己的 CSS）、接线 `src/ui/useSlotStyle.ts`（`slotOf()` → `textureRef()` → `surfaceStyle()`，与容器 / 按钮**同一条取图链**）；**四个落点**：`SkillBar.tsx` 与 `BattleDialog.tsx` 的 `.skill-slot`（**两处共用 `skill`**）、`GainNoteView.tsx` 的 `.reward-card`（钩子提到 `compact` 早返回之前）、`EquipPanel.tsx` 的 `.equip-slot`、`BagPanel.tsx` 的背包格与穿戴格 `.bag-cell`；**未配该键 / 包里缺这张图 / 未启用皮肤一律不传 `style`**。**背包格是唯一的交叠处**：与 `item.background` 取「**道具衬底优先、格位底纹兜底**」（调用点写 `cell ?? bagSlot`，hook 本身不判别），两节**不会抢同一个落点**；**九宫格已落地**（素材带 `slice` 即走 `border-image`）；**构建页不接**
- [x] `window` **条 / 提示条 / 分隔线**（**随内容族与单向族**，[`skin/03-window.md`](../docs/design/skin/03-window.md) §4.4、§八）：**必须九宫格 / 单轴九宫格**（硬拉伸违反 `KW-3`），故**素材带 `slice` 才改铺法、不带即回落整图拉伸**（不是回落成 CSS）——**落点**：取图新增 `barOf(win, tone)`（`BAR_TONES = ['hp','mp']`）、`hintOf(win, tone)`（`HINT_TONES = ['ok','warn','error']`）、`ruleOf(win)`（只有 `rules.line`），一律**不跨键 / 不跨档借用**；**条多一层结构**——`bars.<档>` 一次给两张（`track` / `fill`），`src/ui/useBarStyle.ts` 返回 `{ track?, fill? }`（两张各自独立，只配一张不影响另一张）；提示条 `src/ui/useHintStyle.ts` 返回**单个**样式；分隔线 `src/ui/useRuleStyle.ts` 无参。**六个落点**：`StatusPanel.tsx` 的属性面板血蓝条（`Bar` 的 `tone` 由 `'hp' | 'mp'` 放宽为 `BarTone`）、`BattleDialog.tsx` 交锋弹层对手血条（与属性面板**同键**）、`GainNoteView.tsx` 的「没拿下」`.hintbox.warn`、`EncounterView.tsx` 的事件判定框（**同一个 `.hintbox` 按 `verdict` 换三档** → `success` / `blocked` / `fail`，故三档全部先取再挑一份，hook 不落条件分支）、`LoadScreen.tsx` 与 `StartScreen.tsx` 的警告条 ＋ 分隔线、`BagPanel.tsx` 的分隔线。**中性档（裸 `.hintbox`）不设键也不借用**——`MapView` 的空态提示与各构建页提示都不铺；**构建页不接**；`KW-1` / `KW-5` 的清单提示仍等校验层（`SkinIssueCode` 现只有 `KP-*`）
- [x] `window` **按钮三态**（`hover` / `active` / `disabled`；[`skin/03-window.md`](../docs/design/skin/03-window.md) §4.1、§八）：**四态各查自己的态、不跨键借用**，字符串写法等价于只写 `normal`；**没配该态 = 不写那对变量**（不是补一张 `normal` 顶上去）——**落点**：取图新增 `buttonStatesOf(win, kind)`（`BUTTON_STATES` 定序；`buttonOf()` 退化为它取 `normal` 那一项，老调用点一行不动）、落图新增 [`../src/ui/Texture.tsx`](../src/ui/Texture.tsx) 的 `buttonStyle(states, assets)`——`normal` 那份仍走容器链（行内属性），三态各按**自己那张图的铺法**落成一对 CSS 变量（`--sk-<态>-bg` 整图拉伸 / `--sk-<态>-bi` 九宫格简写，后者由 `nineShorthand()` 出、与 `nineStyle()` 的长写同义）、接线 [`../src/ui/useButtonStyle.ts`](../src/ui/useButtonStyle.ts)（`buttonStatesOf()` → `buttonStyle()`，**调用方一行不动**：变量与 `normal` 那份行内属性在同一个 `style` 对象里）；**为什么走变量**：行内写不出伪类，而 `.btn:hover` / `:active` / `:disabled` 是 CSS 的原生状态，故由 [`../src/styles/theme.css`](../src/styles/theme.css) 的三条规则按状态取用（`!important` 用于压过 `normal` 那份行内样式，**全文件仅此三处**），缺省链就写成 `var(--sk-hover-*, var(--sk-normal-*))`——**该态没配、或该态的图不在包里，都自然回落 `normal`**；`normal` 缺位时一对变量都不会有；构建页 / 未启用皮肤 / 没配该键时三条规则一律取到 `none`，与纸面 `.btn` 等价。`KW-6` 随之作废，`KW-7`（四态尺寸一致性）仍待校验层
- [ ] `window` §四.2 **信息图标组合**（裁决 12）：`background` 衬底在下 ＋ `icon` 居中在上；名称与说明文字走**窗体自身**字体字色，**不读** `building.font` / `fontColor`
- [x] `misc` **地图标记 ＋ 骰子**：起点 / 终点 / 脚印与骰子本体 / 骰面（[`skin/04-misc.md`](../docs/design/skin/04-misc.md) §二、§三、§十）——**落点**：取图 `markOf(misc, kind)`（`start` / `end` / `footprint` 三键**不跨键借用**）、`dieBodyOf()`（一张通吃 46 / 38 / 34 三档）、`dieFaceOf(misc, pips)`（`1`–`6` → 点阵，**其余点数一律 `numeric`**）；**标记**走 SVG 层、盒＝**整格**（与道路同一约定，图形自己居中留白；原程序绘制旗 / 叉占格 86%、脚印 60%），落点 `src/play/MapView.tsx`（**脚印只在 `road` 缺图时**顶替 `<Footprint>`）；**骰子本体**走 CSS 背景 `surfaceStyle(…, 'contain')`（等比进 `.die` 盒、绝**不拉伸**），五处 `.die` 盒共用一张（HUD 46 / 对战 38 掷骰中 ＋ 30 定格 / 对话 34 / 流水 34）；**骰面**走行内层 `InlineTexture` ＋ `.die-face`（尺寸随本体），四个调用处共用 `src/play/DiceLog.tsx` 的 `DieFace`；**缺图一律回退程序图形**（旗 / X / 脚印 / 点阵 / 数字文本），贴图不套手绘滤镜；§三 的镜像 / 旋转复用由包里对象式显式声明、**默认不启用镜像**；**构建页 `src/build/Canvas.tsx` 不接**
- [x] `misc` **图标（按名索引）**（[`skin/04-misc.md`](../docs/design/skin/04-misc.md) §四、§十）：`misc.icons.<lucide 图标名>`——**落点**：取图 `iconOf(misc, name)`（`src/engine/skin/lookup.ts`，清单 `ICON_NAMES` 九个名字；**不跨名借用**，清单外名字静默搁置）、落图走**行内层** `InlineTexture`（与内容 emoji 同一档：**不套手绘滤镜、不加衬底**；素材占 lucide 那档 `size × size` 的盒 → **换与不换都不动布局**）、入口组件 `src/ui/GameIcon.tsx`（`name` / `icon` / `size`，未配 / 缺图 / 未启用皮肤一律原样回退那个 lucide 元件）、接线 `src/ui/useIconSkin.ts`（`iconOf()` → `textureRef()` → `textureProps()`）；**落点八个文件、九个名字**（加载屏 `Sword` / `Hammer` / `FileDown` / `FileUp` / `LibraryBig`、顶栏 `Menu` / `Flag`、骰子 `StepForward`、四面板关闭 `X`）；**内容 emoji**（职业 / 道具 / 怪物 / 技能）不归这里、走 `role` / `item` 各节；**兜底字形** `🙂` `✦` `❔` `🎲` `🔒` **永远不可覆盖**；**构建页不接**
- [ ] `misc` 其余：**建筑节点 `node.building`**（随格数拉伸、**必须九宫格** `KM-1`，V1 无 `slice` → **V1.1**；**已被用作 `building.img` 缺位的回退通用件**、按**普通拉伸**顶替，见 `item` / `building` 条）/ **引导线**（＝**定位线**，属**平铺** `tile`，V1 无该策略 → **V2.2**；**当前位置线是程序绘制的虚线，游玩菜单已给出开 / 关**——`MapView` 的 `guides`，裁决 27）/ 骰子动画态 `die.rolling`（**待确认 2** 未裁决，暂用 `🎲`）；`KM-1`–`KM-3` 的清单提示等校验层（`SkinIssueCode` 现只有 `KP-*`）
- [x] `background`（画布）：**下标一一对应、每张地图只渲染一层** / 越界降级为最后一层 / 图点与格 `[0,0]` 中心对齐 / 跟随 `cellSize` 缩放 / 图外填充色取**采用层**的值 / 无可用层即默认配置（裁决 17，修订 23；[`skin/05-canvas.md`](../docs/design/skin/05-canvas.md)）——**落点**：取层与落位归纯函数 `src/engine/skin/canvas.ts`（`backgroundUsable()` 判掉 `KB-1`、`backgroundOf()` 吃 `available` 判掉 `KB-2` 并向前回退、`backgroundPlacement()` 出倍率与左上角落点）；渲染在 `src/play/MapView.tsx`（底纹色取采用层 → `translate/scale` 的 `<g>` 里一张背景图 → 参照线 / 道路）；图**按素材自身像素**出图（取图盒 `w/h: 'auto'`，SVG 层不写 `width`/`height`），故无需解码量尺寸。**构建页画布（`src/build/Canvas.tsx`）本轮未接**，仍画纸面底纹
- [x] `item` / `building` **（`item` 全落；`building` 落地图节点）**：**取图** `itemSkinOf()` / `buildingSkinOf()`（键一律组件 `id`、**不跨键借用**）、`groundPaint(field, fallback?)`（字符串＝只写 `fill`；**三项全空即整节未接管**、判的是原字段）、`buildingImgOf(building, misc, id)`（`building[<id>].img ?? misc.nodes.building` 全篇唯一跨节回退，节点查不到组件时不拿空串撞键）；**衬底落法** `Texture.tsx` 的 `groundStyle()`——`img` → 背景图（`100% 100%`）、`fill` → 背景色、`stroke` → `border-color`，**未给 `stroke` 写 `transparent` 只为不改盒尺寸**，整节未接管即不传 `style`；**道具**走 `ui/ItemGlyph.tsx`（行内层 `InlineTexture`／缺图原样输出 `icon` 字形），落点 `play/BagPanel.tsx` 的背包格 ＋ 穿戴格（`.bag-cell` 衬底，`fill` 兜底＝组件 `color` → `fallbackColor(id)`）与 `play/EquipPanel.tsx` 的穿戴行 ＋ **更换气泡候选**，**`bag-name` 字体字色不接**（归窗体）；**建筑**在 `play/MapView.tsx` 的 `NodeShape`——`img` 可用即 `<g rotate(-0.6°)> ＋ SvgTexture` **整图替换 `rect`**（`+3 / −6` 保留 3px 内缩，`S-9`）且**不再画图标字形**，未出图时 `background` 接管 `rect`（`fill` α0.42、**`stroke` 缺省即 `transparent` ＋ `stroke-width: 0`**，裁决 18），两件都缺即程序绘制照旧；名称 `fontColor` 与 `font`（`ui/skinFont.ts` 的 `usePackFont()`：包内文件注入 `@font-face`、族名取文件名去扩展名，**内置字体名原样交给 CSS、缺文件回退内置字体** `KIB-4`；字号固定 11px，`S-10`）。**未接**：物品／建筑**信息视图**与**组件库**（等 `03-window.md` §四.2 与构建页排期）、`KIB-*` 校验层（`SkinIssueCode` 现只有 `KP-*`）、`misc.nodes.building` 的**九宫格**（`KM-1` → V1.1）。**背包格上 `item.background` 与 `window.slots.bag` 的关系已定**（道具衬底优先、格位底纹兜底，见上面的 `window` 固定族格子条 / [`skin/03-window.md`](../docs/design/skin/03-window.md) §4.3）
- [x] `startup` / `lobby`：APP 欢迎页与游戏首页／选角页面，**首页封面图归皮肤侧**（`bg`，`.pmod` 不设字段）；字体与字色**不由**这两节接管（裁决 20；[`skin/08-pages.md`](../docs/design/skin/08-pages.md)）——**落点**：取图 `pageFitOf()`（`cover` / `contain` / `tile`，**非法值与缺省一律回退 `cover`**，`KPG-1`）、`pageBgOf()`（两屏**各查自己那一节的 `bg`、互不借用**）、`startupArtOf(startup, art)`（`title` / `cover` / `dice` 三键一个入口）、`lobbyCardPaint(lobby, selected)`（`selected.img` 缺位**沿用卡底**、`stroke` 只在选中态给）；**整屏背景**落法 `Texture.tsx` 的 `pageBgStyle(ref, assets, fit)`——`cover` / `contain` → `background-size` 同名值 ＋ `no-repeat`，`tile` → `auto` ＋ `repeat`，一律居中，**只写 image 与铺法、不动 `background-color`**（`contain` 留的边由主题底色兜着，`S-26`）；**欢迎页** `play/LoadScreen.tsx`——整屏背景落 `.play-shell.no-topbar`（不是带留白的内层 `.load-cover`）、`title` 走**行内层** `InlineTexture`（盒 `CSS_SIZED_BOX`，尺寸交给新增的 `.cover-title .cover-title-art`：高 `0.86em`、宽由素材宽高比推出、绝不拉伸；**文案不变、落在 `alt`**，`S-14`）、`cover` 用 `SvgTexture` 整块替换洞穴手绘（复用现成 `<svg class="cover-cave" viewBox="0 0 120 92">` 当盒）、`dice` 只给**本体**（`surfaceStyle(…, 'contain')`，与 `misc.dice.body` 同档）＋ **骰面复用 `misc.dice`**（直接渲染 `DieFace`，本节**不另设骰面字段**，`KPG-4`；没配骰面仍是程序数字面，缺省观感不变）；**游戏首页** `play/StartScreen.tsx`——`bg` 落 `.play-shell.start-screen`、`panel` 落 `.panel.scroll`（V1 拉伸）、`card` 落每张 `.class-card`（`img` 铺满整卡、`stroke` **只写选中那一张**、未选中**不碰** `border-color` 交还 CSS）；接线 `ui/usePageSkin.ts`（`useStartupBgStyle` / `useLobbyBgStyle` / `useLobbyPanelStyle` / `useLobbyCardStyle` / `useStartupArt` / `useStartupDiceBody`）。**未接**：封面标语 / 副标题 / 版本号 / 警告条的文字字体（`S-15`）、职业图标与立绘（归 `02-role.md`）、按钮与徽章（归 `03-window.md`）；`card` / `panel` 的 `slice` **九宫格已随 D3 第十三屏生效**（都走 `surfaceStyle()`，`panel` 的 `pageSkin` 测试标题已随之改写），`dice` 走 `contain` 铺法、不受切片影响
- [x] `audio`：**V1 只解析与校验**——识别字段、路径与 `volume` 校验、清单提示；**不加载／不解码／不播放**，播放整体排 **V2.2**（裁决 16；[`skin/07-audio.md`](../docs/design/skin/07-audio.md)）——**已接**：取值与校验归纯函数 [`../src/engine/skin/audio.ts`](../src/engine/skin/audio.ts)（`bgmOf` / `sfxOf` 原值、`bgmTrackOf` / `sfxTrackOf` 收成 `{ file, loop?, volume }`、`clampVolume` 越界夹回；缺省 `0.5` / `true` / `0.8`；`unknownSfxEvents` 出 `KA-2`、`outOfRangeVolumes` 出 `KA-3`），体积（`KA-4`）在 [`../src/io/pp.ts`](../src/io/pp.ts) 的 `checkAudio()`（要读包内条目、同一文件只报一次、阈值 2 MB）；`SkinIssueCode` 新增 `KA-2` / `KA-3` / `KA-4`，**`KA-1` 不单列**（归 `KP-2` 的通用收集）、`KA-5` 待 V2.2；**全程无声音**

## D4 Creative 模式（第三个顶层模式）

> **已接**（2026-09-30）：`#/creative` 三支路由 ＋ 页面三栏 ＋ 中栏三页；工程状态、靶子/骨架、槽位与绑定、九宫格切分、还缺哪些图（含路面填图板与内置画图）、预览、打包/解包、导入入库全部落地，实现落点见 [`skin/09-creative.md`](../docs/design/skin/09-creative.md) §六。
> **剩余两处**（**不臆造数据/不越设计**，故留白并记待办）：
> ① 「目标尺寸 / 是否成整倍数」需要一份**目标尺寸表**（文档只有尺寸行，无机器可读数据）——当前检视器只给缩略图 ＋ **原始尺寸**；
> ② 九宫格面板的**分区高亮实时预览**与「可拖尺寸的拉伸预览框」未落地（拖线/填数/黑边识别/成对校验/另存九张已在）。

- [x] 路由与模式入口：[`../src/app/router.ts`](../src/app/router.ts) 扩为 `Route = 'play' | 'build' | 'creative'`（`#/creative`），入口挂在构建页顶栏菜单（与游玩页并列），创意页顶栏亦可互达
- [x] 新建：空白骨架（`blankManifest()`）；或**从 `.pmod` 生成骨架**（[`../src/creative/target.ts`](../src/creative/target.ts) 的 `readPmodTarget()` 读出该局启用组件与地图用到的全部道路 flag，`skeletonManifest()` 逐槽位生成空值待填条目）
- [x] 打开：`.pp`（zip，`fflate` 解包）＋ **本地目录**（`pickDirectory()` → [`../src/creative/package.ts`](../src/creative/package.ts) `readSkinDirectory()`，剥掉公共顶层目录后走**同一条** `readSkinEntries()`）；导入：与用户皮肤**逐节点**合并（`mergeManifest()`，同名以导入者为准）；**导入即入皮肤库**（`createSkinLibrary().add()`，**不自动启用**），导出产物不自动入库
- [x] 导出：`.pp`（`packSkin()`）；或 `.pgame`（`packPGame()` —— `pack.json` ＋ 当前 `.pmod` ＋ 当前皮肤）——**打包/解包统一走 `fflate`**（裁决 14 / 19）
- [x] 素材绑定：拖入图片按 `<元素>_<变体>.<ext>` 建议名自动匹配槽位（先精确后宽松，`matchSlot()`），未识别者进「未绑定素材」暂存区；绑定即写回 manifest（写**相对包根**路径）、不复制文件内容；检视器同屏给缩略图 ＋ **原始尺寸**（目标尺寸/整倍数见上方待办①）
- [x] **九宫格切分工具（裁决 21）**：[`../src/creative/NineSlicePanel.tsx`](../src/creative/NineSlicePanel.tsx) ＋ [`nine.ts`](../src/creative/nine.ts) —— 导入整图 → 拖四根参考线（上／右／下／左）或直接填数 → 显示**原始像素尺寸**与九格数值、黑边识别、四边成对校验 → 写回 `slice` ＋ 可另存九张切片（分区高亮与可拖预览框见待办②）；**不改变 V1 的拉伸渲染**
- [x] 还缺哪些图：**已命中 / 走通用 / 程序绘制**三类清单（[`hits.ts`](../src/creative/hits.ts) ＋ `HitCheckPanel.tsx`），「程序绘制」列为缺图清单并给出建议文件名；道路改为**路面填图板**（[`RoadBoard.tsx`](../src/creative/RoadBoard.tsx)，15 种形状按连通条数分组进一整幅：虚线示意与哪些邻格连通、连通邻格里叠同一张图、点格直接填图）
- [x] 画图窗口（[`paint.ts`](../src/creative/paint.ts) ＋ [`ImageEditor.tsx`](../src/creative/ImageEditor.tsx)）：右栏每一行素材都能直接画 / 改——像素工具（画笔 / 橡皮 / 油漆桶 / 吸管）＋ 形状工具（直线 / 矩形 / 椭圆，可实心）＋ 撤销重做 / 像素网格 / 改画布大小 / 清空；「每改一笔就更新工程」开着时，松手即写回同一包内路径，预览与缩略图立刻更新（算法是纯函数，单测见 `src/creative/__tests__/paint.test.ts`）
- [x] 预览：被编辑工程 ＋ 靶子 `.pmod`（[`CreativePreview.tsx`](../src/creative/CreativePreview.tsx)）：靶子 → `startSession()` → **复用游玩页 `MapView`**（以入参覆盖 manifest/素材，不写全局皮肤）；「只看素材」开关（`MapView` 的 `onlyAssets` 脱掉程序绘制兜底）
- [x] Creative 编辑器自身 UI **不接管素材**（避免自举循环，取舍 `S-18`）——只用程序绘制样式与 lucide 图标，素材只出现在预览与槽位缩略图
- [x] 存储：[`../src/store/creative.ts`](../src/store/creative.ts) `persist`（`localStorage` 键 `poprpg_creative`，只存描述与素材清单）＋ 素材字节走 IndexedDB（与皮肤库同一套 `BlobStore`），与 build 项目同级；导出时才打包；打开高版本包时 `mergeManifest()` 深合并**保号不降级**
- [x] 除九宫格切分与**基础画图窗口**外不内置其它图片编辑（裁剪构图 / 抠图 / 改色 / 生成 `.9.png` 黑边，`S-16`）；**字体不做子集化**，原样打包、超大仅提示（裁决 21，`S-27`）

## D5 build 模式加载 pp（仅预览）

> **已接**（2026-10-10）：顶栏「⋯」菜单进入整页面板 [`src/build/SkinPreview.tsx`](../src/build/SkinPreview.tsx)，把一份 `.pp` **顶进游玩态地图的覆盖入参**（与创意模式预览同一套代码）——**不写全局皮肤**，故编辑器自身（顶栏 / 面板 / 弹层）与游玩页都不受影响。工程内容只读，导出仍走原路径。

- [x] build 加载 `.pp`：**仅地图视图与预览用组件**按素材渲染，用于验证「素材与地图是否对得上」——**落点**：运行期 store [`src/store/skinPreview.ts`](../src/store/skinPreview.ts)（`open` / `loaded` / `skin` / `assets` / `issues` / `source`；`load()` 先释放旧素材源再交新的，`clear()` 卸下并释放，**不入 `localStorage`**）；面板把 `scenarioFromProject()` → `startSession()` 起一局，再以 `manifest` / `assets` / `onlyAssets` **覆盖入参**顶进 [`src/play/MapView.tsx`](../src/play/MapView.tsx)，「只看素材」开关脱掉程序绘制兜底；入口见 [`src/build/TopBar.tsx`](../src/build/TopBar.tsx) 的「皮肤预览」、装配见 [`src/build/BuildApp.tsx`](../src/build/BuildApp.tsx)
- [x] **不改导出结果**：加载 pp 前后导出的 `.pmod` 完全一致（回归项）——**落点**：面板只读工程快照（`librarySnapshot()` / `projectSnapshot()`），导出仍走 `exportCurrentPmod()`；回归用例 [`src/build/__tests__/skinPreview.test.ts`](../src/build/__tests__/skinPreview.test.ts) 断言加载前后 `exportPmod()` 文本 / `missing` / `renamed` 一致且 `projectSnapshot()` 一字未动，并断言预览皮肤**只落预览 store**（全局运行期皮肤不受影响）；面板渲染用例见 [`src/build/__tests__/skinPreview.test.tsx`](../src/build/__tests__/skinPreview.test.tsx)

## D6 校验接入「清单」

> **已接**（2026-10-10）：皮肤校验器 [`src/check/skinValidate.ts`](../src/check/skinValidate.ts)（**纯函数**：读入参的**皮肤条目 ＋ 组件库 ＋ 工程**，不碰 store）汇总加载期 `KP-*` / `KA-*` 与「须对照组件库 / 本局工程」的各节码；[`src/check/validate.ts`](../src/check/validate.ts) 的 `validateProject()` 新增可选 `SkinContext` 并并入结果，[`src/build/Checklist.tsx`](../src/build/Checklist.tsx) 取「预览皮肤优先、回退全局启用皮肤」两处来源。
> **注册即真会产出**：只登记能判的码；需解码像素的 `KR-4` / `KR-8` / `KM-2` / `KIB-3` / `KB-4` / `KB-5` 一支与规范未定的 `KW-2` / `KW-3` 暂不产出（口径见 [`src/types/skin.ts`](../src/types/skin.ts) 的 `SKIN_ISSUE_CODES` 注释）。

- [x] `KP-1`~`KP-10` 接入 `src/check/validate.ts`，在 `src/build/Checklist.tsx` 汇总显示；**全部为提示，不阻断导出**（**不设皮肤体积硬上限**，裁决 15）——**落点**：加载期码由 [`src/io/pp.ts`](../src/io/pp.ts) 收下、原样并入 `SkinIssue[]`；`KP-5`（无效键汇总）与各节明细共用一份判据（`badKeys`，取 `project.enabledIds` 启用集）
- [x] 各节明细校验项登记——**落点**：`skinValidate.ts` 逐节产出 **`KB-1` / `KB-3` / `KB-6`~`KB-9`**（画布背景，`05-canvas.md` §五）、**`KR-1`~`KR-3` / `KR-5`~`KR-7` / `KR-9`~`KR-11`**（角色与立绘，含 `KR-11` 的 `name` ＋ 通配口径，`02-role.md` §八）、**`KS-1` / `KS-3`~`KS-7`**（道路）、**`KW-1` / `KW-4` / `KW-7`**（容器与控件）、**`KM-1` / `KM-3`**（标记与骰子）、**`KIB-1` / `KIB-2` / `KIB-5`~`KIB-7`**（道具与建筑，`enabledIds` 启用集判定）、**`KPG-1`~`KPG-6`**（欢迎页与首页，含 `KPG-6` 旧 `pages` 键迁移提示）；码表与标题见 [`src/types/skin.ts`](../src/types/skin.ts)（`KM-4` 已由 `slotColor()` 循环取色天然满足，**不产出**）
- [x] 皮肤校验只在加载了 `.pp` 时出现；未加载皮肤时清单内容与现状一致——**落点**：`Checklist.tsx` 仅当「预览已加载」或「存在全局启用皮肤及其提示」时才传 `SkinContext`，否则传 `undefined`；整包被忽略（`KP-1`，`skin` 为 `undefined`）时**只回加载期提示**（无 manifest 可判）

## D7 验收（原子项）

- [ ] 完全不加载 `.pp`：全流程渲染与现状一致，无报错、无空白
- [ ] 只有 `road` 一节的 `.pp`：地图道路走素材，其余元素仍程序绘制
- [ ] `item.background.img` 生效：背包格显示衬底图（`img` 覆盖 `fill`）；**只给 `fill` 不给 `stroke` 时不出现描边**（裁决 18）
- [ ] 背景按下标一一对应（**每图单层**）：皮肤背景 2 层 ＋ pmod 4 张地图时，第 1、2 张地图各取下标 0 / 1，**第 3、4 张地图（越界）都取最后一层（下标 1）**——**任何情况下画布上只有一层背景图**（裁决 23 回归项）
- [ ] 无可用背景：`background` 缺失／为空时该地图走**默认配置**（程序绘制纸面底纹）并提示 `KB-6`；层数多于地图数时末尾层不生效并提示 `KB-7`，均无报错（裁决 23）
- [ ] `manifest.json` 缺失的 `.pp`：整包被忽略并提示 `KP-1`，游戏照常渲染
- [ ] `KP-4`：含 `../` 或 `http://` 的素材路径被拒绝并提示
- [ ] 旧写法 `resource` 前缀拼接不再生效：写 `"bg.jpg"` 的包取不到条目并提示 `KP-2`（路径必须相对包根，裁决 19）
- [ ] **目录结构自由（裁决 22）**：同一份 manifest 把素材整体移到其它目录名下（如 `assets/`）并同步改路径后，加载与渲染结果完全一致；含旧 `resource` 键的包照常加载并提示 `KP-10`
- [ ] **立绘 · 底栏（裁决 24 / 25）**：配置 `portraits.player` 后，底栏 hp/mp 左侧显示立绘且**原 `hud-face`（职业 emoji ＋ 职业名）不再出现**；**未配置立绘时底栏渲染与现状逐像素一致**，立绘位**不占宽**（无空盒、无占位）；立绘高度＝**窗口短边 `6% W`**，**改变窗口尺寸时立绘等比跟随**
- [ ] **立绘 · 对战 VS 区（裁决 24 / 25）**：**任一方有立绘即渲染**整个 VS 区（主角在左、怪物在右、中间「VS」为文字），缺失的一侧**留空且不回退 emoji**；**双方都无立绘时 VS 区整体不渲染**；写 `flip: true` 的立绘**左右翻转但不改变站位**；立绘高度＝ **`18% W`**、**底边对齐**
- [ ] **对话弹层不设立绘区（`S-29` 2026-09-29 修订）**：踩到 `encounter: talk` 建筑进入对话弹层时，弹层只有**标题栏 ＋ 台词 ＋ 选项**——不出现任何立绘、不出现 VS 区；NPC 只占标题栏 `icon` 一格（`role.npcs.<NPC name>`，**V2.4 起为 `name` ＋ 通配 `"*"`**，缺位回退该 NPC `icon` emoji）
- [ ] **立绘 · 其余落点（裁决 24 / 25）**：出身卡内职业立绘**居中替代** `.class-icon`（高度 `10% W`），缺位回退 `cls.icon` emoji；状态面板头部与底栏**同源同图**；**遭遇 / 商店弹层始终不出现立绘**（`S-29` 仅预留）；`portraits.*` 写成数组时按 `KR-7` 提示且不渲染
- [ ] **受击两法（裁决 25）**：同一素材分别验证——提供 `hurt` 时受击瞬间显示受击图（与 `img` 不同宽高比时提示 `KR-9`）；**未提供 `hurt` 时发生形变**（棋子以格中心、立绘以底边为基准），幅度与时长**写死、不随素材变化**；`dead` 不设变体
- [ ] **NPC 形象与立绘（裁决 26，`S-29` 修订；V2.4 裁决 66 改写）**：`role.npcs` 生效时按 **NPC 的 `name`** 取图（**先精确 `name`、再通配 `"*"`**），未命中回退该 NPC `icon` emoji；`portraits.npcs` **当前无落点**（对话弹层不设立绘区），仍参与 `KR` 校验（拿 `hero_stand.png` 冒充 NPC 立绘提示 `KR-10`；`npcs` 键与任一 `name` 都不重名却配了图 → **`KR-11`**）
- [ ] **NPC 地图落点（V2.4，裁决 66；原「NPC 不占地图格」作废）**：加载含 NPC 槽位的 `.pmod` 与皮肤后，地图上按各槽 `at` 绘制 NPC——**`role.npcs` 命中 → 画皮肤**（单格、无朝向、层在棋子层之下）；**未命中 → 画槽位色圆环**（颜色 ＝ 构建页该槽位行颜色，调色板**构建页与游玩态共用**，槽号 ≥ 色数即循环取色）；**玩家与 NPC 重叠时 NPC 仍可见**、**NPC 之间不重叠**；对话弹层**不受影响**（NPC 仍只占标题栏 `icon` 一格）
- [ ] `.pgame` 一次加载游戏与皮肤；缺 `pack.json` 时按约定文件名回退（`KP-7`）；缺少 `skin/` 子目录时按「无皮肤」启动
- [ ] 皮肤库：导入两份 `.pp` 后列表有两条、包体在 IndexedDB；**切换皮肤后旧皮肤的解压结果被释放**（裁决 15）
- [ ] 本局 `.pp` 与用户全局 pp 并存：被覆盖节点取本局，未覆盖节点取全局
- [ ] `theme` 生效且越权被忽略：改 `--paper` 生效，改 `--gap` 被忽略并提示 `KP-9`
- [ ] 按钮配置写有四态：`normal` 落**行内**属性，`hover` / `active` / `disabled` 各落**一对 CSS 变量**（没配的那态**不写**），真浏览器里悬停 / 按下 / 禁用各换各的图；**没配该态的观感与完全不写四态时逐像素一致**（缺省链回落 `normal` ＋ CSS 表现）
- [ ] 建筑信息视图：`building.background` 生效，文字仍为窗体字体字色（裁决 12 回归项）
- [ ] `audio` 字段被解析并校验：清单能看到路径/音量提示（`KA-2` / `KA-3` / `KA-4`，裁决 16）
- [ ] **音频播放（V2.2）**：首次用户交互后 BGM 起播并按场景切换（首页／地图／战斗，各 600ms 淡出淡入）；8 个 SFX 触发点各自发声；音量与静音写入 `localStorage`（`poprpg_audio`）并跨刷新恢复；未启用皮肤或该场景无曲时静默、不报错
- [ ] Creative 九宫格切分工具：拖四根参考线后写回的 `slice` 落在 manifest 中，V1 渲染仍为拉伸（裁决 21）
- [ ] Creative 全链路：从 `.pmod` 生成骨架 → 绑定素材 → 导出 `.pp` → 在 play 加载，观感与预览一致
- [ ] `npm run build`（tsc 无错）＋ `npx vitest run` 全绿
- [ ] `npm run dev` 人工手测一次：zip 读取、`.pp` / `.pgame` 导出下载在真浏览器可用

## D8 未决项（未裁决前不动工）

- `Q26` BGM 是否需要「按地图」；`Q28` 是否允许跨包 `extends`（按皮肤名继承）；`Q29` `.pgame` 的 `pack.json.entry` 取值语义。
- **裁决 25 / 26 遗留**：VS 区「VS」字样是否素材化；`W` 的三个比例值（底栏 6% / VS 区 18% / 出身卡 10%）与宽度上限 25% 是否合适；受击形变参数是否需**逐素材可调**（`S-32`）；败北 / 倒下是否需 `dead` 变体。~~**NPC 立绘是否需要对话之外的落点**~~ → **已裁决（V2.4 裁决 66）**：**NPC 的棋子形象新增地图落点**（有皮肤画皮肤 / 无皮肤画槽位色圆环），但**立绘仍只在对话弹层标题栏 `icon` 一格**（`S-29` 不变）。见 [`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §4.1 落点 6 / §4.3 / §十。
- 另有非本里程碑的排期项：建筑信息视图是否进 V1（[`../docs/design/skin/06-item-building.md`](../docs/design/skin/06-item-building.md) §六）、是否需要「加载中」过程屏（[`../docs/design/skin/08-pages.md`](../docs/design/skin/08-pages.md) §六）。
- 汇总见 [`../docs/design/skin.md`](../docs/design/skin.md) §八；三件套侧的同源项见 [`../docs/design/00a-formats.md`](../docs/design/00a-formats.md) §七（任一项裁决后两处必须同步）。

---

## 进度同步

**2026-09-29 · 末轮裁决 14–21 并入设计与本清单**
- 裁决 14（`Q12`）zip 读写＝引入 `fflate`（读＋写，约 8 KB gzip，满足 GH Pages 纯静态）；裁决 15（`Q17`）导入过的 `.pp` 入库、运行时**一次只解压一套**、切换即清空、不设体积上限、`.psave` 不记录皮肤名；裁决 16（`Q20`）音频**不进 V1**（字段定稿为预留，**V2.2** 实现）；裁决 17（`Q21`）背景数组**多层叠加**（**已由裁决 23 修订为按地图下标一一对应、单层渲染**）；裁决 18（`Q22`）描边为**独立设置项**、缺省不渲染；裁决 19（`Q23`）包内布局定稿（`pack.json` / `preview.png` / **路径相对包根** / `format` / `extends` / `theme`）；裁决 20（`Q24`）`pages` 拆为 `startup` / `lobby`、封面图归皮肤；裁决 21（`Q25`）Creative **提供九宫格切分工具**、字体不子集化。
- 待办清单已按上述裁决改写：D0 类型（17 顶层键）、D1 容器（`fflate` / `pack.json` / 皮肤库 / 单套解压）、D3 逐屏（多层背景 / 描边 / `startup`+`lobby` / 音频只解析）、D4（切分工具）、D6（`KP-1`~`KP-9`）与 D7 验收项。

**2026-09-29 · 裁决 22 并入本清单（包内目录不设强制结构）**
- 强制结构收敛为两项：`manifest.json`（包根）与可选 `preview.png`（包根）；**素材的目录名 / 层级 / 文件名一律自由**，`resource/<节>/` 降为推荐约定。
- 加载器改为**按 manifest 各字段所写的相对包根路径逐条取条目**（不推断前缀、不假设目录约定）；`resource` 键废除，新增校验项 `KP-10`。
- 清单改动：D0 顶层键由 17 项改为 **16 项**（删 `resource`）；D1 解析条目改写、校验项补 `KP-10`；D6 由 `KP-1`~`KP-9` 改为 `KP-1`~`KP-10`；D7 新增「目录结构自由」验收项。

**2026-09-29 · 裁决 23 并入本清单（背景按下标一一对应、单层渲染）**
- `background` 数组改为**逐图清单**：**下标即地图下标**（第 `i` 张地图取 `background[i]`），**无需匹配 key**（`maps` 字段废除），**每次只取一层渲染**（不再叠加）；**地图数多于层数时，越界地图降级为使用最后一层**；无可用层即**降级为默认配置**（程序绘制纸面底纹）；`color` 取**采用层**的值。
- 清单改动：D0 画布 `background` 类型条目改写；D3 画布接入条目改写；D7 原「背景多层叠加」验收项改为「按下标一一对应（含越界降级为最后一层）＋ 无可用背景即默认配置」两条。

**2026-09-29 · 裁决 24 并入本清单（新增立绘 `portraits`）**
- `role` 下新增**立绘**子节点 `portraits`（`player` / `classes.<组件 id>` / `monsters.<组件 id>`；字段 `img` ＋ 可选 `flip`）：**纯皮肤元素——`.pmod` 不设任何字段**，无皮肤即整块不出现；**暂不考虑四向**，左右相对**仅**由显式 `flip` 表达（缺省不翻转）。
- **落点**：底栏 hp/mp **左侧**（**替代整个 `hud-face`**，缺位不占宽）；对战对话框顶部 **VS 区**（**任一方有立绘即渲染**，主角左 / 怪物右，缺侧留空）；出身卡职业立绘（**居中**替代 `.class-icon`）；状态面板头部（与底栏**同源同图**）；遭遇 / 商店弹层**仅预留不渲染**。立绘不用 `CELL` 基准、按容器高度等比缩放、**底边对齐**、**缺位不占位**。
- 清单改动：D0 新增 `role.portraits` 类型条目；D3 `role` 条目改写（含立绘落点与 `flip`）；D6 明细校验项登记修正为**角色 `KR`**（新增 `KR-5`~`KR-8`）/ **道路 `KS`**；D7 新增「立绘 · 底栏 / 对战 VS 区 / 其余落点」三条验收。
- 另同步正文 [`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §二 / §四 / §五 / §六 / §八 / §九 / §十、[`../docs/design/skin.md`](../docs/design/skin.md) 模块映射 / 逐屏覆盖清单 / §二 尺寸行 / `S-28`~`S-30` / `Q30`、[`../docs/design/skin/03-window.md`](../docs/design/skin/03-window.md) §一、[`../docs/design/skin/08-pages.md`](../docs/design/skin/08-pages.md) §2.2、[`../docs/design/07-decisions.md`](../docs/design/07-decisions.md) §8.2、[`../docs/DESIGN.md`](../docs/DESIGN.md) 模块映射与进度同步。

**2026-09-29 · 裁决 25 / 26 并入本清单（单人／受击／窗口缩放 ＋ NPC 形象与对话 VS 区）**
- **裁决 25（`Q30`）**：本引擎为**单人游戏、只有一位主人公**——立绘即**唯一形象**，无队伍 / 队友 / 多角色矩阵；`portraits.classes.<id>` 是**各出身职业**的主人公立绘。**受击两法**＝皮肤给出 `hurt` 就显示受击图、未提供则改用**形变**（横向 ×1.15 / 纵向 ×0.9、约 `120ms` 回弹；棋子以格中心、立绘以底边为基准；**参数写死**）；**立绘尺寸改为按窗口短边 `W` 的比例**（底栏与状态面板 `6%`、对战与对话 VS 区 `18%`、出身卡 `10%`），宽度受「可用宽度 25%」上限约束，**废弃固定像素档**。
- **裁决 26（`Q31`）**：素材库新增 **NPC 分组**——棋子形象 `role.npcs.<组件 id>`（结构与 `monsters` 一致）＋ 立绘 `portraits.npcs.<组件 id>`；**NPC 不占地图格**，形象的**唯一落点是对话弹层**；NPC 对话弹层顶部**启用 `[主角] VS [NPC]` 立绘区**（正是裁决 24 预留的启用场景），NPC 侧缺位**不渲染、不回退 emoji**；遭遇 / 商店弹层**仍为预留**（`S-29`）。
- 清单改动：D0 新增 **NPC 形象 / 受击两法 / 窗口尺度** 三条并扩写立绘条目（含 `npcs` 与 `hurt`）；D3 `role` 条目加入 NPC 形象与**对话 VS 区**，并新增「受击表现」条目；D6 明细校验项由 `KR-1`~`KR-8` 扩为 **`KR-1`~`KR-10`**（新增 `KR-9` 受击图宽高比 / `KR-10` 冒充 NPC）；D7 新增「NPC 对话 VS 区 / 受击两法 / NPC 形象与立绘 / NPC 不占地图格」四条并给三条既有立绘验收补上 `W` 比例；D8 登记裁决 25 / 26 遗留项。
- 皮肤侧接口与对话数据结构见 [`05-npc.md`](./05-npc.md) E5 与 [`../docs/design/02-data-model.md`](../docs/design/02-data-model.md) §4.9；正文
另同步 [`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §二 / §4.2 / §4.4 / §八 / §九 / §十、[`../docs/design/skin.md`](../docs/design/skin.md) `S-28`~`S-32` / `Q30` / `Q31` / 逐屏覆盖清单、[`../docs/design/skin/00-package.md`](../docs/design/skin/00-package.md) §三、[`../docs/design/skin/03-window.md`](../docs/design/skin/03-window.md) §一。

**2026-09-29 · V2.1 / V2.2 版本线**
- 本里程碑拆为 **V2.1 ＝ SKIN 基础（D0–D3）** 与 **V2.2 ＝ SKIN 进阶 ＋ 音频（D4–D6）**，**排在 V2.0（新增 NPC）之后**——V1 口径（七大类 / 13 项 / 五选一）不受影响。
- 「V1.1」字样一律读作 **V2.2**（音频播放 / 贴图 `nine` 策略 / 九宫格切片消费）——**其中 `nine` 的 DOM 层已提前到 V2.1**（D3 第十三屏，见 D2 条目与「九宫格」相关落点），**按钮三态也提前到 V2.1**（D3 第十四屏，原与九宫格同批），`tile` 平铺与 SVG 层切块拼装仍在 V2.2 线上（`tile` 的唯一候选已收敛为**定位线**，裁决 29）。

**2026-09-29 · D0 落地（类型与取图纯函数）**
- 新增 `src/types/skin.ts`：manifest 顶层 16 键、三写法（`SkinSprite`）、图引用对象（`SkinImage`）、衬底三元组（`SkinGround`）、15 槽位常量 `ROAD_SLOTS`、音频键常量 `BGM_SCENES` / `SFX_EVENTS`、主题 token 白名单 `SKIN_THEME_TOKENS` / `SKIN_LAYOUT_TOKENS`、`.pgame` 容器 `PGamePack` 与约定缺省名；`src/types/index.ts` 已导出。
- 新增 `src/engine/skin/`：`road-bits.ts`（位序与 15 槽位判定）、`road-style.ts`（样式集选取，非空优先 → 命中数降序 → 声明顺序）、`road.ts`（三写法合成取图，含 `base` 前缀与数组下标消解）、`canvas.ts`（按下标取层、越界 clamp、向前回退）、`lookup.ts`（形象 / 立绘 / 道具 / 建筑 / 衬底）、`theme.ts`（观感 token 过滤）；`src/engine/index.ts` 已导出。
- 单测：`src/engine/skin/__tests__/`（`road.test.ts` / `road-style.test.ts` / `pick.test.ts`），覆盖位模式确定性、槽位与姿态、样式标签优先级、数组下标与纠偏角、背景取层与回退、token 过滤。

**2026-09-29 · `S-29` 修订并入本清单（对话弹层不设立绘区）**
- 设计侧已修订（[`../docs/design/skin.md`](../docs/design/skin.md) `S-29` / `Q30` / `Q31`，[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §4.1），本清单随之改写：D0 立绘尺寸条目去掉「NPC 对话 VS 区」；D3 `role` 条目中该落点改为「对话弹层不设立绘区（NPC 只占标题栏 `icon` 一格）」；D7 原「立绘 · NPC 对话 VS 区」验收改为「对话弹层不设立绘区」，并修正「NPC 不占地图格」与「NPC 形象与立绘」两条的落点措辞。

**2026-09-30 · 三条回执落地（角位口径与路径定义定稿）**
- **角位改为「夹角」口径（已裁决）**：角位**只在该角两侧的边都有路时**才是**夹角角块**并计入角数 `c`，只挨一条路的**外侧角**一律忽略。据此 `corner` / `tee_corner_*` / `tee_full` 恢复为**运行期可达**槽位（不再是交付用死键），`n ≤ 3` 的角位判定由「夹角是否有路」给出：`n = 2` 相邻 → 有路即 `corner`、无路即 `bend`；`n = 3` → 夹角 0 / 1 / 2 个有路即 `tee` / `tee_corner_*` / `tee_full`。设计侧 [`../docs/design/skin/01-road.md`](../docs/design/skin/01-road.md) §五 整段改写（含判定口径表），§2.1 / §三 / §四 同步；代码 [`../src/engine/skin/road-bits.ts`](../src/engine/skin/road-bits.ts) 随之实现 `isAngleCorner` / `activeAngles`。
- **基准姿态补全**：`tee_corner_nw` / `tee_corner_ne` 的基准姿态为**缺口朝南**（此时两个夹角分别落在西北与东北侧，绝对角名才区分得开），已写入 §四 与文件头注释；`tee` / `tee_full` 仍以缺口朝北为基准。
- **`cross_*` 基准角位确认**：**西北角起、顺时针**（回执确认「左上角开始顺时针」即西北起始），`cross_three_corners` 以缺西南角为基准；文件内的「推算待校正」标注已移除。
- **`base` 与 `tiles` 定义重申**：`styles[].base` 是**目录前缀**，`tiles` 的值是**相对文件名**，拼接即相对包根的路径；仅当样式集缺省 `base` 时，值才按相对包根的完整路径处理。§七 示例的 `tiles` 值已全部改为相对文件名，§十 待确认第 4 条（`base` 是否保留）随之删除。
- 验证：`src/engine/skin/__tests__/road.test.ts` 补夹角用例（`corner` / `tee_corner_nw` / `tee_corner_ne` / `tee_full` 与外侧角忽略），皮肤测试 **35 项**全绿。

**2026-09-30 · D2 落地（贴图渲染器）**
- 三层落点：纯函数 [`../src/engine/skin/texture.ts`](../src/engine/skin/texture.ts)（`textureRef` / `spriteRef` 三写法归一、`placeTexture` 落位、`normalizeAngle`、`effectiveMode`）、素材源 [`../src/io/skin-assets.ts`](../src/io/skin-assets.ts)（`createSkinAssets`：按需建地址、`mimeOf` 认扩展名、`release()` 一次撤，裁决 15）、渲染器 [`../src/ui/Texture.tsx`](../src/ui/Texture.tsx)（`textureProps()` 唯一入口 ＋ `SvgTexture` / `DomTexture` 两层同接口）。
- **取图归一**：数组写法按姿态下标取图且**不旋转**（缺中间项即该向降级、回退程序绘制）；字符串 / 对象写法按 `index × 90` 摆正，对象写法的纠偏角与之相加；`base` 前缀对三写法一律生效；`slice` 随取图结果带出但 V1 不解析。
- **单一入口的退路**：`textureProps()` 在「该节点未被接管 / 包里缺这张图 / 环境给不出地址」三种情形都返回 `undefined`——业务代码只判断「有没有 props」，**不判断素材类型**（§四）。
- **两层同接口**：`rotate` / `flip` 由落位结果给出（都绕盒心）；SVG 层编译成 `translate(cx cy) rotate(a) scale(-1 1) translate(-cx -cy)`，DOM 层编译成 `rotate(a deg) scaleX(-1)` ＋ `transform-origin: center`；素材节点不写 `filter`（`S-6`）并统一 `pointerEvents: none`。
- **参数位**：`nine` / `tile` 在 `effectiveMode()` 统一回落 `stretch`——V2.2 落地九宫格时只改这一处。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **31 个文件 / 364 项**全绿（新增 `src/engine/skin/__tests__/texture.test.ts` 14 项、`src/io/__tests__/skin-assets.test.ts` 8 项、`src/ui/__tests__/texture.test.tsx` 6 项）。
- 设计侧同步：[`../docs/design/skin.md`](../docs/design/skin.md) §四 补「实现落点」并把表内版本线 `V1.1` 更正为 **V2.2**、[`../docs/DESIGN.md`](../docs/DESIGN.md) 进度同步、[`../TASK.md`](../TASK.md) 里程碑索引与进度同步。

**2026-09-30 · D3 起步：运行期通道 ＋ `road` 接入**
- **公共前置**：新增 [`../src/store/skin.ts`](../src/store/skin.ts)——界面侧读皮肤的唯一入口，持有「生效皮肤 ＋ 素材源 ＋ 提示」，`activateLayers({ game, user })` 整体换两层、`refresh()` 从皮肤库重取用户启用的全局皮肤（本局层记住不冲掉）、`release()` 回到全部程序绘制；换套时**先撤旧的一套地址再交新的**（裁决 15）。[`../src/app/App.tsx`](../src/app/App.tsx) 启动时 `refresh()` 一次（幂等，没启用就落回程序绘制）。未启用皮肤时 `assets` 是空素材源，一切查询落 `undefined`，各屏自然回退程序绘制，**调用方不必判空**。
- **道路接入**：新增 [`../src/play/road.ts`](../src/play/road.ts)（`roadAt` / `roadNeighbors` / `roadPickAt`：多格节点按占地全算、按左上格取图；非道路节点不算有路）；[`../src/play/MapView.tsx`](../src/play/MapView.tsx) 每格 `roadPickAt` → `textureProps` → `SvgTexture`，未接管的那一格照旧画 `Footprint`，姿态角落在 `transform` 上、素材按短边居中落图。
- 待办（同屏遗留）：**构建页画布仍为脚印**。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **34 个文件 / 386 项**全绿（新增 `src/play/__tests__/road.test.ts` 10 项、`src/store/__tests__/skin.test.ts` 8 项、`src/play/__tests__/mapView.test.tsx` 4 项）。
- 设计侧同步：[`../docs/design/skin/01-road.md`](../docs/design/skin/01-road.md) 与 [`../docs/design/skin/00-package.md`](../docs/design/skin/00-package.md) §4.4 补「实现落点」、[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。

**2026-09-30 · D3 第二屏：画布 `background` 接入（→ V2.1）**
- **取层与落位**：[`../src/engine/skin/canvas.ts`](../src/engine/skin/canvas.ts) 补 `backgroundUsable()`（`img` ＋ 正的 `cellSize` 齐备，即 `KB-1`）、`backgroundOf(bg, mapIndex, available?)`（下标量出越界即 clamp 到最后一层；采用层不可用即**向前回退**；`available` 由调用方传入以判掉 `KB-2`，构建期用素材源 `has()`，**只问包里有没有、不建地址**）、`backgroundPlacement()`（§三 的倍率 `屏幕每格 ÷ cellSize` 与图片左上角落点，`startX` / `startY` 缺省按 `0`）。
- **渲染**：[`../src/play/MapView.tsx`](../src/play/MapView.tsx) 按 §四 顺序——底纹 `<rect>` 的 `fill` 取**采用层**的 `color`（漏写即 `var(--paper-card)`）→ 背景图放进 `translate(x y) scale(s)` 的 `<g>`（带 `data-bg-layer`）→ 参照线 / 道路。未取到可用层时一字不改，照旧纸面底纹。
- **图片尺寸交给素材自身像素**：`background` 没有「多大一个盒」，故取图盒新增 `w/h: 'auto'`（[`../src/engine/skin/texture.ts`](../src/engine/skin/texture.ts)），SVG 层据此**不写 `width` / `height`**、由浏览器按 SVG2 的 auto 取素材原始像素——**无需解码图片量尺寸**；`auto` 盒量不出盒心，该类元素不参与旋转 / 镜像（`background` 本来也没有这两个字段），`DomTexture` 对应写 `auto`。
- **`§3.1` 基准落地**：屏幕一格恒为 `CELL`，素材拉伸进一个屏幕格的倍率**就是**「屏幕每格像素 ÷ `cellSize`」，与背景图共用同一变换——`road` 侧无需改代码，`01-road.md` §3.1 末条与 D3 遗留「暂用 `CELL` 基准」随之销账。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **34 个文件 / 398 项**全绿（新增 `mapView.test.tsx` 4 项画布背景用例、`pick.test.ts` 5 项取层与落位用例、`texture.ts` / `texture.tsx` 各 1～2 项 `auto` 盒用例）。
- 设计侧同步：[`../docs/design/skin/05-canvas.md`](../docs/design/skin/05-canvas.md) 新增 §八 实现落点、[`../docs/design/skin/01-road.md`](../docs/design/skin/01-road.md) §十一 素材基准条改写、[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。
- 同屏遗留：**构建页画布（`src/build/Canvas.tsx`）本轮仍未接**，仍画纸面底纹。

**2026-09-30 · D3 第三屏：棋子形象 `role` 接入**
- 取图 `roleSprite()` → `spriteRef()`（[`../src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) / [`../src/engine/skin/texture.ts`](../src/engine/skin/texture.ts)）；地图棋子 `role.player` 在 [`../src/play/MapView.tsx`](../src/play/MapView.tsx) 按**整格 ＋ 锚点格中心**出图，职业 / 怪物 / NPC 三处文字落点走行内层 [`../src/ui/RoleGlyph.tsx`](../src/ui/RoleGlyph.tsx)（`CSS_SIZED_BOX`，尺寸交给 `.inline-texture` 的 `1em`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` 全绿（新增 `mapView.test.tsx` 棋子用例与 `roleGlyph.test.tsx`）。
- 设计侧同步：[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) 新增 §十一 实现落点，[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。

**2026-09-30 · D3 第四屏：立绘 `role.portraits` 四落点接入**
- 渲染件 [`../src/ui/Portrait.tsx`](../src/ui/Portrait.tsx)（`portraitTile()` ＋ `Portrait`）；尺寸全在 CSS：`W = min(视口宽, 视口高)` 即 `100vmin`，故 `.portrait-hud / -vs / -card` 是 `6 / 18 / 10vmin`，宽度由素材宽高比推出、`max-width: 25%` 为上限；默认底边对齐、出身卡居中；`Texture.tsx` 抽出 `CSS_SIZED_BOX`。
- 四个落点：① 底栏 `.hud-vitals`（替代整个 `hud-face`，血蓝条包进 `.hud-vitals-main`）、④ 状态面板头（与 ① 同源同图）、② 对战 `.vs-area`（任一方有即整块渲染、缺侧留空）、⑤ 出身卡 `.class-card-head`（逐卡按职业查表、缺位回退 `player`）；**NPC 立绘仍不渲染**（`S-29`）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **37 个文件 / 422 项**全绿（新增 16 项）。
- 设计侧同步：[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §十一 重写、§十 待确认归位，[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。

**2026-09-30 · D3 `role` 收口：受击表现（§4.4）**
- **信号**：新增 [`../src/ui/useHitPulse.ts`](../src/ui/useHitPulse.ts)——结算里没有「正在挨打」字段，故锚 **`hp` 掉下来的那一帧**；`HIT_MS = 120` 与 CSS 回弹同值，`key`（怪物 id）变只挪基准。
- **两条路**：`Portrait` 收 `hurt` / `hit`——有 `hurt` 换图（`portraitHurtTile()`，`flip` 跟主图）、没有才挂 `.portrait-hit`；棋子形象没有 `hurt` 字段 ⇒ 恒走形变（`.piece-hit` 用 `transform-box: fill-box` ＋ `transform-origin: 50% 50%` 把基准钉在格中心）。
- **接线**：对战 VS 区两侧各管各的（怪物锚 `monster.resources.hp` ＋ `monster.id`）、底栏 / 状态面板 / 地图棋子锚同一个主角 `hp`；棋子形变层**只包形象**，定位环不跟着压扁；形象格的文字落点不做形变。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **38 个文件 / 437 项**全绿（新增 `hitPulse.test.tsx` 3 项、`portrait.test.tsx` 5 项、`portraitLandings.test.tsx` 4 项、`mapView.test.tsx` 3 项）。
- 设计侧同步：[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §十一 新增「受击表现」并撤掉「未落地」、[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。

**2026-09-30 · D4 Creative 模式接线（第三个顶层模式从「未实现」到可用）**
- **路由与入口**：[`../src/app/router.ts`](../src/app/router.ts) 扩为 `Route = 'play' | 'build' | 'creative'`（`#/creative`），[`../src/app/App.tsx`](../src/app/App.tsx) 按三支渲染；入口挂在[构建页顶栏](../src/build/TopBar.tsx)菜单（与「前往游玩页」并列）。此前 `src/creative/*` 与 `src/store/creative.ts` 已写好但**没有任何装配与路由**，本次把它们接上。
- **页面外壳**：[`../src/creative/CreativeApp.tsx`](../src/creative/CreativeApp.tsx) 按 §2.1 出三栏——顶栏 / 左栏槽位 / 中栏（**预览 · 还缺哪些图 · 路面填图板**三页）/ 右栏检视器 ＋ 底部提示条；窄屏走 `.drawer-toggle` 抽屉。编辑器自身只用程序绘制样式与 lucide 图标（`S-18`）。
- **预览复用游玩页渲染**：[`../src/creative/CreativePreview.tsx`](../src/creative/CreativePreview.tsx) 把靶子 `.pmod` 经 `scenarioFromPmod()` → `startSession()` 起一局，再把本工程 manifest 与素材源**作为入参覆盖**顶进 [`../src/play/MapView.tsx`](../src/play/MapView.tsx)——**不写全局皮肤**，故游玩页 / 构建页一格不改。[`MapView`](../src/play/MapView.tsx) 新增三个**可选**入参（`manifest` / `assets` / `onlyAssets`）并把 `onStep` 改为可省（省掉即**只读预览**：不画可达格、不响应点格）；缺省全走原路径，既有渲染与测试不受影响。
- **「只看素材」**：`onlyAssets` 一并脱掉程序绘制的兜底（纸面底纹 / 圆角矩形 / 脚印 / 旗标 / emoji / 定位环），画面剩下的即**这份皮肤真正提供了什么**。
- **打开本地目录**（D4「`.pp` 或本地目录」的另一半）：[`../src/io/download.ts`](../src/io/download.ts) 新增 `pickDirectory()`，[`../src/creative/package.ts`](../src/creative/package.ts) 新增 `readSkinDirectory()`——剥掉公共顶层目录后走与 `.pp` **同一条** `readSkinEntries()`，并顺带 `zipEntries()` 出等价字节供入库。
- **导入即入皮肤库**（裁决 15）落到代码：导入 `.pp` / 打开目录后 `createSkinLibrary().add()`（**不自动启用**）；**导出产物不自动入库**。
- **素材绑定同屏信息**：检视器补缩略图 ＋ **原始尺寸**（[`../src/creative/CreativeInspector.tsx`](../src/creative/CreativeInspector.tsx) 的 `AssetThumb`，`URL.createObjectURL` 不可用时自动不渲染图片）。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **54 个文件 / 658 项**全绿（新增 [`../src/creative/__tests__/creative.test.tsx`](../src/creative/__tests__/creative.test.tsx) 14 项：三支路由、靶子→骨架→绑定→命中→打包、目录装载、页面三栏三页、预览真出 `.mapview`、只看素材）；`npm run build` 通过；真浏览器（Playwright）实测 `#/` / `#/build` / `#/creative` 三路由可渲染且无 console 报错。
- **两处留白（不臆造数据 / 不越设计）**：① 检视器的「目标尺寸 / 是否成整倍数」需要设计侧一份**目标尺寸表**（文档只有尺寸行，无机器可读数据），当前只给缩略图 ＋ 原始尺寸；② 九宫格面板的**分区高亮实时预览**与「可拖尺寸的拉伸预览框」未落地（拖线 / 填数 / 黑边识别 / 四边成对校验 / 另存九张已在）。两项已记入 D4 顶部待办。
- 设计侧同步：[`../docs/design/skin/09-creative.md`](../docs/design/skin/09-creative.md) 状态改「**已落地**」并新增 §六 实现落点（含已知边界），[`../docs/DESIGN.md`](../docs/DESIGN.md) 进度同步。

**2026-09-30 · D4 靶子来源补齐 ＋ 创意模式文案回到设计名词（铁律零复查）**
- **靶子来源补齐 §五·待确认 1 的另一半**：此前只落地「在 Creative 内临时选择一份 `.pmod`」。现 [`../src/store/creative.ts`](../src/store/creative.ts) 新增 `loadTargetFromProject()`：本工程没存过靶子时，把**构建页当前工程**经 `exportPmod()` 导出成 `.pmod` 当靶子（工程里没启用组件、地图上也没铺任何件时**不接管**）；顶栏更多菜单另有「用当前构建工程当靶子」可随时改回。**Creative 自己存下的靶子优先**，不会被构建工程顶掉。入口见 [`../src/creative/CreativeApp.tsx`](../src/creative/CreativeApp.tsx)（`hydrate()` 之后兜底）与 [`../src/creative/CreativeTopBar.tsx`](../src/creative/CreativeTopBar.tsx)。
- **用语回到设计名词（铁律零）**：「没认领的图」→「**未绑定素材**」、「放到选中位置」→「**绑定到选中位置**」（`skin/09-creative.md` §2.2 原文）；左栏行尾徽章与中栏三类名统一为「**已命中 / 走通用 / 程序绘制 / 可留空**」（§2.4 原文）；右栏「这一处该填：单张图（可带额外旋转 / 左右翻转 / 九宫格切片）」→「**本图片位置可填：一张图（可另设旋转、左右翻转、九宫格切片）**」；拖放提示改为「把图片文件拖进本栏：文件名符合命名约定的自动绑定」并在悬停说明里写明 `<元素>_<变体>.<扩展名>` 约定；删掉与徽章说明重复的三步口水提示与「暂无未绑定素材」之上的重复说明。
- **全量口语复查**：`颗` / `面骰` / `认领` / `放好` / `认得出` / `回捞` / `顶替` / `顺手` / `跟着变` / `搞混` / `告诉你` 等一律改书面语（含注释与测试内注释），`src/` 内已无残留。
- 验收：`npx tsc --noEmit` 无错；`npx vitest run` **55 个文件 / 669 项**全绿；真浏览器（Playwright）实测：预置一份「构建页已有内容」的工程后进 `#/creative`，靶子自动变为「构建页工程：探针工程」（1 张地图 · 1 个道路朝向），左栏出现「未绑定素材」，中栏三类名正确，无 console 报错。
- 设计侧同步：[`../docs/design/skin/09-creative.md`](../docs/design/skin/09-creative.md) §五·待确认 1 标注**两侧均已落地**、§六 改写并新增「靶子来源」实现落点一行。

**2026-10-09 · V2.4 NPC 槽位 SlotN：皮肤侧口径（裁决 66；设计侧定稿）**
- **命中键由 `id` 改 `name` ＋ 通配**：`role.npcs` 与 `portraits.npcs` 的子键由**组件 `id`** 改为 **NPC 的 `name`**，并支持**通配键 `"*"`**；命中顺序 **精确 `name` → `"*"` → 该 NPC `icon` emoji**（立绘命中不到 → **不渲染**，不跨 NPC 借用）。`KR-2` / `KR-3` / `KR-6` 的键范围检查与查询实现（`lookup.ts`）随之按 `name` ＋ 通配走。
- **NPC 新增地图落点（原「NPC 不占地图格」作废）**：V2.4 起 NPC 有**地图槽位落点**（[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §4.1 **落点 6**）——`role.npcs` 命中 → 画**皮肤**（单格、无朝向）；**未命中 → 画槽位色圆环**（颜色 ＝ 构建页该槽位行颜色，调色板**构建页与游玩态共用**，槽号 ≥ 色数即**循环取色**）；绘制层在**棋子层之下**；**玩家与 NPC 可重叠**（重叠即触发）。
- **新增校验**：**`KR-11`**（`npcs` 键与任一 NPC `name` 都不重名却配了图）/ **`KM-4`**（槽号 ≥ 调色板色数 → 循环取色）。D6 明细校验由 `KR-1`~`KR-10` 扩为 **`KR-1`~`KR-11`**。
- **对话弹层不受影响**：`S-29` 不变——NPC 在对话里仍只占**标题栏 `icon` 一格**（按 `name` ＋ 通配取图）；地图落点是**棋子形象**、**不是立绘**。
- **本档改写条目**：D0「立绘 `portraits`」「NPC 棋子形象 `role.npcs`」两条；D3 `role` 条目；D6 明细校验登记；D7「NPC 形象与立绘」改写、「NPC 不占地图格」→「**NPC 地图落点**」；D8 裁决 25/26 遗留项中「NPC 立绘是否需要对话之外的落点」标注**已裁决**。
- **版本线**：本档仍属 **V2.1 / V2.2** 皮肤档，但本组改动**排在 V2.4**（结构改造类）之后或**随其落地**——须早于皮肤收尾完成，以避免 `role.npcs` 按 `id` 实现的返工（[`../docs/design/07-decisions.md`](../docs/design/07-decisions.md) §8.6 版本线）。
- 设计侧同步：[`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §三 / §4.1 落点 6 / §4.3 / §五 / §六 `KR-11`、[`../docs/design/skin/04-misc.md`](../docs/design/skin/04-misc.md) §二 / §八 `KM-4`、[`../docs/design/skin.md`](../docs/design/skin.md) §六 `S-33` / §七 `Q32`、[`../docs/DESIGN.md`](../docs/DESIGN.md) 与 [`../TASK.md`](../TASK.md) 进度同步。

**2026-10-09 · V2.4 NPC 槽位 SlotN：皮肤侧代码落地（E6，`task/05-npc.md` 验收 20–23）**
- **取图键改 `name` ＋ 通配（已落地）**：[`../src/engine/skin/lookup.ts`](../src/engine/skin/lookup.ts) 的 `roleSprite()` / `portraitOf()` 在 `kind === 'npc'` 时改为 **精确 `name` → 通配 `"*"`**（新增导出常量 `NPC_WILDCARD = '*'`）；形象命中不到 → `undefined`（调用方回退该 NPC `icon` emoji），立绘命中不到 → `undefined`（不渲染、不跨组借用）。键由组件 `id` 改 `name` 是 **V2.4 裁决 66** 的口径。
- **对话弹层标题栏（已落地）**：[`../src/play/TalkDialog.tsx`](../src/play/TalkDialog.tsx) 的标题栏形象改为 `roleSprite(role, 'npc', npc?.name)`（原先按 `npc?.id`），`S-29` 不变——NPC 在对话里仍只占标题栏 `icon` 一格。
- **NPC 地图落点（已落地）**：[`../src/play/MapView.tsx`](../src/play/MapView.tsx) 新增 `NpcLayer`（挂在**棋子层之下**，随背景一样 `pointerEvents: none`）——逐建筑逐槽解析：**皮肤命中 → `SvgTexture` 单格出图（无朝向、锚点格中心）**；**未命中 → 槽位色圆环**（`stroke = slotColor(slotN)`、`r = CELL/2 - 6`，`onlyAssets` 时不画）；**槽号 ≥ 色数循环取色**由 [`../src/lib/npcSlots.ts`](../src/lib/npcSlots.ts) 的 `slotColor()` 天然满足（`KM-4`）。占位解析：池值 `engine-roll.npc.<buildingKey>.slotN` 有抽定即取之；未抽定的**单候选槽**按唯一候选画；多候选未抽定**不画**（避免误导）。
- **单测**：[`../src/engine/skin/__tests__/pick.test.ts`](../src/engine/skin/__tests__/pick.test.ts) 新增「NPC 按 name ＋ 通配 `"*"`」7 项（精确优先、通配回退、不跨组借用、无 id → `undefined`、立绘缺失不渲染）；[`../src/play/__tests__/mapView.test.tsx`](../src/play/__tests__/mapView.test.tsx) 新增「NPC 槽位层」6 项（无皮肤画两环 ＋ 颜色/半径、精确名画图 ＋ 余环、通配画满、`onlyAssets` 只画图、`g[data-role-npc]` 在 `g[data-role-pawn]` 之前、多候选未抽定不画 / 单候选画环）。`npx tsc --noEmit` 无错。
- **注释同步**：[`../src/types/skin.ts`](../src/types/skin.ts) 的 `SkinRole.npcs` / `SkinPortraits.npcs` 注释由「唯一落点是对话弹层 / 当前 V1 无落点」更新为 **V2.4 的 `name` ＋ 通配 ＋ 双落点（地图槽位格 / 对话标题栏）**。
- **遗留（属 D6，本档未动工）**：`KR-11`（`npcs` 键与任一 NPC `name` 都不重名却配了图）尚未实现——当前**整个 `KR-*` / `KP-*` 皮肤校验尚未落地**（`SkinIssueCode` 仅 `KP-1`~`KP-10` ＋ `KA-2`，`src/check/validate.ts` 无皮肤清单上下文），随 D6「校验接入清单」一并做；`KM-4` 属调色板循环，已由 `slotColor()` 满足，无需单独校验。

**2026-10-10 · V2.2 D5 / D6 落地（build 加载 `.pp` 预览 ＋ 皮肤校验接入「清单」）**
- **D5 build 加载 `.pp`（仅预览）**：新增运行期 store [`../src/store/skinPreview.ts`](../src/store/skinPreview.ts)（`open` / `loaded` / `skin` / `assets` / `issues` / `source`；`load()` 先释放旧素材源再交新的，`clear()` 卸下并释放，**不入 `localStorage`**——预览是一次性观察态）与整页面板 [`../src/build/SkinPreview.tsx`](../src/build/SkinPreview.tsx)。面板把 `scenarioFromProject()` → `startSession()` 起一局，再以 `manifest` / `assets` / `onlyAssets` **覆盖入参**顶进 [`../src/play/MapView.tsx`](../src/play/MapView.tsx)（与创意模式预览同一套代码），「只看素材」开关脱掉程序绘制兜底。**不写全局皮肤**（编辑器自身与游玩页都不受影响）、**工程只读**（导出仍走 `exportCurrentPmod()`）。入口见 [`../src/build/TopBar.tsx`](../src/build/TopBar.tsx) 的「皮肤预览」、装配见 [`../src/build/BuildApp.tsx`](../src/build/BuildApp.tsx)。回归用例 [`../src/build/__tests__/skinPreview.test.ts`](../src/build/__tests__/skinPreview.test.ts) 断言加载前后 `exportPmod()` 文本 / `missing` / `renamed` 一致且 `projectSnapshot()` 一字未动、预览皮肤只落预览 store；面板渲染用例见 [`../src/build/__tests__/skinPreview.test.tsx`](../src/build/__tests__/skinPreview.test.tsx)。
- **D6 皮肤校验接入「清单」**：新增纯函数校验器 [`../src/check/skinValidate.ts`](../src/check/skinValidate.ts)（读入参的**皮肤条目 ＋ 组件库 ＋ 工程**，不碰 store）——汇总加载期 `KP-*` / `KA-*` 与须对照组件库 / 本局工程的各节码：**`KP-5`**（无效键汇总，取 `project.enabledIds` 启用集）、**`KB-1` / `KB-3` / `KB-6`~`KB-9`**、**`KR-1`~`KR-3` / `KR-5`~`KR-7` / `KR-9`~`KR-11`**（含 `KR-11`：`npcs` 键与任何 `name` 都不重名）、**`KS-1` / `KS-3`~`KS-7`**、**`KW-1` / `KW-4` / `KW-7`**、**`KM-1` / `KM-3`**、**`KIB-1` / `KIB-2` / `KIB-5`~`KIB-7`**、**`KPG-1`~`KPG-6`**（含 `KPG-6` 旧 `pages` 键迁移提示）。[`../src/check/validate.ts`](../src/check/validate.ts) 的 `validateProject()` 新增可选 `SkinContext` 并并入结果；[`../src/build/Checklist.tsx`](../src/build/Checklist.tsx) 取「**预览皮肤优先、回退全局启用皮肤**」两处来源，未加载皮肤时传 `undefined`、清单内容与现状一致；整包被忽略（`KP-1`）时只回加载期提示。
- **码表登记（只登记「现在真会产生」的编号）**：`SkinIssueCode` 新增 `KB-*` / `KR-*` / `KS-*` / `KW-*` / `KM-*` / `KIB-*` / `KPG-*` 共 38 码，`SKIN_ISSUE_TITLES` 逐条对应（[`../src/types/skin.ts`](../src/types/skin.ts)）。**不产出**：需解码像素的 `KR-4` / `KR-8` / `KM-2` / `KIB-3` / `KB-4` / `KB-5` 一支、规范未定的 `KW-2` / `KW-3`；`KM-4` 由 `slotColor()` 循环取色天然满足、`KW-6` 与 `KIB-8` 已作废。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **69 个文件 / 843 项**全绿（较 D4 收口 55 / 669 净增 **14 文件 / 174 项**；本轮新增 [`../src/build/__tests__/skinPreview.test.ts`](../src/build/__tests__/skinPreview.test.ts) ＋ [`.test.tsx`](../src/build/__tests__/skinPreview.test.tsx)、[`../src/check/__tests__/skinValidate.test.ts`](../src/check/__tests__/skinValidate.test.ts)）。

**2026-10-10 · V2.2 音频播放落地（D7 音频项由「只解析不发声」升级为「真发声」）**
- **运行期**：新增 [`../src/io/audio-runtime.ts`](../src/io/audio-runtime.ts)——`createAudioRuntime(deps?)` 以**可注入依赖**（`createContext` / `decode` / `setTimer`）包住 `AudioContext`（与 `createSkinAssets({ createUrl })` 同法，便于 jsdom 注入假上下文单测）：惰性建上下文 ＋ 主 `Gain`；`decodeAudioData` 结果按文件缓存（`inflight` 去重）；BGM 同场景只改音量、跨场景 **600ms 淡出淡入**（`token` 递增挡异步竞态）；SFX 经 `setTimer(fn, 0)` **合帧**（同一帧同事件只发一次）；`reload()` 换肤重放、`release()` 停源 / 清缓存 / 关上下文。单测 [`../src/io/__tests__/audio-runtime.test.ts`](../src/io/__tests__/audio-runtime.test.ts)。
- **偏好与巴士**：新增 [`../src/store/audio.ts`](../src/store/audio.ts)——`persist` 只落 `{ master, muted }` 到 `localStorage`（键由 `AUDIO_STORAGE_KEY = 'poprpg_audio'` 导出供单测引用），`onRehydrateStorage` 回灌运行期；`setMaster()` 夹回 0–1（`NaN` → 1）；`resolveBgm()` / `resolveSfx()` 从 `useSkinStore` 取当前皮肤，经 `bgmTrackOf` / `sfxTrackOf` 解析并**带上包内解出的字节**（`skinBytesOf`）交给运行期。单测 [`../src/store/__tests__/audio.test.ts`](../src/store/__tests__/audio.test.ts)。
- **驱动**：新增 [`../src/audio/driver.ts`](../src/audio/driver.ts)——纯函数 `sceneOfSession()`（无对局 `home`、有 `monster` / `encounter` / `talk` / 掷骰在途 `battle`、其余 `map`）＋ `useAudioDriver()`（按路由与局势定场景并 `setScene`、窗口一次性 `pointerdown` / `keydown` / `touchstart` **首次手势解锁**、皮肤变更 `reload()`、卸载 `release()`）。单测 [`../src/audio/__tests__/driver.test.ts`](../src/audio/__tests__/driver.test.ts)。
- **触发点**：新增 [`../src/audio/hooks.ts`](../src/audio/hooks.ts)——`useDiceSfx` / `useBattleSfx` / `useModalSfx` / `useNoticeSfx` / `useCoinSfx` / `useErrorSfx` 覆盖 **8 个事件键**（`dice_roll` / `dice_land` / `hit` / `pickup` / `coin` / `open` / `close` / `error`）；各 hook 只调 `useAudioStore.getState().sfx(...)`，接线点分布在 `flow.ts` / `BattleDialog.tsx` / `Overlay.tsx` 等处。单测 [`../src/audio/__tests__/hooks.test.ts`](../src/audio/__tests__/hooks.test.ts)。
- **设置 UI 与素材**：菜单内静音开关（🔊 / 🔇）＋ 总音量滑杆（`0`–`1`，步进 `0.05`，静音时禁用）落在 [`../src/play/GameScreen.tsx`](../src/play/GameScreen.tsx)；[`../src/io/skin-assets.ts`](../src/io/skin-assets.ts) 的 `mimeOf()` 补音频扩展名（`mp3` → `audio/mpeg`、`ogg` → `audio/ogg` 等）。
- **既有用例修正**：菜单按钮计数由 7 改 8（[`../src/play/__tests__/windowButtons.test.tsx`](../src/play/__tests__/windowButtons.test.tsx)）；`skin-assets` 音频 mime 期望随之更新（[`../src/io/__tests__/skin-assets.test.ts`](../src/io/__tests__/skin-assets.test.ts)）。
- **版本登记修正**：`audio` 的 SFX 事件键为 **8 个**（[`../src/types/skin.ts`](../src/types/skin.ts) 的 `SFX_EVENTS`）；[`../TASK.md`](../TASK.md) V2.2 行原写「9 个」已更正为 **8**。
- **未接（诚实边界）**：`KA-5`（`loop: false` 且 < 3s）**仍未接**——须解码量时长，成本高于收益；`bgm.<场景>.fade` 覆盖**未落**，淡入淡出时长写死 600ms。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **73 个文件 / 884 项**全绿（较 D5/D6 的 69 / 843 净增 **4 文件 / 41 项**，本轮新增 `audio-runtime` / `driver` / `hooks` / `store/audio` 四个用例文件，并修正上述两处既有用例）。
- 设计侧同步：[`../docs/design/skin/07-audio.md`](../docs/design/skin/07-audio.md) 状态行 / §一 / §四 / §五 / §六 版本措辞改写并新增 §8.2 播放落点；[`../TASK.md`](../TASK.md) V2.2 行「9 → 8」。