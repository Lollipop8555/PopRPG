import { describe, expect, it } from 'vitest'

import type { SkinRoadStyle } from '../../../types'
import { pickRoadStyle } from '../road-style'

const s = (tags: string[], mode?: 'any' | 'all'): SkinRoadStyle => ({ tags, mode })

describe('pickRoadStyle：道路样式集选取（§六）', () => {
  it('① 未标标签的样式集优先于任何带标签的候选，即使声明在后', () => {
    const styles = [s(['grass']), s([])]
    expect(pickRoadStyle(['grass'], styles)?.tags).toEqual([])
  })

  it('② 命中数多者优先', () => {
    const styles = [s(['a']), s(['a', 'b'])]
    expect(pickRoadStyle(['a', 'b'], styles)?.tags).toEqual(['a', 'b'])
    expect(pickRoadStyle(['a'], styles)?.tags).toEqual(['a'])
  })

  it('③ 同分时声明顺序靠前者优先', () => {
    const styles = [s(['a']), s(['a', 'a'])]
    expect(pickRoadStyle(['a'], styles)).toBe(styles[0])
  })

  it('标签按集合交去重计数，重复标签不虚增命中数', () => {
    const styles = [s(['a', 'b']), s(['a', 'a', 'a'])]
    expect(pickRoadStyle(['a'], styles)).toBe(styles[0])
  })

  it('无标签命中且没有通配底样时返回 undefined', () => {
    expect(pickRoadStyle(['grass'], [s(['stone'])])).toBeUndefined()
    expect(pickRoadStyle([], undefined)).toBeUndefined()
    expect(pickRoadStyle([], [])).toBeUndefined()
  })

  it('mode: all 要求样式集标签被全部命中', () => {
    const styles = [s(['a', 'b'], 'all')]
    expect(pickRoadStyle(['a'], styles)).toBeUndefined()
    expect(pickRoadStyle(['a', 'b'], styles)).toBe(styles[0])
  })

  it('mode: all 命中后仍参与 ① 的通配比较', () => {
    const styles = [s(['a', 'b'], 'all'), s([])]
    expect(pickRoadStyle(['a', 'b'], styles)?.tags).toEqual([])
  })

  it('同一输入恒取同一结果（确定性）', () => {
    const styles = [s(['a']), s(['a', 'b']), s([])]
    const runs = Array.from({ length: 5 }, () => pickRoadStyle(['a', 'b'], styles))
    expect(new Set(runs).size).toBe(1)
    expect(runs[0]?.tags).toEqual([])
  })

  it('空 tags 集合不会命中带标签的样式集', () => {
    expect(pickRoadStyle([], [s(['a'])])).toBeUndefined()
  })
})
