/**
 * 靶子 `.pmod` 的读取与骨架生成（`skin/09-creative.md` §2.1 / §2.4）。
 *
 * 「靶子」＝ Creative 里用来对照的那一份 `.pmod`：它决定
 * **有哪些槽位值得填**（该局启用了哪些组件、地图上铺了哪些道路姿态）。
 * 读取只做两件事：把启用范围摊平成键集合、把地图摊平成用到的道路 flag。
 */

import type { GameMap, RoadSlot, SkinManifest, SkinRoadStyle } from '../types'
import { ROAD_SLOTS } from '../types'
import type { ParsedPmod } from '../io/pmod'
import { roadNeighbors } from '../play/road'
import { roadFlag, roadTileOf, type RoadRotation } from '../engine/skin'
import { COMMON_ICON_NAMES, emptySlotKeys, type SlotKeys } from './slots'

/** 一个 flag 的判定结果（flag 矩阵视图与命中检查共用） */
export interface TargetPose {
  /** 8 位邻接标记，`0`–`255` */
  flag: number
  slot: RoadSlot
  rotate: RoadRotation
}

/** 读出的一份靶子 */
export interface PmodTarget {
  /** 显示名（`.pmod` 文件名或工程名） */
  name: string
  maps: GameMap[]
  /** 组件 id → 中文名（UI 展示用；查不到回退 id） */
  labels: Record<string, string>
  /** 该局值得填的键集合 */
  keys: SlotKeys
  /** 地图上用到的全部 flag（升序去重） */
  flags: number[]
  /** 用到的道路槽位（按 `ROAD_SLOTS` 的固定次序） */
  slots: RoadSlot[]
  /** 每个 flag 的槽位与姿态 */
  poses: TargetPose[]
  /** 道路样式集的候选底样（`road.styles`；靶子的道路组件带标签时用它组织素材） */
  roadStyles: SkinRoadStyle[]
}

/** 组件显示名：`name` 优先，缺省回退 `id` */
function labelOf(def: { id: string; name?: string }): string {
  return typeof def.name === 'string' && def.name !== '' ? def.name : def.id
}

/**
 * 读一份靶子。
 *
 * 两点口径：
 * - `items` / `classes` / `monsters` / `npcs` 取**该局组件的全部 id**——`.pmod` 里出现即视为启用
 *   （`05-npc.md` §4.9：NPC 只出现在建筑里，不走 `enabledIds`，故同样按「出现即启用」收）。
 * - `buildings` 取**地图上真正铺下的** `ref`（地图件靠铺设，与构建页 `enabledIds` 口径一致）。
 */
export function readPmodTarget(parsed: ParsedPmod, name?: string): PmodTarget {
  const maps = parsed.maps
  const labels: Record<string, string> = {}

  const keys = emptySlotKeys()
  const collect = (source: 'items' | 'classes' | 'monsters' | 'npcs', list: { id: string; name?: string }[]) => {
    for (const def of list) {
      keys[source].push(def.id)
      labels[def.id] = labelOf(def)
    }
  }
  collect('items', parsed.components.items)
  collect('classes', parsed.components.classes)
  collect('monsters', parsed.components.monsters)
  collect('npcs', parsed.components.npcs)

  const placedBuildings = new Set<string>()
  for (const map of maps) {
    for (const node of map.nodes) {
      if (node.type === 'building' && typeof node.ref === 'string' && node.ref !== '') {
        placedBuildings.add(node.ref)
      }
    }
  }
  for (const def of parsed.components.buildings) {
    labels[def.id] = labelOf(def)
    if (placedBuildings.has(def.id)) keys.buildings.push(def.id)
  }

  keys.icons.push(...COMMON_ICON_NAMES)

  // 道路：逐格取左上格的邻接标记（`play/road.ts` 与运行期同一口径）
  const flagSet = new Set<number>()
  for (const map of maps) {
    for (const node of map.nodes) {
      if (node.type !== 'road') continue
      flagSet.add(roadFlag(roadNeighbors(map, node.x, node.y)))
    }
  }
  const flags = [...flagSet].sort((a, b) => a - b)
  const poses = flags.map((flag) => ({ flag, ...roadTileOf(flag) }))
  const used = new Set(poses.map((pose) => pose.slot))
  const slots = ROAD_SLOTS.filter((slot) => used.has(slot))

  // 道路样式集：靶子的道路组件带标签时，把标签集合登记成候选底样（不自建 base 前缀）
  const tagSet = new Set<string>()
  for (const def of parsed.components.roads) for (const tag of def.tags ?? []) tagSet.add(tag)
  const roadStyles: SkinRoadStyle[] = tagSet.size > 0 ? [{ tags: [...tagSet] }] : []

  return {
    name: name ?? parsed.name,
    maps,
    labels,
    keys,
    flags,
    slots,
    poses,
    roadStyles,
  }
}

/**
 * 由靶子生成**待填骨架**（§2.1「从 `.pmod` 生成骨架」）。
 *
 * 每个槽位写**空字符串**占位——它是「这里还缺图」的显式记号，
 * 导出后由 `KP-2` 逐条提示（提示但不阻断），与设计一致。
 */
export function skeletonManifest(target: PmodTarget, name?: string): SkinManifest {
  const tiles: Record<string, string> = {}
  for (const slot of target.slots) tiles[slot] = ''

  const manifest: SkinManifest = {
    format: 1,
    name: name ?? target.name,
    road: { tiles },
  }
  if (target.roadStyles.length > 0) manifest.road = { ...manifest.road, styles: target.roadStyles }

  const classes: Record<string, string> = {}
  for (const id of target.keys.classes) classes[id] = ''
  const monsters: Record<string, string> = {}
  for (const id of target.keys.monsters) monsters[id] = ''
  const npcs: Record<string, string> = {}
  for (const id of target.keys.npcs) npcs[id] = ''

  const portraitsClasses: Record<string, string> = {}
  for (const id of target.keys.classes) portraitsClasses[id] = ''
  const portraitsMonsters: Record<string, string> = {}
  for (const id of target.keys.monsters) portraitsMonsters[id] = ''
  const portraitsNpcs: Record<string, string> = {}
  for (const id of target.keys.npcs) portraitsNpcs[id] = ''

  manifest.role = {
    player: '',
    classes,
    monsters,
    npcs,
    portraits: {
      player: '',
      classes: portraitsClasses,
      monsters: portraitsMonsters,
      npcs: portraitsNpcs,
    },
  }

  const items: Record<string, { icon: string }> = {}
  for (const id of target.keys.items) items[id] = { icon: '' }
  if (target.keys.items.length > 0) manifest.item = items

  const buildings: Record<string, { icon: string }> = {}
  for (const id of target.keys.buildings) buildings[id] = { icon: '' }
  if (target.keys.buildings.length > 0) manifest.building = buildings

  return manifest
}

/** 空白骨架（§2.1「从空白骨架开始」）：只有格式版本与名字 */
export function blankManifest(name = '未命名皮肤'): SkinManifest {
  return { format: 1, name }
}

/** 靶子键集合的展示项（名称优先，供 UI 列表） */
export function keyLabels(target: PmodTarget, source: keyof SlotKeys): { id: string; label: string }[] {
  return target.keys[source].map((id) => ({ id, label: target.labels[id] ?? id }))
}
