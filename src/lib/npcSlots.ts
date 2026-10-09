/**
 * NPC **槽位（SlotN）** 的公共纯函数（§4.9.3，**V2.4 裁决 62–66**）。
 *
 * 被三方共用，**只此一份**，避免各写各的几何 / 配色：
 * - 构建页（实例页槽位列表 ＋ 画布槽位标记，§5.6）
 * - 校验（`K38`–`K40`，§5.7）
 * - 游玩态（落点触发 ＋ 无皮肤画槽位色圆环，§4.8.12 / skin §4.1 落点 6）
 *
 * 三条硬规矩（裁决 62–63）：
 * - 槽号 ＝ **声明序**（数组下标），**删除不回收**；
 * - 槽位数 ≤ `w × h`，超出**只取前 `w × h` 个**（`K38`）；
 * - 落点 `at` 是**建筑自身格坐标系**（左上 `(0,0)`，`0 ≤ dx < w`、`0 ≤ dy < h`），
 *   越界 `K39`、与同实例前者重复 `K40`，二者一并**落回缺省格**。
 */

import type { MapNode, NpcSlot } from '../types'

/* ------------------------------------------------------------------ */
/* 配色（构建页该槽行与游玩态圆环共用）                                 */
/* ------------------------------------------------------------------ */

/**
 * 槽位调色板：**按槽号取色**，构建页的槽位行与画布标记同色、游玩态的无皮肤圆环同色。
 * 槽号超过色数 → **循环取色**（`KM-4`）。
 */
export const SLOT_PALETTE: readonly string[] = [
  '#e06c75', // 红
  '#e5c07b', // 黄
  '#98c379', // 绿
  '#61afef', // 蓝
  '#c678dd', // 紫
  '#56b6c2', // 青
  '#d19a66', // 橙
  '#7f9cf5', // 靛
]

/** 槽号 → 颜色（越界循环取色，`KM-4`） */
export function slotColor(slotN: number): string {
  const size = SLOT_PALETTE.length
  const i = ((Math.floor(slotN) % size) + size) % size
  return SLOT_PALETTE[i]
}

/* ------------------------------------------------------------------ */
/* 几何：缺省落点（先 y 后 x 字典序第 N 格）                            */
/* ------------------------------------------------------------------ */

/** 建筑的槽位数上限 ＝ `w × h` */
export function slotCap(node: MapNode): number {
  return Math.max(1, node.w ?? 1) * Math.max(1, node.h ?? 1)
}

/**
 * 缺省落点（裁决 63）：建筑自身格坐标系里**先 y 后 x 字典序**的第 `index` 格。
 * `slot0` → `(0,0)`；`w × h` 内的下标循环。
 */
export function defaultSlotCell(index: number, w: number, h: number): [number, number] {
  const cw = Math.max(1, Math.floor(w))
  const ch = Math.max(1, Math.floor(h))
  const total = cw * ch
  const i = total > 0 ? ((Math.floor(index) % total) + total) % total : 0
  return [i % cw, Math.floor(i / cw)]
}

/** 建筑实例上是否配了「有内容」的 NPC（空数组 / 全空 `ids` → 视为没有） */
export function hasAnyNpc(node: MapNode): boolean {
  return (node.npcs ?? []).some((slot) => (slot?.ids?.length ?? 0) > 0)
}

/** 该槽候选 NPC id（去空） */
export function slotIds(slot: NpcSlot | undefined): string[] {
  return (slot?.ids ?? []).map((id) => String(id)).filter((id) => id !== '')
}

/* ------------------------------------------------------------------ */
/* 落点求解（K38 / K39 / K40 → 生效落点）                               */
/* ------------------------------------------------------------------ */

export interface ResolvedSlot {
  /** 槽号（声明序，从 0 起；删除不回收） */
  slotN: number
  /** 该槽候选 NPC id（去空） */
  ids: string[]
  /** 该槽写死的方案名（无 → `undefined`） */
  mod?: string
  /** 生效落点（建筑自身格坐标，已按 `K38`–`K40` 修正） */
  at: [number, number]
  /** 原声明 `at` **越界**（`K39`，已落回缺省格） */
  outOfRange: boolean
  /** 原声明 `at` 与**前者重复**（`K40`，已落回缺省格） */
  duplicateAt: boolean
}

/**
 * 求解一个建筑实例的**生效槽位表**：套用 `K38`（只取前 `w × h` 个）、
 * `K39`（越界 → 缺省格）、`K40`（与前者重复 → 缺省格）三条规则。
 *
 * **先声明者优先**：`at` 的占用按声明序累积，后者撞格才回退。
 */
export function resolveSlots(node: MapNode): ResolvedSlot[] {
  const w = Math.max(1, node.w ?? 1)
  const h = Math.max(1, node.h ?? 1)
  const cap = w * h
  const raw = (node.npcs ?? []).slice(0, cap) // K38：多出的槽不会被抽定
  const used = new Set<string>()
  const out: ResolvedSlot[] = []

  raw.forEach((slot, i) => {
    const fallback = defaultSlotCell(i, w, h)
    let at: [number, number] = fallback
    let outOfRange = false
    let duplicateAt = false

    const declared = slot?.at
    if (declared) {
      const dx = Math.floor(declared[0])
      const dy = Math.floor(declared[1])
      if (dx >= 0 && dx < w && dy >= 0 && dy < h) {
        const key = `${dx},${dy}`
        if (used.has(key)) duplicateAt = true // K40 → 落回缺省格
        else at = [dx, dy]
      } else {
        outOfRange = true // K39 → 落回缺省格
      }
    }

    used.add(`${at[0]},${at[1]}`)
    const mod = slot?.dialog?.mod && String(slot.dialog.mod).trim() !== '' ? String(slot.dialog.mod).trim() : undefined
    out.push({ slotN: i, ids: slotIds(slot), mod, at, outOfRange, duplicateAt })
  })

  return out
}

/**
 * 找出落在该格上的**槽**（建筑自身格坐标）—— 游玩态「踩到落点格触发该槽对话」用。
 * 同一格至多归属一个槽（`K40` 已保证不重叠）。
 */
export function slotAtCell(node: MapNode, dx: number, dy: number): ResolvedSlot | undefined {
  return resolveSlots(node).find((s) => s.at[0] === dx && s.at[1] === dy)
}

/** 生效落点的世界坐标（建筑左上角 ＋ 槽内偏移） */
export function slotWorldAt(node: MapNode, at: [number, number]): [number, number] {
  return [node.x + at[0], node.y + at[1]]
}
