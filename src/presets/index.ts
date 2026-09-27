/**
 * 内置预设总表（§6.1）—— 首次启动时**播种一次**进组件库，之后就是用户的资产。
 *
 * 来源判定（§3.2）：id 命中这张表 = `预设`，否则 = `自建`。七大类一视同仁。
 */

import type { AnyComponent, ComponentKind, Library } from '../types'
import { LIBRARY_KEYS } from '../types'
import { fallbackColor } from '../lib/color'
import { PRESET_BACKGROUNDS } from './backgrounds'
import { PRESET_BUILDINGS } from './buildings'
import { PRESET_CLASSES } from './classes'
import { PRESET_ITEMS } from './items'
import { PRESET_MONSTERS } from './monsters'
import { PRESET_ROADS } from './roads'
import { PRESET_SKILLS } from './skills'

export {
  PRESET_BACKGROUNDS,
  PRESET_BUILDINGS,
  PRESET_CLASSES,
  PRESET_ITEMS,
  PRESET_MONSTERS,
  PRESET_ROADS,
  PRESET_SKILLS,
}

/** 一份深拷贝的预设库，播种时用（避免把模块常量直接交给 store 去改） */
export function presetLibrary(): Library {
  const lib = structuredClone({
    roads: PRESET_ROADS,
    buildings: PRESET_BUILDINGS,
    items: PRESET_ITEMS,
    monsters: PRESET_MONSTERS,
    classes: PRESET_CLASSES,
    skills: PRESET_SKILLS,
    backgrounds: PRESET_BACKGROUNDS,
  })
  // 预设本身不带 color，这里按 id 给一个稳定区分色（不随机，刷新不变）
  for (const key of LIBRARY_KEYS) {
    const arr = lib[key] as AnyComponent[]
    lib[key] = arr.map((c) => (c.color ? c : { ...c, color: fallbackColor(c.id) })) as never
  }
  return lib
}

/** id → 原始预设定义 */
export const PRESET_INDEX: ReadonlyMap<string, AnyComponent> = new Map<string, AnyComponent>(
  [
    ...PRESET_ROADS,
    ...PRESET_BUILDINGS,
    ...PRESET_ITEMS,
    ...PRESET_MONSTERS,
    ...PRESET_CLASSES,
    ...PRESET_SKILLS,
    ...PRESET_BACKGROUNDS,
  ].map((c) => [c.id, c]),
)

export function isPresetId(id: string): boolean {
  return PRESET_INDEX.has(id)
}

export function presetDef(id: string): AnyComponent | undefined {
  const raw = PRESET_INDEX.get(id)
  return raw ? structuredClone(raw) : undefined
}

export function presetKind(id: string): ComponentKind | undefined {
  if (PRESET_ROADS.some((c) => c.id === id)) return 'road'
  if (PRESET_BUILDINGS.some((c) => c.id === id)) return 'building'
  if (PRESET_ITEMS.some((c) => c.id === id)) return 'item'
  if (PRESET_MONSTERS.some((c) => c.id === id)) return 'monster'
  if (PRESET_CLASSES.some((c) => c.id === id)) return 'class'
  if (PRESET_SKILLS.some((c) => c.id === id)) return 'skill'
  if (PRESET_BACKGROUNDS.some((c) => c.id === id)) return 'background'
  return undefined
}
