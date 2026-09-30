/** 用户皮肤库（裁决 15）：索引走 localStorage、包体走（注入的）二进制存储 */

import { describe, expect, it } from 'vitest'
import { createMemoryBlobStore } from '../idb'
import { readSkin } from '../pp'
import { createSkinLibrary, SKIN_LIBRARY_KEY, type IndexStorage } from '../skin-library'
import { minimalPp } from '../../test/skin-fixtures'
import type { LoadedSkin } from '../pp'

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  const storage: IndexStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
  return { storage, raw: () => map.get(SKIN_LIBRARY_KEY) ?? null }
}

function loadedSkin(): LoadedSkin {
  return readSkin(minimalPp(), '小径.pp').skin!
}

function library(seed: Record<string, string> = {}) {
  const { storage, raw } = fakeStorage(seed)
  const blobs = createMemoryBlobStore()
  let seq = 0
  const lib = createSkinLibrary({
    storage,
    blobs,
    now: () => 1_700_000_000_000 + seq,
    newId: () => `skin-${++seq}`,
  })
  return { lib, blobs, raw }
}

describe('增删查', () => {
  it('导入一条：索引与包体都落地', async () => {
    const { lib, blobs, raw } = library()
    const bytes = minimalPp()
    const entry = await lib.add(loadedSkin(), bytes)

    expect(entry.id).toBe('skin-1')
    expect(entry.name).toBe('小径')
    expect(entry.author).toBe('测试')
    expect(entry.source).toBe('小径.pp')
    expect(entry.enabled).toBe(false)

    expect(lib.list()).toHaveLength(1)
    expect(lib.get('skin-1')).toEqual(entry)
    expect(await lib.bytesOf('skin-1')).toEqual(bytes)
    expect(await blobs.keys()).toEqual(['skin-1'])
    expect(raw()).toContain(`"id":"skin-1"`)
  })

  it('包体原封不动：取回的字节能再次解压出同一份皮肤', async () => {
    const { lib } = library()
    const bytes = minimalPp()
    await lib.add(loadedSkin(), bytes)
    const again = await lib.bytesOf('skin-1')
    expect(readSkin(again!).skin?.name).toBe('小径')
  })

  it('启用互斥：同一时刻只有一条是用户配置层', async () => {
    const { lib } = library()
    await lib.add(loadedSkin(), minimalPp())
    await lib.add(loadedSkin(), minimalPp())

    await lib.setEnabled('skin-2')
    expect(lib.enabled()?.id).toBe('skin-2')
    expect(lib.list().filter((entry) => entry.enabled)).toHaveLength(1)

    await lib.setEnabled('skin-1')
    expect(lib.enabled()?.id).toBe('skin-1')

    await lib.setEnabled(null)
    expect(lib.enabled()).toBeUndefined()
  })

  it('删除条目同时清掉包体', async () => {
    const { lib, blobs } = library()
    await lib.add(loadedSkin(), minimalPp())
    await lib.remove('skin-1')
    expect(lib.list()).toEqual([])
    expect(await lib.bytesOf('skin-1')).toBeUndefined()
    expect(await blobs.keys()).toEqual([])
  })
})

describe('索引读取的容错', () => {
  it('环境没有 localStorage 时仍可用（当次会话）', async () => {
    const lib = createSkinLibrary({ storage: null, blobs: createMemoryBlobStore() })
    await lib.add(loadedSkin(), minimalPp())
    expect(lib.list()).toHaveLength(1)
  })

  it('索引 JSON 损坏时当作空库，不抛', () => {
    const { lib } = library({ [SKIN_LIBRARY_KEY]: '{ 坏的' })
    expect(lib.list()).toEqual([])
    expect(lib.enabled()).toBeUndefined()
  })

  it('索引里的非法条目被过滤掉', async () => {
    const { lib } = library({ [SKIN_LIBRARY_KEY]: JSON.stringify([{ id: 1 }, { id: 'ok', source: 'a.pp', enabled: false, name: '', importedAt: 0 }]) })
    expect(lib.list().map((entry) => entry.id)).toEqual(['ok'])
  })
})
