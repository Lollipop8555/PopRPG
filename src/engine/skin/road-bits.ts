/**
 * 道路位模式与槽位判定（`skin/01-road.md` §2.1 / §三 / §五）。
 *
 * 位序从**左上角起顺时针**：`bit0` 左上角 → `bit1` 中上 → … → `bit7` 左中。
 *
 * 角位按 §五 的**夹角口径**判定：某角**两侧的边都有路**时它才是**夹角角块**，参与计入角数 `c`；
 * 只挨一条路的**外侧角**一律忽略。故 `n ≤ 3` 时 `corner` / `tee_corner_*` / `tee_full`
 * 由夹角是否有路决定，而非由任意角位决定。
 *
 * 基准姿态（§四）：`dead_end` / `tee` / `tee_full` 缺口朝北；`tee_corner_nw` / `tee_corner_ne`
 * 以缺口朝南为基准（此时两个夹角分别落在西北与东北侧，绝对角名才区分得开）；
 * `straight` 连通南北；`bend` / `corner` 连通东北；`cross` 系（四边俱全，四角全是夹角）
 * 以**西北角起、顺时针**为基准。
 */

import type { RoadSlot } from '../../types'

/** 顺时针旋转角（度） */
export type RoadRotation = 0 | 90 | 180 | 270

/** 四邻与四角是否存在道路（缺省视为 false） */
export interface RoadNeighbors {
  nw?: boolean
  n?: boolean
  ne?: boolean
  e?: boolean
  se?: boolean
  s?: boolean
  sw?: boolean
  w?: boolean
}

/** 位序表：下标即位移 */
export const ROAD_BIT_ORDER = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

/** 槽位与姿态 */
export interface RoadTile {
  slot: RoadSlot
  rotate: RoadRotation
}

/** 由四邻与四角状态算出 8 位标记（`0`–`255`） */
export function roadFlag(nb: RoadNeighbors): number {
  let flag = 0
  for (let i = 0; i < ROAD_BIT_ORDER.length; i++) {
    if (nb[ROAD_BIT_ORDER[i]]) flag |= 1 << i
  }
  return flag
}

/** 角位序号：0 西北 · 1 东北 · 2 东南 · 3 西南（顺时针） */
const NW = 0
const NE = 1

/** 该角的两侧边是否都有路（即它是否为夹角角块）：西北↔北＋西、东北↔北＋东、东南↔东＋南、西南↔南＋西 */
function isAngleCorner(e: boolean[], i: number): boolean {
  if (i === 0) return e[0] && e[3]
  if (i === 1) return e[0] && e[1]
  if (i === 2) return e[1] && e[2]
  return e[2] && e[3]
}

/** 夹角且该角有路的角位（`n = 3` 时最多两个） */
function activeAngles(e: boolean[], c: boolean[]): number[] {
  return c.map((has, i) => has && isAngleCorner(e, i)).reduce<number[]>((acc, hit, i) => {
    if (hit) acc.push(i)
    return acc
  }, [])
}

/** 缺口朝北的基准姿态角：缺口在北为 0°，依次顺时针 */
function gapNorthRotate(gap: number): RoadRotation {
  return ((gap % 4) * 90) as RoadRotation
}

/**
 * 槽位与姿态判定（基准姿态见文件头）。
 */
export function roadTileOf(flag: number): RoadTile {
  const e = [1 << 1, 1 << 3, 1 << 5, 1 << 7].map((b) => (flag & b) !== 0) // 北 · 东 · 南 · 西
  const c = [1 << 0, 1 << 2, 1 << 4, 1 << 6].map((b) => (flag & b) !== 0) // 西北 · 东北 · 东南 · 西南
  const n = e.filter(Boolean).length

  if (n === 0) return { slot: 'isolated', rotate: 0 }

  // n = 1：断头路，基准缺口朝北＝连通南
  if (n === 1) return { slot: 'dead_end', rotate: e[0] ? 180 : e[1] ? 270 : e[2] ? 0 : 90 }

  // n = 2：相对为直路（南北为基准），相邻为折路（东北为基准）
  if (n === 2) {
    if ((e[0] && e[2]) || (e[1] && e[3])) return { slot: 'straight', rotate: e[0] ? 0 : 90 }
    const rotate: RoadRotation = e[0] && e[1] ? 0 : e[1] && e[2] ? 90 : e[2] && e[3] ? 180 : 270
    // 唯一的夹角即这两条边的交角（东北 / 东南 / 西南 / 西北），有路即 `corner`，无路即 `bend`
    const angle = e[0] && e[1] ? NE : e[1] && e[2] ? 2 : e[2] && e[3] ? 3 : NW
    return { slot: c[angle] ? 'corner' : 'bend', rotate }
  }

  // n = 3：三岔口。缺口 = 唯一无路的边；夹角为缺口两侧的两个角
  if (n === 3) {
    const gap = e.findIndex((v) => !v) // 0 北 · 1 东 · 2 南 · 3 西
    const angles = activeAngles(e, c)
    if (angles.length === 0) return { slot: 'tee', rotate: gapNorthRotate(gap) }
    if (angles.length === 2) return { slot: 'tee_full', rotate: gapNorthRotate(gap) }
    // 一个夹角有路：基准姿态为**缺口朝南**（夹角落在西北 / 东北），按顺时针折算基准角位
    const k = (gap - 2 + 4) % 4
    const base = (angles[0] - k + 4) % 4
    return { slot: base === NW ? 'tee_corner_nw' : 'tee_corner_ne', rotate: (k * 90) as RoadRotation }
  }

  // n = 4：四角全是夹角，全部参与区分（§三 cross 系），基准为西北角起顺时针
  const cc = c.filter(Boolean).length
  if (cc === 0) return { slot: 'cross', rotate: 0 }
  if (cc === 1) {
    const rotate: RoadRotation = c[0] ? 0 : c[1] ? 90 : c[2] ? 180 : 270
    return { slot: 'cross_one_corner', rotate }
  }
  if (cc === 2) {
    // 相邻（北侧为基准）或相对（主对角为基准）
    if ((c[0] && c[1]) || (c[1] && c[2]) || (c[2] && c[3]) || (c[3] && c[0])) {
      const rotate: RoadRotation = c[0] && c[1] ? 0 : c[1] && c[2] ? 90 : c[2] && c[3] ? 180 : 270
      return { slot: 'cross_adjacent', rotate }
    }
    return { slot: 'cross_diagonal', rotate: c[0] && c[2] ? 0 : 90 }
  }
  if (cc === 3) {
    // 基准缺西南角
    const rotate: RoadRotation = !c[3] ? 0 : !c[0] ? 90 : !c[1] ? 180 : 270
    return { slot: 'cross_three_corners', rotate }
  }
  return { slot: 'plaza', rotate: 0 }
}
