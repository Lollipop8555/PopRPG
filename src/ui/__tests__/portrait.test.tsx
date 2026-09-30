/** 立绘渲染件（`skin/02-role.md` §4.2 / §4.3）：缺位不出现、尺寸交给 CSS 的 `vmin` 档、默认底边对齐 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Portrait, portraitTile } from '../Portrait'
import type { SkinAssets } from '../../io/skin-assets'

afterEach(() => cleanup())

const HERO = 'art/portrait/hero.png'

/** 只按路径给地址的假素材源 */
function assets(map: Record<string, string> = {}): SkinAssets {
  return {
    urlOf: (path) => map[path],
    has: (path) => map[path] !== undefined,
    previewUrl: () => undefined,
    release: () => {},
  }
}

const withHero = () => assets({ [HERO]: 'blob:hero' })

describe('立绘 Portrait', () => {
  it('没配立绘、包里缺这张图：整块不渲染（不占位、不回退 emoji，§4.3）', () => {
    const none = render(<Portrait tile={portraitTile(undefined, withHero())} size="hud" />)
    expect(none.container.innerHTML).toBe('')

    const missing = render(<Portrait tile={portraitTile(HERO, assets())} size="hud" />)
    expect(missing.container.innerHTML).toBe('')
  })

  it('有图就出：外层是尺寸盒（落点档），图片走行内层（只吃 src / flip）', () => {
    const { container } = render(<Portrait tile={portraitTile(HERO, withHero())} size="vs" />)
    const box = container.querySelector('.portrait')!

    expect(box.className).toBe('portrait portrait-vs')
    expect(box.querySelector('img')!.getAttribute('src')).toBe('blob:hero')
    expect(box.querySelector('img')!.className).toBe('inline-texture')
  })

  it('三个落点各一档尺寸；出身卡额外带居中档（§4.1 落点 5）', () => {
    const hud = render(<Portrait tile={portraitTile(HERO, withHero())} size="hud" />)
    expect(hud.container.querySelector('.portrait')!.className).toBe('portrait portrait-hud')

    const card = render(<Portrait tile={portraitTile(HERO, withHero())} size="card" center />)
    expect(card.container.querySelector('.portrait')!.className).toBe('portrait portrait-card portrait-center')
  })

  it('对象写法里的 flip 落到图片上', () => {
    const { container } = render(<Portrait tile={portraitTile({ img: HERO, flip: true }, withHero())} size="hud" />)
    expect(container.querySelector('img')!.style.transform).toBe('scaleX(-1)')
  })
})
