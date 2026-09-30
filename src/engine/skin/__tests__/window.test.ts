/**
 * 容器与按钮取值（`skin/03-window.md` §四）：`surfaceOf()` / `buttonOf()` / `buttonStatesOf()` 的确定性——
 * 每个键各查自己的键，**不跨键借用**（对话框没配就用不回抽屉的图），整个 `window` 节缺位也不抛。
 * 按钮四态里 `normal` 唯一必填（`buttonOf()` 就是 `buttonStatesOf()` 的 `normal` 那一项）。
 */

import { describe, expect, it } from 'vitest'
import { BUTTON_KINDS, BUTTON_STATES, SLOT_KINDS, buttonOf, buttonStatesOf, slotOf, surfaceOf } from '../lookup'
import type { SkinButton, SkinWindow } from '../../../types'

const DIALOG = 'art/window/paper.png'
const PRIMARY = 'art/window/btn-primary.png'
const SKILL = 'art/window/slot-skill.png'

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

describe('window.buttons 取值（§四）', () => {
  const win: SkinWindow = {
    buttons: {
      primary: PRIMARY,
      danger: 'art/window/btn-danger.png',
      // 四态对象：`normal` 是唯一必填项，其余三态各查自己的态
      small: { normal: 'art/window/btn-small.png', hover: 'art/window/btn-small-hover.png' },
      // 老包 / 手写配置可能漏掉 `normal`，此时整个按钮算没配
      ghost: { hover: 'art/window/btn-ghost-hover.png' } as unknown as SkinButton,
    },
  }

  it('字符串写法等于只写 `normal`，四态对象交出的是它的 `normal`', () => {
    expect(buttonOf(win, 'primary')).toBe(PRIMARY)
    expect(buttonOf(win, 'small')).toBe('art/window/btn-small.png')
  })

  it('四态对象缺 `normal` 即取不到：`hover` 不代表这个按钮有图', () => {
    expect(buttonOf(win, 'ghost')).toBeUndefined()
  })

  it('七个键互不借用：配了 `primary` 不等于配了 `plain` / `close`', () => {
    expect(buttonOf(win, 'plain')).toBeUndefined()
    expect(buttonOf(win, 'close')).toBeUndefined()
    expect(buttonOf(win, 'icon')).toBeUndefined()
  })

  it('整个 window 节缺位、或该键没配，都取不到且不抛', () => {
    expect(buttonOf(undefined, 'primary')).toBeUndefined()
    expect(buttonOf({ surfaces: {} }, 'primary')).toBeUndefined()
  })

  it('键集合是固定的七个（清单与遍历用），键名不随实现漂移', () => {
    expect([...BUTTON_KINDS]).toEqual(['plain', 'primary', 'danger', 'ghost', 'small', 'icon', 'close'])
  })
})

describe('window.buttons 四态取值（§4.1）', () => {
  const win: SkinWindow = {
    buttons: {
      primary: PRIMARY,
      small: {
        normal: 'art/window/btn-small.png',
        hover: 'art/window/btn-small-hover.png',
        active: 'art/window/btn-small-active.png',
      },
      danger: { normal: 'art/window/btn-danger.png', disabled: 'art/window/btn-danger-off.png' },
      // 缺 `normal`：整个按钮算没配，`hover` 写了也一并作废
      ghost: { hover: 'art/window/btn-ghost-hover.png' } as unknown as SkinButton,
    },
  }

  it('字符串写法只交出 `normal` 一项，不凭空补三态', () => {
    expect(buttonStatesOf(win, 'primary')).toEqual({ normal: PRIMARY })
  })

  it('真写了的态才在表里：没写的 `disabled` 不占位（交给渲染侧回落 `normal`）', () => {
    expect(buttonStatesOf(win, 'small')).toEqual({
      normal: 'art/window/btn-small.png',
      hover: 'art/window/btn-small-hover.png',
      active: 'art/window/btn-small-active.png',
    })
    expect(buttonStatesOf(win, 'danger')).toEqual({
      normal: 'art/window/btn-danger.png',
      disabled: 'art/window/btn-danger-off.png',
    })
  })

  it('四态各查自己的态：`hover` 不会拿 `normal` 顶上，也不跨键借用', () => {
    expect(buttonStatesOf(win, 'small')?.hover).toBe('art/window/btn-small-hover.png')
    expect(buttonStatesOf(win, 'primary')?.hover).toBeUndefined()
    expect(buttonStatesOf(win, 'plain')).toBeUndefined()
  })

  it('缺 `normal` 即整块取不到，`buttonOf()` 与它一致', () => {
    expect(buttonStatesOf(win, 'ghost')).toBeUndefined()
    expect(buttonOf(win, 'ghost')).toBeUndefined()
    expect(buttonStatesOf(win, 'primary')?.normal).toBe(buttonOf(win, 'primary'))
  })

  it('整个 window 节缺位、或该键没配，都取不到且不抛', () => {
    expect(buttonStatesOf(undefined, 'primary')).toBeUndefined()
    expect(buttonStatesOf({ surfaces: {} }, 'primary')).toBeUndefined()
  })

  it('四态定序固定（清单与遍历用）：常态在前，其余按「悬停 → 按下 → 不可用」', () => {
    expect([...BUTTON_STATES]).toEqual(['normal', 'hover', 'active', 'disabled'])
  })
})

describe('window.slots 取值（§四）', () => {
  const win: SkinWindow = {
    slots: {
      skill: SKILL,
      bag: { img: 'art/window/slot-bag.png', slice: [8, 8, 8, 8] },
    },
  }

  it('四个键各查自己的键：字符串写法与图引用写法都原样交出', () => {
    expect(slotOf(win, 'skill')).toBe(SKILL)
    expect(slotOf(win, 'bag')).toEqual({ img: 'art/window/slot-bag.png', slice: [8, 8, 8, 8] })
  })

  it('不跨键借用：配了技能格不会让奖励卡 / 部位标签跟着有图', () => {
    expect(slotOf(win, 'reward')).toBeUndefined()
    expect(slotOf(win, 'equipLabel')).toBeUndefined()
  })

  it('整个 window 节缺位（无皮肤 / 老包）即取不到，不抛', () => {
    expect(slotOf(undefined, 'skill')).toBeUndefined()
    expect(slotOf({ surfaces: {} }, 'skill')).toBeUndefined()
  })

  it('键集合是固定的四个（清单与遍历用），键名不随实现漂移', () => {
    expect([...SLOT_KINDS]).toEqual(['skill', 'reward', 'bag', 'equipLabel'])
  })
})
