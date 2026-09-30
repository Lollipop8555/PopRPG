/**
 * 杂项取值（`skin/04-misc.md` §二 / §三）：地图标记三键与骰子本体 / 骰面的确定性——
 * 三键各查自己的键、**不互相借用**；骰面 1–6 给点阵、其余点数给数字面；缺位一律 `undefined`。
 */

import { describe, expect, it } from 'vitest'
import { dieBodyOf, dieFaceOf, markOf } from '../lookup'
import type { SkinMisc } from '../../../types'

const misc: SkinMisc = {
  marks: {
    start: 'art/misc/start.png',
    footprint: { img: 'art/misc/foot.png', flip: true },
  },
  dice: {
    body: 'art/misc/die.png',
    faces: { d1: 'art/misc/d1.png', d6: 'art/misc/d6.png', numeric: 'art/misc/num.png' },
  },
}

describe('地图标记取值（§二）', () => {
  it('三键各查自己的键：字符串写法与图引用写法都原样交出', () => {
    expect(markOf(misc, 'start')).toBe('art/misc/start.png')
    expect(markOf(misc, 'footprint')).toEqual({ img: 'art/misc/foot.png', flip: true })
  })

  it('未配该键即取不到：起点的旗不会借给终点', () => {
    expect(markOf(misc, 'end')).toBeUndefined()
  })

  it('整个 misc 节缺位（无皮肤 / 老包）即取不到，不抛', () => {
    expect(markOf(undefined, 'start')).toBeUndefined()
    expect(markOf({}, 'footprint')).toBeUndefined()
  })
})

describe('骰子取值（§三）', () => {
  it('本体一张通吃三档：不分尺寸档，也没配就是没有', () => {
    expect(dieBodyOf(misc)).toBe('art/misc/die.png')
    expect(dieBodyOf({})).toBeUndefined()
    expect(dieBodyOf(undefined)).toBeUndefined()
  })

  it('骰面 1–6 取点阵：只配了哪几面就只认哪几面', () => {
    expect(dieFaceOf(misc, 1)).toBe('art/misc/d1.png')
    expect(dieFaceOf(misc, 6)).toBe('art/misc/d6.png')
    // 缺的那一面（d2）取不到 → 该面回退程序点阵，而不是硬套 d1
    expect(dieFaceOf(misc, 2)).toBeUndefined()
  })

  it('1–6 之外的点数（2D6 的合计、流程里的异常值）一律交给数字面', () => {
    expect(dieFaceOf(misc, 7)).toBe('art/misc/num.png')
    expect(dieFaceOf(misc, 12)).toBe('art/misc/num.png')
    expect(dieFaceOf(misc, 0)).toBe('art/misc/num.png')
    expect(dieFaceOf(misc, -1)).toBe('art/misc/num.png')
  })

  it('整个 faces 节缺位即取不到，不抛', () => {
    expect(dieFaceOf({}, 3)).toBeUndefined()
    expect(dieFaceOf({ dice: { body: 'art/misc/die.png' } }, 3)).toBeUndefined()
    expect(dieFaceOf(undefined, 9)).toBeUndefined()
  })
})
