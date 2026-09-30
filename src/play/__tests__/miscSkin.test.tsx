/**
 * 杂项的两个落点（`skin/04-misc.md` §二 / §三）：**地图标记**（起点 / 终点 / 脚印）
 * 与**骰子**（本体 / 骰面）。
 *
 * 两边的底线一致：没配该键、或包里缺这张图，就照旧画程序图形
 * （手绘旗 / 藏宝图 X / 脚印 / 点阵 / 数字文本）——素材是可选叠加层。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import MapView from '../MapView'
import DiceHud from '../DiceHud'
import { DieFace } from '../DiceLog'
import { nextRound, startSession } from '../flow'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { useSkinStore } from '../../store/skin'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinMisc, SkinRoad, SkinSprite } from '../../types'

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

/** 夹具地图上的道路格共 7 格（`src/test/fixtures.ts`） */
const ROAD_CELLS = 7
/** `MapView` 的屏幕格子边长（不随窗口变化） */
const CELL = 48

const START = 'art/misc/start.png'
const END = 'art/misc/end.png'
const FOOT = 'art/misc/foot.png'
const BODY = 'art/misc/die.png'
const NUM = 'art/misc/num.png'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

/** 一份形象的三写法（字符串 / 对象 / 数组）都摊成路径 */
function spritePaths(sprite: SkinSprite): string[] {
  if (typeof sprite === 'string') return [sprite]
  if (Array.isArray(sprite)) return sprite.flatMap(spritePaths)
  return [sprite.img]
}

/** `misc` 节里用到的全部路径（标记三键 ＋ 骰子本体 / 骰面） */
function miscPaths(misc?: SkinMisc): string[] {
  const out: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(misc)
  return out
}

/**
 * 装上一套皮肤（`misc` 与 / 或 `road`）。
 *
 * @param unpacked 故意**不放进包**的路径（试路径取不到时的降级）
 */
function paint(misc?: SkinMisc, road?: SkinRoad, unpacked: string[] = []) {
  const files = [...miscPaths(misc), ...Object.values(road?.tiles ?? {}).flatMap(spritePaths)].filter(
    (path) => !unpacked.includes(path),
  )
  const set = new Set(files)
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin:
      misc || road
        ? ({ name: '测试皮', manifest: { misc, road } } as unknown as LoadedSkin)
        : undefined,
    assets,
  })
}

const draw = () => render(<MapView session={session} onStep={() => {}} />)

describe('地图标记：起点 / 终点 / 脚印（§二）', () => {
  it('起点配了素材：那一格换图，整格大小、左上角＝格左上角，程序旗让位', () => {
    paint({ marks: { start: START } })
    const { container } = draw()

    const image = container.querySelector('image.mark-start')!
    expect(image.getAttribute('href')).toBe(`blob:${START}`)
    // 三键都是「1 格、整图居中」：盒＝整格（与道路同一约定，`01-road.md` §3.1）
    expect(image.getAttribute('x')).toBe('0')
    expect(image.getAttribute('y')).toBe('0')
    expect(image.getAttribute('width')).toBe(String(CELL))
    expect(image.getAttribute('height')).toBe(String(CELL))
    // 标记没有朝向，故不带姿态角
    expect(image.getAttribute('transform')).toBeNull()
  })

  it('三键不互相借用：配了起点，终点照旧画程序 X', () => {
    paint({ marks: { start: START } })
    const { container } = draw()

    expect(container.querySelector('image.mark-end')).toBeNull()
    expect(container.querySelectorAll('image').length).toBe(1)
    // 程序的藏宝图 X 是手绘 path，不是贴图
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('道路素材缺失时才轮到脚印：7 个道路格全出脚印图', () => {
    paint({ marks: { footprint: FOOT } })
    const { container } = draw()

    const feet = container.querySelectorAll('image.mark-footprint')
    expect(feet.length).toBe(ROAD_CELLS)
    expect(feet[0].getAttribute('href')).toBe(`blob:${FOOT}`)
  })

  it('道路素材够用时轮不到脚印：出图的那一格仍是道路图', () => {
    paint({ marks: { footprint: FOOT } }, { tiles: { straight: 'straight_ns.png' } })
    const { container } = draw()

    const hrefs = [...container.querySelectorAll('image')].map((img) => img.getAttribute('href'))
    expect(hrefs).toContain('blob:straight_ns.png')
    expect(container.querySelectorAll('image.mark-footprint').length).toBe(ROAD_CELLS - 1)
  })

  it('配了但包里缺这张图：算没配 → 三处全回退程序图形，一个贴图都不画', () => {
    paint({ marks: { start: START, end: END, footprint: FOOT } }, undefined, [START, END, FOOT])
    const { container } = draw()

    expect(container.querySelectorAll('image').length).toBe(0)
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('未启用皮肤：标记全走程序绘制', () => {
    paint()
    const { container } = draw()

    expect(container.querySelectorAll('image').length).toBe(0)
  })
})

describe('骰子：本体与骰面（§三）', () => {
  /** 程序点阵：外层网格 ＋ 9 个点 */
  const PROGRAM_DOTS = 10

  it('配了那一面：骰面出图，程序点阵让位', () => {
    paint({ dice: { faces: { d5: 'art/misc/d5.png' } } })
    const { container } = render(<DieFace pips={5} />)

    expect(container.querySelector('img.die-face')?.getAttribute('src')).toBe('blob:art/misc/d5.png')
    expect(container.querySelectorAll('span').length).toBe(0)
  })

  it('只认配了的那几面：缺的那一面照旧画程序点阵（不倒借别的面）', () => {
    paint({ dice: { faces: { d5: 'art/misc/d5.png' } } })
    const { container } = render(<DieFace pips={2} />)

    expect(container.querySelector('img.die-face')).toBeNull()
    expect(container.querySelectorAll('span').length).toBe(PROGRAM_DOTS)
  })

  it('1–6 之外的点数：配了数字面就出图，没配就仍是数字文本', () => {
    paint({ dice: { faces: { numeric: NUM } } })
    expect(render(<DieFace pips={9} />).container.querySelector('img.die-face')?.getAttribute('src')).toBe(
      `blob:${NUM}`,
    )
    cleanup()

    paint({ dice: { faces: { d1: 'art/misc/d1.png' } } })
    const text = render(<DieFace pips={9} />).container
    expect(text.querySelector('img.die-face')).toBeNull()
    expect(text.textContent).toBe('9')
  })

  it('本体铺进 `.die` 盒：等比缩放（contain），盒的尺寸与底色仍归 CSS', () => {
    paint({ dice: { body: BODY } })
    const hud = render(<DiceHud session={session} canRoll spinning={false} onRoll={() => {}} />)

    const die = hud.container.querySelector('.die') as HTMLElement
    expect(die.style.backgroundImage).toContain(`blob:${BODY}`)
    expect(die.style.backgroundSize).toBe('contain')
    // 46 / 38 / 34 三档由调用处与 CSS 定，本体只补背景图、不碰底色
    expect(die.style.width).toBe('46px')
    expect(die.style.backgroundColor).toBe('')
  })

  it('没配本体：不传背景，CSS 纸面照旧', () => {
    paint({})
    const hud = render(<DiceHud session={session} canRoll spinning={false} onRoll={() => {}} />)

    expect((hud.container.querySelector('.die') as HTMLElement).style.backgroundImage).toBe('')
  })
})
