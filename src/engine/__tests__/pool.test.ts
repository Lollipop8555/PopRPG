/** 池 + 抽取算法（§4.8.5）单测边界 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../types'
import type { Library, PoolRef } from '../../types'
import { presetLibrary } from '../../presets'
import {
  copiesBounds,
  pickCountBounds,
  resolveItemPool,
  resolveMonster,
  resolveMonsterPool,
  resolveReward,
} from '../pool'

const library: Library = presetLibrary()
const allIds = [
  ...library.items.map((i) => i.id),
  ...library.monsters.map((m) => m.id),
  ...library.classes.map((c) => c.id),
  ...library.skills.map((s) => s.id),
]

describe('定池', () => {
  it('source: ids 只留已启用的那些', () => {
    const pool: PoolRef = { source: 'ids', ids: [{ id: 'red_potion', weight: 5 }, 'iron_sword'] }
    const full = resolveItemPool(library, allIds, pool)
    expect(full.map((p) => p.id)).toEqual(['red_potion', 'iron_sword'])
    expect(full[0].weight).toBe(5)
    expect(full[1].weight).toBe(1) // 写纯 id 视为权重 1
    const partial = resolveItemPool(library, ['red_potion'], pool)
    expect(partial.map((p) => p.id)).toEqual(['red_potion'])
  })

  it('source: filter 按 kind + 标签筛（多个标签 = 全都要有）', () => {
    const byKind = resolveItemPool(library, allIds, { source: 'filter', filter: { itemKind: 'consumable' } })
    expect(byKind.every((p) => library.items.find((i) => i.id === p.id)!.kind === 'consumable')).toBe(true)

    const byTag = resolveItemPool(library, allIds, { source: 'filter', filter: { tags: ['货币'] } })
    expect(byTag.map((p) => p.id)).toEqual(['gold'])

    const twoTags = resolveItemPool(library, allIds, { source: 'filter', filter: { tags: ['货币', '洞穴'] } })
    expect(twoTags.length).toBe(0) // 两个都要满足 → 没人同时满足
  })

  it('未启用的怪物不进任何池', () => {
    const pool: PoolRef = { source: 'ids', ids: ['goblin', 'slime'] }
    const none = resolveMonsterPool(library, [], pool)
    expect(none.length).toBe(0)
    const one = resolveMonsterPool(library, ['goblin'], pool)
    expect(one.map((p) => p.id)).toEqual(['goblin'])
  })
})

describe('抽取算法五步', () => {
  const pool: PoolRef = { source: 'ids', ids: ['red_potion', 'blue_potion'] }
  const items = resolveItemPool(library, allIds, pool)

  it('件数恒被 |池| 夹住（|池| < n）', () => {
    const res = resolveReward(
      items,
      { algo: 'count', dice: '1D6', range: [5, 6] },
      { algo: 'fixed', n: 1 },
      () => 0.999,
    )
    expect(res.requested).toBe(6)
    expect(res.pieces.length).toBe(2)
    expect(res.poolSize).toBe(2)
  })

  it('池空 → 产出为空', () => {
    const res = resolveReward([], { algo: 'count', dice: '1D6', range: [1, 2] }, { algo: 'fixed', n: 1 }, () => 0.5)
    expect(res.pieces).toEqual([])
    expect(res.poolSize).toBe(0)
  })

  it('tiers 档位可以写 0 → 空箱', () => {
    const tiers = { algo: 'tiers' as const, dice: '1D6', tiers: [{ upto: 2, n: 0 }, { upto: 4, n: 1 }, { upto: 6, n: 2 }] }
    const empty = resolveReward(items, tiers, { algo: 'fixed', n: 1 }, () => 0)
    expect(empty.pieces.length).toBe(0)
    const two = resolveReward(items, tiers, { algo: 'fixed', n: 1 }, () => 0.999)
    expect(two.pieces.length).toBe(2)
    expect(pickCountBounds(tiers, 5)).toEqual({ min: 0, max: 2 })
    expect(pickCountBounds(tiers, 1)).toEqual({ min: 0, max: 1 })
  })

  it('copies 三种算法的值域', () => {
    expect(copiesBounds({ algo: 'fixed', n: 3 })).toEqual({ min: 3, max: 3 })
    expect(copiesBounds({ algo: 'value', dice: '1D6', range: [2, 5] })).toEqual({ min: 2, max: 5 })
    expect(copiesBounds({ algo: 'multiplier', dice: '1D6', steps: [1, 1, 1, 2, 2, 3] })).toEqual({ min: 1, max: 3 })
  })
})

describe('怪物房：先抽一只，再摇属性', () => {
  it('抽到就成型，属性已摇定', () => {
    const res = resolveMonster(
      library,
      allIds,
      { source: 'ids', ids: [{ id: 'goblin', weight: 3 }, { id: 'slime', weight: 1 }] },
      DEFAULT_RULES,
      { rng: () => 0.1 },
    )
    expect(res).not.toBeNull()
    expect(res!.monster.stats.hp).toBeGreaterThanOrEqual(6)
    expect(res!.monster.id === 'goblin' || res!.monster.id === 'slime').toBe(true)
  })

  it('池空 → 空房间，不触发战斗', () => {
    const res = resolveMonster(library, [], { source: 'ids', ids: ['goblin'] }, DEFAULT_RULES, {})
    expect(res).toBeNull()
  })

  it('两次遭遇各自独立摇（同一只怪第二次是另一个实例）', () => {
    const pool: PoolRef = { source: 'ids', ids: ['goblin'] }
    const a = resolveMonster(library, allIds, pool, DEFAULT_RULES, { rng: () => 0 })
    const b = resolveMonster(library, allIds, pool, DEFAULT_RULES, { rng: () => 0.999 })
    expect(a!.monster.stats.patk).toBe(2)
    expect(b!.monster.stats.patk).toBe(4)
  })
})
