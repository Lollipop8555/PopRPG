/** 地图层接入皮肤（`skin/01-road.md` + `skin/05-canvas.md`；§四 降级链）：有素材画图，没素材画脚印 / 纸面 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import MapView from '../MapView'
import { nextRound, startSession } from '../flow'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureMap, fixtureProject } from '../../test/fixtures'
import { useSkinStore } from '../../store/skin'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinBackground, SkinBackgroundLayer, SkinRoad, SkinRole, SkinSprite } from '../../types'
import type { Session } from '../../types/session'

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

/** 两张地图的同一局：逐图清单的越界降级要看得出「不是第 0 张」 */
const scenario2 = scenarioFromProject(presetLibrary(), { ...fixtureProject(), maps: [fixtureMap(), fixtureMap()] })
const session2: Session = { ...nextRound(startSession(scenario2, 'knight'), () => 0.5), mapIndex: 1 }

/**
 * 夹具地图上的道路格共 7 格（`src/test/fixtures.ts`）：
 * (1,0) (3,0) 孤立 · (5,0) (7,0) (9,0) (5,1) 断头 · (8,0) 直路
 */
const ROAD_CELLS = 7

/** `MapView` 的屏幕格子边长（不随窗口变化） */
const CELL = 48

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
  vi.useRealTimers()
})

/** 一份素材的三写法（字符串 / 对象 / 数组）都摊成路径 */
function spritePaths(sprite: SkinSprite): string[] {
  if (typeof sprite === 'string') return [sprite]
  if (Array.isArray(sprite)) return sprite.flatMap(spritePaths)
  return [sprite.img]
}

/** `role` 节里会用到的全部路径（棋子 / 职业 / 怪物 / NPC 形象） */
function rolePaths(role?: SkinRole): string[] {
  if (!role) return []
  return [
    ...(role.player ? spritePaths(role.player) : []),
    ...Object.values(role.classes ?? {}).flatMap(spritePaths),
    ...Object.values(role.monsters ?? {}).flatMap(spritePaths),
    ...Object.values(role.npcs ?? {}).flatMap(spritePaths),
  ]
}

/**
 * 装上一套皮肤：素材按文件名直接给地址，不碰真包。
 *
 * @param unpacked 故意**不放进包**的路径（试 `KB-2` 的路径取不到）
 */
function paint(road?: SkinRoad, background?: SkinBackground, unpacked: string[] = [], role?: SkinRole) {
  const files = [
    ...Object.values(road?.tiles ?? {}).flatMap(spritePaths),
    ...(Array.isArray(background) ? background : background ? [background] : []).map((l) => l.img),
    ...rolePaths(role),
  ].filter((path): path is string => typeof path === 'string' && !unpacked.includes(path))
  const set = new Set(files)
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin:
      road || background || role
        ? ({ name: '测试皮', manifest: { road, background, role } } as unknown as LoadedSkin)
        : undefined,
    assets,
  })
}

const draw = (s: Session = session) => render(<MapView session={s} onStep={() => {}} />)

const round3 = (value: number) => Math.round(value * 1000) / 1000

describe('未启用皮肤', () => {
  it('一个贴图都不画（全部走程序绘制的脚印），底纹用纸面色', () => {
    paint(undefined)
    const { container } = draw()

    expect(container.querySelectorAll('image').length).toBe(0)
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe('var(--paper-card)')
  })
})

describe('接管道路', () => {
  it('每个道路格一张贴图，起点 / 建筑不受影响', () => {
    paint({ tiles: { isolated: 'isolated.png', dead_end: 'dead_end.png', straight: 'straight_ns.png' } })
    const { container } = draw()

    const images = container.querySelectorAll('image')
    expect(images.length).toBe(ROAD_CELLS)
    for (const img of images) expect(img.getAttribute('href')).toMatch(/^blob:/)
  })

  it('只接管直路：只有那一格换图，其余仍画脚印', () => {
    paint({ tiles: { straight: 'straight_ns.png' } })
    const { container } = draw()

    const images = container.querySelectorAll('image')
    expect(images.length).toBe(1)
    expect(images[0].getAttribute('href')).toBe('blob:straight_ns.png')
  })

  it('姿态角落在 transform 上（东西连通即转 90°），且不带手绘滤镜（S-6）', () => {
    paint({ tiles: { straight: 'straight_ns.png' } })
    const { container } = draw()

    const image = container.querySelector('image')
    expect(image?.getAttribute('transform')).toContain('rotate(90)')
    expect(image?.getAttribute('filter')).toBeNull()
    expect(image?.getAttribute('preserveAspectRatio')).toBe('none')
  })
})

/** 单层背景：`cellSize` 25 表示图上的 25 px ＝ 一格，图点 (256,256) 对齐格 [0,0] 中心 */
const BG_PLAIN: SkinBackgroundLayer = {
  img: 'resource/bg/plain.jpg',
  cellSize: 25,
  startX: 256,
  startY: 256,
  color: '#F2ECDD',
}

describe('接管画布背景', () => {
  it('每张地图只画采用的那一层，按 cellSize 缩放、图点 (startX,startY) 对齐格 [0,0] 中心', () => {
    paint(undefined, BG_PLAIN)
    const { container } = draw()

    const images = container.querySelectorAll('image')
    expect(images.length).toBe(1)
    expect(images[0].getAttribute('href')).toBe('blob:resource/bg/plain.jpg')
    // 尺寸交给素材自身像素（SVG2 auto），故不写 width / height
    expect(images[0].getAttribute('width')).toBeNull()
    expect(images[0].getAttribute('height')).toBeNull()

    const scale = CELL / 25
    const corner = round3(CELL / 2 - 256 * scale)
    expect(container.querySelector('g[data-bg-layer="0"]')?.getAttribute('transform')).toBe(
      `translate(${corner} ${corner}) scale(${round3(scale)})`,
    )
    // ② 之外的底色取**采用层**的 color（图覆盖不到的地方兜底）
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe('#F2ECDD')
  })

  it('逐图清单下标即地图下标，越界即 clamp 到最后一层', () => {
    const layers: SkinBackgroundLayer[] = [BG_PLAIN, { ...BG_PLAIN, img: 'resource/bg/dark.jpg', color: '#222' }]

    paint(undefined, layers)
    expect(draw(session).container.querySelector('g[data-bg-layer="0"]')).not.toBeNull()
    cleanup()

    const { container } = draw(session2)
    const g = container.querySelector('g[data-bg-layer="1"]')
    expect(g).not.toBeNull()
    expect(g?.querySelector('image')?.getAttribute('href')).toBe('blob:resource/bg/dark.jpg')
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe('#222')
  })

  it('该层不可用（缺 cellSize / 路径取不到）即向前回退；一路不可用则留纸面底纹', () => {
    // 第 1 张地图取的是下标 0 的那层：它缺 `cellSize`（KB-1），回退无处可去 → 未接管
    paint(undefined, { img: 'resource/bg/plain.jpg' })
    const noSize = draw().container
    expect(noSize.querySelectorAll('image').length).toBe(0)
    expect(noSize.querySelector('rect')?.getAttribute('fill')).toBe('var(--paper-card)')
    cleanup()

    // 第 2 张地图要下标 1 的层，但它没配进包（KB-2）→ 回退到下标 0 可用层
    const list: SkinBackgroundLayer[] = [{ ...BG_PLAIN, color: '#F2ECDD' }, { ...BG_PLAIN, img: 'resource/bg/missing.jpg' }]
    paint(undefined, list, ['resource/bg/missing.jpg'])
    const fellBack = draw(session2).container
    expect(fellBack.querySelector('g[data-bg-layer="0"]')?.querySelector('image')?.getAttribute('href')).toBe(
      'blob:resource/bg/plain.jpg',
    )
  })

  it('背景与道路共存：道路仍是每格一张，背景只多一层', () => {
    paint({ tiles: { dead_end: 'dead_end.png', straight: 'straight_ns.png', isolated: 'isolated.png' } }, BG_PLAIN)
    const { container } = draw(session2)
    const g = container.querySelector('g[data-bg-layer="0"]')!

    // 背景图那一张不算在道路贴图里（它在自己的坐标映射 `<g>` 中）
    const all = [...container.querySelectorAll('image')]
    expect(all.length).toBe(ROAD_CELLS + 1)
    expect(g.querySelectorAll('image').length).toBe(1)
    expect(all.filter((img) => !g.contains(img))).toHaveLength(ROAD_CELLS)
  })
})

/** 主角棋子：单格、锚点格中心（`skin/02-role.md` §三 / §五） */
const HERO = 'art/role/hero.png'

describe('接管主角棋子', () => {
  it('player 有素材即在主角那一格出图：整格大小、左上角＝格左上角（即锚点格中心），方框与 emoji 一并让位', () => {
    paint(undefined, undefined, [], { player: HERO })
    const { container } = draw()
    const pawn = container.querySelector('g[data-role-pawn]')!
    const [px, py] = session.pos
    const image = pawn.querySelector('image')!

    expect(image.getAttribute('href')).toBe('blob:art/role/hero.png')
    expect(image.getAttribute('x')).toBe(String(px * CELL))
    expect(image.getAttribute('y')).toBe(String(py * CELL))
    expect(image.getAttribute('width')).toBe(String(CELL))
    expect(image.getAttribute('height')).toBe(String(CELL))
    // 棋子形象没有朝向，故不带姿态角
    expect(image.getAttribute('transform')).toBeNull()
    expect(pawn.querySelector('text')).toBeNull()
    // 定位环与棋子形象无关，照旧画
    expect(pawn.querySelector('circle')).not.toBeNull()
  })

  it('棋子只认 player：只给了 classes 时照旧画职业 emoji（不跨组借用）', () => {
    paint(undefined, undefined, [], { classes: { knight: 'art/role/knight.png' } })
    const pawn = draw().container.querySelector('g[data-role-pawn]')!

    expect(pawn.querySelector('image')).toBeNull()
    expect(pawn.querySelector('text')?.textContent).toBe(session.player.cls?.icon)
  })

  it('player 那张没配进包（路径取不到）同样回退 emoji', () => {
    paint(undefined, undefined, [HERO], { player: HERO })
    const pawn = draw().container.querySelector('g[data-role-pawn]')!

    expect(pawn.querySelector('image')).toBeNull()
    expect(pawn.querySelector('text')?.textContent).toBe(session.player.cls?.icon)
  })
})

/** 棋子的受击形变（`skin/02-role.md` §4.4）：与立绘同一套规则，基准是**格中心** */
describe('棋子的受击形变', () => {
  /** 主角掉一点血（受击信号只看这个锚点） */
  function struck(): Session {
    const { resources } = session.player
    return { ...session, player: { ...session.player, resources: { ...resources, hp: resources.hp - 2 } } }
  }

  it('掉血：形象那一层挂 `.piece-hit`（定位环在它外面，不跟着压扁）', () => {
    vi.useFakeTimers()
    paint(undefined, undefined, [], { player: HERO })
    const { container, rerender } = draw()
    expect(container.querySelector('.piece-hit')).toBeNull()

    rerender(<MapView session={struck()} onStep={() => {}} />)

    const deform = container.querySelector('g[data-role-pawn] .piece-hit')
    expect(deform).not.toBeNull()
    expect(deform!.querySelector('image')).not.toBeNull()
    expect(deform!.querySelector('circle')).toBeNull()
  })

  it('没素材（回退方框 ＋ emoji）时照样抖：形变那一层不挑有没有图', () => {
    vi.useFakeTimers()
    const { container, rerender } = draw()
    expect(container.querySelector('.piece-hit')).toBeNull()

    rerender(<MapView session={struck()} onStep={() => {}} />)

    expect(container.querySelector('.piece-hit text')).not.toBeNull()
  })

  it('回血不算挨打', () => {
    const { container, rerender } = draw()
    const healed: Session = {
      ...session,
      player: { ...session.player, resources: { ...session.player.resources, hp: session.player.resources.hp + 3 } },
    }

    rerender(<MapView session={healed} onStep={() => {}} />)

    expect(container.querySelector('.piece-hit')).toBeNull()
  })
})
