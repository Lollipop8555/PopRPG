/**
 * 形象 / 立绘 / 道具 / 建筑 / 衬底 / 容器 / 标记与骰子的取值（`skin/02-role.md`、
 * `skin/03-window.md`、`skin/04-misc.md`、`skin/06-item-building.md`）。
 *
 * 全部为「**有则取、无则 `undefined`**」的查表：回退链只在本文件明确写出，
 * 渲染侧拿到 `undefined` 即走程序绘制形态，不再自行猜测上级素材。
 *
 * 回退链（与文档逐条对应）：
 * - 棋子形象：玩家 → `role.player`；职业 / 怪物 / NPC 各自分组，**不跨组借用**。
 * - 立绘：职业缺位**先回退 `role.portraits.player`**；怪物与 NPC 缺位即不渲染，**不跨条借用**。
 * - 衬底：字符串写法等价于只写 `fill`；`stroke` 独立设置，未给即不绘制描边。
 * - 容器：对话框 / 抽屉 / 气泡三种容器各查 `window.surfaces` 一个键，**互不借用**。
 * - 地图标记：起点 / 终点 / 脚印三键各查 `misc.marks` 自己的键，**互不借用**（缺了照旧画程序图形）。
 * - 骰子：本体与骰面各一张；骰面 1–6 取点阵 `d1`–`d6`、其余点数取数字面 `numeric`。
 * - 道具 / 建筑：键一律为**组件 `id`**，不跨键借用；建筑贴图 `building.img` 缺位才回退
 *   `misc.nodes.building`（`06-item-building.md` §2.3，全篇唯一的一处跨节回退）。
 * - 欢迎页 / 游戏首页：两屏各查自己的 `bg`，**不互相借用**；出身卡 `selected.img` 缺位沿用卡底。
 */

import type {
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

/** 取棋子形象；`player` 忽略 `id`，其余分组按 `id` 查表且不跨组借用 */
export function roleSprite(
  role: SkinRole | undefined,
  kind: RoleKind,
  id?: string,
): SkinSprite | undefined {
  if (!role) return undefined
  if (kind === 'player') return role.player
  const group = kind === 'class' ? role.classes : kind === 'monster' ? role.monsters : role.npcs
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
  const group = kind === 'monster' ? ps.monsters : ps.npcs
  return id === undefined ? undefined : group?.[id]
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
