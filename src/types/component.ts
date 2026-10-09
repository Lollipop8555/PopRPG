/**
 * 组件库八类 + 背景（§4.0 / §4.1~§4.5 / §4.8.3 / §4.9）。
 * 公共字段：id / name / icon / desc / tags —— 各类完全一致，没有来源字段。
 *
 * **NPC 是第 8 类结构化组件**（§4.9）：不占地图格、不走 `enabledIds`，
 * 入包条件 ＝ **被某个建筑实例引用**（节点的 `npcs`，§4.9.3）。
 */

import type { PartialStatValues, RollSet, StatKey, Stats, StatValues } from './common'
import type { PoolCheckRef, PoolEffect } from './state-pool'

/** 组件所属大类（= 组件库里的分区，§5.0.1） */
export type ComponentKind =
  | 'road'
  | 'building'
  | 'item'
  | 'monster'
  | 'class'
  | 'skill'
  | 'npc'
  | 'background'

/** 八类 + 背景的公共字段，一个不多一个不少 */
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
 * （事件块语义相同：`penalty` 表示允许强行尝试，后果按 `on_fail` 结算，§4.8.9）
 */
export type GateMissing = 'block' | 'penalty'

export interface Gate {
  tags: string[]
  mode?: GateMode
  missing?: GateMissing
  penalty?: MapCost
  /**
   * **触发判定**（V2.3 §6.4）：与 `tags` **同档并列**，两者都要满足才放行；
   * 可写条件体，也可写判定模板名（§4.5）。落点即门锁的既有落点。
   */
  pool?: PoolCheckRef
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
/* 建筑 §4.4（六种行为并列，不互相嵌套）                                */
/* ------------------------------------------------------------------ */

export type EncounterKind = 'empty' | 'treasure' | 'monster' | 'event' | 'shop' | 'talk'

export const ENCOUNTER_KINDS: readonly EncounterKind[] = [
  'empty',
  'treasure',
  'monster',
  'event',
  'shop',
  'talk',
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

/** 事件块 = 门槛 gate（能否参与）+ 判定 check（做不做得成） */
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
  /**
   * **建筑 `encounter` 行为前置的触发判定**（V2.3 §6.4 / §8.3③）：在门锁与 NPC 之后、建筑行为之前求值，
   * **与门锁同构**，可写条件体或判定模板名（§4.5）；**不写 ＝ 恒成立**。
   *
   * **不成立 → 本次到访不触发建筑行为**（也不等掷骰），用于"到访即触发"的反馈切换。
   * 反馈内容本身仍由作者的文案 / 对话树 `if` 承担（§6.7），引擎不额外记录、不新增内置键（裁决 56）。
   */
  encounterPool?: PoolCheckRef
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
/* NPC §4.9 —— 第 8 类组件：只出现在建筑里，不走 `enabledIds`            */
/* ------------------------------------------------------------------ */

/**
 * 对话记录 —— **全树唯一的类型**（§4.9.2「只有一个结构」）。
 *
 * **根层数组的元素与任意深层的 `items` 元素都是它**，`items` 递归指向自己；
 * **没有 `type` 判别**，也**不存在"节点 / 项"两种东西**（`DialogItem` /
 * `DialogChatItem` / `DialogPropItem` 全部作废；旧包里的 `type` 字段忽略）。
 *
 * **必填只有 `message`**，其余五个字段全部可省。
 */
export interface DialogNode {
  /**
   * **本条作为 `items` 的元素（玩家的一个选项）时才生效**：玩家那一步选择的
   * **答复文本** ＝ 父层给玩家看的选项按钮文本（也作编辑器卡片标题）。
   * **根层数组里的元素不写它**（不展示、无意义；导入时忽略并提示）。
   */
  result?: string
  /** **唯一必填**：NPC 台词，按顺序逐条展示，玩家点「继续」推进 */
  message: string[]
  /**
   * **本层 `items` 的 item 骰子**（如 `'1D6'`；有它 → 本层仍把全部 `items` 一次列出、各标出命中区间，
   * 但**选项不可点** —— 玩家点**骰子**掷出点数，命中的那条高亮后进它；**没有 → 玩家直接点选**）。
   * 写在**内容**里，不是前置配置；**每一层都能写**。
   */
  dice?: string
  /**
   * 若**父层写了 `dice`**：本条被命中的区间（如 `'1-2'` / `'6'`）。
   * **非骰子选择时不需要**；父层没 `dice` 却写了 → 忽略并提示。
   */
  hit?: string
  /** **后续选项**（同一结构的数组）；**缺省 / 空数组 ＝ 说完就结束** */
  items?: DialogNode[]
  /**
   * **赠予道具的 id 列表**（不是 `items`，§8.3 设定 8）；**可重复＝多份**
   * （同一种给 2 份就写 2 次）。**没有赠予时不需要**。
   * **与 `items` 可并存**：先结算 `give`，再按 `items` 继续或结束（§4.9.2）。
   */
  give?: string[]
  /**
   * **条件**（V2.3 §6.3）：本条记录是否进入候选。写条件体，或写一个判定模板名（`string`）；
   * 同一层数组里的多条 `if` 组成 **if-else 链**（自上而下取第一条成立者、命中即停）。
   */
  if?: PoolCheckRef
  /**
   * **修改状态池**（V2.3 §6.3）：本条记录说完之后的操作结果，与 `give` 同级并列
   * （先结算 `give`，再执行 `pool`）。
   */
  pool?: PoolEffect[]
}

/**
 * NPC 定义（§4.9.1）：公共字段 ＋ **多套对话方案**。
 * 方案名即 key（如 `Mod1` / `Mod2`），值是该方案的**根节点数组**。
 * 位置一律由**建筑实例**给出（节点的 `npcs` / `dialog`，§4.9.3）。
 */
export interface NpcDef extends ComponentBase {
  dialogs: Record<string, DialogNode[]>
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
  | NpcDef
  | BackgroundDef
