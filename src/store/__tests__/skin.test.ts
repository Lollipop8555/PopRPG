/** 运行期皮肤（`skin/00-package.md` §4.4，裁决 5 / 15）：激活 / 换套 / 释放 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSkinStore } from '../skin'
import type { SkinLibrary } from '../../io/skin-library'
import { minimalPp } from '../../test/skin-fixtures'

const TILE = 'art/road/straight_ns.png'

/** 假皮肤库：给一条「本机启用」的条目（不含包体即模拟包体丢失） */
function fakeLibrary(entry?: { id: string; source: string; bytes?: Uint8Array }): SkinLibrary {
  return {
    enabled: () => (entry ? { id: entry.id, source: entry.source } : undefined),
    bytesOf: () => entry?.bytes,
  } as unknown as SkinLibrary
}

/** 记账 URL：真身由 `io/skin-assets.ts` 用，这里只关心「建了几个、撤了哪些」 */
let created: string[] = []
let revoked: string[] = []
let originalCreate: unknown
let originalRevoke: unknown

beforeEach(() => {
  created = []
  revoked = []
  const url = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
  originalCreate = url.createObjectURL
  originalRevoke = url.revokeObjectURL
  url.createObjectURL = () => {
    const next = `blob:${created.length + 1}`
    created.push(next)
    return next
  }
  url.revokeObjectURL = (u: string) => {
    revoked.push(u)
  }
})

afterEach(() => {
  const url = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
  url.createObjectURL = originalCreate
  url.revokeObjectURL = originalRevoke
})

describe('未启用皮肤', () => {
  it('一切落空：没有皮肤、素材源问什么都是 undefined', () => {
    const store = createSkinStore({ library: fakeLibrary() })
    const state = store.getState()

    expect(state.skin).toBeUndefined()
    expect(state.assets.urlOf(TILE)).toBeUndefined()
    expect(state.assets.has(TILE)).toBe(false)
    expect(state.issues).toEqual([])
  })

  it('本局层未给、用户层也没启用时，refresh 不报错也不建地址', async () => {
    const store = createSkinStore({ library: fakeLibrary() })

    await store.getState().refresh()

    expect(store.getState().skin).toBeUndefined()
    expect(created).toEqual([])
  })
})

describe('激活', () => {
  it('本局层给了包体就生效，素材源按需建地址', () => {
    const store = createSkinStore({ library: fakeLibrary() })
    const skin = store.getState().activateLayers({ game: { bytes: minimalPp(), source: '本局' } })

    expect(skin).toBeDefined()
    expect(store.getState().skin).toBe(skin)
    expect(store.getState().assets.urlOf(TILE)).toBe('blob:1')
  })

  it('用户层从皮肤库取：启用了就生效', async () => {
    const store = createSkinStore({ library: fakeLibrary({ id: 'a', source: '导入的.pp', bytes: minimalPp() }) })

    await store.getState().refresh()

    expect(store.getState().skin).toBeDefined()
    expect(store.getState().assets.urlOf(TILE)).toBe('blob:1')
  })

  it('库里有条目但包体丢了：当作这一层不存在，不抛错', async () => {
    const store = createSkinStore({ library: fakeLibrary({ id: 'a', source: '导入的.pp' }) })

    await store.getState().refresh()

    expect(store.getState().skin).toBeUndefined()
    expect(created).toEqual([])
  })
})

describe('换套与释放（裁决 15）', () => {
  it('换一套先撤旧地址，再建新的', () => {
    const store = createSkinStore({ library: fakeLibrary() })

    store.getState().activateLayers({ game: { bytes: minimalPp(), source: '本局' } })
    expect(store.getState().assets.urlOf(TILE)).toBe('blob:1')

    store.getState().activateLayers({ game: { bytes: minimalPp(), source: '本局' } })
    expect(revoked).toEqual(['blob:1'])
    expect(store.getState().assets.urlOf(TILE)).toBe('blob:2')
  })

  it('release 回到全部程序绘制，地址一次撤干净', () => {
    const store = createSkinStore({ library: fakeLibrary() })
    store.getState().activateLayers({ game: { bytes: minimalPp(), source: '本局' } })
    store.getState().assets.urlOf(TILE)

    store.getState().release()

    expect(store.getState().skin).toBeUndefined()
    expect(revoked).toEqual(['blob:1'])
    expect(store.getState().assets.urlOf(TILE)).toBeUndefined()
    expect(created).toEqual(['blob:1'])
  })

  it('refresh 只换用户层，不把本局皮肤冲掉', async () => {
    const store = createSkinStore({ library: fakeLibrary() })
    const game = store.getState().activateLayers({ game: { bytes: minimalPp(), source: '本局' } })

    await store.getState().refresh()

    expect(store.getState().skin).toBeDefined()
    expect(store.getState().skin?.name).toBe(game?.name)
  })
})
