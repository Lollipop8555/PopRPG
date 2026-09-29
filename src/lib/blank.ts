/**
 * 新建 / 复制组件（§5.3）
 *
 * 自建 id 用「类型前缀 + 随机串」，这样来源（`预设` / `自建`）当场就能派生出来（§3.2）。
 */

import type {
  AnyComponent,
  BuildingDef,
  ClassDef,
  ComponentKind,
  ItemDef,
  ItemKind,
  MonsterDef,
  NpcDef,
  SkillDef,
  Stats,
} from '../types'
import { zeroStatValues } from '../types'
import { newComponentId } from './ids'
import { randomComponentColor } from './color'

export const DEFAULT_ICON: Record<ComponentKind, string> = {
  road: '🛤️',
  building: '🏠',
  item: '🧪',
  monster: '👺',
  class: '🛡️',
  skill: '⚔️',
  npc: '🧑',
  background: '🏕️',
}

export const DEFAULT_NAME: Record<ComponentKind, string> = {
  road: '新建道路',
  building: '新建建筑',
  item: '新建道具',
  monster: '新建怪物',
  class: '新建职业',
  skill: '新建技能',
  npc: '新建 NPC',
  background: '新建背景',
}

function defaultStats(): Stats {
  return { hp: [6, 12], mp: [0, 2], patk: [2, 4], matk: [0, 2], pdef: [1, 2], mdef: [1, 2] }
}

/** 从零建一条库组件（§5.3「＋ 新建」） */
export function blankComponent(kind: ComponentKind, itemKind: ItemKind = 'consumable'): AnyComponent {
  const id = newComponentId(kind)
  const base = { id, name: DEFAULT_NAME[kind], icon: DEFAULT_ICON[kind], color: randomComponentColor() }
  switch (kind) {
    case 'road':
      return { ...base, cost: { step: 1 } }
    case 'building': {
      const def: BuildingDef = { ...base, encounter: 'empty' }
      return def
    }
    case 'item': {
      const def: ItemDef = { ...base, kind: itemKind }
      if (itemKind === 'equipment') {
        def.slots = []
        def.modifiers = {}
      } else {
        def.usable = ['move']
        def.effects = []
      }
      return def
    }
    case 'monster': {
      const def: MonsterDef = { ...base, stats: defaultStats(), attack_weights: {}, point_reward: 0 }
      return def
    }
    case 'class': {
      const def: ClassDef = {
        ...base,
        base_stats: zeroStatValues(),
        free_points: 25,
        buffs: {},
        inventory_size: 50,
        starting_items: [],
      }
      return def
    }
    case 'skill': {
      const def: SkillDef = {
        ...base,
        dim: 'patk',
        target: 'opponent',
        vs: 'auto',
        bonus: 0,
        apply: 'hp',
        cost: {},
      }
      return def
    }
    case 'npc': {
      const def: NpcDef = { ...base, dialogs: {} }
      return def
    }
    case 'background':
    default:
      return { ...base, desc: '' }
  }
}

/** 以现有条目为起点派生一条新库组件（原条目**不受影响**） */
export function duplicateOf(kind: ComponentKind, source: AnyComponent): AnyComponent {
  const clone = structuredClone(source)
  return { ...clone, id: newComponentId(kind), name: `${source.name} 副本`, color: clone.color ?? randomComponentColor() }
}
