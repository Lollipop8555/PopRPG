/** 状态与五 op（§4.8.10）单测边界 */

import { describe, expect, it } from 'vitest'
import type { ItemDef, SkillDef } from '../../types'
import { PRESET_ITEMS, PRESET_SKILLS } from '../../presets'
import { applyEffects, clampDuration, tickStates } from '../state'
import { makePlayerUnit } from '../units'

const skillMap = new Map<string, SkillDef>(PRESET_SKILLS.map((s) => [s.id, s]))
const redPotion = PRESET_ITEMS.find((i) => i.id === 'red_potion') as ItemDef
const antidote = PRESET_ITEMS.find((i) => i.id === 'antidote') as ItemDef
const scroll = PRESET_ITEMS.find((i) => i.id === 'scroll_of_fireball') as ItemDef
const baseOpts = { source: 'test', maxDuration: 10, skills: skillMap }

describe('clampDuration', () => {
  it('超上限夹到上限，造不出永久状态', () => {
    expect(clampDuration(100, 10)).toBe(10)
    expect(clampDuration(undefined, 10)).toBe(10)
    expect(clampDuration(3, 10)).toBe(3)
    expect(clampDuration(0, 10)).toBe(0)
  })
})

describe('applyEffects 五 op', () => {
  it('add_stat：红瓶回血且不超过上限', () => {
    const unit = makePlayerUnit({})
    unit.stats = { ...unit.stats, hp: 10 }
    unit.resources = { ...unit.resources, hp: 1 }
    const res = applyEffects(unit, unit, redPotion.effects, baseOpts)
    expect(res.target.resources.hp).toBe(6)
    unit.resources = { ...unit.resources, hp: 8 }
    const capped = applyEffects(unit, unit, redPotion.effects, baseOpts)
    expect(capped.target.resources.hp).toBe(10) // 夹到上限
  })

  it('add_tag + per_turn + modifiers，并夹到 max_duration', () => {
    const unit = makePlayerUnit({})
    const res = applyEffects(unit, unit, [{ op: 'add_tag', tag: '中毒', duration: 99, per_turn: { hp: -1 }, modifiers: { patk: -2 } }], baseOpts)
    const poison = res.target.states[0]
    expect(poison.duration).toBe(10)
    expect(poison.per_turn).toEqual({ hp: -1 })
    expect(poison.modifiers).toEqual({ patk: -2 })
  })

  it('remove_tag：解不存在的状态不报错', () => {
    const unit = makePlayerUnit({})
    const res = applyEffects(unit, unit, antidote.effects, baseOpts)
    expect(res.target.states.length).toBe(0)
    expect(res.logs.length).toBe(0)
  })

  it('中毒 → 解毒剂能解', () => {
    let unit = makePlayerUnit({})
    unit.resources = { ...unit.resources, hp: 10 }
    unit = applyEffects(unit, unit, [{ op: 'add_tag', tag: '中毒', duration: 3, per_turn: { hp: -1 } }], baseOpts).target
    expect(unit.states.length).toBe(1)
    unit = applyEffects(unit, unit, antidote.effects, baseOpts).target
    expect(unit.states.length).toBe(0)
  })

  it('learn_skill：技能书学会；已学会 → alreadyLearned（不消耗）', () => {
    const unit = makePlayerUnit({})
    const first = applyEffects(unit, unit, scroll.effects, baseOpts)
    expect(first.learned).toEqual(['fireball'])
    expect(first.target.skills.map((s) => s.id)).toContain('fireball')
    const second = applyEffects(first.target, first.target, scroll.effects, baseOpts)
    expect(second.learned).toEqual([])
    expect(second.alreadyLearned).toEqual(['fireball'])
  })

  it('learn_skill 指向不存在的技能 → 跳过说明', () => {
    const unit = makePlayerUnit({})
    const res = applyEffects(unit, unit, [{ op: 'learn_skill', skill: 'nope' }], baseOpts)
    expect(res.target.skills.length).toBe(0)
    expect(res.logs.join()).toContain('不存在')
  })

  it('forget_skill：不在技能栏里就静默', () => {
    const unit = makePlayerUnit({ skills: [skillMap.get('basic_attack')!] })
    const gone = applyEffects(unit, unit, [{ op: 'forget_skill', skill: 'basic_attack' }], baseOpts)
    expect(gone.forgotten).toEqual(['basic_attack'])
    expect(gone.target.skills.length).toBe(0)
    const again = applyEffects(gone.target, gone.target, [{ op: 'forget_skill', skill: 'basic_attack' }], baseOpts)
    expect(again.forgotten).toEqual([])
  })
})

describe('tickStates（回合开始执行一次）', () => {
  it('per_turn → duration−1 → 归零移除', () => {
    let unit = makePlayerUnit({})
    unit.stats = { ...unit.stats, hp: 10 }
    unit.resources = { ...unit.resources, hp: 10 }
    unit = applyEffects(unit, unit, [{ op: 'add_tag', tag: '中毒', duration: 2, per_turn: { hp: -1 } }], baseOpts).target

    // 刚挂上：第一次 tick 只清 pending（errors-skipped pass）
    const t0 = tickStates(unit)
    expect(t0.unit.states[0].duration).toBe(2)
    expect(t0.unit.resources.hp).toBe(10)

    const t1 = tickStates(t0.unit)
    expect(t1.unit.states[0].duration).toBe(1)
    expect(t1.unit.resources.hp).toBe(9)

    const t2 = tickStates(t1.unit)
    expect(t2.unit.states.length).toBe(0)
    expect(t2.expired).toEqual(['中毒'])
  })

  it('本回合刚挂的状态这次不 tick，下回合才首次生效（决策 6）', () => {
    let unit = makePlayerUnit({})
    unit.stats = { ...unit.stats, hp: 10 }
    unit.resources = { ...unit.resources, hp: 10 }
    unit = applyEffects(unit, unit, [{ op: 'add_tag', tag: '中毒', duration: 3, per_turn: { hp: -1 } }], baseOpts).target
    // 第一次 tick：清 pending，不结算
    const first = tickStates(unit)
    expect(first.unit.resources.hp).toBe(10)
    expect(first.unit.states[0].duration).toBe(3)
    // 第二次 tick 才真正扣
    const second = tickStates(first.unit)
    expect(second.unit.resources.hp).toBe(9)
    expect(second.unit.states[0].duration).toBe(2)
  })

  it('用道具不 tick：连吃两瓶药，状态的剩余回合一点不减', () => {
    let unit = makePlayerUnit({})
    unit.stats = { ...unit.stats, hp: 10 }
    unit.resources = { ...unit.resources, hp: 4 }
    unit = applyEffects(unit, unit, [{ op: 'add_tag', tag: '中毒', duration: 3, per_turn: { hp: -1 } }], baseOpts).target
    unit = applyEffects(unit, unit, redPotion.effects, baseOpts).target
    unit = applyEffects(unit, unit, redPotion.effects, baseOpts).target
    expect(unit.states[0].duration).toBe(3)
    expect(unit.resources.hp).toBe(10)
  })
})
