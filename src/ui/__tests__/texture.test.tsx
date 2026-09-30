/** 贴图渲染器两层（`skin.md` §四；S-6 位图不套手绘滤镜） */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { DomTexture, InlineTexture, SvgTexture, buttonStyle, surfaceStyle, textureProps } from '../Texture'
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

describe('背景铺法 surfaceStyle：九宫格走 border-image（§3.3）', () => {
  it('素材没交切片：整图拉伸铺满，只写图 / 尺寸 / 重复，**不写底色**', () => {
    expect(surfaceStyle(ref(), withTile())).toEqual({
      backgroundImage: 'url("blob:1")',
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    })
  })

  it('素材交了切片：改走 `border-image`，四值按 `[上, 右, 下, 左]` 逐字落，中心用 `fill` 画出来', () => {
    const style = surfaceStyle(ref({ slice: [6, 12, 18, 24] }), withTile())!

    expect(style.borderImageSource).toBe('url("blob:1")')
    expect(style.borderImageSlice).toBe('6 12 18 24 fill')
    expect(style.borderImageWidth).toBe('6px 12px 18px 24px')
    expect(style.borderImageRepeat).toBe('stretch')
    // 九宫格与背景图是两套画法，不能同时写
    expect(style.backgroundImage).toBeUndefined()
    // S-4：边框与底色仍归元素自己的 CSS，这里一个都不动
    expect(style.borderWidth).toBeUndefined()
    expect(style.borderStyle).toBeUndefined()
    expect(style.backgroundColor).toBeUndefined()
  })

  it('单轴九宫格就是上下切片给 0：只在左右拉伸（单向族的写法）', () => {
    const style = surfaceStyle(ref({ slice: [0, 10, 0, 10] }), withTile())!

    expect(style.borderImageSlice).toBe('0 10 0 10 fill')
    expect(style.borderImageWidth).toBe('0px 10px 0px 10px')
  })

  it('`contain` 那一档不受切片影响（骰子本体等比缩放，不能切）', () => {
    const style = surfaceStyle(ref({ slice: [6, 6, 6, 6] }), withTile(), 'contain')!

    expect(style.backgroundSize).toBe('contain')
    expect(style.borderImageSource).toBeUndefined()
  })

  it('没配 / 包里缺这张图一律 `undefined`（调用方不传 `style`，CSS 纸面照旧）', () => {
    expect(surfaceStyle(undefined, withTile())).toBeUndefined()
    expect(surfaceStyle(ref({ slice: [6, 6, 6, 6] }), assets())).toBeUndefined()
  })
})

describe('按钮四态 buttonStyle：normal 行内 ＋ 三态变量（§4.1）', () => {
  const HOVER = 'art/window/btn-hover.png'
  const pack = assets({ [TILE]: 'blob:1', [HOVER]: 'blob:2' })
  /** 变量读法：`--sk-*` 是 CSS 自定义属性，React 的 `CSSProperties` 型上没有它们 */
  const vars = (style: CSSProperties | undefined) => (style ?? {}) as Record<string, string>

  it('只写 `normal`：行内属性照旧，另外三态一对变量都不写（交给 CSS 回落）', () => {
    const style = buttonStyle({ normal: TILE }, withTile())!

    // `normal` 那份与容器同一条落法：行内四值照旧
    expect(style.backgroundImage).toBe('url("blob:1")')
    expect(style.backgroundSize).toBe('100% 100%')
    expect(style.backgroundRepeat).toBe('no-repeat')
    expect(style.borderImageSource).toBeUndefined()
    expect(vars(style)['--sk-normal-bg']).toBe('url("blob:1")')
    expect(vars(style)['--sk-normal-bi']).toBe('none')
    expect(vars(style)['--sk-hover-bg']).toBeUndefined()
    expect(vars(style)['--sk-active-bg']).toBeUndefined()
    expect(vars(style)['--sk-disabled-bg']).toBeUndefined()
  })

  it('写了哪一态就写哪一对变量：三态各写各的，没写的不占位', () => {
    const style = buttonStyle({ normal: TILE, hover: HOVER, disabled: HOVER }, pack)!

    expect(vars(style)['--sk-hover-bg']).toBe('url("blob:2")')
    expect(vars(style)['--sk-hover-bi']).toBe('none')
    expect(vars(style)['--sk-disabled-bg']).toBe('url("blob:2")')
    expect(vars(style)['--sk-active-bg']).toBeUndefined()
  })

  it('某一态自己交了切片就走九宫格：背景图那半给 `none`，`border-image` 写成简写', () => {
    const style = buttonStyle({ normal: TILE, hover: { img: HOVER, slice: [6, 12, 18, 24] } }, pack)!

    expect(vars(style)['--sk-hover-bg']).toBe('none')
    expect(vars(style)['--sk-hover-bi']).toBe('url("blob:2") 6 12 18 24 fill / 6px 12px 18px 24px stretch')
    // 与九宫格长写同义（同一份切片、同一份四值）
    expect(surfaceStyle(ref({ src: HOVER, slice: [6, 12, 18, 24] }), pack)!.borderImageSlice).toBe('6 12 18 24 fill')
    // `normal` 那一态不受兄弟态铺法影响
    expect(vars(style)['--sk-normal-bg']).toBe('url("blob:1")')
  })

  it('该态的图不在包里：当没配——不写那对变量，`theme.css` 自然回落 `normal`', () => {
    const style = buttonStyle({ normal: TILE, hover: HOVER }, withTile())!

    expect(vars(style)['--sk-normal-bg']).toBe('url("blob:1")')
    expect(vars(style)['--sk-hover-bg']).toBeUndefined()
  })

  it('缺 `normal`（或包里缺 `normal` 那张图）即整块 `undefined`：三态写了也一并作废', () => {
    expect(buttonStyle({ hover: HOVER }, pack)).toBeUndefined()
    expect(buttonStyle({ normal: TILE, hover: HOVER }, assets())).toBeUndefined()
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

  it('auto 盒不写尺寸属性（尺寸交给素材自身像素，仅画布背景用）', () => {
    const props = textureProps(ref(), withTile(), { x: 0, y: 0, w: 'auto', h: 'auto' })!
    render(
      <svg>
        <SvgTexture {...props} />
      </svg>,
    )
    const image = document.querySelector('image')!

    expect(image.getAttribute('x')).toBe('0')
    expect(image.getAttribute('width')).toBeNull()
    expect(image.getAttribute('height')).toBeNull()
  })

  it('auto 盒量不出盒心，故不合成绕心变换', () => {
    const props = textureProps(ref({ rotate: 90, flip: true }), withTile(), { x: 0, y: 0, w: 'auto', h: 'auto' })!
    render(
      <svg>
        <SvgTexture {...props} />
      </svg>,
    )
    expect(document.querySelector('image')!.getAttribute('transform')).toBeNull()
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

describe('行内层 InlineTexture', () => {
  it('尺寸交给 CSS（`.inline-texture` 跟字号走），故不摆坐标、但镜像 / 纠偏角照旧生效', () => {
    const props = textureProps(ref({ rotate: 90, flip: true }), withTile(), BOX)!
    const { container } = render(<InlineTexture {...props} alt="骑士" />)
    const img = container.querySelector('img')!

    expect(img.getAttribute('src')).toBe('blob:1')
    expect(img.getAttribute('alt')).toBe('骑士')
    expect(img.className).toBe('inline-texture')
    expect(img.style.position).toBe('')
    expect(img.style.transform).toBe('rotate(90deg) scaleX(-1)')
    expect(img.getAttribute('draggable')).toBe('false')
  })

  it('同一份 props 三层都能画（接口一致）', () => {
    const props = textureProps(ref(), withTile(), BOX)!
    const svg = render(
      <svg>
        <SvgTexture {...props} />
      </svg>,
    )
    const inline = render(<InlineTexture {...props} />)

    expect(svg.container.querySelector('image')).toBeTruthy()
    expect(inline.container.querySelector('img')).toBeTruthy()
  })
})
