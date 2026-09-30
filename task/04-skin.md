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
- [x] **立绘 `portraits`（裁决 24 / 25 / 26）**：`role` 下新增 `portraits` 子节点（`player` / `classes.<组件 id>` / `monsters.<组件 id>` / **`npcs.<组件 id>`**；字段 `img` ＋ 可选 `flip` ＋ 可选 **`hurt`**（受击图），**不接受数组**——**变体只认 `hurt` 一个具名字段、不做表情变体**）——**纯皮肤元素、`.pmod` 不设字段**；取图纯函数覆盖「职业立绘缺位 → 回退 `portraits.player` → 回退 emoji」链，怪物与 **NPC** 缺位**不跨同类借用**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §四）
- [x] **NPC 棋子形象 `role.npcs`（裁决 26）**：`role` 下新增 `npcs` 子节点（按 NPC id 查表；结构与 `monsters` 一致、**不接受数组**）；缺位回退该 NPC `icon` emoji；**地图上不绘制 NPC**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §三）
- [ ] **受击两法（裁决 25）**：`hurt` 素材优先；未提供则**形变**——棋子以**格中心**为基准、立绘以**底边**为基准，横向 ×1.15 / 纵向 ×0.9、约 `120ms` 回弹；**参数写死、不做逐素材配置**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.4）
- [ ] **立绘尺寸按窗口尺度（裁决 25）**：以**窗口短边** `W = min(视口宽, 视口高)` 为唯一尺度——底栏与状态面板 `6% W`、对战 VS 区 `18% W`、出身卡 `10% W`；宽度由素材宽高比推出并受「可用宽度 25%」上限约束；**固定像素档与 `@media` 断点均不再使用**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.2）

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
- [x] V1 只实现 `stretch`（`<image preserveAspectRatio="none">`）；`nine` / `tile` 仅预留参数位，V1 不解析九宫格（取舍 `S-1`；**切分工具**在 D4，但 V1 渲染不变，裁决 21）——**落点**：`src/engine/skin/texture.ts` 的 `effectiveMode()` 统一回落为 `stretch`（V2.2 落地九宫格时只改这一处），`slice` 随取图结果带出但不解析
- [x] 渲染器为**纯函数 + 单一入口**：业务代码内**禁止**判断素材类型（不写 `if (is9Patch)`）——**落点**：几何与取图归纯函数 `src/engine/skin/texture.ts`（三写法归一 `spriteRef` / 单张 `textureRef`、绕心旋转镜像 `placeTexture`、角度归一），地址归 `src/io/skin-assets.ts`（按需建、`release()` 一次撤，裁决 15）；业务侧只拿 `TextureProps`
- [x] DOM 层（面板 / 弹窗）与 SVG 层共用同一调用接口（两侧实现可不同）——**落点**：同一份 `TextureProps` 两个实现——`SvgTexture`（`<image>`，绕盒心 `transform`）与 `DomTexture`（`<img>` 绝对定位，`rotate` / `scaleX(-1)` ＋ `transform-origin: center`，要求父元素 `position: relative`）
- [x] 位图素材**不套手绘滤镜**（`S-6`）；纸纹与手绘分隔线仍由 CSS 承担，素材接管时不得双层叠加（[`skin.md`](../docs/design/skin.md) §3.4）——**落点**：素材节点一律不写 `filter`（手绘滤镜只由程序绘制的图形显式加 `url(#poprpg-sketch)`），并统一 `pointerEvents: none`（素材不参与点击命中）

## D3 逐屏素材接入

> 覆盖清单逐屏对照 [`skin.md`](../docs/design/skin.md) §「覆盖清单（逐屏）」。每接入一屏，用同一份 `.pp` 验证「有素材 / 无素材」两种形态。

- [x] `road`：15 槽位 / 47 姿态 / 样式标签优先级（**已定稿**，按 [`skin/01-road.md`](../docs/design/skin/01-road.md) 实现）；缺图回退脚印 `src/ui/Footprint.tsx`——**落点**：邻接折算 `src/play/road.ts`（格子 → 四邻四角 → `roadFlag`，多格节点按占地全算、按左上格取图）、取图 `roadPickAt()`（标签取自道路定义，走 `pickRoadStyle`）、渲染 `src/play/MapView.tsx`（每格 `roadPickAt` → `textureProps` → `SvgTexture`，该格未接管即照旧画脚印；素材按 `cellSize` 正方形居中；屏幕一格恒为 `CELL`，**拉伸进一个屏幕格的倍率就是「屏幕每格像素 ÷ `cellSize`」**，与背景图（`05-canvas.md` §八）共用同一变换，故无需另算基准）。**构建页画布（`src/build/Canvas.tsx`）本轮未接**，仍画脚印
- [ ] `role`：玩家棋子 / 职业形象 / 怪物形象 / **NPC 形象 `npcs`**（单格、无朝向；**地图上不绘制 NPC**，其形象唯一落点是对话弹层）＋ **立绘 `portraits`**（裁决 24 / 25 / 26）：底栏 hp/mp 左侧（**替代整个 `hud-face`**，缺位不占宽）、对战对话框顶部 **VS 区**（**任一方有立绘即渲染**，主角在左 / 怪物在右，缺侧留空、不补 emoji）、**对话弹层不设立绘区**（`S-29` 2026-09-29 修订，原裁决 26 的对话 VS 区作废；NPC 只占标题栏 `icon` 一格，取 `role.npcs.<id>`）、出身卡职业立绘（**居中**替代 `.class-icon`）、状态面板头部（与底栏**同源同图**）；遭遇 / 商店弹层**仅预留不渲染**（`S-29`）；立绘按**窗口短边 `W`** 的比例缩放、**底边对齐**（仅出身卡居中）、**不用 `CELL` 基准**、**不套手绘滤镜**、**不参与点击命中**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §四）——**棋子形象与立绘均已接**：取图 `roleSprite()` / `portraitOf()` → `spriteRef()` / `textureRef()`；地图棋子 `role.player` 在 [`../src/play/MapView.tsx`](../src/play/MapView.tsx) 按**整格 ＋ 锚点格中心**出图（缺图仍画方框 ＋ 职业 `icon` emoji，**不借 `classes` 的图**；绿色定位环与形象无关、照旧画）；职业 / 怪物 / NPC 三处文字落点走**行内层** [`../src/ui/RoleGlyph.tsx`](../src/ui/RoleGlyph.tsx)（`.inline-texture` 的 `1em` 方框、`object-fit: contain` 等比内缩）；**立绘四落点**走 [`../src/ui/Portrait.tsx`](../src/ui/Portrait.tsx)——尺寸全在 CSS（`W = 100vmin` ⇒ `.portrait-hud/vs/card` 的 `6/18/10vmin`、宽度按素材宽高比、`max-width: 25%` 上限、默认底边对齐 / 出身卡居中），落点 ① 底栏 `.hud-vitals`（替代 `hud-face`；血蓝条包进 `.hud-vitals-main`）、④ 状态面板头（与 ① 同源同图）、② 对战 `.vs-area`（任一方有即整块渲染、缺侧留空）、⑤ 出身卡 `.class-card-head`（逐卡按职业查表、缺位回退 `player`），取不到图即 `null`（**不占位、不回退 emoji**）；**NPC 立绘仍不渲染**（`S-29`）；**受击表现未接**（下一条）
- [ ] **受击表现**（裁决 25）：棋子与立绘**同一套规则**——有 `hurt` 素材即改显示 `hurt`，未提供则形变（基准：棋子＝格中心、立绘＝底边）；**`dead`（倒下）不设变体**（[`skin/02-role.md`](../docs/design/skin/02-role.md) §4.4）
- [ ] `window`：对话框 / 抽屉 / 气泡 / 按钮 / 格子 / 条 / 提示条；**按钮四态**结构定稿、接入可后置——先只读 `normal`，其余三态暂由 CSS 表现并在清单提示 `KW-6`（裁决 13 / [`skin/03-window.md`](../docs/design/skin/03-window.md) §四.1）
- [ ] `window` §四.2 **信息图标组合**（裁决 12）：`background` 衬底在下 ＋ `icon` 居中在上；名称与说明文字走**窗体自身**字体字色，**不读** `building.font` / `fontColor`
- [ ] `misc`：起点终点标记 / 建筑节点 / 骰子与骰面 / 图标兜底 / 引导线（[`skin/04-misc.md`](../docs/design/skin/04-misc.md)；游玩态内容图标无独立衬底）
- [x] `background`（画布）：**下标一一对应、每张地图只渲染一层** / 越界降级为最后一层 / 图点与格 `[0,0]` 中心对齐 / 跟随 `cellSize` 缩放 / 图外填充色取**采用层**的值 / 无可用层即默认配置（裁决 17，修订 23；[`skin/05-canvas.md`](../docs/design/skin/05-canvas.md)）——**落点**：取层与落位归纯函数 `src/engine/skin/canvas.ts`（`backgroundUsable()` 判掉 `KB-1`、`backgroundOf()` 吃 `available` 判掉 `KB-2` 并向前回退、`backgroundPlacement()` 出倍率与左上角落点）；渲染在 `src/play/MapView.tsx`（底纹色取采用层 → `translate/scale` 的 `<g>` 里一张背景图 → 参照线 / 道路）；图**按素材自身像素**出图（取图盒 `w/h: 'auto'`，SVG 层不写 `width`/`height`），故无需解码量尺寸。**构建页画布（`src/build/Canvas.tsx`）本轮未接**，仍画纸面底纹
- [ ] `item` / `building`：背包与穿戴格衬底（`.bag-cell`）、组件库与信息视图、建筑地图贴图 `img`、地图名称 `font` / `fontColor`（字号固定 11px，取舍 `S-10`）；**描边缺省不绘制**（裁决 18；[`skin/06-item-building.md`](../docs/design/skin/06-item-building.md) §3.3）
- [ ] `startup` / `lobby`：APP 欢迎页与游戏首页／选角页面，**首页封面图归皮肤侧**（`bg`，`.pmod` 不设字段）；字体与字色**不由**这两节接管（裁决 20；[`skin/08-pages.md`](../docs/design/skin/08-pages.md)）
- [ ] `audio`：**V1 只解析与校验**——识别字段、路径与 `volume` 校验、清单提示；**不加载／不解码／不播放**，播放整体排 **V2.2**（裁决 16；[`skin/07-audio.md`](../docs/design/skin/07-audio.md)）

## D4 Creative 模式（第三个顶层模式）

- [ ] 路由与模式入口：`src/app/router.ts` 现为 `play` / `build` 两支，扩为三支，`Route` 类型同步
- [ ] 新建：空白骨架；或**从 `.pmod` 生成骨架**（读出该局启用组件与地图用到的全部道路 flag，逐槽位生成空值待填条目）
- [ ] 打开：`.pp`（zip，`fflate` 解包）或本地目录；导入：与用户皮肤**逐节点**合并（同名以导入者为准）；**导入即入皮肤库，导出产物不自动入库**（裁决 15）
- [ ] 导出：`.pp`；或 `.pgame`（`pack.json` ＋ 当前 `.pmod` ＋ 当前皮肤打包）——**打包/解包统一走 `fflate`**（裁决 14 / 19）
- [ ] 素材绑定：拖入图片按 `<元素>_<变体>.<ext>` 自动匹配槽位，未识别者进「未绑定素材」暂存区；绑定即写回 manifest（写**相对包根**路径）、不复制文件内容；同屏显示预览缩略图与尺寸比
- [ ] **九宫格切分工具（裁决 21）**：导入整图 → 拖四根参考线（上／右／下／左）→ 实时预览九宫格分区 → 写回 `slice` ＋ 可选另存九张切片（[`skin/09-creative.md`](../docs/design/skin/09-creative.md) §2.3）；**不改变 V1 的拉伸渲染**
- [ ] 命中检查：**已命中 / 走通用 / 程序绘制**三类清单，「程序绘制」列为缺图清单并给出建议文件名；道路另给 `16 × 16` flag 矩阵视图（可直接绑定素材）
- [ ] 预览：被编辑 `.pp` ＋ 靶子 `.pmod`；「只看素材」开关；道路「按 flag / 按姿态」两种视图
- [ ] Creative 编辑器自身 UI **不接管素材**（避免自举循环，取舍 `S-18`）
- [ ] 存储：编辑中的工程与素材 blob 与 build 项目同级存本地，导出时才打包；打开高版本包时保存**不降级**版本号
- [ ] 除九宫格切分外**不内置其它图片编辑**（裁剪构图 / 抠图 / 改色 / 生成 `.9.png` 黑边，`S-16`）；**字体不做子集化**，原样打包、超大仅提示（裁决 21，`S-27`）

## D5 build 模式加载 pp（仅预览）

- [ ] build 加载 `.pp`：**仅地图视图与预览用组件**按素材渲染，用于验证「素材与地图是否对得上」
- [ ] **不改导出结果**：加载 pp 前后导出的 `.pmod` 完全一致（回归项）

## D6 校验接入「清单」

- [ ] `KP-1`~`KP-10` 接入 `src/check/validate.ts`，在 `src/build/Checklist.tsx` 汇总显示；**全部为提示，不阻断导出**（**不设皮肤体积硬上限**，裁决 15）
- [ ] 各节明细校验项登记：**角色 `KR`**（`KR-1`~`KR-10`；`KR-5`~`KR-8` 为**立绘**新增：非竖构图 / 无效键 / 数组写法 / 无透明通道（裁决 24）；**`KR-9` 受击图与主图宽高比不一致 / `KR-10` 拿主人公图冒充 NPC**（裁决 25 / 26）；`KR-2` / `KR-3` / `KR-6` 的键范围含 **`npcs`**） / **道路 `KS`** / 窗体 `KW` / 标记与骰子 `KM` / 道具与建筑 `KIB` / 页 `KPG`（含 `KPG-6`：旧 `pages` 键提示迁移到 `startup` / `lobby`）
- [ ] 皮肤校验只在加载了 `.pp` 时出现；未加载皮肤时清单内容与现状一致

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
- [ ] **对话弹层不设立绘区（`S-29` 2026-09-29 修订）**：踩到 `encounter: talk` 建筑进入对话弹层时，弹层只有**标题栏 ＋ 台词 ＋ 选项**——不出现任何立绘、不出现 VS 区；NPC 只占标题栏 `icon` 一格（`role.npcs.<id>`，缺位回退该 NPC `icon` emoji）
- [ ] **立绘 · 其余落点（裁决 24 / 25）**：出身卡内职业立绘**居中替代** `.class-icon`（高度 `10% W`），缺位回退 `cls.icon` emoji；状态面板头部与底栏**同源同图**；**遭遇 / 商店弹层始终不出现立绘**（`S-29` 仅预留）；`portraits.*` 写成数组时按 `KR-7` 提示且不渲染
- [ ] **受击两法（裁决 25）**：同一素材分别验证——提供 `hurt` 时受击瞬间显示受击图（与 `img` 不同宽高比时提示 `KR-9`）；**未提供 `hurt` 时发生形变**（棋子以格中心、立绘以底边为基准），幅度与时长**写死、不随素材变化**；`dead` 不设变体
- [ ] **NPC 形象与立绘（裁决 26，`S-29` 修订）**：`role.npcs` 生效时按 NPC id 取图，缺位回退该 NPC `icon` emoji；`portraits.npcs` **当前无落点**（对话弹层不设立绘区），仍参与 `KR` 校验（拿 `hero_stand.png` 冒充 NPC 立绘提示 `KR-10`）
- [ ] **NPC 不占地图格（裁决 26）**：加载含 NPC 的 `.pmod` 与皮肤后，**地图上不出现 NPC 形象节点**——NPC 形象只出现在对话弹层标题栏 `icon` 一格
- [ ] `.pgame` 一次加载游戏与皮肤；缺 `pack.json` 时按约定文件名回退（`KP-7`）；缺少 `skin/` 子目录时按「无皮肤」启动
- [ ] 皮肤库：导入两份 `.pp` 后列表有两条、包体在 IndexedDB；**切换皮肤后旧皮肤的解压结果被释放**（裁决 15）
- [ ] 本局 `.pp` 与用户全局 pp 并存：被覆盖节点取本局，未覆盖节点取全局
- [ ] `theme` 生效且越权被忽略：改 `--paper` 生效，改 `--gap` 被忽略并提示 `KP-9`
- [ ] 按钮配置写有 `hover` / `active` / `disabled`：运行时只读 `normal`，清单出现 `KW-6` 提示
- [ ] 建筑信息视图：`building.background` 生效，文字仍为窗体字体字色（裁决 12 回归项）
- [ ] `audio` 字段被解析并校验：清单能看到路径/音量提示，但**全程无声音**（裁决 16 回归项）
- [ ] Creative 九宫格切分工具：拖四根参考线后写回的 `slice` 落在 manifest 中，V1 渲染仍为拉伸（裁决 21）
- [ ] Creative 全链路：从 `.pmod` 生成骨架 → 绑定素材 → 导出 `.pp` → 在 play 加载，观感与预览一致
- [ ] `npm run build`（tsc 无错）＋ `npx vitest run` 全绿
- [ ] `npm run dev` 人工手测一次：zip 读取、`.pp` / `.pgame` 导出下载在真浏览器可用

## D8 未决项（未裁决前不动工）

- `Q26` BGM 是否需要「按地图」；`Q28` 是否允许跨包 `extends`（按皮肤名继承）；`Q29` `.pgame` 的 `pack.json.entry` 取值语义。
- **裁决 25 / 26 遗留**：VS 区「VS」字样是否素材化；`W` 的三个比例值（底栏 6% / VS 区 18% / 出身卡 10%）与宽度上限 25% 是否合适；受击形变参数是否需**逐素材可调**（`S-32`）；败北 / 倒下是否需 `dead` 变体；**NPC 立绘是否需要对话之外的落点**（现只有对话弹层）。见 [`../docs/design/skin/02-role.md`](../docs/design/skin/02-role.md) §十。
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
- 「V1.1」字样一律读作 **V2.2**（音频播放 / 贴图 `nine` 策略 / 九宫格切片消费）。

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
