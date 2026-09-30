/**
 * 形象 / 立绘 / 道具 / 建筑 / 衬底的取值（`skin/02-role.md`、`skin/06-item-building.md`）。
 *
 * 全部为「**有则取、无则 `undefined`**」的查表：回退链只在本文件明确写出，
 * 渲染侧拿到 `undefined` 即走程序绘制形态，不再自行猜测上级素材。
 *
 * 回退链（与文档逐条对应）：
 * - 棋子形象：玩家 → `role.player`；职业 / 怪物 / NPC 各自分组，**不跨组借用**。
 * - 立绘：职业缺位**先回退 `role.portraits.player`**；怪物与 NPC 缺位即不渲染，**不跨条借用**。
 * - 衬底：字符串写法等价于只写 `fill`；`stroke` 独立设置，未给即不绘制描边。
 */

import type {
  SkinBuilding,
  SkinBuildingSkin,
  SkinGround,
  SkinGroundField,
  SkinItem,
  SkinItemSkin,
  SkinPortrait,
  SkinPortraitObject,
  SkinRole,
  SkinSprite,
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

/** 规整衬底字段：字符串写法等价于只写 `fill` */
export function groundOf(field: SkinGroundField | undefined): SkinGround | undefined {
  if (field === undefined) return undefined
  return typeof field === 'string' ? { fill: field } : field
}

/**
 * 衬底的实际绘制取舍：**背景图优先于填充色**，`stroke` 独立判断。
 * 返回 `undefined` 即该节点不设衬底、沿用程序默认。
 */
export function groundPaint(
  field: SkinGroundField | undefined,
): { img?: string; fill?: string; stroke?: string } | undefined {
  const ground = groundOf(field)
  if (!ground) return undefined
  const paint = { img: ground.img, fill: ground.fill, stroke: ground.stroke }
  return paint.img || paint.fill || paint.stroke ? paint : undefined
}
