/** zip 读写（裁决 14）：`.pp` / `.pgame` 共用的容器底座 */

import { describe, expect, it } from 'vitest'
import { hasEntry, jsonEntry, subEntries, textBytes, textEntry, unzipEntries, zipEntries } from '../zip'

describe('zip 读写', () => {
  it('打包 → 解包：条目名与字节一致', () => {
    const bytes = zipEntries({
      'a.txt': textBytes('甲'),
      'dir/b.bin': new Uint8Array([1, 2, 3]),
    })
    const entries = unzipEntries(bytes)
    expect(textEntry(entries, 'a.txt')).toBe('甲')
    expect(entries['dir/b.bin']).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('条目名带 `./` 前缀时被归一化', () => {
    const entries = unzipEntries(zipEntries({ './a.txt': textBytes('x') }))
    expect(textEntry(entries, 'a.txt')).toBe('x')
  })

  it('jsonEntry 的解析失败向上抛（由加载器按 KP-1 处理）', () => {
    const entries = unzipEntries(zipEntries({ 'manifest.json': textBytes('{ 坏的') }))
    expect(() => jsonEntry(entries, 'manifest.json')).toThrow()
  })

  it('缺条目返回 undefined', () => {
    const entries = unzipEntries(zipEntries({ 'a.txt': textBytes('x') }))
    expect(textEntry(entries, 'nope.txt')).toBeUndefined()
    expect(jsonEntry(entries, 'nope.json')).toBeUndefined()
    expect(hasEntry(entries, 'nope.txt')).toBe(false)
  })

  it('subEntries 剥掉目录前缀（.pgame 的 skin/ 是一份独立 .pp）', () => {
    const entries = unzipEntries(
      zipEntries({
        'skin/manifest.json': textBytes('{}'),
        'skin/art/a.png': new Uint8Array([1]),
        'game.pmod': textBytes('x'),
      }),
    )
    expect(Object.keys(subEntries(entries, 'skin/')).sort()).toEqual(['art/a.png', 'manifest.json'])
    expect(Object.keys(subEntries(entries, 'skin')).sort()).toEqual(['art/a.png', 'manifest.json'])
  })

  it('目录占位项不算「有该条目」', () => {
    const entries = unzipEntries(
      zipEntries({ 'skin/': new Uint8Array(0), 'a.png': new Uint8Array([1]) }),
    )
    expect(hasEntry(entries, 'skin/')).toBe(false)
    expect(hasEntry(entries, 'a.png')).toBe(true)
  })
})
