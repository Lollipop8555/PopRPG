import { describe, expect, it } from 'vitest'

import type { SkinRoad } from '../../../types'
import { roadFlag, roadTileOf } from '../road-bits'
import { roadSprite } from '../road'

describe('roadFlag：位序从左上角起顺时针（§2.1）', () => {
  it('单一位对应固定位移', () => {
    expect(roadFlag({ nw: true })).toBe(1)
    expect(roadFlag({ n: true })).toBe(2)
    expect(roadFlag({ ne: true })).toBe(4)
    expect(roadFlag({ e: true })).toBe(8)
    expect(roadFlag({ se: true })).toBe(16)
    expect(roadFlag({ s: true })).toBe(32)
    expect(roadFlag({ sw: true })).toBe(64)
    expect(roadFlag({ w: true })).toBe(128)
  })

  it('全真为 255，全缺省为 0', () => {
    expect(
      roadFlag({ nw: true, n: true, ne: true, e: true, se: true, s: true, sw: true, w: true }),
    ).toBe(255)
    expect(roadFlag({})).toBe(0)
  })
})

describe('roadTileOf：槽位与姿态（§三 ＋ §五）', () => {
  const slotOf = (nb: Parameters<typeof roadFlag>[0]) => roadTileOf(roadFlag(nb))

  it('n = 0 为孤点', () => {
    expect(slotOf({})).toEqual({ slot: 'isolated', rotate: 0 })
  })

  it('n = 1 尽端路基准缺口朝北＝连通南', () => {
    expect(slotOf({ s: true })).toEqual({ slot: 'dead_end', rotate: 0 })
    expect(slotOf({ w: true })).toEqual({ slot: 'dead_end', rotate: 90 })
    expect(slotOf({ n: true })).toEqual({ slot: 'dead_end', rotate: 180 })
    expect(slotOf({ e: true })).toEqual({ slot: 'dead_end', rotate: 270 })
  })

  it('n = 2 相对为直路、相邻为折路', () => {
    expect(slotOf({ n: true, s: true })).toEqual({ slot: 'straight', rotate: 0 })
    expect(slotOf({ e: true, w: true })).toEqual({ slot: 'straight', rotate: 90 })
    expect(slotOf({ n: true, e: true })).toEqual({ slot: 'bend', rotate: 0 })
    expect(slotOf({ e: true, s: true })).toEqual({ slot: 'bend', rotate: 90 })
    expect(slotOf({ s: true, w: true })).toEqual({ slot: 'bend', rotate: 180 })
    expect(slotOf({ w: true, n: true })).toEqual({ slot: 'bend', rotate: 270 })
  })

  it('n = 2 相邻：夹角有路为 corner，外侧角不算（§五）', () => {
    // 北 ＋ 东 的唯一夹角是东北角
    expect(slotOf({ n: true, e: true, ne: true })).toEqual({ slot: 'corner', rotate: 0 })
    expect(slotOf({ n: true, e: true, nw: true })).toEqual({ slot: 'bend', rotate: 0 })
    expect(slotOf({ n: true, e: true, nw: true, se: true })).toEqual({
      slot: 'bend',
      rotate: 0,
    })
    // 东 ＋ 南 的夹角是东南角
    expect(slotOf({ e: true, s: true, se: true })).toEqual({ slot: 'corner', rotate: 90 })
    expect(slotOf({ e: true, s: true, ne: true })).toEqual({ slot: 'bend', rotate: 90 })
  })

  it('n = 3 三岔口基准缺口朝北', () => {
    expect(slotOf({ e: true, s: true, w: true })).toEqual({ slot: 'tee', rotate: 0 })
    expect(slotOf({ n: true, s: true, w: true })).toEqual({ slot: 'tee', rotate: 90 })
    expect(slotOf({ n: true, e: true, w: true })).toEqual({ slot: 'tee', rotate: 180 })
    expect(slotOf({ n: true, e: true, s: true })).toEqual({ slot: 'tee', rotate: 270 })
  })

  it('n = 3 的角位只数夹角：缺口两侧的角才算', () => {
    // 缺北（东＋南＋西）：夹角是东南与西南，西北 / 东北是外侧角
    expect(slotOf({ e: true, s: true, w: true, nw: true, ne: true })).toEqual({
      slot: 'tee',
      rotate: 0,
    })
    // 夹角之一有路 → tee_corner；基准姿态缺口朝南（西北 / 东北为夹角）
    expect(slotOf({ e: true, s: true, w: true, se: true })).toEqual({
      slot: 'tee_corner_nw',
      rotate: 180,
    })
    expect(slotOf({ e: true, s: true, w: true, sw: true })).toEqual({
      slot: 'tee_corner_ne',
      rotate: 180,
    })
    // 缺口朝南：夹角即西北与东北，基准姿态旋转量为 0
    expect(slotOf({ n: true, e: true, w: true, nw: true })).toEqual({
      slot: 'tee_corner_nw',
      rotate: 0,
    })
    expect(slotOf({ n: true, e: true, w: true, ne: true })).toEqual({
      slot: 'tee_corner_ne',
      rotate: 0,
    })
    // 缺口朝东（夹角为西北与西南）：西北有路 → 基准角位回到东北，旋转 270°
    expect(slotOf({ n: true, s: true, w: true, nw: true })).toEqual({
      slot: 'tee_corner_ne',
      rotate: 270,
    })
    // 缺口朝西：西南是外侧角，不计入
    expect(slotOf({ n: true, e: true, s: true, sw: true })).toEqual({ slot: 'tee', rotate: 270 })
    // 两个夹角都有路 → tee_full，基准缺口朝北
    expect(slotOf({ e: true, s: true, w: true, se: true, sw: true })).toEqual({
      slot: 'tee_full',
      rotate: 0,
    })
  })

  it('n = 4 才用角位区分 cross 系', () => {
    const all = { n: true, e: true, s: true, w: true }
    expect(slotOf(all).slot).toBe('cross')
    expect(slotOf({ ...all, nw: true })).toEqual({ slot: 'cross_one_corner', rotate: 0 })
    expect(slotOf({ ...all, ne: true })).toEqual({ slot: 'cross_one_corner', rotate: 90 })
    expect(slotOf({ ...all, nw: true, ne: true })).toEqual({ slot: 'cross_adjacent', rotate: 0 })
    expect(slotOf({ ...all, nw: true, se: true })).toEqual({ slot: 'cross_diagonal', rotate: 0 })
    expect(slotOf({ ...all, ne: true, sw: true })).toEqual({ slot: 'cross_diagonal', rotate: 90 })
    expect(slotOf({ ...all, nw: true, ne: true, se: true })).toEqual({
      slot: 'cross_three_corners',
      rotate: 0,
    })
    expect(slotOf({ ...all, nw: true, ne: true, se: true, sw: true })).toEqual({
      slot: 'plaza',
      rotate: 0,
    })
  })

  it('同一状态恒得同一槽位（确定性）', () => {
    const nb = { n: true, e: true, s: true, w: true, nw: true, se: true }
    const runs = Array.from({ length: 5 }, () => roadTileOf(roadFlag(nb)))
    expect(new Set(runs.map((r) => `${r.slot}:${r.rotate}`)).size).toBe(1)
  })
})

describe('roadSprite：合成取图（§二 / §七）', () => {
  const tiles: SkinRoad['tiles'] = {
    isolated: 'isolated.png',
    dead_end: 'dead_end.png',
    plaza: ['n.png', 'e.png', 's.png', 'w.png'],
  }

  it('整体缺省或该槽位缺键即未接管', () => {
    expect(roadSprite(undefined, [], 0)).toBeUndefined()
    expect(roadSprite({}, [], 0)).toBeUndefined()
    expect(roadSprite({ tiles }, [], roadFlag({ n: true, e: true }))).toBeUndefined()
  })

  it('base 作为共享前缀，平级 tiles 的值按相对文件名处理', () => {
    const road: SkinRoad = { styles: [{ tags: ['grass'], base: 'road/dirt/' }], tiles }
    expect(roadSprite(road, ['grass'], 0)?.src).toBe('road/dirt/isolated.png')
  })

  it('base 缺省时按全路径处理', () => {
    const road: SkinRoad = { tiles: { isolated: 'resource/road/isolated.png' } }
    expect(roadSprite(road, [], 0)?.src).toBe('resource/road/isolated.png')
  })

  it('四向数组按下标消解姿态，结果不再旋转', () => {
    const road: SkinRoad = { tiles: { dead_end: ['n.png', 'e.png', 's.png', 'w.png'] } }
    expect(roadSprite(road, [], roadFlag({ s: true }))).toEqual({
      slot: 'dead_end', src: 'n.png', rotate: 0, index: 0,
    })
    expect(roadSprite(road, [], roadFlag({ w: true }))).toEqual({
      slot: 'dead_end', src: 'e.png', rotate: 0, index: 1,
    })
    expect(roadSprite(road, [], roadFlag({ n: true }))).toEqual({
      slot: 'dead_end', src: 's.png', rotate: 0, index: 2,
    })
    expect(roadSprite(road, [], roadFlag({ e: true }))).toEqual({
      slot: 'dead_end', src: 'w.png', rotate: 0, index: 3,
    })
  })

  it('数组不足四项时，缺失的朝向视为该槽位未接管', () => {
    const road: SkinRoad = { tiles: { dead_end: ['n.png', 'e.png'] } }
    expect(roadSprite(road, [], roadFlag({ s: true }))?.src).toBe('n.png')
    expect(roadSprite(road, [], roadFlag({ n: true }))).toBeUndefined()
  })

  it('对象写法的纠偏角与姿态角相加并归一到 0–359', () => {
    const road: SkinRoad = { tiles: { dead_end: { img: 'd.png', rotate: 90 } } }
    expect(roadSprite(road, [], roadFlag({ s: true }))?.rotate).toBe(90)
    expect(roadSprite(road, [], roadFlag({ w: true }))?.rotate).toBe(180)
    expect(roadSprite(road, [], roadFlag({ n: true }))?.rotate).toBe(270)
    expect(roadSprite(road, [], roadFlag({ e: true }))?.rotate).toBe(0)
  })
})
