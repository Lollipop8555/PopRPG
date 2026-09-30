/** 运行期生效皮肤（裁决 5 / 15）：两层合成、节点级降级、一次只解压一套 */

import { describe, expect, it } from 'vitest'
import { skinBytesOf } from '../pp'
import { createSkinRuntime } from '../skin-runtime'
import { img, minimalPp, packZip } from '../../test/skin-fixtures'

/** 用户配置层：自带 `window.rules.line` 与自己的 `role.player`，另有素材 */
const userPp = () =>
  minimalPp(
    {
      name: '用户包',
      role: { player: 'art/role/you.png' },
      window: { rules: { line: 'art/line.png' } },
    },
    { 'art/role/you.png': img('you'), 'art/line.png': img('line') },
  )

/** 游戏配置层：覆盖 `role.player`，素材自带一份 */
const gamePp = () =>
  minimalPp(
    { name: '本局包', role: { player: 'art/role/me.png' } },
    { 'art/role/me.png': img('me') },
  )

describe('单层', () => {
  it('只激活本局层', () => {
    const runtime = createSkinRuntime()
    const skin = runtime.activate({ game: { bytes: gamePp(), source: '本局.pp' } })
    expect(skin?.name).toBe('本局包')
    expect(runtime.current()).toBe(skin)
    expect(runtime.issues()).toEqual([])
  })

  it('只激活用户层', () => {
    const runtime = createSkinRuntime()
    const skin = runtime.activate({ user: { bytes: userPp(), source: '用户.pp' } })
    expect(skin?.name).toBe('用户包')
    expect(skin && skinBytesOf(skin, 'art/line.png')).toBeDefined()
  })

  it('未激活时一切走程序绘制', () => {
    const runtime = createSkinRuntime()
    expect(runtime.current()).toBeUndefined()
    expect(runtime.activate({})).toBeUndefined()
    expect(runtime.current()).toBeUndefined()
  })
})

describe('两层合成', () => {
  const runtime = createSkinRuntime()
  const skin = runtime.activate({
    game: { bytes: gamePp(), source: '本局.pp' },
    user: { bytes: userPp(), source: '用户.pp' },
  })!

  it('同名节点本局优先', () => {
    expect(skin.manifest.role?.player).toBe('art/role/me.png')
  })

  it('本局未覆盖的节点落到用户层（节点级降级）', () => {
    expect(skin.manifest.window?.rules?.line).toBe('art/line.png')
  })

  it('两层的条目都在，各节点都能取到自己的素材', () => {
    expect(skinBytesOf(skin, 'art/role/me.png')).toBeDefined()
    expect(skinBytesOf(skin, 'art/line.png')).toBeDefined()
    expect(skinBytesOf(skin, 'art/role/you.png')).toBeDefined()
  })

  it('元信息与来源取本局层', () => {
    expect(skin.name).toBe('本局包')
    expect(skin.source).toBe('本局.pp')
  })

  it('两层的提示都收集', () => {
    const badUser = packZip({
      'manifest.json': JSON.stringify({
        road: { styles: [{ tags: [], base: 'art/road' }], tiles: { straight: '缺的.png' } },
      }),
    })
    const issues = createSkinRuntime().activate({
      game: { bytes: minimalPp(), source: '本局.pp' },
      user: { bytes: badUser, source: '用户.pp' },
    })!
    expect(issues.issues.map((entry) => entry.code)).toEqual(['KP-2'])
  })
})

describe('一次只解压一套', () => {
  it('换皮肤后上一套的解压结果不再可达', () => {
    const runtime = createSkinRuntime()
    const first = runtime.activate({
      game: { bytes: minimalPp({}, { 'only-a.png': img('a') }), source: 'A.pp' },
    })!
    expect(skinBytesOf(first, 'only-a.png')).toBeDefined()

    const second = runtime.activate({
      game: { bytes: minimalPp({}, { 'only-b.png': img('b') }), source: 'B.pp' },
    })!
    expect(skinBytesOf(second, 'only-b.png')).toBeDefined()
    expect(skinBytesOf(second, 'only-a.png')).toBeUndefined()
    expect(runtime.current()).toBe(second)
  })

  it('卸载后回到程序绘制，提示也清空', () => {
    const runtime = createSkinRuntime()
    runtime.activate({ game: { bytes: gamePp(), source: '本局.pp' } })
    runtime.release()
    expect(runtime.current()).toBeUndefined()
    expect(runtime.issues()).toEqual([])
  })
})
