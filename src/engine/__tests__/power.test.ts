/** 属性结算 + 力值链（§4.8.2）单测边界 */

import { describe, expect, it } from 'vitest'
import {
  buildPower,
  canPass,
  capabilities,
  makePlayerUnit,
  playerStats,
  powerBounds,
  remainingPoints,
  settleStats,
} from '../units'
import type { Rng } from '../dice'
import { PRESET_CLASSES, PRESET_ITEMS } from '../../presets'

const knight = PRESET_CLASSES[0]
const mage = PRESET_CLASSES[1]
const sword = PRESET_ITEMS.find((i) => i.id === 'iron_sword')!
const boots = PRESET_ITEMS.find((i) => i.id === 'fire_boots')!

describe('playerStats —— 玩家侧不摇', () => {
  it('玩家属性 = base_stats + 分配', () => {
    const stats = playerStats(knight, { hp: 8, patk: 12, pdef: 5 })
    expect(stats).toEqual({ hp: 13, mp: 0, patk: 15, matk: 0, pdef: 7, mdef: 0 })
  })
})

describe('remainingPoints', () => {
  it('free_points: 0 与 300 都不报错（那是职业设定，不是引擎硬规则）', () => {
    const poor = { ...knight, free_points: 0 }
    const rich = { ...knight, free_points: 300 }
    expect(remainingPoints(poor)).toBe(0)
    expect(remainingPoints(rich)).toBe(300)
    expect(remainingPoints(knight, { hp: 25 })).toBe(0)
  })

  it('余点保留、跨来源累积（Σ point_reward 进剩余点）', () => {
    expect(remainingPoints(knight, { patk: 10 }, 5)).toBe(25 + 5 - 10)
  })
})

describe('settleStats —— 怪物侧登场摇定', () => {
  const stats = { hp: [6, 12], mp: [0, 2], patk: [2, 4], matk: [0, 2], pdef: [1, 2], mdef: [1, 2] } as const

  it('掷最小 / 最大', () => {
    const lo: Rng = () => 0
    const hi: Rng = () => 0.999
    expect(settleStats(stats as never, '1D6', lo)).toEqual({ hp: 6, mp: 0, patk: 2, matk: 0, pdef: 1, mdef: 1 })
    expect(settleStats(stats as never, '1D6', hi)).toEqual({ hp: 12, mp: 2, patk: 4, matk: 2, pdef: 2, mdef: 2 })
  })

  it('不同遭遇各自独立摇（不是全局只摇一次）', () => {
    const first = settleStats(stats as never, '1D6', () => 0)
    const second = settleStats(stats as never, '1D6', () => 0.999)
    expect(first.patk).toBe(2)
    expect(second.patk).toBe(4)
    expect(first.patk).not.toBe(second.patk)
  })
})

describe('buildPower 五环', () => {
  it('装备加值（加法环）与职业百分比（乘法环）位置不同，不能互换', () => {
    const unit = makePlayerUnit({ cls: knight, equipped: [sword], alloc: { patk: 10 } })
    const p = buildPower(unit, 'patk', undefined, 0, { noRoll: true })
    // 属性 3+10=13，装备 +5 → 18，骑士 patk 120% → 21.6 → floor 21
    expect(p.stat).toBe(13)
    expect(p.equipment).toBe(5)
    expect(p.prof).toBe(1.2)
    expect(p.value).toBe(Math.floor(18 * 1.2))
  })

  it('法师 patk 永远按 ×0.8 计算（先天属性配置不可更改）', () => {
    const unit = makePlayerUnit({ cls: mage, alloc: { patk: 30 } })
    const p = buildPower(unit, 'patk', undefined, 0, { noRoll: true })
    expect(p.prof).toBe(0.8)
    expect(p.value).toBe(Math.floor(30 * 0.8))
  })

  it('不防御 = 固有数值（无骰浮动，不是 0）', () => {
    const unit = makePlayerUnit({ cls: knight, equipped: [sword], alloc: { pdef: 5 } })
    const roll = { add_dice: '1D4' }
    const noRoll = buildPower(unit, 'pdef', roll, 0, { noRoll: true })
    const minRoll = buildPower(unit, 'pdef', roll, 0, { addRoll: 1 })
    expect(noRoll.add).toBe(0)
    expect(noRoll.value).toBe(Math.floor((2 + 5 + 0) * 1.1))
    expect(minRoll.value).toBe(Math.floor(((2 + 5) * 1.1 + 1) * 1))
  })

  it('powerBounds 取全组合极值', () => {
    const unit = makePlayerUnit({ cls: knight, alloc: { patk: 4 } })
    const bounds = powerBounds(unit, 'patk', { add_dice: '1D4', mult: { dice: '1D6', steps: [0.5, 1, 1, 1.5, 2, 3] } }, 0)
    expect(bounds.min).toBe(Math.floor(((3 + 4) * 1.2 + 1) * 0.5))
    expect(bounds.max).toBe(buildPower(unit, 'patk', { add_dice: '1D4', mult: { dice: '1D6', steps: [0.5, 1, 1, 1.5, 2, 3] } }, 0, { addRoll: 4, multRoll: 6 }).value)
  })
})

describe('capabilities 与 canPass', () => {
  it('能力 = 装备 ∪ 职业 ∪ 身上状态', () => {
    const unit = makePlayerUnit({ cls: knight, equipped: [boots] })
    unit.states.push({ tag: '火抗', duration: 3, source: 'fire_ward' })
    const caps = capabilities(unit)
    expect(caps.has('火抗')).toBe(true)
  })

  it('any / all / block / penalty', () => {
    const unit = makePlayerUnit({ cls: knight, equipped: [boots] })
    const caps = capabilities(unit)
    expect(canPass(undefined, caps).pass).toBe(true)
    expect(canPass({ tags: ['火抗'] }, caps).pass).toBe(true)
    expect(canPass({ tags: ['渡河'] }, caps).pass).toBe(false)
    expect(canPass({ tags: ['火抗'], mode: 'all' }, caps).pass).toBe(true)
    expect(canPass({ tags: ['火抗', '渡河'], mode: 'all' }, caps).pass).toBe(false)
    expect(canPass({ tags: ['火抗', '渡河'], mode: 'any' }, caps).pass).toBe(true)
    // penalty：能走，但要付代价
    const soft = canPass({ tags: ['渡河'], missing: 'penalty', penalty: { hp: 5 } }, caps)
    expect(soft.pass).toBe(true)
    expect(soft.penalty).toEqual({ hp: 5 })
  })

  it('标签驱动：编辑器不认识具体的词（临时造「飞行」也走得通）', () => {
    const winged = makePlayerUnit({
      cls: { ...knight, tags: ['飞行'] },
    })
    expect(canPass({ tags: ['飞行'], missing: 'block' }, capabilities(winged)).pass).toBe(true)
  })
})
