/**
 * 图标取值（`skin/04-misc.md` §四）：`iconOf()` 的确定性——按 lucide 图标名各查自己的名，
 * **不跨名借用**（配了 `Sword` 不会让 `Hammer` 跟着有图），`misc` 整节缺位也不抛。
 *
 * 清单 `ICON_NAMES` 只声明**有落点**的名字；`iconOf()` 本身是纯读取，配了清单外的名字照样交出
 * （与各节一致：不报错、不静默改名，只是没有落点会用到它）。这是给自己人看的边界，不是白名单。
 */

import { describe, expect, it } from 'vitest'
import { ICON_NAMES, iconOf } from '../lookup'
import type { SkinMisc } from '../../../types'

const SWORD = 'art/misc/icon-sword.png'

describe('misc.icons 取值（§四）', () => {
  const misc: SkinMisc = {
    icons: {
      Sword: SWORD,
      Hammer: { img: 'art/misc/icon-hammer.png', rotate: 15, flip: true },
    },
  }

  it('按名各查自己的名：字符串写法与图引用写法都原样交出', () => {
    expect(iconOf(misc, 'Sword')).toBe(SWORD)
    expect(iconOf(misc, 'Hammer')).toEqual({ img: 'art/misc/icon-hammer.png', rotate: 15, flip: true })
  })

  it('未配该名即取不到：`Sword` 的图不会借给 `Hammer` 之外的任何名字', () => {
    expect(iconOf(misc, 'Flag')).toBeUndefined()
    expect(iconOf(misc, 'X')).toBeUndefined()
  })

  it('整个 misc 节缺位（无皮肤 / 老包）即取不到，不抛', () => {
    expect(iconOf(undefined, 'Sword')).toBeUndefined()
    expect(iconOf({}, 'Sword')).toBeUndefined()
    expect(iconOf({ icons: undefined }, 'Sword')).toBeUndefined()
  })

  it('清单外的名字照样照读：清单只声明落点，不当白名单', () => {
    expect(iconOf({ icons: { Heart: 'art/misc/icon-heart.png' } }, 'Heart')).toBe(
      'art/misc/icon-heart.png',
    )
  })
})

describe('ICON_NAMES（§四）', () => {
  it('就是游玩态实际用到的那九个 lucide 图标名，定序稳定', () => {
    expect(ICON_NAMES).toEqual([
      'Sword',
      'Hammer',
      'FileDown',
      'FileUp',
      'LibraryBig',
      'Menu',
      'Flag',
      'StepForward',
      'X',
    ])
  })

  it('兜底字形与内容 emoji 都不在清单里：它们不走 misc.icons', () => {
    // 兜底字形（`🙂` / `✦` / `❔` / `🎲` / `🔒`）永远是字形；内容 emoji 走 role / item 节。
    for (const name of ['🙂', '✦', '❔', '🎲', '🔒', 'glyph', 'emoji']) {
      expect(ICON_NAMES as readonly string[]).not.toContain(name)
    }
  })
})
