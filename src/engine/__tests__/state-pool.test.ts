/** 全局状态池运行时（V2.3 §2.5 读写接口 / §4 算子 / §8.4 回合判定排序） */

import { describe, expect, it } from 'vitest'
import { applyEffects, evalCheck, evalCheckRef, findDependencyCycle, orderRoundChecks, readByName, readPool, writePool } from '../state-pool'
import type { CondTpl, Pool, PoolRoundCheck } from '../../types'

const check = (alias: string | undefined, deps: string[] | undefined, source: 'pmod' | 'state' | 'engine'): PoolRoundCheck => ({
  ...(alias ? { alias } : {}),
  ...(deps ? { deps } : {}),
  when: { mode: 'all', items: [] },
  pool: [],
  source,
})

describe('读接口（§2.5 / §3.4 / §3.6）', () => {
  it('按「空间 ＋ 短名」拼前缀读；缺省值按空间的族给', () => {
    const pool: Pool = { 'usr-gold': 5, 'engine-hpValue': 12 }
    expect(readPool(pool, 'usr', 'gold')).toBe(5)
    expect(readPool(pool, 'engine', 'hpValue')).toBe(12)
    // engine-item.* 缺省 0；engine-roll.* 缺省空串 / false
    expect(readByName(pool, 'engine-item.apple')).toBe(0)
    expect(readByName(pool, 'engine-roll.npc.0-1,1#b1@0.slot1')).toBe('')
    expect(readByName(pool, 'engine-roll.mod.0-1,1#b1@0.n_m.1')).toBe(false)
    // 其余未设值 → undefined
    expect(readByName(pool, 'usr-nope')).toBeUndefined()
  })
})

describe('写接口（§4.3）', () => {
  it('七种写算子', () => {
    expect(writePool({}, 'usr', 's', 'set', 'a').pool['usr-s']).toBe('a')
    expect(writePool({ 'usr-s': 'a' }, 'usr', 's', 'append', 'b').pool['usr-s']).toBe('ab')
    expect(writePool({ 'usr-n': 1 }, 'usr', 'n', 'add', 2).pool['usr-n']).toBe(3)
    expect(writePool({ 'usr-n': 5 }, 'usr', 'n', 'minus', 2).pool['usr-n']).toBe(3)
    expect(writePool({ 'usr-n': 3 }, 'usr', 'n', 'multiply', 4).pool['usr-n']).toBe(12)
    expect(writePool({ 'usr-n': 8 }, 'usr', 'n', 'divide', 2).pool['usr-n']).toBe(4)
    expect(writePool({ 'usr-b': false }, 'usr', 'b', 'toggle', true).pool['usr-b']).toBe(true)
  })

  it('除以零 / 写只读引擎键 / 算子与类型不符 → 不执行（K22 / K23 / K26）', () => {
    const zero = writePool({ 'usr-n': 8 }, 'usr', 'n', 'divide', 0)
    expect(zero.ok).toBe(false)
    expect(zero.reason).toBe('divideByZero')
    expect(zero.pool['usr-n']).toBe(8)

    const ro = writePool({ 'engine-hpMax': 30 }, 'engine', 'hpMax', 'add', 5)
    expect(ro.ok).toBe(false)
    expect(ro.reason).toBe('readonly')
    expect(ro.pool['engine-hpMax']).toBe(30)

    // engine-hpValue 在可写四类之内
    expect(writePool({ 'engine-hpValue': 10 }, 'engine', 'hpValue', 'minus', 3).pool['engine-hpValue']).toBe(7)

    const mismatch = writePool({ 'usr-b': true }, 'usr', 'b', 'add', 1)
    expect(mismatch.ok).toBe(false)
  })

  it('批量执行静默跳过被拒绝的动作', () => {
    const pool = applyEffects({ 'engine-hpValue': 10, 'usr-n': 1 }, [
      { name: 'usr-n', op: 'add', value: 2 },
      { name: 'engine-patk', op: 'set', value: 99 },
      { name: 'usr-n', op: 'divide', value: 0 },
    ])
    expect(pool['usr-n']).toBe(3)
    expect(pool['engine-patk']).toBeUndefined()
  })
})

describe('判定求值（§4.2 / §4.4）', () => {
  it('空集合视为成立；all / any 语义', () => {
    expect(evalCheck({}, { mode: 'all', items: [] })).toBe(true)
    const pool: Pool = { 'usr-a': 3, 'usr-b': 5 }
    const items = [
      { name: 'usr-a', op: 'greater' as const, value: 2 },
      { name: 'usr-b', op: 'less' as const, value: 4 },
    ]
    expect(evalCheck(pool, { mode: 'all', items })).toBe(false)
    expect(evalCheck(pool, { mode: 'any', items })).toBe(true)
  })

  it('引用不存在的键 → 不成立；字符串包含；键对键比较', () => {
    const pool: Pool = { 'usr-name': '商人', 'usr-price': 30, 'usr-limit': 30 }
    expect(evalCheck(pool, { mode: 'all', items: [{ name: 'usr-missing', op: 'equals', value: 1 }] })).toBe(false)
    expect(evalCheck(pool, { mode: 'all', items: [{ name: 'usr-name', op: 'contain', value: '商' }] })).toBe(true)
    expect(evalCheck(pool, { mode: 'all', items: [{ name: 'usr-price', op: 'greaterEqual', ref: 'usr-limit' }] })).toBe(true)
  })

  it('判定模板：未声明的模板名恒不成立', () => {
    const templates = new Map<string, CondTpl>([['usr-rich', { name: 'usr-rich', when: { mode: 'all', items: [{ name: 'usr-gold', op: 'greater', value: 100 }] } }]])
    expect(evalCheckRef({ 'usr-gold': 200 }, 'usr-rich', templates)).toBe(true)
    expect(evalCheckRef({ 'usr-gold': 1 }, 'usr-rich', templates)).toBe(false)
    expect(evalCheckRef({}, 'usr-nope', templates)).toBe(false)
  })
})

describe('回合判定排序（§8.4）', () => {
  it('先按来源分三批，批内按依赖拓扑、匿名后置', () => {
    const checks = [
      check('b', ['a'], 'pmod'),
      check('a', undefined, 'pmod'),
      check(undefined, undefined, 'pmod'),
      check(undefined, undefined, 'state'),
      check('death', undefined, 'engine'),
    ]
    const ordered = orderRoundChecks(checks)
    expect(ordered.map((c) => c.alias ?? 'anon')).toEqual(['a', 'b', 'anon', 'anon', 'death'])
    expect(ordered[3].source).toBe('state')
    expect(ordered[4].source).toBe('engine')
  })

  it('缺依赖不成边、不影响执行；无依赖者保持声明顺序', () => {
    const checks = [check('x', ['nope'], 'pmod'), check('y', undefined, 'pmod')]
    expect(orderRoundChecks(checks).map((c) => c.alias)).toEqual(['x', 'y'])
  })

  it('回环按声明顺序兜底，不丢判定', () => {
    const checks = [check('a', ['b'], 'pmod'), check('b', ['a'], 'pmod')]
    expect(orderRoundChecks(checks).map((c) => c.alias)).toEqual(['a', 'b'])
    expect(findDependencyCycle(checks)).not.toBeNull()
    expect(findDependencyCycle([check('a', ['b'], 'pmod'), check('b', undefined, 'pmod')])).toBeNull()
  })
})
