/**
 * 容器取值（`skin/03-window.md` §四）：`surfaceOf()` 的确定性——三种容器各查自己的键，
 * **不跨键借用**（对话框没配就用不回抽屉的图），整个 `window` 节缺位也不抛。
 */

import { describe, expect, it } from 'vitest'
import { surfaceOf } from '../lookup'
import type { SkinWindow } from '../../../types'

const DIALOG = 'art/window/paper.png'

describe('window.surfaces 取值（§四）', () => {
  const win: SkinWindow = {
    surfaces: {
      dialog: DIALOG,
      popover: { img: 'art/window/pop.png', slice: [10, 10, 10, 10] },
    },
  }

  it('三种容器各查自己的键：字符串写法与图引用写法都原样交出', () => {
    expect(surfaceOf(win, 'dialog')).toBe(DIALOG)
    expect(surfaceOf(win, 'popover')).toEqual({ img: 'art/window/pop.png', slice: [10, 10, 10, 10] })
  })

  it('未配该键即取不到：对话框的图不会借给抽屉', () => {
    expect(surfaceOf(win, 'drawer')).toBeUndefined()
  })

  it('整个 window 节缺位（无皮肤 / 老包）即取不到，不抛', () => {
    expect(surfaceOf(undefined, 'dialog')).toBeUndefined()
    expect(surfaceOf({ buttons: {} }, 'dialog')).toBeUndefined()
  })
})
