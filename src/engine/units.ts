/**
 * 单位（玩家 / 怪物）+ 属性结算（第一步） + 力值合成链（第二步）（§4.8.2）
 *
 * 这里是**运行时形态**：结算之后才有力值。
 * ① 属性在新单位登场时结算一次（玩家不摇、怪物摇定）
 * ② 力值链在**每次判定**时现算，可拆出五环明细给 UI 看（§6.2 验收 7）
 */

import type {
  ClassDef,
  Gate,
  ItemDef,
  MapCost,
  MonsterDef,
  PartialStatValues,
  PoolRef,
  RollSet,
  SkillDef,
  StatKey,
  StatValues,
  Stats,
} from '../types'
import { STAT_KEYS, zeroStatValues } from '../types'
import { diceMax, diceMin, parseDice, rollRange, rollStepsAt, type Rng } from './dice'

/** 挂在单位身上的状态 = 标签 + 剩余回合数（§4.8.10） */
export interface StateTag {
  tag: string
  duration: number
  per_turn?: PartialStatValues
  modifiers?: PartialStatValues
  source: string
  /** 引擎内部记账：本回合刚挂上的状态不参与本次 tick（决策 6 / §4.8.10） */
  pending?: boolean
}

export interface InventoryEntry {
  id: string
  count: number
}

/** 力值骰的来源优先级（§4.8.7：组件覆盖前置配置） */
export interface UnitRolls {
  atk?: RollSet
  def?: RollSet
  stat_dice?: string
  pick_dice?: string
}

export interface Unit {
  kind: 'player' | 'monster'
  id: string
  name: string
  icon: string
  /** ① 已结算的属性值（hp / mp 同时作为上限） */
  stats: StatValues
  /** 当前资源值，只有 hp / mp 有意义 */
  resources: StatValues
  /** ③ 职业百分比（怪物为空对象 = 100%） */
  buffs: PartialStatValues
  /** 职业自带的通行能力标签 */
  tags: string[]
  equipped: ItemDef[]
  states: StateTag[]
  /** 已学会的技能栏（玩家）/ 怪物会的技能 */
  skills: SkillDef[]
  rolls?: UnitRolls
  attackWeights?: Record<string, number>
}

export interface PlayerUnit extends Unit {
  kind: 'player'
  cls?: ClassDef
  /** 已分配的自由点，如 { hp: 8, patk: 12 } */
  alloc: PartialStatValues
  /** 后天挣到的自由点（Σ point_reward） */
  earnedPoints: number
  inventory: InventoryEntry[]
}

export interface MonsterUnit extends Unit {
  kind: 'monster'
  def?: MonsterDef
  point_reward?: number
  reward_pool?: PoolRef
}

/* ------------------------------------------------------------------ */
/* 第一步：属性结算                                                     */
/* ------------------------------------------------------------------ */

/** 玩家侧不摇：玩家属性 = 职业 base_stats + 已分配（§4.0.2 / §4.2.1） */
export function playerStats(cls: ClassDef, alloc: PartialStatValues = {}): StatValues {
  const out = zeroStatValues()
  for (const key of STAT_KEYS) out[key] = cls.base_stats[key] + (alloc[key] ?? 0)
  return out
}

/** 剩余自由点 = 职业 free_points + Σ point_reward − Σ 已分配；余点保留、不可洗点（§4.2.1 / §4.2.2） */
export function remainingPoints(cls: ClassDef, alloc: PartialStatValues = {}, earned = 0): number {
  const spent = STAT_KEYS.reduce((sum, k) => sum + (alloc[k] ?? 0), 0)
  return cls.free_points + earned - spent
}

/** 怪物侧：登场时把区间摇成具体值，本场固定；**不同遭遇各自独立摇**（决策 2） */
export function settleStats(def: Stats, statDice: string | undefined, rng: Rng = Math.random): StatValues {
  const out = zeroStatValues()
  for (const key of STAT_KEYS) out[key] = rollRange(def[key], statDice, rng)
  return out
}

function unitBase<K extends Unit['kind']>(
  kind: K,
  meta: { id: string; name: string; icon: string },
  stats: StatValues,
): Unit & { kind: K } {
  const resources = zeroStatValues()
  resources.hp = stats.hp
  resources.mp = stats.mp
  return {
    kind,
    id: meta.id,
    name: meta.name,
    icon: meta.icon,
    stats,
    resources,
    buffs: {},
    tags: [],
    equipped: [],
    states: [],
    skills: [],
  }
}

/** 登场：抽中一只怪（或单元素池）→ 立刻摇定属性 → 成型，整场不再重摇 */
export function makeMonsterUnit(
  def: MonsterDef,
  opts: { statDice: string; skills?: SkillDef[]; rng?: Rng },
): MonsterUnit {
  const stats = settleStats(def.stats, def.stat_dice ?? opts.statDice, opts.rng)
  const unit: MonsterUnit = {
    ...unitBase('monster', def, stats),
    def,
    tags: def.tags ?? [],
    skills: opts.skills ?? [],
    point_reward: def.point_reward ?? 0,
    reward_pool: def.reward_pool,
  }
  if (def.attack_weights) unit.attackWeights = def.attack_weights
  unit.rolls = {}
  if (def.atk_roll) unit.rolls.atk = def.atk_roll
  if (def.def_roll) unit.rolls.def = def.def_roll
  if (def.stat_dice) unit.rolls.stat_dice = def.stat_dice
  return unit
}

export function makePlayerUnit(opts: {
  cls?: ClassDef
  alloc?: PartialStatValues
  earnedPoints?: number
  equipped?: ItemDef[]
  skills?: SkillDef[]
  inventory?: InventoryEntry[]
}): PlayerUnit {
  const cls = opts.cls
  const alloc = opts.alloc ?? {}
  const stats = cls ? playerStats(cls, alloc) : zeroStatValues()
  const unit: PlayerUnit = {
    ...unitBase('player', cls ?? { id: 'nobody', name: '无职业', icon: '🙂' }, stats),
    cls,
    alloc,
    earnedPoints: opts.earnedPoints ?? 0,
    equipped: opts.equipped ?? [],
    skills: opts.skills ?? [],
    inventory: opts.inventory ?? [],
  }
  if (cls) {
    unit.tags = cls.tags ?? []
    unit.buffs = cls.buffs ?? {}
  }
  return unit
}

/* ------------------------------------------------------------------ */
/* 能力集合与通行 §4.5.2 / §4.8.10                                     */
/* ------------------------------------------------------------------ */

/** capabilities = ⋃(穿戴中装备.tags) ∪ 当前职业.tags ∪ 身上状态.tags */
export function capabilities(unit: Unit): Set<string> {
  const caps = new Set<string>(unit.tags)
  for (const eq of unit.equipped) for (const t of eq.tags ?? []) caps.add(t)
  for (const st of unit.states) caps.add(st.tag)
  return caps
}

export interface PassResult {
  pass: boolean
  /** 不满足且 missing=penalty 时额外要付的消耗 */
  penalty?: MapCost
}

export function canPass(gate: Gate | undefined, caps: Set<string>): PassResult {
  if (!gate || gate.tags.length === 0) return { pass: true }
  const mode = gate.mode ?? 'any'
  const satisfied = mode === 'all' ? gate.tags.every((t) => caps.has(t)) : gate.tags.some((t) => caps.has(t))
  if (satisfied) return { pass: true }
  if ((gate.missing ?? 'block') === 'penalty') return { pass: true, penalty: gate.penalty }
  return { pass: false }
}

/* ------------------------------------------------------------------ */
/* 第二步：力值合成链 —— 五类来源各占一环（§4.8.2）                     */
/* ------------------------------------------------------------------ */

export interface PowerBreakdown {
  /** 最终力值 */
  value: number
  /** ① 已结算属性值 */
  stat: number
  /** ② 加法环细分 */
  equipment: number
  state: number
  skillBonus: number
  /** ② 合计 */
  plus: number
  /** ③ 职业百分比（100 → 1） */
  prof: number
  /** ④ 基础力值 = (① + ②) × ③ */
  base: number
  /** ⑤ 骰子叠加 */
  add: number
  addRoll?: number
  /** ⑥ 骰子倍率 */
  mult: number
  multRoll?: number
  /** 是否走了「固有数值」（不掷骰） */
  noRoll: boolean
}

export interface PowerOptions {
  rng?: Rng
  /** 指定叠加骰点数（必成 / 必败区间用） */
  addRoll?: number
  /** 指定倍率骰点数 */
  multRoll?: number
  /** 不掷骰：骰子项取中性值（加法 0 / 倍率 1）—— 玩家「不防御」就是这个（决策 12） */
  noRoll?: boolean
}

function sumModifier(list: PartialStatValues[], dim: StatKey): number {
  return list.reduce((sum, m) => sum + (m?.[dim] ?? 0), 0)
}

function rollPips(d: { count: number; faces: number }, rng?: Rng): number {
  const r = rng ?? Math.random
  let sum = 0
  for (let i = 0; i < d.count; i++) sum += 1 + Math.floor(r() * d.faces)
  return sum
}

/**
 * 攻值 / 防值走同一条链，只是取的属性维不同：
 *   力值 = floor( ( (①属性 + ②装备 + ②状态 + ②技能bonus) × ③职业% + ⑤骰叠加 ) × ⑥骰倍率 )
 */
export function buildPower(
  unit: Unit,
  dim: StatKey,
  roll: RollSet | undefined,
  skillBonus = 0,
  opts: PowerOptions = {},
): PowerBreakdown {
  const stat = unit.stats[dim]
  const equipment = sumModifier(unit.equipped.map((e) => e.modifiers ?? {}), dim)
  const stateMod = sumModifier(unit.states.map((s) => s.modifiers ?? {}), dim)
  const plus = equipment + stateMod + skillBonus
  const profRaw = unit.buffs[dim]
  const prof = typeof profRaw === 'number' ? profRaw / 100 : 1
  const base = (stat + plus) * prof

  const noRoll = opts.noRoll === true
  const addDice = parseDice(roll?.add_dice)
  let add = 0
  let addRoll: number | undefined
  if (!noRoll && addDice) {
    add = opts.addRoll ?? rollPips(addDice, opts.rng)
    addRoll = add
  }

  const steps = roll?.mult?.steps
  let mult = 1
  let multRoll: number | undefined
  if (!noRoll && steps && steps.length > 0 && parseDice(roll?.mult?.dice)) {
    multRoll = opts.multRoll ?? rollPips(parseDice(roll!.mult!.dice)!, opts.rng)
    mult = rollStepsAt(steps, roll?.mult?.dice, multRoll)
  }

  const value = Math.floor((base + add) * mult)
  return { value, stat, equipment, state: stateMod, skillBonus, plus, prof, base, add, addRoll, mult, multRoll, noRoll }
}

/** 某单位某一维力值的上下界（编辑器标注必成 / 必败用，§4.8.9） */
export function powerBounds(unit: Unit, dim: StatKey, roll: RollSet | undefined, skillBonus = 0): { min: number; max: number } {
  const addDice = parseDice(roll?.add_dice)
  const multSteps = roll?.mult?.steps
  const multDice = parseDice(roll?.mult?.dice)
  const addVals: (number | undefined)[] = addDice ? [diceMin(addDice), diceMax(addDice)] : [undefined]
  const multVals: (number | undefined)[] =
    multDice && multSteps && multSteps.length > 0 ? [diceMin(multDice), diceMax(multDice)] : [undefined]
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const a of addVals) {
    for (const m of multVals) {
      const v = buildPower(unit, dim, roll, skillBonus, { addRoll: a, multRoll: m }).value
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (!Number.isFinite(min)) {
    const v = buildPower(unit, dim, roll, skillBonus, { noRoll: true }).value
    return { min: v, max: v }
  }
  return { min, max }
}

export function isAlive(unit: Unit): boolean {
  return unit.resources.hp > 0
}

/** 付地图代价（`cost` / `penalty`）：只动资源，不动属性（§4.5.1 / §4.8.9） */
export function payMapCost(unit: Unit, cost: MapCost | undefined): Unit {
  if (!cost) return unit
  const out = { ...unit, resources: { ...unit.resources } }
  if (cost.hp) out.resources.hp = Math.max(0, out.resources.hp - cost.hp)
  if (cost.mp) out.resources.mp = Math.max(0, out.resources.mp - cost.mp)
  return out
}
