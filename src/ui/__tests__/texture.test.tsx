/** 贴图渲染器两层（`skin.md` §四；S-6 位图不套手绘滤镜） */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DomTexture, SvgTexture, textureProps } from '../Texture'
import type { TextureRef } from '../../engine/skin/texture'
import type { SkinAssets } from '../../io/skin-assets'

afterEach(() => cleanup())

const BOX = { x: 10, y: 20, w: 30, h: 40 }
const TILE = 'art/road/a.png'

/** 只按路径给地址的假素材源（真地址归 D2 的 `skin-assets`，另有其用例） */
function assets(map: Record<string, string> = {}): SkinAssets {
  return {
    urlOf: (path) => map[path],
    has: (path) => map[path] !== undefined,
    previewUrl: () => undefined,
    release: () => {},
  }
}

const withTile = (map: Record<string, string> = { [TILE]: 'blob:1' }): SkinAssets => assets(map)
const ref = (over: Partial<TextureRef> = {}): TextureRef => ({ src: TILE, rotate: 0, flip: false, ...over })

describe('单一入口 textureProps', () => {
  it('取图 → 落位 → 换地址，一次给全', () => {
    const props = textureProps(ref({ rotate: 90, flip: true }), withTile(), BOX, { mode: 'nine', opacity: 0.5 })
    expect(props).toEqual({ ...BOX, rotate: 90, flip: true, src: 'blob:1', mode: 'nine', opacity: 0.5 })
  })

  it('未接管的节点、包里缺这张图，都返回 undefined（调用方改画程序图形）', () => {
    expect(textureProps(undefined, withTile(), BOX)).toBeUndefined()
    expect(textureProps(ref(), assets(), BOX)).toBeUndefined()
  })
})

describe('SVG 层 SvgTexture', () => {
  it('按盒拉伸，不带手绘滤镜、不吃点击', () => {
    render(
      <svg>
        <SvgTexture {...textureProps(ref(), withTile(), BOX)!} />
      </svg>,
    )
    const image = document.querySelector('image')!

    expect(image.getAttribute('href')).toBe('blob:1')
    expect(image.getAttribute('x')).toBe('10')
    expect(image.getAttribute('y')).toBe('20')
    expect(image.getAttribute('width')).toBe('30')
    expect(image.getAttribute('height')).toBe('40')
    expect(image.getAttribute('preserveAspectRatio')).toBe('none')
    expect(image.getAttribute('filter')).toBeNull()
    expect(image.getAttribute('transform')).toBeNull()
    expect(image.getAttribute('style')).toContain('pointer-events: none')
  })

  it('旋转与镜像都绕盒心', () => {
    render(
      <svg>
        <SvgTexture {...textureProps(ref({ rotate: 90, flip: true }), withTile(), BOX)!} />
      </svg>,
    )
    expect(document.querySelector('image')!.getAttribute('transform')).toBe(
      'translate(25 40) scale(-1 1) rotate(90) translate(-25 -40)',
    )
  })
})

describe('DOM 层 DomTexture', () => {
  it('绝对定位填满盒，镜像用 scaleX(-1)', () => {
    render(
      <div style={{ position: 'relative' }}>
        <DomTexture {...textureProps(ref({ rotate: 270, flip: true }), withTile(), BOX)!} alt="木门" />
      </div>,
    )
    const img = document.querySelector('img')!

    expect(img.getAttribute('src')).toBe('blob:1')
    expect(img.getAttribute('alt')).toBe('木门')
    expect(img.style.position).toBe('absolute')
    expect(img.style.left).toBe('10px')
    expect(img.style.top).toBe('20px')
    expect(img.style.width).toBe('30px')
    expect(img.style.height).toBe('40px')
    expect(img.style.transform).toBe('rotate(270deg) scaleX(-1)')
    expect(img.style.transformOrigin).toBe('center')
    expect(img.style.pointerEvents).toBe('none')
  })

  it('同一份 props 两层都能画（接口一致）', () => {
    const props = textureProps(ref(), withTile(), BOX)!
    const svg = render(
      <svg>
        <SvgTexture {...props} />
      </svg>,
    )
    const dom = render(<DomTexture {...props} />)

    expect(svg.container.querySelector('image')).toBeTruthy()
    expect(dom.container.querySelector('img')).toBeTruthy()
  })
})
