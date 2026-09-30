/** 立绘渲染件（`skin/02-role.md` §4.2 / §4.3）：缺位不出现、尺寸交给 CSS 的 `vmin` 档、默认底边对齐 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Portrait, portraitHurtTile, portraitTile } from '../Portrait'
import type { SkinAssets } from '../../io/skin-assets'

afterEach(() => cleanup())

const HERO = 'art/portrait/hero.png'
const HURT = 'art/portrait/hero_hurt.png'

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
const withHurt = () => assets({ [HERO]: 'blob:hero', [HURT]: 'blob:hurt' })

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

describe('立绘受击（§4.4）', () => {
  const struck = { img: HERO, hurt: HURT }

  it('有 `hurt` 素材：改显示受击图，主图与尺寸都不动（不形变）', () => {
    const { container } = render(
      <Portrait tile={portraitTile(struck, withHurt())} hurt={portraitHurtTile(struck, withHurt())} hit size="vs" />,
    )
    const box = container.querySelector('.portrait')!

    expect(box.className).toBe('portrait portrait-vs')
    expect(box.querySelector('img')!.getAttribute('src')).toBe('blob:hurt')
  })

  it('没有 `hurt` 素材：挂上形变那一档（基准、幅度、回弹时长都在 CSS 里）', () => {
    const { container } = render(
      <Portrait tile={portraitTile(HERO, withHero())} hurt={portraitHurtTile(HERO, withHero())} hit size="vs" />,
    )
    const box = container.querySelector('.portrait')!

    expect(box.className).toBe('portrait portrait-vs portrait-hit')
    expect(box.querySelector('img')!.getAttribute('src')).toBe('blob:hero')
  })

  it('没在挨打：受击图不出现、也没有形变那一档', () => {
    const { container } = render(
      <Portrait tile={portraitTile(struck, withHurt())} hurt={portraitHurtTile(struck, withHurt())} size="hud" />,
    )
    const box = container.querySelector('.portrait')!

    expect(box.className).toBe('portrait portrait-hud')
    expect(box.querySelector('img')!.getAttribute('src')).toBe('blob:hero')
  })

  it('`hurt` 只有对象写法能给；那张图不在包里也算没有（退回形变）', () => {
    expect(portraitHurtTile(HERO, withHurt())).toBeUndefined()
    expect(portraitHurtTile(struck, withHero())).toBeUndefined()
    expect(portraitHurtTile(struck, withHurt())!.src).toBe('blob:hurt')
  })

  it('受击图的翻转跟着主图走：站位与挨不挨打无关', () => {
    const flipped = { img: HERO, hurt: HURT, flip: true }
    const { container } = render(
      <Portrait tile={portraitTile(flipped, withHurt())} hurt={portraitHurtTile(flipped, withHurt())} hit size="hud" />,
    )

    expect(container.querySelector('img')!.style.transform).toBe('scaleX(-1)')
  })
})
