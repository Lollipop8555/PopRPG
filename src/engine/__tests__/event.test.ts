/** 事件 / 背包 / 商店（§4.8.9 / §4.2.4 / §4.8.11）单测边界 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../types'
import type { EventBlock, Gate } from '../../types'
import { PRESET_CLASSES, PRESET_ITEMS } from '../../presets'
import { checkAnalysis, resolveEvent } from '../event'
import { addToInventory, canPickUp, inventoryCapacity, payAndTake, priceBounds, resolvePrice, resolvePointReward } from '../item'
import { makePlayerUnit } from '../units'

const knight = PRESET_CLASSES[0]
const opts = { rules: DEFAULT_RULES, maxDuration: 10 }

function strong() {
  const unit = makePlayerUnit({ cls: knight, alloc: { patk: 30 } })
  unit.stats = { ...unit.stats, hp: 30 }
  unit.resources = { ...unit.resources, hp: 30 }
  return unit
}

function weak() {
  const unit = makePlayerUnit({ cls: knight })
  unit.stats = { ...unit.stats, hp: 5 }
  unit.resources = { ...unit.resources, hp: 5 }
  return unit
}

describe('check 省略 = 必成', () => {
  it('没有 check：过了门槛就是成功', () => {
    const res = resolveEvent(weak(), { text: '一段旁白' }, opts)
    expect(res.verdict).toBe('success')
    expect(res.roll).toBeUndefined()
  })
})

describe('门槛 gate 两个分支', () => {
  const gate: Gate = { tags: ['撬锁'], mode: 'all', missing: 'block' }

  it('missing: block → 连尝试都不给', () => {
    const res = resolveEvent(weak(), { text: '', gate }, opts)
    expect(res.verdict).toBe('blocked')
    expect(res.pointReward).toBe(0)
  })

  it('missing: penalty → 允许强闯，承受额外代价并走失败分支', () => {
    const event: EventBlock = {
      text: '',
      gate: { tags: ['撬锁'], missing: 'penalty', penalty: { hp: 3 } },
      on_fail: { text: '受伤', cost: { hp: 2 } },
    }
    const unit = weak()
    const res = resolveEvent(unit, event, opts)
    expect(res.verdict).toBe('fail')
    expect(res.unit.resources.hp).toBe(0) // 3 + 2 都扣掉了
  })

  it('有门把手：带上撬锁工具就能过门槛', () => {
    const unit = makePlayerUnit({ cls: knight, equipped: [PRESET_ITEMS.find((i) => i.id === 'lockpick')!] })
    const res = resolveEvent(unit, { text: '', gate, check: { add: 'none', target: 1 } }, opts)
    expect(res.verdict).toBe('success')
  })
})

describe('必成 / 必败（§5.7）', () => {
  it('目标值调到必败：手掷满也不够', () => {
    const check = { dice: '2D6', add: 'patk' as const, target: 999 }
    const analysis = checkAnalysis(weak(), check, DEFAULT_RULES)
    expect(analysis.verdict).toBe('never')
    expect(analysis.needPips).toBeNull()
    expect(analysis.rate).toBe(0)
  })

  it('目标值调到必定成功', () => {
    const analysis = checkAnalysis(strong(), { dice: '2D6', add: 'patk', target: 1 }, DEFAULT_RULES)
    expect(analysis.verdict).toBe('always')
    expect(analysis.rate).toBe(1)
  })

  it('命中率与文档例子一致（加值 8 / 2D6 / target 15 → 需掷 ≥ 7，约 58%）', () => {
    const unit = makePlayerUnit({ cls: knight, alloc: { patk: 5 } })
    // 骑士 patk 120%：(3 + 5) × 1.2 = 9.6 → floor 9
    const analysis = checkAnalysis(unit, { dice: '2D6', add: 'patk', target: 15 }, DEFAULT_RULES)
    expect(analysis.min).toBe(11) // 9 + 2
    expect(analysis.max).toBe(21) // 9 + 12
    expect(analysis.verdict).toBe('maybe')
    // needPips = 6 → 命中率 26/36
    expect(analysis.needPips).toBe(6)
    expect(analysis.rate).toBeCloseTo(26 / 36, 5)
  })
})

describe('后果块', () => {
  it('成功后给点数与道具', () => {
    const res = resolveEvent(weak(), {
      on_success: { point_reward: 2, grant: [{ id: 'red_potion', count: 1 }] },
    }, opts)
    expect(res.pointReward).toBe(2)
    expect(res.grants).toEqual([{ id: 'red_potion', count: 1 }])
  })

  it('point_reward 是固定值、不掷骰', () => {
    expect(resolvePointReward(undefined)).toBe(0)
    expect(resolvePointReward(5)).toBe(5)
  })
})

describe('背包容量（§4.2.4）', () => {
  it('inventory_size: 1 → 第二件不同道具被拒；同种叠加仍占 1 格；0 = 无限', () => {
    const cls = { ...knight, inventory_size: 1 }
    const first = addToInventory(cls, [], [{ id: 'red_potion', count: 1 }])
    expect(first.inventory.length).toBe(1)

    const sameKind = addToInventory(cls, first.inventory, [{ id: 'red_potion', count: 9 }])
    expect(sameKind.inventory.length).toBe(1)
    expect(sameKind.inventory[0].count).toBe(10)

    const second = addToInventory(cls, sameKind.inventory, [{ id: 'iron_sword', count: 1 }])
    expect(second.rejected.length).toBe(1)
    expect(second.rejected[0].reason).toBe('背包已满')

    const unlimited = { ...knight, inventory_size: 0 }
    expect(inventoryCapacity(unlimited)).toBe(Number.POSITIVE_INFINITY)
    const many = addToInventory(unlimited, [], [
      { id: 'red_potion', count: 1 },
      { id: 'iron_sword', count: 1 },
      { id: 'gold', count: 1 },
    ])
    expect(many.rejected.length).toBe(0)
  })

  it('默认 50 格；职业没写 inventory_size 也按 50 算', () => {
    const bare = { ...knight, inventory_size: undefined }
    expect(inventoryCapacity(bare)).toBe(50)
    expect(canPickUp(bare, [], 'gold').ok).toBe(true)
  })
})

describe('商店（§4.8.11）', () => {
  it('fixed 不掷骰；value 按区间取值', () => {
    const fixed = { currency: 'gold', algo: 'fixed' as const, n: 7 }
    expect(resolvePrice(fixed, DEFAULT_RULES.shop.price, { rng: () => 0.999 }).value).toBe(7)
    expect(priceBounds(fixed)).toEqual({ min: 7, max: 7 })

    const value = { currency: 'gold', algo: 'value' as const, dice: '1D6', range: [5, 15] as [number, number] }
    expect(resolvePrice(value, DEFAULT_RULES.shop.price, { rng: () => 0 }).value).toBe(5)
    expect(resolvePrice(value, DEFAULT_RULES.shop.price, { rng: () => 0.999 }).value).toBe(15)
  })

  it('货币就是一件普通道具：够钱就成交，不够就被拒', () => {
    const cls = { ...knight, inventory_size: 10 }
    const rich = [{ id: 'gold', count: 100 }]
    const ok = payAndTake(cls, rich, 'red_potion', 1, { value: 12, currency: 'gold' })
    expect(ok.ok).toBe(true)
    expect(ok.inventory.find((e) => e.id === 'gold')?.count).toBe(88)

    const poor = [{ id: 'gold', count: 3 }]
    const bad = payAndTake(cls, poor, 'red_potion', 1, { value: 12, currency: 'gold' })
    expect(bad.ok).toBe(false)
    expect(bad.reason).toContain('不够')
  })
})
