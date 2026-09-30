/** 包体二进制存储：内存实现与「无 IndexedDB 时降级」 */

import { describe, expect, it } from 'vitest'
import { createIndexedDbBlobStore, createMemoryBlobStore, defaultBlobStore } from '../idb'

describe('内存实现', () => {
  it('存取删与列举', async () => {
    const store = createMemoryBlobStore()
    await store.put('a', new Uint8Array([1]))
    expect(await store.get('a')).toEqual(new Uint8Array([1]))
    expect(await store.keys()).toEqual(['a'])
    await store.remove('a')
    expect(await store.get('a')).toBeUndefined()
    expect(await store.keys()).toEqual([])
  })
})

describe('默认存储', () => {
  it('环境没有 IndexedDB 时降级为内存实现', async () => {
    if (typeof indexedDB === 'undefined') {
      expect(createIndexedDbBlobStore()).toBeUndefined()
    }
    const store = defaultBlobStore()
    await store.put('a', new Uint8Array([1, 2]))
    expect(await store.get('a')).toEqual(new Uint8Array([1, 2]))
  })
})
