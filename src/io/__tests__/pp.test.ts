/** `.pp` 加载（`skin/00-package.md` §2.1 / §五 / §六） */

import { describe, expect, it, vi } from 'vitest'
import { textBytes } from '../zip'
import { readSkin, skinBytesOf } from '../pp'
import { img, minimalManifest, minimalPp, packZip, PNG_BYTES } from '../../test/skin-fixtures'
import { SKIN_LAYOUT_TOKENS, SKIN_THEME_TOKENS, type SkinIssue } from '../../types'

const codes = (issues: SkinIssue[]): string[] => issues.map((entry) => entry.code)

function manifestZip(manifest: unknown, files: Record<string, string | Uint8Array> = {}) {
  return packZip({ 'manifest.json': JSON.stringify(manifest), ...files })
}

describe('基本形态', () => {
  it('最小可用包：无提示，元信息与素材都取得到', () => {
    const { skin, issues } = readSkin(minimalPp(), '小径.pp')
    expect(issues).toEqual([])
    expect(skin?.name).toBe('小径')
    expect(skin?.author).toBe('测试')
    expect(skin?.format).toBe(1)
    expect(skin?.source).toBe('小径.pp')
    expect(skin?.preview).toBeUndefined()
    expect(skin && skinBytesOf(skin, 'art/road/straight_ns.png')).toBeDefined()
    expect(skin && skinBytesOf(skin, 'art/road/nope.png')).toBeUndefined()
  })

  it('目录结构与文件名完全自由，路径照写即可', () => {
    const bytes = manifestZip(
      {
        road: { styles: [{ tags: [], base: '随便/深层/目录' }], tiles: { straight: '名字也可以很奇怪.png' } },
      },
      { '随便/深层/目录/名字也可以很奇怪.png': img() },
    )
    expect(readSkin(bytes).issues).toEqual([])
  })

  it('整包不像 zip 时不抛，按 KP-1 忽略', () => {
    const result = readSkin(new Uint8Array([1, 2, 3, 4]), '坏.pp')
    expect(result.skin).toBeUndefined()
    expect(codes(result.issues)).toEqual(['KP-1'])
  })
})

describe('KP-1 入口', () => {
  it('包根没有 manifest.json', () => {
    const result = readSkin(packZip({ 'art/road/straight_ns.png': img() }), 'x.pp')
    expect(result.skin).toBeUndefined()
    expect(codes(result.issues)).toEqual(['KP-1'])
  })

  it('manifest.json 不是合法 JSON', () => {
    const result = readSkin(packZip({ 'manifest.json': textBytes('不是 JSON') }), 'x.pp')
    expect(result.skin).toBeUndefined()
    expect(codes(result.issues)).toEqual(['KP-1'])
  })

  it('manifest 放在子目录里不算数（必须在包根）', () => {
    const result = readSkin(packZip({ 'sub/manifest.json': JSON.stringify(minimalManifest()) }))
    expect(codes(result.issues)).toEqual(['KP-1'])
  })
})

describe('KP-2 素材存在性', () => {
  it('道路 tiles 的相对文件名与 base 拼接后才判定（§七）', () => {
    const { issues } = readSkin(minimalPp())
    expect(issues).toEqual([])
  })

  it('缺素材时列出拼接后的路径与出处', () => {
    const { issues } = readSkin(manifestZip(minimalManifest()))
    expect(codes(issues)).toEqual(['KP-2'])
    expect(issues[0].detail).toContain('art/road/straight_ns.png')
    expect(issues[0].detail).toContain('road.tiles.straight')
  })

  it('样式集缺省 base 时，tiles 的值按完整路径处理', () => {
    const bytes = manifestZip(
      { road: { styles: [{ tags: [] }], tiles: { straight: 'art/road/straight_ns.png' } } },
      { 'art/road/straight_ns.png': img() },
    )
    expect(readSkin(bytes).issues).toEqual([])
  })

  it('多套样式集：只要有一套能取到就算有效', () => {
    const manifest = {
      road: {
        styles: [
          { tags: ['grass'], base: 'art/grass' },
          { tags: [], base: 'art/dirt' },
        ],
        tiles: { straight: 'straight_ns.png' },
      },
    }
    const bytes = manifestZip(manifest, { 'art/dirt/straight_ns.png': img() })
    expect(readSkin(bytes).issues).toEqual([])
  })

  it('多套样式集都缺时，把全部候选列出来', () => {
    const manifest = {
      road: {
        styles: [
          { tags: ['grass'], base: 'art/grass' },
          { tags: [], base: 'art/dirt' },
        ],
        tiles: { straight: 'straight_ns.png' },
      },
    }
    const { issues } = readSkin(manifestZip(manifest))
    expect(codes(issues)).toEqual(['KP-2'])
    expect(issues[0].detail).toContain('art/grass/straight_ns.png / art/dirt/straight_ns.png')
  })

  it('四张数组写法逐张检查，缺哪张报哪张', () => {
    const manifest = {
      road: { styles: [{ tags: [], base: 'art' }], tiles: { straight: ['n.png', 'e.png', 's.png', 'w.png'] } },
    }
    const bytes = manifestZip(manifest, { 'art/n.png': img(), 'art/e.png': img(), 'art/s.png': img() })
    const { issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-2'])
    expect(issues[0].detail).toContain('art/w.png')
    expect(issues[0].detail).not.toContain('art/n.png')
  })

  it('对象写法读 `img`（`hurt` 等平级图同样计入）', () => {
    const manifest = {
      role: { portraits: { player: { img: 'art/role/me.png', hurt: 'art/role/me_hurt.png' } } },
    }
    const bytes = manifestZip(manifest, { 'art/role/me.png': img() })
    const { issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-2'])
    expect(issues[0].detail).toContain('art/role/me_hurt.png')
  })
})

describe('KP-4 路径约束', () => {
  const cases: [string, string][] = [
    ['../escape.png', '含 `..`'],
    ['/absolute/x.png', '绝对路径'],
    ['https://example.com/x.png', '外部地址'],
  ]

  for (const [path, label] of cases) {
    it(`${path} → ${label}`, () => {
      const bytes = minimalPp({ window: { surfaces: { dialog: path } } })
      const { issues } = readSkin(bytes)
      expect(codes(issues)).toEqual(['KP-4'])
      expect(issues[0].detail).toContain(path)
      expect(issues[0].detail).toContain(label)
    })
  }

  it('违规路径不再重复报 KP-2', () => {
    const bytes = minimalPp({ window: { surfaces: { dialog: '../escape.png' } } })
    expect(codes(readSkin(bytes).issues)).not.toContain('KP-2')
  })

  it('extends 违规时截断继承链', () => {
    const bytes = manifestZip({ name: '本包', extends: 'http://x/base.json' })
    const { skin, issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-4'])
    expect(skin?.name).toBe('本包')
  })
})

describe('KP-3 版本', () => {
  it('缺省与非正整数都按 1', () => {
    expect(readSkin(minimalPp()).skin?.format).toBe(1)
    expect(readSkin(minimalPp({ format: 0 })).skin?.format).toBe(1)
    expect(readSkin(minimalPp({ format: 1.5 })).skin?.format).toBe(1)
  })

  it('更高版本照常渲染，提示一次且控制台只警告一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bytes = minimalPp({ format: 2 })

    const first = readSkin(bytes, 'a.pp')
    expect(codes(first.issues)).toEqual(['KP-3'])
    expect(first.skin?.format).toBe(2)
    expect(first.skin?.name).toBe('小径')

    expect(codes(readSkin(bytes, 'b.pp').issues)).toEqual(['KP-3'])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('KP-6 预览图', () => {
  it('合法 PNG 进 preview，无提示', () => {
    const { skin, issues } = readSkin(minimalPp({}, { 'preview.png': PNG_BYTES }))
    expect(issues).toEqual([])
    expect(skin?.preview).toEqual(PNG_BYTES)
  })

  it('没有 preview.png 是正常状态（列表回退文件名），不提示', () => {
    expect(codes(readSkin(minimalPp()).issues)).toEqual([])
  })

  it('给了但不是 PNG → KP-6，且不当作预览图', () => {
    const { skin, issues } = readSkin(minimalPp({}, { 'preview.png': img('假图') }))
    expect(codes(issues)).toEqual(['KP-6'])
    expect(skin?.preview).toBeUndefined()
  })
})

describe('KP-8 extends', () => {
  it('逐节点覆盖：本包优先，未覆盖的继承基座', () => {
    const bytes = packZip({
      'base.json': JSON.stringify({
        name: '基座',
        road: { styles: [{ tags: [], base: 'art/road' }], tiles: { straight: 'straight_ns.png' } },
        role: { player: 'art/role/hero.png' },
      }),
      'art/road/straight_ns.png': img(),
      'art/role/hero.png': img(),
      'manifest.json': JSON.stringify({ extends: 'base.json', role: { player: 'art/role/me.png' } }),
      'art/role/me.png': img(),
    })

    const { skin, issues } = readSkin(bytes, 'a.pp')
    expect(issues).toEqual([])
    expect(skin?.manifest.road?.tiles?.straight).toBe('straight_ns.png')
    expect(skin?.manifest.role?.player).toBe('art/role/me.png')
    expect(skin?.name).toBe('基座')
  })

  it('三层链按「基座 → 中间 → 本包」的顺序合并', () => {
    const bytes = packZip({
      'base.json': JSON.stringify({ name: '基座', misc: { dice: { body: 'art/dice.png' } } }),
      'mid.json': JSON.stringify({ extends: 'base.json', window: { rules: { line: 'art/line.png' } } }),
      'art/dice.png': img(),
      'art/line.png': img(),
      'art/hero.png': img(),
      'manifest.json': JSON.stringify({ extends: 'mid.json', role: { player: 'art/hero.png' } }),
    })

    const { skin, issues } = readSkin(bytes)
    expect(issues).toEqual([])
    expect(skin?.manifest.misc?.dice?.body).toBe('art/dice.png')
    expect(skin?.manifest.window?.rules?.line).toBe('art/line.png')
    expect(skin?.manifest.role?.player).toBe('art/hero.png')
  })

  it('成环时截断并提示，已读到的照常合并', () => {
    const bytes = packZip({
      'a.json': JSON.stringify({ extends: 'b.json', name: 'A' }),
      'b.json': JSON.stringify({ extends: 'a.json', author: 'B' }),
      'manifest.json': JSON.stringify({ extends: 'a.json', description: '本包' }),
    })

    const { skin, issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-8'])
    expect(skin?.name).toBe('A')
    expect(skin?.author).toBe('B')
    expect(skin?.description).toBe('本包')
  })

  it('目标不存在时忽略继承，只按本包渲染', () => {
    const { skin, issues } = readSkin(manifestZip({ extends: 'nope.json', name: '本包' }))
    expect(codes(issues)).toEqual(['KP-8'])
    expect(skin?.name).toBe('本包')
  })

  it('extends 目标本身不是对象也算 KP-8', () => {
    const bytes = packZip({
      'base.json': JSON.stringify(['不是对象']),
      'manifest.json': JSON.stringify({ extends: 'base.json', name: '本包' }),
    })
    expect(codes(readSkin(bytes).issues)).toEqual(['KP-8'])
  })
})

describe('KP-10 已废除的 resource 键', () => {
  it('存在即提示，且不作为路径依据', () => {
    const bytes = minimalPp({ resource: 'resource/' })
    const { skin, issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-10'])
    // 素材仍按各字段自身给出的路径取用
    expect(skin && skinBytesOf(skin, 'art/road/straight_ns.png')).toBeDefined()
  })
})

describe('KP-9 主题键', () => {
  it('布局 token 与未知键名被忽略并提示', () => {
    const bytes = minimalPp({ theme: { [SKIN_LAYOUT_TOKENS[0]]: '999px', '--not-a-token': 'x' } })
    const { skin, issues } = readSkin(bytes)
    expect(codes(issues)).toEqual(['KP-9'])
    expect(issues[0].detail).toContain(SKIN_LAYOUT_TOKENS[0])
    expect(issues[0].detail).toContain('--not-a-token')
    // theme 原样留在 manifest 里，过滤发生在落地（`applySkinTheme`）时
    expect(Object.keys(skin?.manifest.theme ?? {})).toHaveLength(2)
  })

  it('白名单内的观感 token 不提示', () => {
    const bytes = minimalPp({ theme: { [SKIN_THEME_TOKENS[0]]: 'pink' } })
    expect(readSkin(bytes).issues).toEqual([])
  })
})
