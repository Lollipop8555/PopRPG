/**
 * 测试夹具（仅供测试构造数据，**不是产品功能**、不参与任何线上流程）。
 * 作用：把预设套件组装成一个「已启用 + 铺好一张小地图」的项目，供构建页 / 游玩页用例使用。
 */

import type { GameMap, MapNode, Project } from '../types'
import { DEFAULT_RULES } from '../types'
import { newMapId } from '../lib/ids'
import {
  PRESET_BUILDINGS,
  PRESET_CLASSES,
  PRESET_ITEMS,
  PRESET_MONSTERS,
  PRESET_ROADS,
  PRESET_SKILLS,
} from '../presets'

/** 夹具地图上的节点：每一条路 / 每一种行为都露一次脸 */
const NODES: MapNode[] = [
  { x: 0, y: 0, type: 'start' },
  { x: 1, y: 0, type: 'road', ref: 'swamp' },
  { x: 2, y: 0, type: 'building', ref: 'chest_room' },
  { x: 3, y: 0, type: 'road', ref: 'volcano' },
  { x: 4, y: 0, type: 'building', ref: 'monster_room' },
  { x: 5, y: 0, type: 'road', ref: 'path' },
  { x: 6, y: 0, type: 'building', ref: 'merchant' },
  { x: 7, y: 0, type: 'road', ref: 'path' },
  { x: 8, y: 0, type: 'road', ref: 'belt' },
  { x: 9, y: 0, type: 'road', ref: 'path' },
  { x: 10, y: 0, type: 'end' },
  { x: 5, y: 1, type: 'road', ref: 'river' },
  { x: 5, y: 2, type: 'building', ref: 'chest_room' },
  { x: 7, y: 1, type: 'building', ref: 'stone_door' },
]

export function fixtureMap(): GameMap {
  return {
    id: newMapId(),
    name: '测试地穴',
    start: [0, 0],
    end: [10, 0],
    nodes: NODES.map((n) => ({ ...n })),
  }
}

export function fixtureEnabledIds(): string[] {
  return [
    ...PRESET_ROADS.map((c) => c.id),
    ...PRESET_BUILDINGS.map((c) => c.id),
    ...PRESET_ITEMS.map((c) => c.id),
    ...PRESET_MONSTERS.map((c) => c.id),
    ...PRESET_CLASSES.map((c) => c.id),
    ...PRESET_SKILLS.map((c) => c.id),
  ]
}

export function fixtureProject(): Project {
  return {
    name: '测试地穴',
    background: '测试用的背景文字。',
    enabledIds: fixtureEnabledIds(),
    rules: DEFAULT_RULES,
    maps: [fixtureMap()],
  }
}
