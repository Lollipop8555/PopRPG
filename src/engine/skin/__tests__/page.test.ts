/**
 * 欢迎页与游戏首页的取图（`skin/08-pages.md` §2.1 / §2.2）。
 *
 * 三处本批新增的规矩：`bg.fit` 的**非法值回退 `cover`**（`KPG-1`）、两屏 `bg` **不互相借用**
 * （§2.3 逐节点降级）、出身卡 `selected.img` **缺位沿用卡底**（只换描边）。
 */

import { describe, expect, it } from 'vitest'
import { lobbyCardPaint, pageBgOf, pageFitOf, startupArtOf } from '../lookup'
import type { SkinFit, SkinLobby, SkinStartup } from '../../../types'

describe('封面背景的铺法（§2.1 `fit` / `KPG-1`）', () => {
  it('缺省 `cover`；`contain` / `tile` 照给', () => {
    expect(pageFitOf(undefined)).toBe('cover')
    expect(pageFitOf({ img: 'bg.jpg' })).toBe('cover')
    expect(pageFitOf({ img: 'bg.jpg', fit: 'contain' })).toBe('contain')
    expect(pageFitOf({ img: 'bg.jpg', fit: 'tile' })).toBe('tile')
  })

  it('包外手改出的非法值一律回退 `cover`（只提示、不改行为）', () => {
    expect(pageFitOf({ img: 'bg.jpg', fit: 'stretch' as SkinFit })).toBe('cover')
    expect(pageFitOf({ img: 'bg.jpg', fit: '' as SkinFit })).toBe('cover')
  })
})

describe('两屏的整屏背景（§2.1 / §2.2）：各查自己那一节的 `bg`', () => {
  const startup: SkinStartup = { bg: { img: 'home/bg.jpg' } }
  const lobby: SkinLobby = { bg: { img: 'start/bg.jpg' } }

  it('各取各的', () => {
    expect(pageBgOf(startup)?.img).toBe('home/bg.jpg')
    expect(pageBgOf(lobby)?.img).toBe('start/bg.jpg')
  })

  it('某一屏没配 `bg` 即 `undefined`：那一屏照旧纸面底纹（半素材化是正常状态）', () => {
    expect(pageBgOf(undefined)).toBeUndefined()
    expect(pageBgOf({})).toBeUndefined()
    // 另一屏配了也不借给它——`bg` 只在各自那一节里查
    expect(pageBgOf({ panel: { img: 'start/scroll.png' } })?.img).toBeUndefined()
  })
})

describe('欢迎页三件图形（§2.1）：标题 / 主视觉 / 装饰骰子', () => {
  const startup: SkinStartup = {
    title: { img: 'home/title.png' },
    cover: { img: 'home/cave.png', rotate: 180 },
    dice: { img: 'home/die.png' },
  }

  it('逐个取，修饰一并带出', () => {
    expect(startupArtOf(startup, 'title')?.img).toBe('home/title.png')
    expect(startupArtOf(startup, 'cover')?.rotate).toBe(180)
    expect(startupArtOf(startup, 'dice')?.img).toBe('home/die.png')
  })

  it('未配该键即 `undefined`：那件照旧程序绘制（半素材化是正常状态）', () => {
    expect(startupArtOf({ title: { img: 'a.png' } }, 'cover')).toBeUndefined()
    expect(startupArtOf(undefined, 'title')).toBeUndefined()
  })
})

describe('出身卡底与选中态（§2.2 `card` / `card.selected`）', () => {
  const BASE = 'start/card.png'
  const SEL = 'start/card-sel.png'
  const STROKE = '#B4552F'

  it('只配卡底：两态同一张底，都不碰描边（描边归 CSS）', () => {
    expect(lobbyCardPaint({ card: { img: BASE } }, false)).toEqual({ img: BASE, stroke: undefined })
    expect(lobbyCardPaint({ card: { img: BASE } }, true)).toEqual({ img: BASE, stroke: undefined })
  })

  it('`selected.img` 缺位：沿用卡底、只换描边', () => {
    expect(lobbyCardPaint({ card: { img: BASE, selected: { stroke: STROKE } } }, true)).toEqual({
      img: BASE,
      stroke: STROKE,
    })
    expect(lobbyCardPaint({ card: { img: BASE, selected: { stroke: STROKE } } }, false)).toEqual({
      img: BASE,
      stroke: undefined,
    })
  })

  it('`selected.img` 给了：选中那张换底，未选中仍用卡底', () => {
    expect(lobbyCardPaint({ card: { img: BASE, selected: { img: SEL, stroke: STROKE } } }, true)).toEqual({
      img: SEL,
      stroke: STROKE,
    })
    expect(lobbyCardPaint({ card: { img: BASE, selected: { img: SEL, stroke: STROKE } } }, false)?.img).toBe(BASE)
  })

  it('`card` 整节没配即 `undefined`：卡片照旧手绘', () => {
    expect(lobbyCardPaint(undefined, true)).toBeUndefined()
    expect(lobbyCardPaint({ panel: { img: 'scroll.png' } }, true)).toBeUndefined()
  })
})
