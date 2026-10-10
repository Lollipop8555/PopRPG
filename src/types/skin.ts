/**
 * 皮肤包（`.pp` / `.pgame`）类型（§skin：`docs/design/skin.md` 与 `docs/design/skin/` 各分节）。
 *
 * 三条贯穿本文件的口径：
 * - 素材是**可选叠加层**：任何字段缺失都只意味着该节点回退程序绘制形态，不是错误。
 * - 路径一律**相对包根**写全，由各字段自身给出；加载器不推断前缀、不假设目录约定。
 * - `manifest.json` 顶层**16 键**（裁决 19 / 22；`resource` 已废除）。
 */

/** 包格式版本（缺省视为 1；读到更高版本照常渲染并警告一次） */
export const SKIN_FORMAT = 1

/** 九宫格切片，顺序固定 `[上, 右, 下, 左]`（顺时针，从顶部开始） */
export type SkinSlice = [number, number, number, number]

/** 素材路径：相对包根写全，如 `resource/road/straight.png` */
export type SkinPath = string

/** 颜色（`#rrggbb`） */
export type SkinColor = string

/** 封面 / 背景类图的填充方式（仅 `startup.bg` / `lobby.bg`），缺省 `cover` */
export type SkinFit = 'cover' | 'contain' | 'tile'

/**
 * 图引用对象：`img` ＋ 全部可选修饰。
 * 各节只用其中一部分（`slice` 归容器类、`fit` 归封面类、`rotate` 归可旋元素），
 * 越界组合由各节校验项提示，不在类型层拆分。
 */
export interface SkinImage {
  img: SkinPath
  /** 硬性角度纠偏：素材基准朝向与规范基准朝向不一致时用，不表达「这一格该朝哪」 */
  rotate?: number
  /** 显式左右镜像（不默认启用） */
  flip?: boolean
  /** 九宫格切片；**给了即走九宫格**（DOM 层已落地），不给即按普通拉伸处理 */
  slice?: SkinSlice
  /** 填充方式，仅封面类背景使用 */
  fit?: SkinFit
}

/** 单张图：字符串写法或图引用对象 */
export type SkinTexture = SkinPath | SkinImage

/**
 * 素材字段三写法（`skin.md` §五）：一张 / 一张 ＋ 纠偏角 / 四张。
 * 数组顺序固定 `N / E / S / W`，**不得省略中间项**（缺哪向即该节降级为程序绘制）。
 */
export type SkinSprite = SkinPath | SkinImage | SkinPath[]

/** 衬底三元组：填充色 ＋ 描边色 ＋ 背景图；字符串写法等价于只写 `fill` */
export interface SkinGround {
  fill?: SkinColor
  /** 独立设置项：未给即不绘制描边（既不跟随 `fill`，也不保留组件色） */
  stroke?: SkinColor
  /** 背景图，**优先于 `fill`**（`fill` 作其透明区的兜底） */
  img?: SkinPath
}

/** 衬底字段：颜色简写或三元组 */
export type SkinGroundField = SkinColor | SkinGround

/**
 * 拼接「目录前缀 ＋ 相对文件名」得到相对包根的路径（`skin/01-road.md` §七 路径定义）。
 *
 * `base` 缺省（或空串）即原样返回文件名——此时该字段的值按**完整路径**处理；
 * 两侧多余斜杠各归一化一次，因此 `base` 带不带尾斜杠都合法。
 */
export function joinSkinPath(base: SkinPath | undefined, file: SkinPath): SkinPath {
  if (!base) return file
  return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`
}

// ── 画布背景 `background` ───────────────────────────────────────────────

/** 背景层：一张图 ＋ 该层自己的对齐参数与图外填充色 */
export interface SkinBackgroundLayer {
  /** 背景图 */
  img?: SkinPath
  /** 背景图上一个游戏格占多少像素（同时是地图层素材的出图基准） */
  cellSize?: number
  /** 图片上该点与地图格 `[0,0]` 的**中心**对齐（横向） */
  startX?: number
  /** 同上（纵向） */
  startY?: number
  /** 图片边界之外的填充色；**每层各自携带**，漏写即全局主题色，不做层级回退 */
  color?: SkinColor
}

/** 逐图清单：下标即地图下标；单个对象视为单元素数组（所有地图共用） */
export type SkinBackground = SkinBackgroundLayer | SkinBackgroundLayer[]

// ── 道路 `road` ─────────────────────────────────────────────────────────

/** 15 槽位名（与 `skin/01-road.md` §三 逐字一致；`tiles` 的键必须是其中之一） */
export const ROAD_SLOTS = [
  'isolated',
  'dead_end',
  'straight',
  'bend',
  'corner',
  'tee',
  'tee_corner_nw',
  'tee_corner_ne',
  'tee_full',
  'cross',
  'cross_one_corner',
  'cross_adjacent',
  'cross_diagonal',
  'cross_three_corners',
  'plaza',
] as const

export type RoadSlot = (typeof ROAD_SLOTS)[number]

/** 样式集条目：一套素材的标签与共享路径前缀 */
export interface SkinRoadStyle {
  /** 该套素材的标签；空数组为通配底样 */
  tags: string[]
  /** 15 张图的共享路径前缀（可不用，直接写全路径） */
  base?: SkinPath
  /** 标签匹配方式，缺省 `any`（命中任意一个即候选） */
  mode?: 'any' | 'all'
}

export interface SkinRoad {
  styles?: SkinRoadStyle[]
  /** 15 槽位 → 素材；缺键即该槽位回退脚印 */
  tiles?: Partial<Record<RoadSlot, SkinSprite>>
}

// ── 形象与立绘 `role` ──────────────────────────────────────────────────

/** 立绘对象：`img` ＋ 可选镜像 ＋ 可选受击图（**不接受数组**，变体只认 `hurt`） */
export interface SkinPortraitObject {
  img: SkinPath
  flip?: boolean
  /** 受击图；缺省则受击改用形变（横向 ×1.15 / 纵向 ×0.9，约 120ms） */
  hurt?: SkinPath
}

/** 立绘：字符串简写或对象（**不接受数组**） */
export type SkinPortrait = SkinPath | SkinPortraitObject

/** 立绘分组：主人公 / 各职业 / 各怪物 / 各 NPC */
export interface SkinPortraits {
  player?: SkinPortrait
  /** 职业立绘缺位时先回退 `player`，再回退 emoji */
  classes?: Record<string, SkinPortrait>
  /** 怪物立绘缺位时不渲染，且**不跨怪物借用** */
  monsters?: Record<string, SkinPortrait>
  /**
   * NPC 立绘：键是 NPC 的 `name`（非组件 `id`）＋ 通配 `"*"`（V2.4 裁决 66）。
   * 命中顺序 精确 `name` → `"*"` → 不渲染（不跨组借用、无 emoji 回退）
   */
  npcs?: Record<string, SkinPortrait>
}

/** 形象分组：棋子与形象（无朝向，`classes` / `monsters` / `npcs` 不接受数组） */
export interface SkinRole {
  /** 玩家棋子；缺位回退职业 `icon` emoji → `🙂` */
  player?: SkinSprite
  classes?: Record<string, SkinSprite>
  monsters?: Record<string, SkinSprite>
  /**
   * NPC 形象：键是 NPC 的 `name`（非组件 `id`）＋ 通配 `"*"`（V2.4 裁决 66）。
   * 命中顺序 精确 `name` → `"*"` → 该 NPC `icon` emoji；
   * 落点两处：地图槽位格（层在棋子层之下）与对话弹层标题栏
   */
  npcs?: Record<string, SkinSprite>
  portraits?: SkinPortraits
}

// ── 道具 `item` 与建筑 `building` ───────────────────────────────────────

/** 道具皮肤：只有图标与衬底（**不得**出现 `img` / `font` / `fontColor`） */
export interface SkinItemSkin {
  /** 覆盖组件定义中的 `icon` */
  icon?: SkinTexture
  background?: SkinGroundField
}

/** 建筑皮肤：在道具字段之上，另有地图贴图与地图名称字体字色 */
export interface SkinBuildingSkin extends SkinItemSkin {
  /** 地图节点的整体贴图，替换整个圆角矩形 */
  img?: SkinPath
  /** 地图上建筑名称的文字颜色（对话框内文字不读本字段） */
  fontColor?: SkinColor
  /** 地图上建筑名称的字体：包内字体路径或浏览器内置字体名 */
  font?: string
}

/** 键一律为组件 `id` */
export type SkinItem = Record<string, SkinItemSkin>
export type SkinBuilding = Record<string, SkinBuildingSkin>

// ── 容器与控件 `window` ────────────────────────────────────────────────

/** 按钮四态（`normal` 为唯一必填；缺失即整个按钮走程序绘制） */
export interface SkinButtonStates {
  normal: SkinTexture
  hover?: SkinTexture
  active?: SkinTexture
  disabled?: SkinTexture
}

/** 按钮：单张字符串（等价于只写 `normal`）或四态对象 */
export type SkinButton = SkinTexture | SkinButtonStates

/** 血蓝条两件套 */
export interface SkinBar {
  track?: SkinTexture
  fill?: SkinTexture
}

export interface SkinWindow {
  /** 随视口族容器底纹：对话框 / 抽屉 / 气泡 */
  surfaces?: {
    dialog?: SkinTexture
    drawer?: SkinTexture
    popover?: SkinTexture
  }
  /** 按钮：`primary` / `danger` / `small` / `icon` / `close` 为既有键，允许自定义键 */
  buttons?: Record<string, SkinButton>
  /** 固定尺寸格子：技能格 / 奖励卡 / 背包格 / 部位标签 */
  slots?: {
    skill?: SkinTexture
    reward?: SkinTexture
    bag?: SkinTexture
    equipLabel?: SkinTexture
  }
  bars?: {
    hp?: SkinBar
    mp?: SkinBar
  }
  /** 提示条三档 */
  hints?: {
    ok?: SkinTexture
    warn?: SkinTexture
    error?: SkinTexture
  }
  /** 单向族：手绘分隔线 */
  rules?: {
    line?: SkinTexture
  }
}

// ── 标记与骰子 `misc` ──────────────────────────────────────────────────

/** 骰面键：`d1`–`d6` 为点阵，`numeric` 为 >6 面的数字文本（可选） */
export type SkinDieFace = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'numeric'

export interface SkinMisc {
  /** 地图标记：起点旗 / 终点藏宝图 X / 道路脚印 */
  marks?: {
    start?: SkinSprite
    end?: SkinSprite
    footprint?: SkinSprite
  }
  /** 建筑多格节点贴图（随格数拉伸，建议按九宫格交付） */
  nodes?: {
    building?: SkinTexture
  }
  /** 骰子：本体三档共用一张；`rolling` 为掷骰中动画态（可选） */
  dice?: {
    body?: SkinTexture
    rolling?: SkinTexture
    faces?: Partial<Record<SkinDieFace, SkinTexture>>
  }
  /** lucide 图标按名替换 */
  icons?: Record<string, SkinTexture>
  /**
   * 每 10 格的坐标参照线＝**定位线**：叠在地图之上的辅助层，只作读数定位用
   * （贴图本身不含间距与分割线）；游玩菜单可开 / 关，平铺策略，素材须四边可拼接。见 `skin/04-misc.md` §五
   */
  guides?: {
    grid?: SkinTexture
  }
}

// ── 音频 `audio`（V1 只解析与校验，不播放） ─────────────────────────────

/** BGM 场景键 */
export const BGM_SCENES = ['home', 'map', 'battle'] as const
export type BgmScene = (typeof BGM_SCENES)[number]

/** 音效事件键（键名即唯一契约，改名视为不兼容变更） */
export const SFX_EVENTS = [
  'dice_roll',
  'dice_land',
  'hit',
  'pickup',
  'coin',
  'open',
  'close',
  'error',
] as const
export type SfxEvent = (typeof SFX_EVENTS)[number]

export interface SkinBgm {
  file: SkinPath
  /** 是否循环，缺省 `true` */
  loop?: boolean
  /** 该曲默认音量 0–1，缺省 `0.5`（可被用户偏好覆盖） */
  volume?: number
}

export interface SkinSfxObject {
  file: SkinPath
  /** 该音效默认音量 0–1，缺省 `0.8` */
  volume?: number
}

export interface SkinAudio {
  bgm?: Partial<Record<BgmScene, SkinBgm>>
  /**
   * 音效：路径字符串，或 `{ file, volume }`（`skin/07-audio.md` §二）。
   *
   * **不是 `SkinTexture`**：`rotate` / `flip` 对音源没有意义，写成纹理那两种形状
   * 只会在解析时变成一句「取不到路径」的提示，故取值类型收紧到这两种写法。
   */
  sfx?: Partial<Record<SfxEvent, string | SkinSfxObject>>
}

// ── 欢迎页与游戏首页 `startup` / `lobby` ───────────────────────────────

/** APP 欢迎页：封面图归皮肤侧（`.pmod` 不设字段） */
export interface SkinStartup {
  /** 全屏背景（即该屏封面图） */
  bg?: SkinImage
  /** 标题图形，只替换字形、不改文案 */
  title?: SkinImage
  /** 主视觉图形，替换洞穴手绘 SVG */
  cover?: SkinImage
  /** 主视觉上的装饰骰子贴图 */
  dice?: SkinImage
}

/** 出身卡选中态差异：`img` 缺省时只改描边 */
export interface SkinCardSelected {
  img?: SkinPath
  slice?: SkinSlice
  stroke?: SkinColor
}

/** 出身卡片底 */
export interface SkinLobbyCard extends SkinImage {
  selected?: SkinCardSelected
}

/** 游戏首页／选角页面 */
export interface SkinLobby {
  bg?: SkinImage
  /** 「这一局的世界」正文面板的底 */
  panel?: SkinImage
  /** 出身卡片底 */
  card?: SkinLobbyCard
}

// ── 主题 token ─────────────────────────────────────────────────────────

/**
 * `theme` 允许覆盖的**观感** token（`skin/00-package.md` §3.3）。
 * 未列出的键名视为未知 token，忽略并提示 `KP-9`。
 */
export const SKIN_THEME_TOKENS = [
  '--paper',
  '--paper-deep',
  '--paper-card',
  '--ink',
  '--ink-soft',
  '--ink-faint',
  '--line',
  '--line-soft',
  '--red',
  '--amber',
  '--green',
  '--blue',
  '--radius',
  '--radius-rough',
  '--font-hand',
  '--font-cn',
] as const

/** **布局** token：不可由皮肤覆盖（取舍 `S-23`，越权写入忽略并提示 `KP-9`） */
export const SKIN_LAYOUT_TOKENS = ['--gap', '--topbar-h', '--play-topbar-h'] as const

/** 全局 token → CSS 变量值 */
export type SkinTheme = Record<string, string>

// ── manifest 顶层 ──────────────────────────────────────────────────────

/**
 * `.pp` 的 `manifest.json` 顶层 **16 键**（裁决 19 / 22）。
 * 16 键中除本处的 `extends` / `format` 等元信息外，其余各节均可整体缺省。
 */
export interface SkinManifest {
  /** 包格式版本，整数，缺省 `1` */
  format?: number
  /** 皮肤名（缺失时皮肤列表显示文件名） */
  name?: string
  author?: string
  description?: string
  /** APP 欢迎页 */
  startup?: SkinStartup
  /** 游戏首页／选角页面 */
  lobby?: SkinLobby
  /** 包内继承：相对包根的 manifest 路径（**禁止跨包**） */
  extends?: SkinPath
  /** 全局 token → CSS 变量 */
  theme?: SkinTheme
  /** 画布背景（逐图清单） */
  background?: SkinBackground
  road?: SkinRoad
  role?: SkinRole
  item?: SkinItem
  building?: SkinBuilding
  window?: SkinWindow
  misc?: SkinMisc
  /** 音频字段（V1 只解析与校验，不播放） */
  audio?: SkinAudio
}

/** manifest 顶层键清单（用于校验「已废除的 `resource` 键」等，裁决 22） */
export const SKIN_MANIFEST_KEYS = [
  'format',
  'name',
  'author',
  'description',
  'startup',
  'lobby',
  'extends',
  'theme',
  'background',
  'road',
  'role',
  'item',
  'building',
  'window',
  'misc',
  'audio',
] as const

export type SkinManifestKey = (typeof SKIN_MANIFEST_KEYS)[number]

// ── `.pgame` 容器 ──────────────────────────────────────────────────────

/** `.pgame` 的 `pack.json` 固定标识 */
export const PGAME_KIND = 'poprpg.pgame'

/** `.pgame` 容器描述文件；缺失时按约定文件名回退（`KP-7`） */
export interface PGamePack {
  /** 容器格式版本，缺省 `1`（不与 `pmod` / `manifest` 的版本合并计） */
  format?: number
  /** 固定 `"poprpg.pgame"` */
  kind?: string
  /** 该整体分发的显示名，缺省取文件名 */
  name?: string
  /** `.pmod` 条目路径，缺省 `game.pmod` */
  pmod?: SkinPath
  /** 皮肤目录，缺省 `skin/`；其中为一份 `.pp` 内容 */
  skin?: SkinPath
  /** 入口标识；留空即走默认开局流程 */
  entry?: string
}

/** `.pgame` 的约定缺省名（`pack.json` 缺失时的回退依据） */
export const PGAME_DEFAULT_PMOD = 'game.pmod'
export const PGAME_DEFAULT_SKIN_DIR = 'skin/'

// ── 校验项：包级 `KP-*` ＋ 各分节 `KB / KR / KS / KW / KM / KIB / KPG / KA` ──

/**
 * 加载期与「清单」校验项编号；全部为**提示**，不阻断加载与导出。
 *
 * 各族靠前缀区分、各归其文档：
 * - `KP-*`：**包级**，`skin/00-package.md` §六；
 * - `KB-*`：**画布背景**，`skin/05-canvas.md` §五；
 * - `KR-*`：**角色与立绘**，`skin/02-role.md` §八；
 * - `KS-*`：**道路**，`skin/01-road.md` §八；
 * - `KW-*`：**容器与控件**，`skin/03-window.md` §六；
 * - `KM-*`：**标记与骰子**，`skin/04-misc.md` §八；
 * - `KIB-*`：**道具与建筑**，`skin/06-item-building.md` §四；
 * - `KPG-*`：**欢迎页与首页**，`skin/08-pages.md` §四；
 * - `KA-*`：**音频**，`skin/07-audio.md` §五。
 *
 * **只登记「现在真会产生」的编号**，与 `KA-1` 的先例一致：
 * - **与 `KP-2` 判同一件事、不单列**：`KB-2` / `KS-2` / `KW-5` / `KIB-4`（路径缺失）与 `KA-1`——
 *   单列只会让同一条缺失在清单里出现两遍；
 * - **需解码像素、当前不做**：`KR-4`（贴满四边）、`KR-8`（无透明通道）、`KM-2`（引导线拼接）、
 *   `KIB-3`（尺寸不为 `cellSize` 整倍数）、`KIB-7` 的「整图全透明」一支、`KB-4` / `KB-5`
 *   （需地图格数，而 `GameMap` 不存网格尺寸）；
 * - **需元素最小渲染尺寸 / 内容族分类，规范未定**：`KW-2` / `KW-3`（`03-window.md` §三 / §二）；
 * - **已作废 / 已满足**：`KW-6`（D3 四态接入后不再产生）、`KM-4`（`slotColor()` 已循环取色，
 *   `04-misc.md` §十）、`KIB-8`（「写了 `fill` 未写 `stroke`」属正常用法，不提示）。
 */
export const SKIN_ISSUE_CODES = [
  // 包级（`00-package.md` §六）
  'KP-1',
  'KP-2',
  'KP-3',
  'KP-4',
  'KP-5',
  'KP-6',
  'KP-7',
  'KP-8',
  'KP-9',
  'KP-10',
  // 画布背景（`05-canvas.md` §五）
  'KB-1',
  'KB-3',
  'KB-6',
  'KB-7',
  'KB-8',
  'KB-9',
  // 角色与立绘（`02-role.md` §八）
  'KR-1',
  'KR-2',
  'KR-3',
  'KR-5',
  'KR-6',
  'KR-7',
  'KR-9',
  'KR-10',
  'KR-11',
  // 道路（`01-road.md` §八）
  'KS-1',
  'KS-3',
  'KS-4',
  'KS-5',
  'KS-6',
  'KS-7',
  // 容器与控件（`03-window.md` §六）
  'KW-1',
  'KW-4',
  'KW-7',
  // 标记与骰子（`04-misc.md` §八）
  'KM-1',
  'KM-3',
  // 道具与建筑（`06-item-building.md` §四）
  'KIB-1',
  'KIB-2',
  'KIB-5',
  'KIB-6',
  'KIB-7',
  // 欢迎页与首页（`08-pages.md` §四）
  'KPG-1',
  'KPG-2',
  'KPG-3',
  'KPG-4',
  'KPG-5',
  'KPG-6',
  // 音频（`07-audio.md` §五）
  'KA-2',
  'KA-3',
  'KA-4',
] as const

export type SkinIssueCode = (typeof SKIN_ISSUE_CODES)[number]

/** 标题与各节校验表逐条对应（明细进 `detail`） */
export const SKIN_ISSUE_TITLES: Record<SkinIssueCode, string> = {
  'KP-1': '缺少可解析的 manifest.json',
  'KP-2': '素材路径在包内不存在',
  'KP-3': '包格式版本高于实现版本',
  'KP-4': '路径违反纯静态约束',
  'KP-5': '组件 id 不在本局启用范围内',
  'KP-6': 'preview.png 无法解码',
  'KP-7': '.pgame 缺少 pack.json',
  'KP-8': 'extends 路径不存在或形成环',
  'KP-9': 'theme 含未知 token 或布局 token',
  'KP-10': '含已废除的 resource 键',
  'KB-1': '背景层缺 cellSize（该项不绘制）',
  'KB-3': 'startX / startY 落在图片之外',
  'KB-6': '某张地图没有任何可用背景',
  'KB-7': 'background 层数多于地图数',
  'KB-8': '被采用的背景层没有写 color',
  'KB-9': '相邻两层的对齐基准不一致',
  'KR-1': '棋子形象素材非正方形',
  'KR-2': '形象键不在本局启用组件内',
  'KR-3': '形象分组写成数组',
  'KR-5': '立绘非竖构图（宽 ≥ 高）',
  'KR-6': '立绘键不在本局启用组件内',
  'KR-7': '立绘写成数组',
  'KR-9': '受击图与主图宽高比不一致',
  'KR-10': 'NPC 立绘与主人公立绘是同一张图',
  'KR-11': 'NPC 形象键与任何 name 都不重名',
  'KS-1': '道路 tiles 键与槽位名不一致',
  'KS-3': '两条道路样式在规则 ①② 上同分',
  'KS-4': '道路素材非正方形',
  'KS-5': '以 .9.png 命名但未提供 slice',
  'KS-6': '道路素材尺寸与 cellSize 不成整倍数',
  'KS-7': 'road 节里出现颜色类字段',
  'KW-1': '随视口族素材无 slice',
  'KW-4': '固定族素材非正方形',
  'KW-7': '按钮四态素材尺寸不一致',
  'KM-1': 'node.building 未提供九宫格切片',
  'KM-3': '骰面少于 6 张且未声明复用方式',
  'KIB-1': '键不在本局启用的组件 id 内',
  'KIB-2': 'img 以 .9.png 命名但未提供 slice',
  'KIB-5': '用了显示名而不是 id 作键',
  'KIB-6': 'item / background 含越界字段',
  'KIB-7': '衬底不可见（fill 与 stroke 都透明）',
  'KPG-1': 'bg.fit 取值非法',
  'KPG-2': 'card 给了 img 但未给 slice',
  'KPG-3': 'title.img 与标题区比例不符',
  'KPG-4': 'dice.img 给了图但未给骰面',
  'KPG-5': 'startup / lobby 出现越界字段',
  'KPG-6': '出现旧键 pages',
  'KA-2': 'sfx 的事件键不在清单内',
  'KA-3': '音频 volume 超出 0–1',
  'KA-4': '单个音频文件体积过大',
}

/**
 * 一条加载期提示。
 *
 * 与 `.pmod` 的校验集合（`src/check/validate.ts` 的 `Issue`）**刻意分开**：
 * 皮肤校验只在加载了 `.pp` 时出现，D6 再把它汇入构建页清单。
 */
export interface SkinIssue {
  code: SkinIssueCode
  detail: string
}
