/**
 * 道具 / 建筑的取图（`skin/06-item-building.md` §2.3）。
 *
 * 两处本批新增的规矩：衬底三件套的**兜底链**（`fill` 缺省＝组件色、`stroke` 缺省＝不绘制）
 * 与建筑贴图的**唯一一处跨节回退**（`building.img` → `misc.nodes.building`）。
 */

import { describe, expect, it } from 'vitest'
import { buildingImgOf, buildingSkinOf, groundPaint, itemSkinOf } from '../lookup'

describe('衬底三件套：fill 的兜底与 stroke 的缺省（§2.3 / 裁决 18）', () => {
  const COLOR = '#e2533b'

  it('只写 `fill`：照给；`stroke` 缺省即不绘制（既不跟随 `fill`，也不保留组件色）', () => {
    expect(groundPaint({ fill: '#aa3311' }, COLOR)).toEqual({
      img: undefined,
      fill: '#aa3311',
      stroke: undefined,
    })
  })

  it('字符串写法＝只写 `fill`', () => {
    expect(groundPaint('#aa3311', COLOR)?.fill).toBe('#aa3311')
    expect(groundPaint('#aa3311', COLOR)?.stroke).toBeUndefined()
  })

  it('只写 `stroke`：`fill` 回退组件色（调用方再缺就是主题色）', () => {
    const paint = groundPaint({ stroke: '#221100' }, COLOR)
    expect(paint?.fill).toBe(COLOR)
    expect(paint?.stroke).toBe('#221100')
  })

  it('只写 `img`：`fill` 仍回退组件色，作背景图透明区的兜底', () => {
    const paint = groundPaint({ img: 'cell.png' }, COLOR)
    expect(paint?.img).toBe('cell.png')
    expect(paint?.fill).toBe(COLOR)
  })

  it('三项都空＝整节未接管：不给兜底色，程序绘制形态照旧（取舍 `S-11`）', () => {
    expect(groundPaint({}, COLOR)).toBeUndefined()
    expect(groundPaint(undefined, COLOR)).toBeUndefined()
  })

  it('没给兜底色时也不编：`fill` 保持缺位，由调用方决定下一步', () => {
    expect(groundPaint({ stroke: '#221100' })?.fill).toBeUndefined()
  })
})

describe('建筑贴图链（§2.3）：唯此一处跨节回退', () => {
  const COMMON = 'art/building/common.png'
  const misc = { nodes: { building: COMMON } }

  it('该建筑配了 `img`：用自己的，不借通用件', () => {
    expect(buildingImgOf({ merchant: { img: 'shop.png' } }, misc, 'merchant')).toBe('shop.png')
  })

  it('该建筑没配 `img`（哪怕配了衬底）：回退 `misc.nodes.building`', () => {
    expect(buildingImgOf({ merchant: { background: '#fff' } }, misc, 'merchant')).toBe(COMMON)
    expect(buildingImgOf({}, misc, 'merchant')).toBe(COMMON)
    expect(buildingImgOf(undefined, misc, 'merchant')).toBe(COMMON)
  })

  it('通用件也没配：`undefined` → 程序绘制圆角矩形', () => {
    expect(buildingImgOf(undefined, undefined, 'merchant')).toBeUndefined()
    expect(buildingImgOf({ merchant: { background: '#fff' } }, undefined, 'merchant')).toBeUndefined()
  })

  it('节点没有 `ref`（查不到组件）：不拿空 id 去撞键，直接走通用件', () => {
    expect(buildingImgOf({ '': { img: 'oops.png' } }, misc, undefined)).toBe(COMMON)
    expect(buildingImgOf({ '': { img: 'oops.png' } }, undefined, undefined)).toBeUndefined()
  })
})

describe('道具 / 建筑各查自己的键（§2.3：不跨键借用）', () => {
  it('没配的那一条不借别人的条目', () => {
    expect(buildingSkinOf({ merchant: { img: 'shop.png' } }, 'stone_door')).toBeUndefined()
    expect(buildingSkinOf(undefined, 'merchant')).toBeUndefined()
    expect(itemSkinOf({ red_potion: { icon: 'p.png' } }, 'iron_sword')).toBeUndefined()
    expect(itemSkinOf(undefined, 'red_potion')).toBeUndefined()
  })
})
