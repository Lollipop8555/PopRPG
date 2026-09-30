/**
 * 欢迎页与游戏首页的落图（`skin/08-pages.md` §2.1 / §2.2）：
 * 整屏背景（`fit` 三档）/ 标题字形 / 主视觉 / 装饰骰子（本体 ＋ 复用 `misc.dice` 的骰面）/
 * 世界简介面板底 / 出身卡（含选中态）。
 *
 * 两屏共同的底线：**没配该键、或包里缺这张图，就一个 `style` 都不传、一个字都不换**——
 * 现有 CSS 手绘封面照旧（§一：素材是可选叠加层，两屏均可整体缺省）。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LoadScreen from '../LoadScreen'
import StartScreen from '../StartScreen'
import { useSkinStore } from '../../store/skin'
import { presetLibrary } from '../../presets'
import { scenarioFromProject } from '../load'
import { fixtureProject } from '../../test/fixtures'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinManifest } from '../../types'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())

const BG = 'home/bg.jpg'
const TITLE = 'home/title.png'
const COVER = 'home/cave.png'
const DIE = 'home/die.png'
const FACE = 'misc/d3.png'
const PANEL = 'start/scroll.png'
const CARD = 'start/card.png'
const CARD_SEL = 'start/card-sel.png'
const STROKE = '#B4552f'

/** 把 manifest 里写的素材路径全收出来 */
function pathsOf(value: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(value)
  return out
}

/**
 * 装上一套皮肤（只配这两屏 ＋ 骰面，够这些落点用）。
 *
 * @param unpacked 故意**不放进包**的路径（试包里缺这张图时的降级）
 */
function paint(manifest: Partial<SkinManifest>, unpacked: string[] = []) {
  const set = new Set(pathsOf(manifest).filter((path) => !unpacked.includes(path)))
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({ skin: { name: '测试皮', manifest } as unknown as LoadedSkin, assets })
}

/** 行内背景图（没配就是空串） */
const bgOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundImage ?? ''

/** jsdom 把十六进制色规整成 `rgb(...)`：两种写法都认 */
function sameColor(actual: string, hex: string): boolean {
  if (actual === hex) return true
  const n = parseInt(hex.slice(1), 16)
  return actual === `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const shell = (container: HTMLElement) => container.querySelector('.play-shell')
const loadCover = () => render(<LoadScreen onLoaded={() => {}} />).container

describe('欢迎页（§2.1）', () => {
  it('`bg` 铺满整屏、`fit` 缺省 `cover`；**不动底色**（`contain` 留的边由主题底色兜着）', () => {
    paint({ startup: { bg: { img: BG } } })
    const el = shell(loadCover()) as HTMLElement

    expect(bgOf(el)).toContain(`blob:${BG}`)
    expect(el.style.backgroundSize).toBe('cover')
    expect(el.style.backgroundRepeat).toBe('no-repeat')
    expect(el.style.backgroundColor).toBe('')
  })

  it('`fit` 三档各是一种铺法：`cover` / `contain` / `tile`', () => {
    const cases = [
      ['cover', 'cover', 'no-repeat'],
      ['contain', 'contain', 'no-repeat'],
      ['tile', 'auto', 'repeat'],
    ] as const

    for (const [fit, size, repeat] of cases) {
      paint({ startup: { bg: { img: BG, fit } } })
      const { container, unmount } = render(<LoadScreen onLoaded={() => {}} />)
      const el = shell(container) as HTMLElement
      expect([el.style.backgroundSize, el.style.backgroundRepeat]).toEqual([size, repeat])
      unmount()
    }
  })

  it('`title` 替掉标题字形，**文案不变**（落在 `alt` 上，取舍 `S-14`）', () => {
    paint({ startup: { title: { img: TITLE } } })
    const img = loadCover().querySelector('.cover-title img.inline-texture.cover-title-art')

    expect(img?.getAttribute('src')).toBe(`blob:${TITLE}`)
    expect(img?.getAttribute('alt')).toBe('PopRPG')
  })

  it('`cover` 整块替换洞穴手绘（同一个 `viewBox` 盒）', () => {
    paint({ startup: { cover: { img: COVER } } })
    const svg = loadCover().querySelector('.cover-cave')

    expect(svg?.querySelector('image')?.getAttribute('href')).toBe(`blob:${COVER}`)
    expect(svg?.querySelectorAll('path')).toHaveLength(0)
  })

  it('`dice` 铺装饰骰子的本体（等比进盒），骰面**复用 `misc.dice`**（`KPG-4`）', () => {
    paint({ startup: { dice: { img: DIE } }, misc: { dice: { faces: { d3: FACE } } } })
    const die = loadCover().querySelector('.die.cover-die.d1') as HTMLElement

    expect(bgOf(die)).toContain(`blob:${DIE}`)
    expect(die.style.backgroundSize).toBe('contain')
    expect(die.querySelector('img.inline-texture')?.getAttribute('src')).toBe(`blob:${FACE}`)
  })

  it('三件都没配：一个 `style` 都不传、一个字都不换（数字面照旧）', () => {
    paint({})
    const container = loadCover()
    const die = container.querySelector('.die.cover-die.d1') as HTMLElement

    expect(shell(container)?.getAttribute('style')).toBeNull()
    expect(container.querySelector('.cover-title')?.textContent).toBe('PopRPG')
    expect(container.querySelector('.cover-title img')).toBeNull()
    expect(container.querySelectorAll('.cover-cave path')).toHaveLength(2)
    expect(container.querySelector('.cover-cave image')).toBeNull()
    expect(die.textContent).toBe('3')
    expect(bgOf(die)).toBe('')
  })

  it('配了但包里缺这些图：同样算没配 → 退回首屏手绘', () => {
    paint({ startup: { bg: { img: BG }, title: { img: TITLE }, cover: { img: COVER }, dice: { img: DIE } } }, [
      BG,
      TITLE,
      COVER,
      DIE,
    ])
    const container = loadCover()

    expect(shell(container)?.getAttribute('style')).toBeNull()
    expect(container.querySelector('.cover-title')?.textContent).toBe('PopRPG')
    expect(container.querySelectorAll('.cover-cave path')).toHaveLength(2)
  })
})

describe('游戏首页（§2.2）', () => {
  const startScreen = () =>
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />).container

  const cards = (container: HTMLElement) => [...container.querySelectorAll('.class-card')] as HTMLElement[]

  it('`bg` 只认 `lobby.bg`：欢迎页配了也不借给它（§2.3 逐节点降级）', () => {
    paint({ startup: { bg: { img: BG } } })
    expect(shell(startScreen())?.getAttribute('style')).toBeNull()

    paint({ lobby: { bg: { img: BG } } })
    expect(bgOf(shell(startScreen()))).toContain(`blob:${BG}`)
  })

  it('`panel` 落在「这一局的世界」那张卡片上（V1 一律拉伸，`S-1`）', () => {
    paint({ lobby: { panel: { img: PANEL } } })
    const panel = startScreen().querySelector('.panel.scroll') as HTMLElement

    expect(bgOf(panel)).toContain(`blob:${PANEL}`)
    expect(panel.style.backgroundSize).toBe('100% 100%')
  })

  it('`card` 铺满每一张出身卡；未选中的**不碰描边**（描边归 CSS）', () => {
    paint({ lobby: { card: { img: CARD } } })
    const container = startScreen()

    for (const card of cards(container)) {
      expect(bgOf(card)).toContain(`blob:${CARD}`)
      expect(card.style.borderColor).toBe('')
    }
  })

  it('`selected.stroke`：点中的那张换描边，其余照旧', () => {
    paint({ lobby: { card: { img: CARD, selected: { stroke: STROKE } } } })
    const container = startScreen()

    fireEvent.click(cards(container)[0])
    const [first, ...rest] = cards(container)

    expect(sameColor(first.style.borderColor, STROKE)).toBe(true)
    expect(bgOf(first)).toContain(`blob:${CARD}`)
    for (const card of rest) expect(card.style.borderColor).toBe('')
  })

  it('`selected.img`：选中那张换底（卡底仍在未选中态用）', () => {
    paint({ lobby: { card: { img: CARD, selected: { img: CARD_SEL, stroke: STROKE } } } })
    const container = startScreen()

    expect(bgOf(cards(container)[0])).toContain(`blob:${CARD}`)
    fireEvent.click(cards(container)[0])
    expect(bgOf(cards(container)[0])).toContain(`blob:${CARD_SEL}`)
  })

  it('卡底配了但包里缺这张图：卡片不铺底；`selected.stroke` 仍照换（描边不靠图）', () => {
    paint({ lobby: { card: { img: CARD, selected: { stroke: STROKE } } } }, [CARD])
    const container = startScreen()

    for (const card of cards(container)) expect(card.getAttribute('style')).toBeNull()

    fireEvent.click(cards(container)[0])
    expect(sameColor(cards(container)[0].style.borderColor, STROKE)).toBe(true)
    expect(bgOf(cards(container)[0])).toBe('')
  })

  it('整屏都没配：外壳与面板都不传 `style`', () => {
    paint({})
    const container = startScreen()

    expect(shell(container)?.getAttribute('style')).toBeNull()
    expect(container.querySelector('.panel.scroll')?.getAttribute('style')).toBeNull()
  })
})
