/** `.pgame` 容器加载（`skin/00-package.md` §2.3、`00a-formats.md` §2.2） */

import { describe, expect, it } from 'vitest'
import { readPGame } from '../pgame'
import { img, minimalManifest, packZip } from '../../test/skin-fixtures'
import type { SkinIssue } from '../../types'

const codes = (issues: SkinIssue[]): string[] => issues.map((entry) => entry.code)

/** 一份标准三件套（＋追加条目） */
function gameZip(extra: Record<string, string | Uint8Array> = {}): Uint8Array {
  return packZip({
    'pack.json': JSON.stringify({ kind: 'poprpg.pgame', name: '小径之旅', pmod: 'game.pmod' }),
    'game.pmod': 'name: 小径之旅\n',
    'skin/manifest.json': JSON.stringify(minimalManifest()),
    'skin/art/road/straight_ns.png': img(),
    ...extra,
  })
}

describe('标准 `pack.json`', () => {
  it('三件套齐备：pmod 文本与皮肤都加载', () => {
    const game = readPGame(gameZip(), '小径之旅.pgame')
    expect(game.issues).toEqual([])
    expect(game.name).toBe('小径之旅')
    expect(game.pmod).toContain('小径之旅')
    expect(game.skin?.name).toBe('小径')
    expect(game.skin && game.skin.entries['art/road/straight_ns.png']).toBeDefined()
  })

  it('皮肤路径相对皮肤根而非包根（`skin/` 前缀被剥掉）', () => {
    const game = readPGame(gameZip())
    expect(game.skin?.manifest.road?.tiles?.straight).toBe('straight_ns.png')
    expect(game.skin?.entries['art/road/straight_ns.png']).toBeDefined()
  })

  it('文件形态自由：换个目录、改个名都合法', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: 'poprpg.pgame', name: '自由', pmod: 'main.pmod', skin: 'theme/' }),
      'main.pmod': 'x\n',
      'theme/manifest.json': JSON.stringify(minimalManifest()),
      'theme/art/road/straight_ns.png': img(),
    })
    const game = readPGame(bytes)
    expect(game.issues).toEqual([])
    expect(game.pmod).toBe('x\n')
    expect(game.skin?.name).toBe('小径')
  })

  it('显示名缺省取文件名', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: 'poprpg.pgame' }),
      'game.pmod': 'x\n',
    })
    expect(readPGame(bytes, '小径之旅.pgame').name).toBe('小径之旅.pgame')
  })
})

describe('KP-7 回退探测', () => {
  it('缺 pack.json 时按约定文件名探测，并提示', () => {
    const bytes = packZip({
      'game.pmod': 'x\n',
      'skin/manifest.json': JSON.stringify(minimalManifest()),
      'skin/art/road/straight_ns.png': img(),
    })
    const game = readPGame(bytes, '裸包.pgame')
    expect(codes(game.issues)).toEqual(['KP-7'])
    expect(game.name).toBe('裸包.pgame')
    expect(game.pmod).toBe('x\n')
    expect(game.skin?.name).toBe('小径')
  })

  it('kind 不符时同样回退探测', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: '别的格式' }),
      'game.pmod': 'x\n',
    })
    expect(codes(readPGame(bytes).issues)).toEqual(['KP-7'])
  })

  it('pack.json 解析不了时回退探测', () => {
    const bytes = packZip({ 'pack.json': '{ 坏的', 'game.pmod': 'x\n' })
    const game = readPGame(bytes)
    expect(codes(game.issues)).toEqual(['KP-7'])
    expect(game.pmod).toBe('x\n')
  })
})

describe('缺件与提示', () => {
  it('没有皮肤目录时按「无皮肤」启动，不算缺陷', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: 'poprpg.pgame' }),
      'game.pmod': 'x\n',
    })
    const game = readPGame(bytes)
    expect(game.issues).toEqual([])
    expect(game.skin).toBeUndefined()
  })

  it('皮肤目录里没有 manifest.json 也按「无皮肤」处理', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: 'poprpg.pgame' }),
      'game.pmod': 'x\n',
      'skin/art/road/straight_ns.png': img(),
    })
    const game = readPGame(bytes)
    expect(game.issues).toEqual([])
    expect(game.skin).toBeUndefined()
  })

  it('声明的 pmod 路径不存在 → KP-2，pmod 为空', () => {
    const bytes = packZip({ 'pack.json': JSON.stringify({ kind: 'poprpg.pgame', pmod: 'main.pmod' }) })
    const game = readPGame(bytes)
    expect(codes(game.issues)).toEqual(['KP-2'])
    expect(game.pmod).toBeUndefined()
  })

  it('皮肤自身的提示冒到容器层（部分接管时仍带提示）', () => {
    const bytes = packZip({
      'pack.json': JSON.stringify({ kind: 'poprpg.pgame' }),
      'game.pmod': 'x\n',
      'skin/manifest.json': JSON.stringify(minimalManifest()),
    })
    const game = readPGame(bytes)
    expect(codes(game.issues)).toEqual(['KP-2'])
    expect(game.skin?.name).toBe('小径')
  })

  it('整体不像 zip 时按 KP-7 返回空壳，不抛', () => {
    const game = readPGame(new Uint8Array([9, 9, 9]), '坏.pgame')
    expect(codes(game.issues)).toEqual(['KP-7'])
    expect(game.pmod).toBeUndefined()
    expect(game.skin).toBeUndefined()
  })
})
