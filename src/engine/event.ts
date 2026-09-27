/**
 * 事件判定（§4.8.9）：**门槛 + 手艺**两层各自独立。
 *
 * ① 门槛 `gate` —— 能否参与（标签）
 * ② 判定 `check` —— 做不做得成（复用力值链：属性 + 装备 + 职业% + 掷骰 vs 固定难度）
 *
 * 编辑器要能实时算出「必成 / 必败」，这里提供 `checkAnalysis`（命中率 + verdict）。
 */

import type { CheckDef, EventBlock, GrantEntry, Rules, SkillDef, StatKey } from '../types'
import { diceMax, diceMin, parseDice, rollSum, type Rng } from './dice'
import { applyEffects, type EffectResult } from './state'
import { buildPower, canPass, capabilities, payMapCost, type Unit } from './units'

/** 手艺值 = floor( ((属性 + 装备 + 状态 mod) × 职业% + rollSum(check.dice)) × 1 ) */
export function checkValue(unit: Unit, check: CheckDef, roll?: number, rng?: Rng): number {
  const pips = roll ?? rollSum(check.dice, rng)
  if (check.add === 'none') return pips
  return buildPower(unit, check.add as StatKey, { add_dice: check.dice }, 0, { addRoll: pips }).value
}

export type CheckVerdict = 'always' | 'never' | 'maybe'

export interface CheckAnalysis {
  min: number
  max: number
  /** 命中率 0~1 */
  rate: number
  verdict: CheckVerdict
  /** 至少要掷出几点（null = 掷多少都不成） */
  needPips: number | null
  target: number
}

/** nDf 点数和的精确分布（DP，不给近似值） */
function sumDistribution(count: number, faces: number): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]])
  for (let i = 0; i < count; i++) {
    const next = new Map<number, number>()
    for (const [sum, ways] of dist) {
      for (let f = 1; f <= faces; f++) next.set(sum + f, (next.get(sum + f) ?? 0) + ways)
    }
    dist = next
  }
  return dist
}

/** 必成 / 必败分析（§5.7）：必成 = 手艺下限 ≥ target；必败 = 手艺上限 < target */
export function checkAnalysis(unit: Unit, check: CheckDef, rules: Rules): CheckAnalysis {
  const target = check.target
  const dice = parseDice(check.dice ?? rules.event.dice)
  const lo = dice ? diceMin(dice) : 0
  const hi = dice ? diceMax(dice) : 0
  const min = checkValue(unit, check, lo)
  const max = checkValue(unit, check, hi)

  let needPips: number | null = null
  for (let p = lo; p <= hi; p++) {
    if (checkValue(unit, check, p) >= target) {
      needPips = p
      break
    }
  }

  let rate = 0
  if (dice) {
    const dist = sumDistribution(dice.count, dice.faces)
    const total = [...dist.values()].reduce((a, b) => a + b, 0)
    if (needPips !== null && total > 0) {
      let ok = 0
      for (const [sum, ways] of dist) if (sum >= needPips) ok += ways
      rate = ok / total
    }
  } else {
    rate = checkValue(unit, check) >= target ? 1 : 0
  }

  const verdict: CheckVerdict = min >= target ? 'always' : max < target ? 'never' : 'maybe'
  return { min, max, rate, verdict, needPips, target }
}

export type EventVerdict = 'blocked' | 'success' | 'fail'

export interface EventOutcomeResult {
  unit: Unit
  text?: string
  pointReward: number
  grants: GrantEntry[]
  effectResult?: EffectResult
}

export interface EventResult extends EventOutcomeResult {
  verdict: EventVerdict
  /** 掷出的点数（没有 check 时不给） */
  roll?: number
  /** 手艺值（没有 check 时不给） */
  value?: number
  logs: string[]
}

export interface EventOptions {
  rng?: Rng
  rules: Rules
  /** `state.max_duration` */
  maxDuration: number
  skills?: Map<string, SkillDef>
}

function applyOutcome(
  unit: Unit,
  outcome: EventBlock['on_success'],
  opts: { maxDuration: number; skills?: Map<string, SkillDef> },
): EventOutcomeResult {
  if (!outcome) return { unit, pointReward: 0, grants: [] }
  let current = payMapCost(unit, outcome.cost)
  let effectResult: EffectResult | undefined
  if (outcome.effects && outcome.effects.length > 0) {
    effectResult = applyEffects(current, current, outcome.effects, {
      source: 'event',
      maxDuration: opts.maxDuration,
      skills: opts.skills,
    })
    current = effectResult.target
  }
  return {
    unit: current,
    text: outcome.text,
    pointReward: outcome.point_reward ?? 0,
    grants: outcome.grant ?? [],
    effectResult,
  }
}

/**
 * 走一遍事件（§4.8.9）：
 * - 门槛不满足且 missing = block → `blocked`（连尝试的选项都不给）
 * - 门槛不满足且 missing = penalty → 允许强行尝试：先承受额外代价，再按失败分支结算
 * - 过了门槛后没有 check → 必成；有 check → 掷骰比手艺
 */
export function resolveEvent(unit: Unit, event: EventBlock, opts: EventOptions): EventResult {
  const logs: string[] = []
  let current = unit

  const gate = event.gate
  if (gate && gate.tags.length > 0) {
    const pass = canPass(gate, capabilities(current))
    if (!pass.pass) {
      logs.push(`缺少所需标签（${gate.tags.join(' / ')}），无法进行判定`)
      return { verdict: 'blocked', unit: current, pointReward: 0, grants: [], logs }
    }
    if (pass.penalty) {
      current = payMapCost(current, pass.penalty)
      logs.push('未满足门槛且允许强行尝试：先承受额外代价，再按失败分支结算')
      return { verdict: 'fail', ...applyOutcome(current, event.on_fail, opts), logs }
    }
    logs.push(`门槛条件满足（${gate.tags.join(' / ')}）`)
  }

  if (!event.check) {
    const res = applyOutcome(current, event.on_success, opts)
    logs.push('未配置判定：满足门槛即视为成功')
    return { verdict: 'success', ...res, logs }
  }

  const check: CheckDef = {
    dice: event.check.dice ?? opts.rules.event.dice,
    add: event.check.add,
    target: event.check.target,
  }
  const roll = rollSum(check.dice, opts.rng)
  const value = checkValue(current, check, roll)
  const success = value >= check.target
  logs.push(`掷 ${check.dice} = ${roll}：判定值 ${value}，难度 ${check.target}，结果 ${success ? '成功' : '失败'}`)

  const res = applyOutcome(current, success ? event.on_success : event.on_fail, opts)
  return { verdict: success ? 'success' : 'fail', roll, value, ...res, logs }
}
