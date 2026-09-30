/** 素材源：路径 → 可用地址（`skin.md` §四；裁决 15「一次只解压一套」） */

import { describe, expect, it, vi } from 'vitest'
import { createSkinAssets, mimeOf, type SkinAssetsOptions } from '../skin-assets'
import { readSkin, type LoadedSkin } from '../pp'
import { minimalPp, PNG_BYTES } from '../../test/skin-fixtures'

const TILE = 'art/road/straight_ns.png'

/** 夹具：最小可用包（包根 manifest ＋ 一张素材），可再追加条目 */
function loaded(extra: Record<string, string | Uint8Array> = {}): LoadedSkin {
  const { skin, issues } = readSkin(minimalPp({}, extra), '小径.pp')
  expect(issues).toEqual([])
  if (!skin) throw new Error('夹具应能解出皮肤')
  return skin
}

/** 记账用的建 / 撤地址：不碰真 `URL`，便于断言「建了几次、撤了哪些」 */
function spy(): SkinAssetsOptions & { revoked: string[] } {
  let seq = 0
  const revoked: string[] = []
  return {
    revoked,
    createUrl: vi.fn(() => `blob:${++seq}`),
    revokeUrl: vi.fn((url: string) => {
      revoked.push(url)
    }),
  }
}

describe('按需建地址', () => {
  it('问到了才建，同一条素材只建一次，mime 认扩展名', () => {
    const { createUrl, revokeUrl } = spy()
    const assets = createSkinAssets(loaded(), { createUrl, revokeUrl })

    expect(createUrl).not.toHaveBeenCalled()

    const url = assets.urlOf(TILE)
    expect(url).toBe('blob:1')
    expect(assets.urlOf(TILE)).toBe(url)
    expect(createUrl).toHaveBeenCalledTimes(1)
    expect(createUrl).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/png')
  })

  it('路径归一：`./` 与前导 `/` 都当包根，同一条只建一个地址', () => {
    const { createUrl } = spy()
    const assets = createSkinAssets(loaded(), { createUrl })

    const url = assets.urlOf(TILE)
    expect(assets.urlOf(`./${TILE}`)).toBe(url)
    expect(assets.urlOf(`/${TILE}`)).toBe(url)
    expect(createUrl).toHaveBeenCalledTimes(1)
  })

  it('包里没有这条素材：返回 undefined，且不为它建地址', () => {
    const { createUrl } = spy()
    const assets = createSkinAssets(loaded(), { createUrl })

    expect(assets.urlOf('art/road/nope.png')).toBeUndefined()
    expect(createUrl).not.toHaveBeenCalled()
    expect(assets.has(TILE)).toBe(true)
    expect(assets.has('art/road/nope.png')).toBe(false)
  })

  it('没启用皮肤（skin 为空）时一切落到 undefined', () => {
    const { createUrl } = spy()
    const assets = createSkinAssets(undefined, { createUrl })

    expect(assets.urlOf(TILE)).toBeUndefined()
    expect(assets.has(TILE)).toBe(false)
    expect(assets.previewUrl()).toBeUndefined()
    expect(() => assets.release()).not.toThrow()
    expect(createUrl).not.toHaveBeenCalled()
  })
})

describe('一次释放（裁决 15）', () => {
  it('release 把建过的地址一次撤干净，撤后再问会重建', () => {
    const { createUrl, revokeUrl, revoked } = spy()
    const assets = createSkinAssets(loaded(), { createUrl, revokeUrl })

    const first = assets.urlOf(TILE)
    assets.release()
    expect(revoked).toEqual([first])

    // 幂等：没建过新地址时再撤一次不该重复撤
    assets.release()
    expect(revokeUrl).toHaveBeenCalledTimes(1)

    expect(assets.urlOf(TILE)).toBe('blob:2')
    expect(createUrl).toHaveBeenCalledTimes(2)
  })
})

describe('封面', () => {
  it('包里有 preview.png 才给地址，且只建一次', () => {
    const { createUrl } = spy()
    expect(createSkinAssets(loaded(), { createUrl }).previewUrl()).toBeUndefined()
    expect(createUrl).not.toHaveBeenCalled()

    const assets = createSkinAssets(loaded({ 'preview.png': PNG_BYTES }), { createUrl })
    expect(assets.previewUrl()).toBe('blob:1')
    expect(assets.previewUrl()).toBe('blob:1')
    expect(createUrl).toHaveBeenCalledTimes(1)
  })
})

describe('默认实现与降级', () => {
  it('mime 认常见扩展名，其余按二进制给', () => {
    expect(mimeOf('a.PNG')).toBe('image/png')
    expect(mimeOf('a.jpeg')).toBe('image/jpeg')
    expect(mimeOf('a.jpg')).toBe('image/jpeg')
    expect(mimeOf('a.webp')).toBe('image/webp')
    expect(mimeOf('a.gif')).toBe('image/gif')
    expect(mimeOf('a.svg')).toBe('image/svg+xml')
    expect(mimeOf('a.ogg')).toBe('application/octet-stream')
    expect(mimeOf('noext')).toBe('application/octet-stream')
  })

  it('默认走 URL.createObjectURL；环境没有该能力时降级为 undefined', () => {
    const url = URL as unknown as { createObjectURL?: (blob: Blob) => string }
    const original = url.createObjectURL
    url.createObjectURL = (blob) => `blob:${blob.type}`

    try {
      expect(createSkinAssets(loaded()).urlOf(TILE)).toBe('blob:image/png')

      url.createObjectURL = undefined
      expect(createSkinAssets(loaded()).urlOf(TILE)).toBeUndefined()
    } finally {
      url.createObjectURL = original
    }
  })
})
