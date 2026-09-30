/** 形象格（`skin/02-role.md` §三）：有素材出图、缺位原样出 emoji */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RoleGlyph } from '../RoleGlyph'
import type { SkinAssets } from '../../io/skin-assets'

afterEach(() => cleanup())

const HERO = 'art/role/hero.png'

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

describe('形象格 RoleGlyph', () => {
  it('有素材就出图：走行内层（`.inline-texture` 的 1em 方框 ＋ 等比内缩）', () => {
    const { container } = render(<RoleGlyph sprite={HERO} assets={withHero()} icon="🛡️" />)
    const img = container.querySelector('img')!

    expect(img.getAttribute('src')).toBe('blob:hero')
    expect(img.className).toBe('inline-texture')
    // 出图即不再出 emoji（两者不会同时出现）
    expect(container.textContent).toBe('')
  })

  it('包里缺这张图、皮肤未启用，都原样交出该组自己的 emoji', () => {
    const missing = render(<RoleGlyph sprite={HERO} assets={assets()} icon="🛡️" />)
    expect(missing.container.querySelector('img')).toBeNull()
    expect(missing.container.textContent).toBe('🛡️')

    const none = render(<RoleGlyph assets={assets()} icon="👹" />)
    expect(none.container.querySelector('img')).toBeNull()
    expect(none.container.textContent).toBe('👹')
  })

  it('三写法归一：对象里的镜像与纠偏角落到行内元素，数组取不到图即回退', () => {
    const flipped = render(
      <RoleGlyph sprite={{ img: HERO, flip: true, rotate: 90 }} assets={withHero()} icon="🛡️" />,
    )
    expect(flipped.container.querySelector('img')!.style.transform).toBe('rotate(90deg) scaleX(-1)')

    // 四向数组是道路素材的写法；形象不讲朝向，取不到首图即回退（不擅自拿第二张）
    const array = render(<RoleGlyph sprite={['a.png', 'b.png']} assets={assets({ 'b.png': 'blob:b' })} icon="🛡️" />)
    expect(array.container.querySelector('img')).toBeNull()
    expect(array.container.textContent).toBe('🛡️')
  })
})
