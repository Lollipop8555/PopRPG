/**
 * 组件库七大类 + 背景（§4.0 / §4.1~§4.5 / §4.8.3）。
 * 公共字段：id / name / icon / desc / tags —— 七大类完全一致，没有来源字段。
 */

import type { PartialStatValues, RollSet, StatKey, Stats, StatValues } from './common'

/** 组件所属大类（= 组件库里的分区，§5.0.1） */
export type ComponentKind =
  | 'road'
  | 'building'
  | 'item'
  | 'monster'
  | 'class'
  | 'skill'
  | 'background'

/** 七大类 + 背景的公共字段，一个不多一个不少 */
export interface ComponentBase {
  id: string
  name: string
  icon: string
  desc?: string
  tags?: string[]
  /** 组件颜色（#rrggbb），渲染时描边 100% alpha + 填充 30% alpha（§视觉基调·色彩系统） */
  color?: string
}

/* ------------------------------------------------------------------ */
/* 消耗 / 权限 —— 地图件（道路 + 建筑）共用同一套（§4.5 / §4.4）       */
/* ------------------------------------------------------------------ */

/** 消耗：步数 / 血量 / 法力 */
export type MapCost = {
  step?: number
  hp?: number
  mp?: number
}

export type GateMode = 'any' | 'all'

/**
 * 权限不满足时怎么办：
 * - `block`   走不进去
 * - `penalty` 能进，但额外付 penalty
 * （事件块语义相同：`penalty` 表示允许强闯，后果按 `on_fail` 结算，§4.8.9）
 */
export type GateMissing = 'block' | 'penalty'

export interface Gate {
  tags: string[]
  mode?: GateMode
  missing?: GateMissing
  penalty?: MapCost
}

/* ------------------------------------------------------------------ */
/* 效果 five ops（§4.8.10）                                            */
/* ------------------------------------------------------------------ */

export type EffectTarget = 'self' | 'opponent'

export type EffectOp =
  | { op: 'add_stat'; target: EffectTarget; stat: StatKey; delta: number }
  | {
      op: 'add_tag'
      tag: string
      duration: number
      per_turn?: PartialStatValues
      modifiers?: PartialStatValues
    }
  | { op: 'remove_tag'; tag: string }
  | { op: 'learn_skill'; skill: string }
  | { op: 'forget_skill'; skill: string }

export const ALL_EFFECT_OPS: readonly EffectOp['op'][] = [
  'add_stat',
  'add_tag',
  'remove_tag',
  'learn_skill',
  'forget_skill',
]

/* ------------------------------------------------------------------ */
/* 池 + 抽取算法（§4.8.5 / §4.8.6）                                    */
/* ------------------------------------------------------------------ */

export type ItemKind = 'equipment' | 'consumable'

export type PoolEntry = string | { id: string; weight: number }

export interface PoolFilter {
  itemKind?: ItemKind
  tags?: string[]
}

/** 奖励池 / 怪物池 / 商店上架池 —— 三处结构完全相同；上架池可用 pick 控制这次抽几件（§4.8.11） */
export interface PoolRef {
  source: 'ids' | 'filter'
  ids?: PoolEntry[]
  filter?: PoolFilter
  pick?: PickAlgo
}

export type PickAlgo =
  | { algo: 'tiers'; dice: string; tiers: { upto: number; n: number }[] }
  | { algo: 'count'; dice: string; range: [number, number] }

export type CopiesAlgo =
  | { algo: 'fixed'; n: number }
  | { algo: 'value'; dice: string; range: [number, number] }
  | { algo: 'multiplier'; dice: string; steps: number[] }

export interface RewardPick {
  pick: PickAlgo
  copies: CopiesAlgo
}

/* ------------------------------------------------------------------ */
/* 道路 §4.5                                                           */
/* ------------------------------------------------------------------ */

export interface RoadDef extends ComponentBase {
  cost?: MapCost
  gate?: Gate
}

/* ------------------------------------------------------------------ */
/* 建筑 §4.4（五种行为并列，不互相嵌套）                                */
/* ------------------------------------------------------------------ */

export type EncounterKind = 'empty' | 'treasure' | 'monster' | 'event' | 'shop'

export const ENCOUNTER_KINDS: readonly EncounterKind[] = [
  'empty',
  'treasure',
  'monster',
  'event',
  'shop',
]

export interface MimicDef {
  chance: number
  monster: string
  reward_pool?: PoolRef
}

/** 事件判定：掷骰 + 加值属性 vs 固定难度（§4.8.9） */
export interface CheckDef {
  dice?: string
  add: StatKey | 'none'
  target: number
}

export interface GrantEntry {
  id: string
  count: number
}

export interface EventOutcome {
  text?: string
  cost?: MapCost
  point_reward?: number
  grant?: GrantEntry[]
  effects?: EffectOp[]
}

/** 事件块 = 门槛 gate（能不能碰）+ 判定 check（做不做得成） */
export interface EventBlock {
  text?: string
  gate?: Gate
  check?: CheckDef
  on_success?: EventOutcome
  on_fail?: EventOutcome
  once?: boolean
}

/** 定价：货币就是一件道具（§4.8.11） */
export interface PriceDef {
  currency: string
  algo: 'fixed' | 'value'
  n?: number
  dice?: string
  range?: [number, number]
}

export interface BuildingDef extends ComponentBase {
  encounter: EncounterKind
  cost?: MapCost
  gate?: Gate
  point_reward?: number
  reward_pool?: PoolRef
  monster_pool?: PoolRef
  stock?: PoolRef
  pick?: PickAlgo
  copies?: CopiesAlgo
  mimic?: MimicDef
  price?: PriceDef
  restock?: 'on_enter' | 'never'
  event?: EventBlock
}

/* ------------------------------------------------------------------ */
/* 道具 §4.3                                                           */
/* ------------------------------------------------------------------ */

export type EquipSlot = 'head' | 'hands' | 'feet' | 'body' | 'weapon'

export const EQUIP_SLOTS: readonly EquipSlot[] = ['head', 'hands', 'feet', 'body', 'weapon']

export const SLOT_LABEL: Record<EquipSlot, string> = {
  head: '头',
  hands: '手',
  feet: '脚',
  body: '身',
  weapon: '武器',
}

export type UsableScene = 'battle' | 'move'

export interface ItemDef extends ComponentBase {
  kind: ItemKind
  slots?: EquipSlot[]
  modifiers?: PartialStatValues
  usable?: UsableScene[]
  effects?: EffectOp[]
}

/* ------------------------------------------------------------------ */
/* 怪物 §4.1                                                           */
/* ------------------------------------------------------------------ */

export interface MonsterDef extends ComponentBase {
  stats: Stats
  attack_weights?: Record<string, number>
  effects?: EffectOp[]
  atk_roll?: RollSet
  def_roll?: RollSet
  stat_dice?: string
  point_reward?: number
  reward_pool?: PoolRef
  pick?: PickAlgo
  copies?: CopiesAlgo
}

/* ------------------------------------------------------------------ */
/* 职业 §4.2.3 —— 只提供先天的属性配置，不含 skills                    */
/* ------------------------------------------------------------------ */

export interface ClassDef extends ComponentBase {
  base_stats: StatValues
  free_points: number
  buffs?: PartialStatValues
  tags?: string[]
  inventory_size?: number
  starting_items?: string[]
}

/* ------------------------------------------------------------------ */
/* 技能 §4.8.3 —— 取哪一维 + 攻击目标 + 附带什么                        */
/* ------------------------------------------------------------------ */

export type SkillTarget = 'opponent' | 'self'

export interface SkillDef extends ComponentBase {
  dim: StatKey
  target: SkillTarget
  vs: StatKey | 'auto' | 'none'
  bonus: number
  apply: 'hp' | 'mp' | 'none'
  cost?: MapCost
  roll?: RollSet
  effects?: EffectOp[]
}

/* ------------------------------------------------------------------ */
/* 背景 §5.0.1 —— 全局，始终生效                                       */
/* ------------------------------------------------------------------ */

export interface BackgroundDef extends ComponentBase {}

/** 任一类组件的可辨识联合 */
export type AnyComponent =
  | RoadDef
  | BuildingDef
  | ItemDef
  | MonsterDef
  | ClassDef
  | SkillDef
  | BackgroundDef
