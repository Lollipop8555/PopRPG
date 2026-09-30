/**
 * 「清单」校验里 **NPC / 对话** 那几条（§5.7）：K14 / K15 / K16 / K17 / K18 / K19，
 * 以及顺带扩到 NPC 的 K3（`npcs` / `dialog` / `give` 的引用完整性）。
 */

import { describe, expect, it } from 'vitest'

import type { BuildingDef, ItemDef, Library, MapNode, NpcDef, Project } from '../../types'
import { DEFAULT_RULES, emptyLibrary } from '../../types'
import { validateProject } from '../validate'
import { exportPmod } from '../../io/pmod'

const TALK: BuildingDef = { id: 'hut', name: '小屋', encounter: 'talk' } as BuildingDef
const TREASURE: BuildingDef = { id: 'chest', name: '宝箱', encounter: 'treasure' } as BuildingDef
const COIN: ItemDef = { id: 'coin', name: '铜币', kind: 'consumable' } as ItemDef

function npc(over: Partial<NpcDef> = {}): NpcDef {
  return { id: 'keeper', name: '守墓人', dialogs: { Mod1: [{ message: ['你好'] }] }, ...over } as NpcDef
}

function lib(over: Partial<Library> = {}): Library {
  return { ...emptyLibrary(), ...over }
}

function proj(nodes: MapNode[], over: Partial<Project> = {}): Project {
  return {
    name: '校验用',
    background: '',
    enabledIds: [],
    rules: DEFAULT_RULES,
    maps: [{ id: 'm1', name: '图一', start: [0, 0], end: [9, 0], nodes }],
    ...over,
  }
}

const keys = (issues: ReturnType<typeof validateProject>): string[] => issues.map((i) => i.key)

describe('K16 `dialog` 方案名悬空', () => {
  it('方案名不在候选 NPC 的 dialogs 里 → 标红，但**导出不剔除**（§8.3 设定 5）', () => {
    const library = lib({ buildings: [TALK], npcs: [npc()] })
    const project = proj([{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['keeper'], dialog: { mod: 'Mod9' } }])

    const issues = validateProject(library, project)
    const found = issues.filter((i) => i.key === 'K16')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('error')
    expect(found[0].cell).toEqual([1, 0])

    // 剔除会把它变成「留空 → 骰子抽一套」，语义正好相反 → 字段必须留在 .pmod 里
    const text = exportPmod(library, project).text
    expect(text).toContain('dialog:')
    expect(text).toContain('mod: Mod9')
  })

  it('方案名存在 → 不报', () => {
    const library = lib({ buildings: [TALK], npcs: [npc()] })
    const project = proj([{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['keeper'], dialog: { mod: 'Mod1' } }])
    expect(keys(validateProject(library, project))).not.toContain('K16')
  })

  it('写了 dialog 却没配 NPC → 也报（没人能接这个名字）', () => {
    const library = lib({ buildings: [TALK], npcs: [npc()] })
    const project = proj([{ x: 1, y: 0, type: 'building', ref: 'hut', dialog: { mod: 'Mod1' } }])
    expect(keys(validateProject(library, project))).toContain('K16')
  })
})

describe('K14 / K15 实例上的 NPC 配置', () => {
  it('`encounter: talk` 的实例没配 NPC → 标黄', () => {
    const issues = validateProject(lib({ buildings: [TALK] }), proj([{ x: 1, y: 0, type: 'building', ref: 'hut' }]))
    expect(keys(issues)).toContain('K14')
  })

  it('`talk` 的实例挂了 NPC → 不报', () => {
    const library = lib({ buildings: [TALK], npcs: [npc()] })
    const project = proj([{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['keeper'] }])
    expect(keys(validateProject(library, project))).not.toContain('K14')
  })

  it('空宝箱且没配 NPC → 标黄（K15）', () => {
    const issues = validateProject(
      lib({ buildings: [TREASURE] }),
      proj([{ x: 1, y: 0, type: 'building', ref: 'chest' }], { enabledIds: ['chest'] }),
    )
    expect(keys(issues)).toContain('K15')
  })

  it('空宝箱但配了 NPC → **合法配置**，一条都不报（NPC 就是内容物）', () => {
    const library = lib({ buildings: [TREASURE], npcs: [npc()] })
    const project = proj([{ x: 1, y: 0, type: 'building', ref: 'chest', npcs: ['keeper'] }], {
      enabledIds: ['chest'],
    })
    const found = validateProject(library, project)
    expect(keys(found)).not.toContain('K15')
    expect(keys(found)).not.toContain('K6')
  })
})

describe('K3 扩到 NPC 的引用完整性', () => {
  it('实例 `npcs` 指向不存在的 NPC → 标红', () => {
    const issues = validateProject(lib({ buildings: [TALK] }), proj([{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['ghost'] }]))
    const found = issues.filter((i) => i.key === 'K3')
    expect(found.some((i) => i.title.includes('不存在的 NPC'))).toBe(true)
  })

  it('NPC 的 `give` 指向没启用的道具 → 标红（导出剔除）', () => {
    const withGive = npc({
      dialogs: { Mod1: [{ message: ['拿着'], give: ['coin'] }] },
    })
    const nodes: MapNode[] = [{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['keeper'] }]

    const off = validateProject(lib({ buildings: [TALK], items: [COIN], npcs: [withGive] }), proj(nodes))
    expect(off.some((i) => i.key === 'K3' && i.title.includes('未启用'))).toBe(true)

    const on = validateProject(
      lib({ buildings: [TALK], items: [COIN], npcs: [withGive] }),
      proj(nodes, { enabledIds: ['coin'] }),
    )
    // 只管 `give` 这一条（`class_pool` 之类的空库告警与它无关）
    expect(on.filter((i) => i.key === 'K3' && i.title.includes('coin'))).toHaveLength(0)
  })

  it('没被任何实例点到的 NPC 不参与检查（它不在这一局里）', () => {
    const broken = npc({ dialogs: { Mod1: [] } })
    const issues = validateProject(lib({ buildings: [TALK], npcs: [broken] }), proj([{ x: 1, y: 0, type: 'building', ref: 'hut' }]))
    expect(keys(issues)).not.toContain('K18')
  })
})

describe('K18 / K19 对话树自身的问题', () => {
  const messy = npc({
    dialogs: {
      Mod1: [
        {
          message: ['根'],
          result: '根层不该有',
          dice: '1D6',
          items: [
            { result: 'A', message: ['a'], hit: '1-2' },
            { result: 'B', message: ['b'], hit: '2-3' },
            { result: 'C', message: ['c'], hit: '7-9' },
            { result: 'D', message: ['d'], hit: 'x' },
            { result: 'E', message: ['e'], hit: '5' },
          ],
        },
        { message: [], hit: '1-2' },
      ],
      Empty: [],
    },
  })
  const library = lib({ buildings: [TALK], npcs: [messy] })
  const project = proj([{ x: 1, y: 0, type: 'building', ref: 'hut', npcs: ['keeper'] }])
  const found = validateProject(library, project)
  const titles = found.filter((i) => i.key === 'K18' || i.key === 'K19').map((i) => i.title)

  it('根层 result / 空对话 / hit 无所属 → 标黄', () => {
    expect(titles.some((t) => t.includes('根节点写了 result'))).toBe(true)
    expect(titles.filter((t) => t.includes('点开就结束了'))).toHaveLength(2) // 空根节点 + 空方案
    expect(titles.some((t) => t.includes('带了 hit 却没有骰子'))).toBe(true)
  })

  it('覆盖不全 / 重叠 → 标黄（只提示）', () => {
    const miss = found.find((i) => i.key === 'K18' && i.title.includes('没有任何选项命中'))
    expect(miss?.title).toContain('4、6')
    expect(miss?.severity).toBe('warn')
    expect(found.some((i) => i.key === 'K18' && i.title.includes('点数 2 被重复命中'))).toBe(true)
  })

  it('越界 / 非法区间 → 标红（K19）', () => {
    const bad = found.filter((i) => i.key === 'K19')
    expect(bad).toHaveLength(2)
    expect(bad.every((i) => i.severity === 'error')).toBe(true)
    expect(bad.some((i) => i.title.includes('超出 1D6'))).toBe(true)
    expect(bad.some((i) => i.title.includes('不是合法区间'))).toBe(true)
    expect(bad.every((i) => i.dialogPath?.startsWith('Mod1'))).toBe(true)
  })
})

describe('K17 地图名重复', () => {
  it('两张同名地图 → 标黄，并挂上 mapId（图层行标黄用）', () => {
    const base = proj([{ x: 0, y: 0, type: 'start' }, { x: 9, y: 0, type: 'end' }])
    const project: Project = {
      ...base,
      maps: [
        { id: 'm1', name: '地穴', start: [0, 0], end: [9, 0], nodes: base.maps[0].nodes },
        { id: 'm2', name: '地穴', start: [0, 0], end: [9, 0], nodes: base.maps[0].nodes },
      ],
    }
    const found = validateProject(lib(), project).filter((i) => i.key === 'K17')
    expect(found).toHaveLength(2)
    expect(found.every((i) => i.mapId)).toBe(true)
    expect(found[0].severity).toBe('warn')
  })
})
