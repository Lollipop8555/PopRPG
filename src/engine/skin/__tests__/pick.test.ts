import { describe, expect, it } from 'vitest'

import type { SkinRole } from '../../../types'
import { backgroundOf, backgroundLayers } from '../canvas'
import { groundOf, groundPaint, itemSkinOf, portraitOf, roleSprite } from '../lookup'
import { themeVars } from '../theme'

describe('backgroundOf：画布背景取层（§二）', () => {
  const layers = [{}, { img: 'b1.png', cellSize: 48 }, { img: 'b2.png' }]

  it('单对象写法视为单元素清单', () => {
    expect(backgroundLayers({ img: 'a.png' })).toHaveLength(1)
    expect(backgroundLayers(undefined)).toEqual([])
  })

  it('按下标取层，越界 clamp 到最后一层', () => {
    expect(backgroundOf(layers, 2)?.layer.img).toBe('b2.png')
    expect(backgroundOf(layers, 9)?.index).toBe(2)
    expect(backgroundOf([{ img: 'a.png' }, { img: 'b.png' }], -3)?.index).toBe(0)
    expect(backgroundOf(layers, -3)).toBeUndefined()
  })

  it('选中层没有 img 时向前找最近可用的一层', () => {
    expect(backgroundOf(layers, 1)?.layer.img).toBe('b1.png')
  })

  it('首层也不可用即整节未接管', () => {
    expect(backgroundOf([{}, { cellSize: 32 }], 1)).toBeUndefined()
    expect(backgroundOf(undefined, 0)).toBeUndefined()
  })
})

describe('lookup：形象 / 立绘 / 道具 / 衬底', () => {
  const role: SkinRole = {
    player: 'hero.png',
    classes: { warrior: 'w.png' },
    monsters: { slime: 's.png' },
    portraits: { player: 'p.png', classes: { mage: 'm.png' }, npcs: { elder: 'e.png' } },
  }

  it('棋子形象按分组取，不跨组借用', () => {
    expect(roleSprite(role, 'player')).toBe('hero.png')
    expect(roleSprite(role, 'class', 'warrior')).toBe('w.png')
    expect(roleSprite(role, 'class', 'mage')).toBeUndefined()
    expect(roleSprite(role, 'monster', 'slime')).toBe('s.png')
    expect(roleSprite(role, 'npc', 'elder')).toBeUndefined()
    expect(roleSprite(undefined, 'player')).toBeUndefined()
  })

  it('立绘：职业缺位先回退 player，怪物与 NPC 不回退', () => {
    expect(portraitOf(role, 'player')).toBe('p.png')
    expect(portraitOf(role, 'class', 'mage')).toBe('m.png')
    expect(portraitOf(role, 'class', 'rogue')).toBe('p.png')
    expect(portraitOf(role, 'monster', 'slime')).toBeUndefined()
    expect(portraitOf(role, 'npc', 'elder')).toBe('e.png')
  })

  it('道具皮肤按组件 id 取', () => {
    expect(itemSkinOf({ bread: { icon: 'b.png' } }, 'bread')).toEqual({ icon: 'b.png' })
    expect(itemSkinOf(undefined, 'bread')).toBeUndefined()
  })

  it('衬底：字符串等价于只写 fill，背景图优先于填充色', () => {
    expect(groundOf('#fff')).toEqual({ fill: '#fff' })
    expect(groundOf({ stroke: '#000' })).toEqual({ stroke: '#000' })
    expect(groundPaint({ fill: '#fff', img: 'g.png' })?.img).toBe('g.png')
    expect(groundPaint({})).toBeUndefined()
    expect(groundPaint(undefined)).toBeUndefined()
  })
})

describe('themeVars：主题 token 过滤（§3.3）', () => {
  it('只保留观感 token', () => {
    const r = themeVars({ '--paper': '#fdf6e3', '--ink': '#333' })
    expect(r.vars).toEqual({ '--paper': '#fdf6e3', '--ink': '#333' })
    expect(r.ignored).toEqual([])
  })

  it('布局 token 与未知 token 一律忽略并按声明顺序记录', () => {
    const r = themeVars({ '--gap': '9px', '--paper': '#fff', '--nope': '1', '--topbar-h': '9px' })
    expect(r.vars).toEqual({ '--paper': '#fff' })
    expect(r.ignored).toEqual(['--gap', '--nope', '--topbar-h'])
  })
})
