/** 组件库形态（§4.0 / §4.7）：跨项目长期存活，库存 localStorage 里，不随项目而生灭。 */

import type {
  BackgroundDef,
  BuildingDef,
  ClassDef,
  ComponentKind,
  ItemDef,
  MonsterDef,
  RoadDef,
  SkillDef,
} from './component'

export interface Library {
  roads: RoadDef[]
  buildings: BuildingDef[]
  items: ItemDef[]
  monsters: MonsterDef[]
  classes: ClassDef[]
  skills: SkillDef[]
  backgrounds: BackgroundDef[]
}

/** 八个分区与世界里的 key 一一对应（§5.0.1） */
export const LIBRARY_KEYS = [
  'roads',
  'buildings',
  'items',
  'monsters',
  'classes',
  'skills',
  'backgrounds',
] as const

export type LibraryKey = (typeof LIBRARY_KEYS)[number]

/** 分区 → 组件大类（背景单独一列） */
export const LIBRARY_KEY_TO_KIND: Record<LibraryKey, ComponentKind> = {
  roads: 'road',
  buildings: 'building',
  items: 'item',
  monsters: 'monster',
  classes: 'class',
  skills: 'skill',
  backgrounds: 'background',
}

export const KIND_TO_LIBRARY_KEY: Record<ComponentKind, LibraryKey> = {
  road: 'roads',
  building: 'buildings',
  item: 'items',
  monster: 'monsters',
  class: 'classes',
  skill: 'skills',
  background: 'backgrounds',
}

/** 地图件 vs 非地图件（§4.0 / §5.0.1） */
export const MAP_PIECE_KINDS: readonly ComponentKind[] = ['road', 'building']

export function isMapPiece(kind: ComponentKind): boolean {
  return MAP_PIECE_KINDS.includes(kind)
}

export function emptyLibrary(): Library {
  return {
    roads: [],
    buildings: [],
    items: [],
    monsters: [],
    classes: [],
    skills: [],
    backgrounds: [],
  }
}
