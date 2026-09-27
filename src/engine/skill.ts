/**
 * 一次技能施放的结算（§4.8.3 六步）+ 怪物挑技能。
 *
 * ① 选技能 ② 查成本（不够就不能选，不扣不掷） ③ 算本力值
 * ④ 判定分支（self / vs:none 跳过判定） ⑤ 作用（伤害 / 治疗）
 * ⑥ 附带效果（**只有命中才执行**）
 */

import type { MapCost, Rules, RollSet, SkillDef, StatKey } from '../types'
import { AUTO_VS } from '../types'
import { rollWeights, type Rng } from './dice'
import { applyEffects, type EffectResult } from './state'
import { buildPower, type PowerBreakdown, type Unit } from './units'

/**
 * 引擎内建的保底技能（决策 9）：怪物没配 `attack_weights`（或选中的都付不起）时用它。
 * **与玩家那两个预设组件无关** —— 作者把 `basic_attack` 组件删了，怪物照样能打。
 */
/** 资源在日志里的正式叫法（日志面向玩家，不显示字段键） */
const RESOURCE_NAME: Record<'hp' | 'mp', string> = { hp: '生命', mp: '法力' }

export const BUILTIN_BASIC_ATTACK: SkillDef = {
  id: 'basic_attack',
  name: '普通攻击',
  icon: '⚔️',
  dim: 'patk',
  target: 'opponent',
  vs: 'auto',
  bonus: 0,
  apply: 'hp',
  cost: {},
}

/** `vs: auto` → 查 AUTO_VS；`none` 原样返回 */
export function resolveVs(skill: SkillDef): StatKey | 'none' {
  if (skill.vs === 'none') return 'none'
  if (skill.vs === 'auto') return AUTO_VS[skill.dim]
  return skill.vs
}

/** 成本的说明文字（用于界面展示与日志） */
export function costText(cost: MapCost | undefined): string {
  if (!cost) return '无消耗'
  const parts: string[] = []
  if (cost.mp) parts.push(`${cost.mp} 点法力`)
  if (cost.hp) parts.push(`${cost.hp} 点生命`)
  if (cost.step) parts.push(`${cost.step} 步`)
  return parts.length ? parts.join('，') : '无消耗'
}

/** mp 由技能自己的 cost 决定（决策 7）：不够就选不了，不扣、不掷 */
export function canUseSkill(unit: Unit, skill: SkillDef): boolean {
  const cost = skill.cost ?? {}
  const needMp = cost.mp ?? 0
  const needHp = cost.hp ?? 0
  if (needMp > 0 && unit.resources.mp < needMp) return false
  if (needHp > 0 && unit.resources.hp <= needHp) return false
  return true
}

function payCost(unit: Unit, cost: MapCost | undefined): Unit {
  const out = { ...unit, resources: { ...unit.resources } }
  if (cost?.mp) out.resources.mp = Math.max(0, out.resources.mp - cost.mp)
  if (cost?.hp) out.resources.hp = Math.max(0, out.resources.hp - cost.hp)
  return out
}

export interface SkillOutcome {
  ok: true
  /** 施放者（已扣费用） */
  user: Unit
  /** 对手（或 self 技能下的自己） */
  target: Unit
  costPaid: MapCost
  power: PowerBreakdown
  vs: StatKey | 'none'
  hit: boolean
  /** target: opponent 才有 */
  defense?: PowerBreakdown
  appliedTo: 'hp' | 'mp' | 'none'
  /** 伤害量或治疗量 */
  amount: number
  /** 因为落空而没执行的 effects 条数（§4.8.3：落空不挂效果） */
  effectsSkipped: number
  effectResult?: EffectResult
  logs: string[]
}

export type SkillResult = SkillOutcome | { ok: false; reason: 'cost'; logs: string[] }

export interface SkillResolveOptions {
  rng?: Rng
  /** 守方是否掷防骰（怪物 AI 恒 true；玩家「不防御」为 false → 走固有数值，决策 12） */
  defenderRolls?: boolean
  /** `state.max_duration` / 技能反查表，给 effects 用 */
  maxDuration: number
  skills?: Map<string, SkillDef>
}

export function resolveSkill(
  user: Unit,
  target: Unit,
  skill: SkillDef,
  rules: Rules,
  opts: SkillResolveOptions,
): SkillResult {
  const logs: string[] = []
  if (!canUseSkill(user, skill)) {
    logs.push(`资源不足，无法施放「${skill.name}」（需要 ${costText(skill.cost)}）`)
    return { ok: false, reason: 'cost', logs }
  }

  const afterCost = payCost(user, skill.cost)
  if (skill.cost && Object.keys(skill.cost).length) logs.push(`消耗 ${costText(skill.cost)}`)

  const roll: RollSet | undefined = skill.roll ?? afterCost.rolls?.atk ?? rules.combat.atk_roll
  const power = attackerPower(afterCost, skill, roll, opts.rng)
  logs.push(`${afterCost.name} 施放「${skill.name}」，本次力值 ${power.value}`)

  const vs = resolveVs(skill)
  const noFight = skill.target === 'self' || vs === 'none'

  let defense: PowerBreakdown | undefined
  let hit = true
  if (!noFight) {
    const defRoll: RollSet | undefined = target.rolls?.def ?? rules.combat.def_roll
    const defenderRolls = opts.defenderRolls ?? target.kind === 'monster'
    defense = buildDefense(target, vs as StatKey, defRoll, defenderRolls, opts.rng)
    hit = power.value >= defense.value
    logs.push(
      `${defenderRolls ? '对方掷防御骰' : '对方未掷防御骰（取固有数值）'}：防御力 ${defense.value} → ${hit ? '命中' : '未命中'}`,
    )
  }

  const receiver = skill.target === 'self' ? afterCost : target
  let appliedTo: 'hp' | 'mp' | 'none' = 'none'
  let amount = 0
  let updatedReceiver = receiver

  if (hit && skill.apply !== 'none') {
    appliedTo = skill.apply
    updatedReceiver = { ...receiver, resources: { ...receiver.resources }, stats: { ...receiver.stats } }
    if (skill.target === 'self') {
      // 治疗 = 本力值（不对抗、不乘算第二遍）
      const max = updatedReceiver.stats[appliedTo]
      const before = updatedReceiver.resources[appliedTo]
      updatedReceiver.resources[appliedTo] = Math.max(0, Math.min(max, before + power.value))
      amount = updatedReceiver.resources[appliedTo] - before
      logs.push(`${updatedReceiver.name} 恢复 ${amount} 点${RESOURCE_NAME[appliedTo]}`)
    } else {
      // 伤害 = max(1, 本力值 − 防值)
      amount = Math.max(1, power.value - (defense?.value ?? 0))
      updatedReceiver.resources[appliedTo] = updatedReceiver.resources[appliedTo] - amount
      logs.push(`${updatedReceiver.name} 损失 ${amount} 点${RESOURCE_NAME[appliedTo]}`)
    }
  }

  let effectResult: EffectResult | undefined
  let effectsSkipped = 0
  if (skill.effects && skill.effects.length > 0) {
    if (!hit) {
      effectsSkipped = skill.effects.length
      logs.push(`未命中：${effectsSkipped} 项附加效果未生效`)
    } else {
      const owner = skill.target === 'self' ? updatedReceiver : afterCost
      effectResult = applyEffects(owner, updatedReceiver, skill.effects, {
        source: skill.id,
        maxDuration: opts.maxDuration,
        skills: opts.skills,
      })
      updatedReceiver = effectResult.target
      logs.push(...effectResult.logs)
      if (skill.target !== 'self') {
        // owner 就是施放者，可能因为 add_stat target:self 被改动
        afterCost.resources = effectResult.owner.resources
        afterCost.stats = effectResult.owner.stats
        afterCost.states = effectResult.owner.states
      }
    }
  }

  const outUser = skill.target === 'self' ? updatedReceiver : afterCost
  return {
    ok: true,
    user: outUser,
    target: updatedReceiver,
    costPaid: skill.cost ?? {},
    power,
    vs,
    hit,
    defense,
    appliedTo,
    amount,
    effectsSkipped,
    effectResult,
    logs,
  }
}

function attackerPower(unit: Unit, skill: SkillDef, roll: RollSet | undefined, rng?: Rng): PowerBreakdown {
  return buildPower(unit, skill.dim, roll, skill.bonus, { rng })
}

function buildDefense(
  unit: Unit,
  dim: StatKey,
  roll: RollSet | undefined,
  rollsDice: boolean,
  rng?: Rng,
): PowerBreakdown {
  // 不防御 ≠ 防值为 0：走固有数值（无骰浮动），仍按属性 + 装备 + 职业% + 状态 mod 算（决策 12）
  return rollsDice ? buildPower(unit, dim, roll, 0, { rng }) : buildPower(unit, dim, roll, 0, { noRoll: true })
}

/* ------------------------------------------------------------------ */
/* 怪物挑技能（权重轮盘 + 回退，决策 9）                                */
/* ------------------------------------------------------------------ */

export interface PickOptions {
  rng?: Rng
  /** id → 技能定义：**只认「已启用」的技能**（未启用的世界里不存在这一招，§4.8.3） */
  skills: Map<string, SkillDef>
}

/**
 * 怪物侧：掷 pick_dice 按 attack_weights 加权随机；玩家侧返回 null（玩家自己选）。
 * - 没配 attack_weights（或表里全是不可解析的技能）→ 内建 basic_attack
 * - 选中的技能 cost 付不起 → 回退同表里 cost 为空的技能；再无则本次反击跳过（null）
 */
export function pickSkill(unit: Unit, rules: Rules, opts: PickOptions): SkillDef | null {
  const weights = unit.attackWeights
  if (!weights) return BUILTIN_BASIC_ATTACK

  const ids = Object.keys(weights)
  if (ids.length === 0) return BUILTIN_BASIC_ATTACK

  const table: { id: string; weight: number; def: SkillDef }[] = []
  for (const id of ids) {
    const def = opts.skills.get(id) ?? (id === BUILTIN_BASIC_ATTACK.id ? BUILTIN_BASIC_ATTACK : undefined)
    if (!def) continue
    const w = weights[id]
    table.push({ id, weight: Number.isFinite(w) ? Math.max(0, w) : 0, def })
  }
  if (table.length === 0) return BUILTIN_BASIC_ATTACK

  const dice = unit.rolls?.pick_dice ?? rules.combat.pick_dice
  const idx = rollWeights(table.map((t) => t.weight), dice, opts.rng)
  if (idx < 0) return BUILTIN_BASIC_ATTACK

  let chosen = table[idx].def
  if (!canUseSkill(unit, chosen)) {
    const free = table.find((t) => Object.keys(t.def.cost ?? {}).length === 0)
    chosen = free ? free.def : BUILTIN_BASIC_ATTACK
    if (!canUseSkill(unit, chosen)) return null
  }
  return chosen
}
