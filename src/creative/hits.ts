/**
 * 还缺哪些图（`skin/09-creative.md` §2.4）——本模式的核心价值。
 *
 * 拿一份参照的游戏 `.pmod`，回答「它需要的每个图片位置，当前皮肤给到了什么」：
 * - **已给图**：该图片位置有专用素材，无需动作；
 * - **用通用图**：无专用素材，但运行期会回退到某张通用素材（且那张已填）；
 * - **程序默认画法**：一路回退到底，仍用脚印 / 圆角矩形 / emoji —— 即**还缺的图**。
 *
 * 「用通用图」的回退关系**照抄运行期**（各节文档的缺省链），本文件不做第二套解释：
 * 建筑地图贴图 → `misc.nodes.building`；职业形象 → `role.player`；
 * 职业大图 → `role.portraits.player`；道路图片位置 → `misc.marks.footprint`。
 * 其余各节都**不跨键借用**（如怪物大图缺位即不渲染，不借用其他怪物的素材），故一律记程序默认画法。
 */

import type { RoadSlot, SkinManifest } from '../types'
import { roadTileOf, type RoadRotation } from '../engine/skin'
import { isFilled, readSlot, type CreativeSlot } from './slots'
import type { PmodTarget } from './target'

/** 一个图片位置的给图结论 */
export interface SlotHit {
  slot: CreativeSlot
  status: 'hit' | 'generic' | 'drawn'
  /** 用通用图时具体借用的通用图片位置路径 */
  via?: string
}

export interface HitReport {
  /** 有专用素材 */
  hits: SlotHit[]
  /** 借用通用素材 */
  generic: SlotHit[]
  /** 一路回退到程序默认画法 —— **还缺的图** */
  drawn: SlotHit[]
}

/**
 * 运行期的通用回退关系（全篇仅这四条）。
 * 判「用通用图」有个前提：**通用图片位置本身已填**，否则仍旧是程序默认画法。
 */
const GENERIC_RULES: readonly { test: RegExp; via: string }[] = [
  { test: /^building\.[^.]+\.img$/, via: 'misc.nodes.building' },
  { test: /^role\.classes\.[^.]+$/, via: 'role.player' },
  { test: /^role\.portraits\.classes\.[^.]+$/, via: 'role.portraits.player' },
  { test: /^road\.tiles\.[^.]+$/, via: 'misc.marks.footprint' },
]

/** 该图片位置的通用回退路径（没有则为 `undefined`） */
export function genericPathOf(path: string): string | undefined {
  return GENERIC_RULES.find((rule) => rule.test.test(path))?.via
}

/**
 * 参照的游戏**要求**的图片位置模式：只有这些算「该有的图」，其余（窗体底纹、提示条等）是可选观感，
 * 不纳入还缺的图——否则清单会被「你没配按钮图」这类无关项刷满。
 */
const REQUIRED_PATTERNS: readonly RegExp[] = [
  /^road\.tiles\.[^.]+$/,
  /^role\.classes\.[^.]+$/,
  /^role\.monsters\.[^.]+$/,
  /^role\.npcs\.[^.]+$/,
  /^role\.portraits\.[^.]+$/,
  /^item\.[^.]+\.icon$/,
  /^building\.[^.]+\.(icon|img)$/,
  /^background\.\d+\.img$/,
]

/** 该图片位置是否属于「参照的游戏要求」的范畴 */
export function isRequiredSlot(path: string): boolean {
  return REQUIRED_PATTERNS.some((pattern) => pattern.test(path))
}

/** 逐条判定（`slots` 应是**按参照的游戏筛选过**的图片位置表） */
export function hitCheck(manifest: SkinManifest, slots: readonly CreativeSlot[]): HitReport {
  const hits: SlotHit[] = []
  const generic: SlotHit[] = []
  const drawn: SlotHit[] = []

  for (const slot of slots) {
    if (!isRequiredSlot(slot.path)) continue
    if (isFilled(readSlot(manifest, slot.path))) {
      hits.push({ slot, status: 'hit' })
      continue
    }
    const via = genericPathOf(slot.path)
    if (via !== undefined && isFilled(readSlot(manifest, via))) {
      generic.push({ slot, status: 'generic', via })
      continue
    }
    drawn.push({ slot, status: 'drawn' })
  }

  return { hits, generic, drawn }
}

/* ------------------------------------------------------------------ */
/* 道路 flag 矩阵（16 × 16 ＝ 256 个组合）                              */
/* ------------------------------------------------------------------ */

/** 矩阵中的一格：一个 flag 的图片位置、朝向与当前填充情况 */
export interface FlagCell {
  /** `0`–`255`；行 ＝ 高 4 位，列 ＝ 低 4 位 */
  flag: number
  slot: RoadSlot
  rotate: RoadRotation
  /** 该 flag 是否出现在参照的游戏的地图上 */
  used: boolean
  /** 该 flag 所属图片位置是否已绑定素材 */
  filled: boolean
}

/**
 * 生成 256 格的 flag 矩阵。
 * 行 = `flag >> 4`、列 = `flag & 15`，与 §2.4 的「16 × 16 网格」一致。
 */
export function flagMatrix(manifest: SkinManifest, target?: PmodTarget): FlagCell[] {
  const used = new Set(target?.flags ?? [])
  const tiles = manifest.road?.tiles ?? {}
  const filledBySlot = new Map<RoadSlot, boolean>()
  const cells: FlagCell[] = []
  for (let flag = 0; flag < 256; flag++) {
    const tile = roadTileOf(flag)
    let filled = filledBySlot.get(tile.slot)
    if (filled === undefined) {
      filled = isFilled(tiles[tile.slot])
      filledBySlot.set(tile.slot, filled)
    }
    cells.push({ flag, slot: tile.slot, rotate: tile.rotate, used: used.has(flag), filled })
  }
  return cells
}

/** 矩阵按「行」切好（16 行 × 16 列），UI 直接铺网格 */
export function flagMatrixRows(cells: readonly FlagCell[]): FlagCell[][] {
  const rows: FlagCell[][] = []
  for (let row = 0; row < 16; row++) rows.push(cells.slice(row * 16, row * 16 + 16))
  return rows
}

/**
 * 「按朝向」视图：把 256 个组合按**图片位置**归并，列出每个图片位置覆盖哪些 flag。
 * 用于确认旋转复用是否正确（`skin/01-road.md` §四：同一张图靠旋转覆盖同图片位置的多个 flag）。
 */
export interface PoseGroup {
  slot: RoadSlot
  rotate: RoadRotation
  flags: number[]
}

export function poseGroups(target?: PmodTarget): PoseGroup[] {
  const map = new Map<string, PoseGroup>()
  for (let flag = 0; flag < 256; flag++) {
    const tile = roadTileOf(flag)
    const key = `${tile.slot}@${tile.rotate}`
    const group = map.get(key)
    if (group) group.flags.push(flag)
    else map.set(key, { slot: tile.slot, rotate: tile.rotate, flags: [flag] })
  }
  const used = new Set(target?.flags ?? [])
  // 参照的游戏用过的小组排前面，组内按 flag 升序
  return [...map.values()]
    .map((group) => ({ ...group, used: group.flags.some((flag) => used.has(flag)) }))
    .sort((a, b) => Number(b.used) - Number(a.used) || a.slot.localeCompare(b.slot) || a.rotate - b.rotate)
    .map(({ slot, rotate, flags }) => ({ slot, rotate, flags }))
}
