/**
 * 形象 / 立绘 / 道具 / 建筑 / 衬底 / 容器 / 标记与骰子的取值（`skin/02-role.md`、
 * `skin/03-window.md`、`skin/04-misc.md`、`skin/06-item-building.md`）。
 *
 * 全部为「**有则取、无则 `undefined`**」的查表：回退链只在本文件明确写出，
 * 渲染侧拿到 `undefined` 即走程序绘制形态，不再自行猜测上级素材。
 *
 * 回退链（与文档逐条对应）：
 * - 棋子形象：玩家 → `role.player`；职业 / 怪物 / NPC 各自分组，**不跨组借用**。
 *   **NPC 例外**：键是 NPC 的 `name`（不是组件 `id`），命中顺序**精确 `name` → 通配 `"*"`**（V2.4 裁决 66）。
 * - 立绘：职业缺位**先回退 `role.portraits.player`**；怪物与 NPC 缺位即不渲染，**不跨条借用**。
 *   NPC 同样按 `name` ＋ 通配 `"*"`，命中不到即 `undefined`（**不**回退 emoji，§4.3）。
 * - 衬底：字符串写法等价于只写 `fill`；`stroke` 独立设置，未给即不绘制描边。
 * - 容器：对话框 / 抽屉 / 气泡三种容器各查 `window.surfaces` 一个键，**互不借用**。
 * - 按钮：七个键各查 `window.buttons` 自己的键，**互不借用**；四态各查自己的态，
 *   缺 `normal` 即整个按钮算没配，其余三态缺位交给渲染侧的「回落 `normal`」。
 * - 地图标记：起点 / 终点 / 脚印三键各查 `misc.marks` 自己的键，**互不借用**（缺了照旧画程序图形）。
 * - 骰子：本体与骰面各一张；骰面 1–6 取点阵 `d1`–`d6`、其余点数取数字面 `numeric`。
 * - 图标：按 **lucide 图标名**查 `misc.icons`，缺位即该处照旧用 lucide 元件。
 * - 道具 / 建筑：键一律为**组件 `id`**，不跨键借用；建筑贴图 `building.img` 缺位才回退
 *   `misc.nodes.building`（`06-item-building.md` §2.3，全篇唯一的一处跨节回退）。
 * - 欢迎页 / 游戏首页：两屏各查自己的 `bg`，**不互相借用**；出身卡 `selected.img` 缺位沿用卡底。
 */

import type {
  SkinBar,
  SkinBuilding,
  SkinBuildingSkin,
  SkinColor,
  SkinDieFace,
  SkinFit,
  SkinGround,
  SkinGroundField,
  SkinImage,
  SkinItem,
  SkinItemSkin,
  SkinLobby,
  SkinMisc,
  SkinPath,
  SkinPortrait,
  SkinPortraitObject,
  SkinRole,
  SkinSprite,
  SkinStartup,
  SkinTexture,
  SkinWindow,
} from '../../types'

/** 形象分组 */
export type RoleKind = 'player' | 'class' | 'monster' | 'npc'

/**
 * NPC 通配键（V2.4 裁决 66）：`role.npcs` / `portraits.npcs` 里没配精确 `name` 时，退而取这个键。
 * 是**分组内**的兜底，不跨组借用（不会去借 `monsters` / `classes` 的图）。
 */
export const NPC_WILDCARD = '*'

/** 取棋子形象；`player` 忽略 `id`，其余分组按 `id` 查表且不跨组借用 */
export function roleSprite(
  role: SkinRole | undefined,
  kind: RoleKind,
  id?: string,
): SkinSprite | undefined {
  if (!role) return undefined
  if (kind === 'player') return role.player
  // NPC：键是 `name`（不是组件 `id`）＋ 通配 `"*"`；命中不到即 `undefined`（对话弹层据此回退 emoji）
  if (kind === 'npc') return id === undefined ? undefined : role.npcs?.[id] ?? role.npcs?.[NPC_WILDCARD]
  const group = kind === 'class' ? role.classes : role.monsters
  return id === undefined ? undefined : group?.[id]
}

/** 立绘是否为对象写法 */
export function portraitObject(p: SkinPortrait | undefined): SkinPortraitObject | undefined {
  return p !== undefined && typeof p !== 'string' ? p : undefined
}

/** 取立绘：职业缺位先回退 `player`；怪物 / NPC 缺位即不渲染 */
export function portraitOf(
  role: SkinRole | undefined,
  kind: RoleKind,
  id?: string,
): SkinPortrait | undefined {
  const ps = role?.portraits
  if (!ps) return undefined
  if (kind === 'player') return ps.player
  if (kind === 'class') return (id === undefined ? undefined : ps.classes?.[id]) ?? ps.player
  // NPC：键是 `name` ＋ 通配 `"*"`；命中不到即 `undefined`（**不**回退 emoji，§4.3）
  if (kind === 'npc') return id === undefined ? undefined : ps.npcs?.[id] ?? ps.npcs?.[NPC_WILDCARD]
  return id === undefined ? undefined : ps.monsters?.[id]
}

/** 取道具皮肤（键为组件 `id`） */
export function itemSkinOf(item: SkinItem | undefined, id: string): SkinItemSkin | undefined {
  return item?.[id]
}

/** 取建筑皮肤（键为组件 `id`） */
export function buildingSkinOf(
  building: SkinBuilding | undefined,
  id: string,
): SkinBuildingSkin | undefined {
  return building?.[id]
}

/**
 * **随视口族容器**（`skin/03-window.md` §二）：尺寸由窗口决定，故 V1 可整体拉伸底纹（§五）。
 * 三个键各有落点、**不互相借用**：对话框 / 抽屉 / 气泡缺图即该处照旧画 CSS 纸面。
 */
export type SurfaceKind = 'dialog' | 'drawer' | 'popover'

/** 取容器底纹；`window.surfaces` 未配该键即 `undefined` */
export function surfaceOf(win: SkinWindow | undefined, kind: SurfaceKind): SkinTexture | undefined {
  return win?.surfaces?.[kind]
}

/**
 * **固定尺寸格子键**（`skin/03-window.md` §二「固定族」/ §四）：技能格 / 奖励卡 / 背包格 / 部位标签。
 * 尺寸写死在程序里（技能格 54、奖励卡 92、部位标签 44），故 V1 可整图等比拉伸——与容器同一条取图链。
 * 四个键各有落点、**不互相借用**；配了无人读取的键静默搁置，与其余各节一致。
 */
export const SLOT_KINDS = ['skill', 'reward', 'bag', 'equipLabel'] as const

export type SlotKind = (typeof SLOT_KINDS)[number]

/** 取固定族格子底纹；`window.slots` 未配该键即 `undefined` */
export function slotOf(win: SkinWindow | undefined, kind: SlotKind): SkinTexture | undefined {
  return win?.slots?.[kind]
}

/**
 * **单向族**（`03-window.md` §二）：血蓝条轨道与填充各一张，两端固定、中段伸缩。
 * 与格子同理，**素材带了 `slice` 就按单轴九宫格**（切片上下给 0 即退化成单轴），
 * 没交切片就整图拉伸。两个字键 `hp` / `mp` **不互相借用**。
 */
export const BAR_TONES = ['hp', 'mp'] as const

export type BarTone = (typeof BAR_TONES)[number]

/** 取血蓝条的两张图（`track` / `fill` 各自可缺，缺哪张哪张走程序绘制） */
export function barOf(win: SkinWindow | undefined, tone: BarTone): SkinBar | undefined {
  return win?.bars?.[tone]
}

/**
 * **提示条**（`03-window.md` §二「随内容族」，§四 `hints`）：三档 tone 各一张，**不互相借用**。
 *
 * 注意 `.hintbox` 有**四**种外观（中性 ＋ `warn` / `error` / `ok`），而字段只定义**三档 tone**：
 * **中性那档没有键、不铺素材**，继续由 CSS 绘制（见 §八「提示条」）。
 */
export const HINT_TONES = ['ok', 'warn', 'error'] as const

export type HintTone = (typeof HINT_TONES)[number]

export function hintOf(win: SkinWindow | undefined, tone: HintTone): SkinTexture | undefined {
  return win?.hints?.[tone]
}

/**
 * **分隔线**（`03-window.md` §二「单向族」，§四 `rules.line`）：只有一条键。
 * 走单轴九宫格（§七.2 的平铺方案是同一处的另一档，未裁决前不引入第二套字段）。
 */
export function ruleOf(win: SkinWindow | undefined): SkinTexture | undefined {
  return win?.rules?.line
}

/**
 * **按钮键**（`skin/03-window.md` §四）：键按**元素角色**判定，不按 CSS 类名判定——
 * `plain` 是 `.btn` 本身（中性按钮），`primary` / `danger` / `ghost` / `small` 是它的四个修饰类，
 * `icon`（只有图形、无文字的按钮）与 `close`（关闭）由调用点在落点处显式指定。
 * 键集合允许自定义；配了无人读取的键即静默搁置，与其余各节一致。
 */
export type ButtonKind = 'plain' | 'primary' | 'danger' | 'ghost' | 'small' | 'icon' | 'close'

/** 按钮键的固定顺序（清单展示与遍历用） */
export const BUTTON_KINDS: readonly ButtonKind[] = [
  'plain',
  'primary',
  'danger',
  'ghost',
  'small',
  'icon',
  'close',
]

/** 按钮四态（`skin/03-window.md` §4.1）：`normal` 唯一必填，其余三态缺位回落到 `normal` ＋ CSS 表现 */
export type ButtonState = 'normal' | 'hover' | 'active' | 'disabled'

/** 四态的固定顺序（遍历 / 清单用）：常态在前，其余按「悬停 → 按下 → 不可用」 */
export const BUTTON_STATES: readonly ButtonState[] = ['normal', 'hover', 'active', 'disabled']

/**
 * 取一个按钮的**四态**（`skin/03-window.md` §四.1）：字符串写法等价于只写 `normal`；
 * 四态对象**缺 `normal` 即整个按钮算没配**（返回 `undefined`——只写 `hover` 不会凭空多出一张底图）。
 *
 * 返回值**只含真写了的态**：缺位的态不在这张表里，交给渲染侧落成「回落 `normal`」（CSS 那份缺省链），
 * 而不是在这里预先补一份 `normal` 的值——否则「写了 `hover` 却缺图」与「根本没写 `hover`」就没法区分了。
 */
export function buttonStatesOf(
  win: SkinWindow | undefined,
  kind: ButtonKind,
): Partial<Record<ButtonState, SkinTexture>> | undefined {
  const button = win?.buttons?.[kind]
  if (button === undefined) return undefined
  if (typeof button === 'string' || 'img' in button) return { normal: button }
  if (button.normal === undefined) return undefined

  const states: Partial<Record<ButtonState, SkinTexture>> = { normal: button.normal }
  if (button.hover !== undefined) states.hover = button.hover
  if (button.active !== undefined) states.active = button.active
  if (button.disabled !== undefined) states.disabled = button.disabled
  return states
}

/**
 * 取按钮素材的 **`normal` 态**（`skin/03-window.md` §四）：即四态里的必填那一张，
 * 缺 `normal`（或整个按钮没配）即 `undefined`——整个按钮走 CSS 纸面。
 */
export function buttonOf(win: SkinWindow | undefined, kind: ButtonKind): SkinTexture | undefined {
  return buttonStatesOf(win, kind)?.normal
}

/**
 * **地图标记三键**（`skin/04-misc.md` §二）：起点旗 / 终点藏宝图 X / 道路脚印。
 *
 * 三键都是「1 格、整图居中、不旋转」，各有落点、**不互相借用**；未配即照旧画程序图形
 * （起点 / 终点的手绘 SVG、脚印）。脚印那一条只在**道路素材缺失**时才用得上（`01-road.md` §一）。
 */
export type MarkKind = 'start' | 'end' | 'footprint'

/** 取地图标记素材；`misc.marks` 未配该键即 `undefined` */
export function markOf(misc: SkinMisc | undefined, kind: MarkKind): SkinSprite | undefined {
  return misc?.marks?.[kind]
}

/** 取骰子本体；**三档尺寸（46 / 38 / 34）共用这一张**、按盒等比缩放（`04-misc.md` §三） */
export function dieBodyOf(misc: SkinMisc | undefined): SkinTexture | undefined {
  return misc?.dice?.body
}

/**
 * 取骰面：1–6 走点阵 `d1`–`d6`；其余点数（`2D6` 之类的合计值、或流程里的异常值）
 * 一律交给数字面 `numeric`（可选）——未配即回退程序点阵 / 数字文本。
 */
export function dieFaceOf(misc: SkinMisc | undefined, pips: number): SkinTexture | undefined {
  const faces = misc?.dice?.faces
  if (faces === undefined) return undefined
  return faces[pips >= 1 && pips <= 6 ? (`d${pips}` as SkinDieFace) : 'numeric']
}

/**
 * **图标名清单**（`skin/04-misc.md` §四）：V1 游玩态实际用到的那几个 lucide 图标。
 *
 * 键名即 lucide 的图标名（PascalCase），`misc.icons[<图标名>]` 提供替换素材；
 * 清单只列**有落点**的名字，配了清单外的名字静默搁置（与各节一致，不报错、不回退到别的名字）。
 */
export const ICON_NAMES = [
  'Sword',
  'Hammer',
  'FileDown',
  'FileUp',
  'LibraryBig',
  'Menu',
  'Flag',
  'StepForward',
  'X',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/**
 * 取按名索引的图标素材；未配该名即 `undefined`，该处照旧渲染 lucide 元件。
 *
 * 三处**不归这里**（§四）：**内容 emoji**（职业 / 道具 / 怪物 / 技能）由各自的节替换
 * （`role` / `item`），**兜底字形**（`🙂` / `✦` / `❔` / `🎲` / `🔒`）**永远不可覆盖**——
 * 它是素材缺失时的最终保底，因此不走 `misc.icons`。
 */
export function iconOf(misc: SkinMisc | undefined, name: IconName | string): SkinTexture | undefined {
  return misc?.icons?.[name]
}

/** 规整衬底字段：字符串写法等价于只写 `fill` */
export function groundOf(field: SkinGroundField | undefined): SkinGround | undefined {
  if (field === undefined) return undefined
  return typeof field === 'string' ? { fill: field } : field
}

/** 衬底的落法：背景图 ＋ 填充色 ＋ 描边色（`skin/06-item-building.md` §二 三元组） */
export interface GroundPaint {
  /** 衬底背景图；优先于 `fill`，`fill` 作其透明区的兜底 */
  img?: SkinPath
  /** 背景填充色；已含组件色 / 主题色兜底 */
  fill?: string
  /** 描边色；**未给即不绘制描边**（裁决 18） */
  stroke?: string
}

/**
 * 衬底的实际绘制取舍：**背景图优先于填充色**，`stroke` 独立判断。
 * 返回 `undefined` 即该元素**整节未接管**、沿用程序绘制形态（含组件色描边，取舍 `S-11`）。
 *
 * @param fallback `fill` 的兜底色：组件定义的 `color`，再缺由调用方给主题色（§2.3 字段表）
 */
export function groundPaint(
  field: SkinGroundField | undefined,
  fallback?: string,
): GroundPaint | undefined {
  const ground = groundOf(field)
  if (!ground) return undefined
  // 「整节未接管」看**原字段**：三项都空（如 `{}`）不算接管，兜底色也救不回来
  if (!ground.img && !ground.fill && !ground.stroke) return undefined
  return { img: ground.img, fill: ground.fill ?? fallback, stroke: ground.stroke }
}

/**
 * **建筑节点贴图**（`skin/06-item-building.md` §2.3）：`building[<id>].img` 优先，
 * 缺位回退通用件 `misc.nodes.building`，再缺即程序绘制圆角矩形。
 */
export function buildingImgOf(
  building: SkinBuilding | undefined,
  misc: SkinMisc | undefined,
  id: string | undefined,
): SkinTexture | undefined {
  return (id === undefined ? undefined : building?.[id]?.img) ?? misc?.nodes?.building
}

// ── 欢迎页与游戏首页 `startup` / `lobby`（`skin/08-pages.md`）─────────────

/**
 * 封面类背景的填充方式（`08-pages.md` §2.1）：`cover` / `contain` / `tile`，**缺省 `cover`**。
 * 手改过的包外 JSON 可能给别的词或 `undefined`，一律按 `cover` 处理（`KPG-1` 只提示、不改行为）。
 */
export function pageFitOf(bg: SkinImage | undefined): SkinFit {
  const fit = bg?.fit
  return fit === 'contain' || fit === 'tile' ? fit : 'cover'
}

/**
 * 取整屏背景（`08-pages.md` §2.1 / §2.2）：欢迎页与游戏首页**各查自己的 `bg`、互不借用**——
 * 只配了 `startup.bg` 时首页仍是纸面底纹（§2.3 逐节点降级）。
 */
export function pageBgOf(page: SkinStartup | SkinLobby | undefined): SkinImage | undefined {
  return page?.bg
}

/** 欢迎页的三件图形（§2.1）：标题字形 / 主视觉 / 主视觉上的装饰骰子 */
export type StartupArt = 'title' | 'cover' | 'dice'

/** 取欢迎页图形；未配该键即 `undefined`，该处照旧程序绘制 */
export function startupArtOf(startup: SkinStartup | undefined, art: StartupArt): SkinImage | undefined {
  return startup?.[art]
}

/**
 * 出身卡底的取图结果（§2.2 `card` ／ `card.selected`）。
 *
 * 卡底本身是**素材对象**（`img` 必填），`selected.img` 才是可缺的那个：缺位时**沿用卡底**
 * （同一张底、只换描边）。`stroke` 未给即**不碰**描边——与衬底三元组的「描边缺省不绘制」
 * 不同，这里是整张卡，未给就该由 `.class-card` / `.class-card.selected` 的 CSS 说了算。
 */
export interface CardPaint {
  /** 卡底：选中态没另给图时就是 `card.img` */
  img: SkinPath
  /** 选中态描边；只有选中那一态才可能有 */
  stroke?: SkinColor
}

/** 取出身卡底：`card` 整节没配即 `undefined`，卡片照旧手绘 */
export function lobbyCardPaint(lobby: SkinLobby | undefined, selected: boolean): CardPaint | undefined {
  const card = lobby?.card
  if (card === undefined) return undefined
  const sel = selected ? card.selected : undefined
  return { img: sel?.img ?? card.img, stroke: sel?.stroke }
}
