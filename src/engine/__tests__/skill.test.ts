/** 技能结算（§4.8.3）单测边界 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../types'
import type { MonsterDef, Rules, SkillDef } from '../../types'
import { PRESET_MONSTERS, PRESET_SKILLS } from '../../presets'
import {
  BUILTIN_BASIC_ATTACK,
  canUseSkill,
  costText,
  pickSkill,
  resolveSkill,
  resolveVs,
} from '../skill'
import { AUTO_VS } from '../../types'
import { makeMonsterUnit, makePlayerUnit } from '../units'

const skillMap = new Map<string, SkillDef>(PRESET_SKILLS.map((s) => [s.id, s]))
const basicAttack = skillMap.get('basic_attack')!
const heal = skillMap.get('heal')!
const bless = skillMap.get('bless')!
const poisonBite = skillMap.get('poison_bite')!

/** 去掉力值骰，让结算完全确定（便于断言伤害 / 命中） */
const plainRules: Rules = {
  ...DEFAULT_RULES,
  combat: { ...DEFAULT_RULES.combat, atk_roll: {}, def_roll: {} },
}
const opts = { maxDuration: 10, skills: skillMap }

function goblin(overrides: Partial<MonsterDef> = {}) {
  const def: MonsterDef = {
    ...(PRESET_MONSTERS[0] as MonsterDef),
    ...overrides,
  }
  return makeMonsterUnit(def, { statDice: plainRules.combat.stat_dice, skills: [basicAttack] })
}

describe('resolveVs', () => {
  it('AUTO_VS 四维覆盖：物理族对物理族、法术族对法术族', () => {
    expect(AUTO_VS.patk).toBe('pdef')
    expect(AUTO_VS.pdef).toBe('patk')
    expect(AUTO_VS.matk).toBe('mdef')
    expect(AUTO_VS.mdef).toBe('matk')
    expect(resolveVs(basicAttack)).toBe('pdef')
    expect(resolveVs({ ...basicAttack, dim: 'matk' })).toBe('mdef')
    expect(resolveVs(heal)).toBe('none')
  })
})

describe('cost（mp 边界，决策 7）', () => {
  it('恰好够可以施放，少 1 就不行', () => {
    const enough = makePlayerUnit({ cls: undefined, skills: [heal] })
    enough.resources = { ...enough.resources, mp: 3 }
    const poor = makePlayerUnit({ cls: undefined, skills: [heal] })
    poor.resources = { ...poor.resources, mp: 2 }
    expect(canUseSkill(enough, heal)).toBe(true)
    expect(canUseSkill(poor, heal)).toBe(false)
    expect(costText(heal.cost)).toBe('3 点法力')
  })

  it('成本不足时既不扣也不掷', () => {
    const poor = makePlayerUnit({ cls: undefined, skills: [heal] })
    poor.resources = { ...poor.resources, mp: 0 }
    const res = resolveSkill(poor, poor, heal, plainRules, opts)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('cost')
    expect(poor.resources.mp).toBe(0)
  })
})

describe('resolveSkill 六步', () => {
  it('target: opponent 会对抗；伤害 = max(1, 本力值 − 防值)', () => {
    const player = makePlayerUnit({ skills: [basicAttack] })
    player.stats = { ...player.stats, patk: 3 }
    const target = goblin({ stats: { hp: [6, 6], mp: [0, 0], patk: [2, 2], matk: [0, 0], pdef: [1, 1], mdef: [1, 1] } })
    const before = target.resources.hp
    const res = resolveSkill(player, target, basicAttack, plainRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.vs).toBe('pdef')
    expect(res.defense?.value).toBe(1)
    expect(res.power.value).toBe(3)
    expect(res.amount).toBe(2) // max(1, 3 − 1)
    expect(res.target.resources.hp).toBe(before - 2)
    expect(res.hit).toBe(true)
  })

  it('伤害至少 1：属性再低也不会打空', () => {
    const player = makePlayerUnit({ skills: [basicAttack] })
    player.stats = { ...player.stats, patk: 0 }
    const target = goblin({
      stats: { hp: [6, 6], mp: [0, 0], patk: [0, 0], matk: [0, 0], pdef: [99, 99], mdef: [99, 99] },
    })
    const res = resolveSkill(player, target, basicAttack, plainRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.hit).toBe(false)
    expect(res.amount).toBe(0)
    // 反过来：够才打，落空就把 both 安全网给 demo 掉
    expect(res.effectsSkipped).toBe(0)
  })

  it('target: self 不对抗、不落空，但仍掷骰', () => {
    const mage = makePlayerUnit({ skills: [heal] })
    mage.stats = { ...mage.stats, matk: 10, hp: 5 }
    mage.resources = { ...mage.resources, hp: 1, mp: 5 }
    const withDiceRules: Rules = {
      ...DEFAULT_RULES,
      combat: { ...DEFAULT_RULES.combat, atk_roll: { add_dice: '1D4' }, def_roll: {} },
    }
    const res = resolveSkill(mage, mage, heal, withDiceRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.defense).toBeUndefined()
    expect(res.hit).toBe(true)
    expect(res.power.add).toBeGreaterThan(0) // 有掷骰
    expect(res.power.addRoll).toBeGreaterThanOrEqual(1)
    expect(res.amount).toBeGreaterThan(0)
    expect(res.target.resources.hp).toBe(Math.min(5, 1 + res.power.value))
  })

  it('vs: none 也不对抗', () => {
    const unit = makePlayerUnit({ skills: [{ ...bless, vs: 'none' }] })
    unit.resources = { ...unit.resources, mp: 5 }
    const res = resolveSkill(unit, unit, { ...bless, vs: 'none' }, plainRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.defense).toBeUndefined()
    expect(res.hit).toBe(true)
  })

  it('apply: none 只挂效果，不改数值', () => {
    const unit = makePlayerUnit({ skills: [bless] })
    unit.resources = { ...unit.resources, mp: 5 }
    const res = resolveSkill(unit, unit, bless, plainRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.appliedTo).toBe('none')
    expect(res.amount).toBe(0)
    expect(res.target.states.map((s) => s.tag)).toContain('力量祝福')
    // 加值立刻进力值链第 ② 环（attribute + modifiers）
    const after = res.target
    expect(after.states[0].modifiers?.patk).toBe(2)
  })

  it('落空时不执行 effects（但交锋仍继续 —— 由流程层决定）', () => {
    const player = makePlayerUnit({ skills: [poisonBite] })
    player.stats = { ...player.stats, patk: 0 }
    const target = goblin({
      stats: { hp: [6, 6], mp: [0, 0], patk: [0, 0], matk: [0, 0], pdef: [99, 99], mdef: [99, 99] },
    })
    const res = resolveSkill(player, target, poisonBite, plainRules, opts)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.hit).toBe(false)
    expect(res.effectsSkipped).toBe(1)
    expect(res.target.states.length).toBe(0)
    expect(res.target.resources.hp).toBe(6)
  })
})

describe('pickSkill（怪物侧掷骰 + 回退）', () => {
  const noWeights = { ...(PRESET_MONSTERS[0] as MonsterDef), attack_weights: undefined }

  it('没配 attack_weights（或空表 / 权重全 0）→ 内建 basic_attack', () => {
    const unit = makeMonsterUnit(noWeights, { statDice: '1D6' })
    expect(pickSkill(unit, plainRules, { skills: skillMap })?.id).toBe(BUILTIN_BASIC_ATTACK.id)
    unit.attackWeights = {}
    expect(pickSkill(unit, plainRules, { skills: skillMap })?.id).toBe(BUILTIN_BASIC_ATTACK.id)
    unit.attackWeights = { poison_bite: 0 }
    expect(pickSkill(unit, plainRules, { skills: skillMap })?.id).toBe(BUILTIN_BASIC_ATTACK.id)
  })

  it('选中的技能付不起 → 回退同表里 cost 为空的技能', () => {
    const unit = makeMonsterUnit(PRESET_MONSTERS[0], { statDice: '1D6' })
    unit.resources = { ...unit.resources, mp: 0 }
    unit.attackWeights = { fireball: 1, basic_attack: 1 }
    // 固定掷到最大 → 选到最后能负担的那条路径
    const chosen = pickSkill(unit, plainRules, { skills: skillMap, rng: () => 0.999 })
    expect(chosen).toBeDefined()
    expect(chosen?.id === 'basic_attack' || chosen?.id === 'fireball').toBe(true)
    expect(canUseSkill(unit, chosen!)).toBe(true)
  })

  it('同表里连免费的都没有 → 本次反击跳过（null）', () => {
    const unit = makeMonsterUnit(PRESET_MONSTERS[0], { statDice: '1D6' })
    unit.resources = { ...unit.resources, mp: 0 }
    unit.attackWeights = { fireball: 1 }
    const chosen = pickSkill(unit, plainRules, { skills: skillMap, rng: () => 0.5 })
    // fireball 付不起 → 回退无可用项 → 内建 basic_attack（cost 为空，永远可用）
    expect(chosen?.id).toBe('basic_attack')
  })
})
