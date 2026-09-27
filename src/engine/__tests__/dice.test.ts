/** 基础积木（§4.8.1）的单测边界 */

import { describe, expect, it } from 'vitest'
import { diceMax, diceMin, isValidDice, parseDice, rollRange, rollRangeAt, rollSteps, rollStepsAt, rollSum, rollWeights } from '../dice'

const always = (r: number) => () => r

describe('parseDice', () => {
  it('只接受 nDf', () => {
    expect(parseDice('1D6')).toEqual({ count: 1, faces: 6 })
    expect(parseDice('2d6')).toEqual({ count: 2, faces: 6 })
    expect(parseDice('10D20')).toEqual({ count: 10, faces: 20 })
    expect(isValidDice('1D6')).toBe(true)
    // 非法不静默默认，交给调用方报错
    expect(parseDice('D6')).toBeNull()
    expect(parseDice('1')).toBeNull()
    expect(parseDice('1D6+1')).toBeNull()
    expect(parseDice('0D6')).toBeNull()
    expect(parseDice('1D0')).toBeNull()
    expect(parseDice('')).toBeNull()
    expect(parseDice(undefined)).toBeNull()
  })

  it('点数上下界', () => {
    expect(diceMin({ count: 2, faces: 6 })).toBe(2)
    expect(diceMax({ count: 2, faces: 6 })).toBe(12)
  })
})

describe('rollRange', () => {
  it('单值区间直接取该值，不掷骰', () => {
    expect(rollRange([5, 5], '1D6', always(0))).toBe(5)
    expect(rollRange([5, 5], '1D6', always(0.99))).toBe(5)
  })

  it('掷最小 / 最大', () => {
    expect(rollRangeAt([3, 6], '1D6', 1)).toBe(3)
    expect(rollRangeAt([3, 6], '1D6', 6)).toBe(6)
    expect(rollRange([3, 6], '1D6', always(0))).toBe(3)
    expect(rollRange([3, 6], '1D6', always(0.999))).toBe(6)
  })

  it('2D6 的中间点数按归一化映射', () => {
    // t = (7 − 2) / (12 − 2) = 0.5 → 1 + round(0.5 × 5) = 1 + 3 = 4
    expect(rollRangeAt([1, 6], '2D6', 7)).toBe(4)
  })
})

describe('rollSteps', () => {
  const steps = [0.5, 1, 1, 1.5, 2, 3]
  it('掷 1 → 0.5 倍，掷 6 → 3 倍', () => {
    expect(rollStepsAt(steps, '1D6', 1)).toBe(0.5)
    expect(rollStepsAt(steps, '1D6', 6)).toBe(3)
    expect(rollSteps(steps, '1D6', always(0))).toBe(0.5)
    expect(rollSteps(steps, '1D6', always(0.999))).toBe(3)
  })
})

describe('rollSum', () => {
  it('骰点直接相加', () => {
    expect(rollSum('1D4', always(0))).toBe(1)
    expect(rollSum('2D4', always(0.999))).toBe(8)
    expect(rollSum(undefined, always(0))).toBe(0)
  })
})

describe('rollWeights（加权轮盘）', () => {
  it('轮子覆盖全部权重', () => {
    expect(rollWeights([3, 1], '1D6', always(0))).toBe(0)
    expect(rollWeights([3, 1], '1D6', always(0.999))).toBe(1)
  })

  it('权重全 0 → -1（无可选项）', () => {
    expect(rollWeights([0, 0], '1D6', always(0.5))).toBe(-1)
    expect(rollWeights([], '1D6', always(0.5))).toBe(-1)
  })
})
