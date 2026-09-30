/** 主题变量落地与卸载（`skin/00-package.md` §3.3） */

import { describe, expect, it } from 'vitest'
import { applySkinTheme } from '../skin-theme'
import { SKIN_LAYOUT_TOKENS, SKIN_THEME_TOKENS } from '../../types'

describe('落地', () => {
  it('观感 token 逐个写成 CSS 变量，卸载时逐个移除', () => {
    const root = document.createElement('div')
    const accent = SKIN_THEME_TOKENS[0]

    const applied = applySkinTheme({ [accent]: 'pink' }, root)
    expect(applied.vars).toEqual({ [accent]: 'pink' })
    expect(root.style.getPropertyValue(accent)).toBe('pink')

    applied.release()
    expect(root.style.getPropertyValue(accent)).toBe('')
  })

  it('布局 token 与未知键名一律不写，并记进 ignored', () => {
    const root = document.createElement('div')
    const layout = SKIN_LAYOUT_TOKENS[0]

    const applied = applySkinTheme({ [layout]: '999px', '--not-a-token': 'x' }, root)
    expect(applied.vars).toEqual({})
    expect(applied.ignored).toEqual([layout, '--not-a-token'])
    expect(root.style.getPropertyValue(layout)).toBe('')
  })

  it('卸载只动自己写过的键，别处写在同元素上的变量不受影响', () => {
    const root = document.createElement('div')
    root.style.setProperty('--someone-else', 'keep')

    applySkinTheme({ [SKIN_THEME_TOKENS[0]]: 'pink' }, root).release()
    expect(root.style.getPropertyValue('--someone-else')).toBe('keep')
  })

  it('没有 theme 节时什么都不写', () => {
    const root = document.createElement('div')
    const applied = applySkinTheme(undefined, root)
    expect(applied.vars).toEqual({})
    expect(applied.ignored).toEqual([])
  })
})
