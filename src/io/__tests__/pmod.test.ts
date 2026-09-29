/** `.pmod` round-trip（A11 / §3.3）：导出 → 导入，启用集合 / 铺设 / 地图顺序 / 定义 / rules 全一致 */

import { describe, expect, it } from 'vitest'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { collectUsedComponents, exportPmod, parsePmod, placedIds, uniqueMapNames } from '../pmod'
import type { Project } from '../../types'

const library = presetLibrary()
const project = fixtureProject()

describe('collectUsedComponents', () => {
  it('只装本局用到的：启用 ∪ 铺设 ∪ 传递引用', () => {
    const { used, missing } = collectUsedComponents(library, project)
    expect(missing).toEqual([])
    expect(used.roads.length).toBe(library.roads.length)
    expect(used.skills.length).toBe(library.skills.length)
    expect(used.classes.length).toBe(library.classes.length)
  })

  it('没启用的东西不会跟着走', () => {
    const lean: Project = { ...project, enabledIds: ['goblin'] }
    const { used } = collectUsedComponents(library, lean)
    const ids = [...used.monsters, ...used.items, ...used.skills].map((c) => c.id)
    expect(ids).toContain('goblin')
    expect(ids).not.toContain('slime')
  })

  it('铺设的道路 / 建筑也算内容（地图件不需要启用）', () => {
    const placedOnly: Project = { ...project, enabledIds: [] }
    expect(placedIds(placedOnly).length).toBeGreaterThan(0)
    const { used } = collectUsedComponents(library, placedOnly)
    const roads = used.roads.map((r) => r.id)
    expect(roads).toContain('swamp')
    expect(roads).toContain('river')
  })
})

describe('round-trip', () => {
  it('导出 → 解析：地图顺序 / 节点 / 起终点 / 规则完全一致', () => {
    const { text } = exportPmod(library, project)
    const parsed = parsePmod(text)

    expect(parsed.name).toBe(project.name)
    expect(parsed.background).toBe(project.background)
    expect(parsed.maps.length).toBe(project.maps.length)
    expect(parsed.maps[0].nodes.length).toBe(project.maps[0].nodes.length)
    expect(parsed.maps[0].start).toEqual(project.maps[0].start)
    expect(parsed.maps[0].end).toEqual(project.maps[0].end)
    expect(parsed.rules).toEqual(project.rules)
    expect(parsed.warnings).toEqual([])
  })

  it('组件定义原样带出，不带来源字段（§3.2）', () => {
    const { text } = exportPmod(library, project)
    const parsed = parsePmod(text)
    const goblin = parsed.components.monsters.find((m) => m.id === 'goblin')
    expect(goblin?.stats.patk).toEqual([2, 4])
    expect(goblin?.attack_weights).toEqual({ basic_attack: 3, basic_magic: 1 })
    const serialized = JSON.stringify(goblin ?? {})
    expect(serialized).not.toContain('"source"')
    expect(serialized).not.toContain('"preset"')
  })

  it('文件头声明字符集：UTF-8 BOM + charset 注释（§3）', () => {
    const { text } = exportPmod(library, project)
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain('<!-- charset: utf-8 -->')
    // BOM 不影响解析
    expect(parsePmod(text).name).toBe(project.name)
    expect(parsePmod(text).warnings).toEqual([])
  })

  it('结构标题只用英文，且能往返（§3）', () => {
    const { text } = exportPmod(library, project)
    for (const heading of ['## Background', '## Components', '## Rules', '## Maps', '### Monsters', '### Backgrounds']) {
      expect(text).toContain(`${heading}\n`)
    }
    expect(text).not.toContain('## 设定')
    expect(text).not.toContain('### 技能')
  })

  it('结构标题不残留中文：每个 `##` / `###` 都命中英文标题表（地图名除外，§3）', () => {
    const CJK = /[\u4e00-\u9fff]/
    const sections = ['Background', 'Components', 'Rules', 'Maps']
    const groups = ['Monsters', 'Items', 'Buildings', 'Roads', 'Classes', 'Skills', 'NPCs', 'Backgrounds']
    const seen = { sections: [] as string[], groups: [] as string[] }
    let section = ''

    for (const line of exportPmod(library, project).text.split('\n')) {
      const m = /^(#{2,3})\s+(.*)$/.exec(line)
      if (!m) continue
      const title = m[2].trim()
      if (m[1].length === 2) {
        section = title
        seen.sections.push(title)
        expect(sections).toContain(title)
        expect(CJK.test(title)).toBe(false)
        // 只有地图名（`### <地图名>`）允许中文，它是内容不是结构
      } else if (section === 'Components') {
        seen.groups.push(title)
        expect(groups).toContain(title)
        expect(CJK.test(title)).toBe(false)
      }
    }

    expect(seen.sections).toEqual(sections)
    // 出现过的分组必须按 GROUP_ORDER 排（空分组不写），且首尾两个恒在
    expect(seen.groups).toEqual(groups.filter((g) => seen.groups.includes(g)))
    expect(seen.groups[0]).toBe('Monsters')
    expect(seen.groups.at(-1)).toBe('Backgrounds')
  })

  it('旧中文标题降级兼容：`## 设定` / `### 技能` 仍能读出来（向后兼容）', () => {
    const legacy = [
      '# 老档',
      '',
      '## 设定',
      '',
      '### 技能',
      '```yaml',
      '- id: basic_attack',
      '  name: 普通攻击',
      '  dim: patk',
      '  target: opponent',
      '  vs: auto',
      '  bonus: 0',
      '  apply: hp',
      '  cost: {}',
      '```',
      '',
    ].join('\n')
    const parsed = parsePmod(legacy)
    expect(parsed.components.skills.map((s) => s.id)).toEqual(['basic_attack'])
    expect(parsed.warnings.join()).not.toContain('未知分组')
  })

  it('旧文件缺 rules / 残留 diceConfig → 使用 DEFAULT_RULES 补齐并提示（§0.6 / A7）', () => {
    const legacy = `# 老档\n\n## 背景\n\n一段旧文字\n\n## 地图\n### 老图\n\`\`\`yaml\nnodes:\n  - { x: 0, y: 0, type: start }\n\`\`\`\n`
    const parsed = parsePmod(legacy)
    expect(parsed.rules.move.dice).toBe('1D6')
    expect(parsed.warnings.join()).toContain('Rules')

    const withLegacyDice = `# 老档\n\n## 规则配置\n\`\`\`yaml\ndiceConfig:\n  default: 1D6\n\`\`\`\n`
    const parsed2 = parsePmod(withLegacyDice)
    expect(parsed2.warnings.join()).toContain('diceConfig')
  })
})

describe('NPC 与对话（§4.9 / §3.3）', () => {
  it('NPC 的入包条件＝被建筑实例的 `npcs` 引用（不走 enabledIds）', () => {
    const lean: Project = { ...project, enabledIds: ['red_potion', 'blue_potion'] }
    const { used, missing } = collectUsedComponents(library, lean)

    expect(used.npcs.map((n) => n.id).sort()).toEqual(['grave_keeper', 'lost_child'])
    // 对话树 `give` 的道具沿引用进包（已启用 → 不算悬空）
    expect(used.items.map((i) => i.id)).toContain('red_potion')
    expect(used.items.map((i) => i.id)).toContain('blue_potion')
    expect(missing).not.toContain('grave_keeper')
    expect(missing).not.toContain('red_potion')
  })

  it('没被任何建筑实例点到、也没启用的 NPC 不跟着走', () => {
    const noNpc: Project = {
      ...project,
      enabledIds: [],
      maps: [{ ...project.maps[0], nodes: project.maps[0].nodes.map(({ npcs, dialog, ...rest }) => rest) }],
    }
    const { used } = collectUsedComponents(library, noNpc)
    expect(used.npcs).toEqual([])
  })

  it('`give` 指向没启用的道具 → 悬空（导出剔除并提示，§5.7）', () => {
    const lean: Project = { ...project, enabledIds: [] }
    const { used, missing } = collectUsedComponents(library, lean)
    expect(used.npcs.length).toBe(2)
    expect(missing).toContain('red_potion')
  })

  it('节点 `npcs` / `dialog` 与 `### NPCs` 段往返无损', () => {
    const { text } = exportPmod(library, project)
    expect(text).toContain('### NPCs\n')

    const parsed = parsePmod(text)
    expect(parsed.warnings).toEqual([])

    const chest = parsed.maps[0].nodes.find((n) => n.x === 2 && n.y === 0)
    expect(chest?.npcs).toEqual(['grave_keeper'])
    expect(chest?.dialog).toBeUndefined()

    const door = parsed.maps[0].nodes.find((n) => n.x === 7 && n.y === 1)
    expect(door?.npcs).toEqual(['lost_child'])
    expect(door?.dialog).toBe('Mod1')

    // 对话树原样带出：掷骰层 / 命中区间 / 给道具（同种两次＝两份）
    const keeper = parsed.components.npcs.find((n) => n.id === 'grave_keeper')
    const mod1 = keeper?.dialogs.Mod1 ?? []
    expect(mod1[0].dice).toBe('1D6')
    expect(mod1[0].items?.map((i) => i.hit)).toEqual(['1-2', '3-4', '5-6'])
    expect(mod1[0].items?.[2].give).toEqual(['red_potion', 'red_potion', 'blue_potion'])
    expect(Object.keys(keeper?.dialogs ?? {})).toEqual(['Mod1', 'Mod2'])
  })

  it('对话骰 `rules.talk.dice` 往返（§4.8.6 第 14 项）', () => {
    const withTalk: Project = { ...project, rules: { ...project.rules, talk: { dice: '1D8' } } }
    const parsed = parsePmod(exportPmod(library, withTalk).text)
    expect(parsed.rules.talk.dice).toBe('1D8')
  })

  it('导入容错：`type` / 根层 `result` / 无所属的 `hit` 一律忽略并提示，导出不再出现（§4.9.2）', () => {
    const legacyNpc = [
      '# 老档',
      '',
      '## Components',
      '',
      '### NPCs',
      '```yaml',
      '- id: legacy_npc',
      '  name: 老 NPC',
      '  dialogs:',
      '    Mod1:',
      '      - type: chat',
      '        result: 根层的答复',
      '        message: [你好]',
      '        items:',
      '          - type: prop',
      '            hit: 1-2',
      '            message: [嗯]',
      '```',
      '',
    ].join('\n')
    const parsed = parsePmod(legacyNpc)
    const warnings = parsed.warnings.join('\n')
    expect(warnings).toContain('`type` 字段已忽略')
    expect(warnings).toContain('根层的 `result` 已忽略')
    expect(warnings).toContain('父层没有 `dice`')

    const mod1 = parsed.components.npcs[0].dialogs.Mod1
    expect(mod1[0].result).toBeUndefined()
    expect('type' in mod1[0]).toBe(false)
    expect(mod1[0].items?.[0].hit).toBeUndefined()
    expect(mod1[0].items?.[0].result).toBeUndefined()
    expect(mod1[0].items?.[0].message).toEqual(['嗯'])

    // 导入 → 再导出：旧字段已剔干净，不会再写出去
    const lib = presetLibrary()
    lib.npcs = parsed.components.npcs
    const out = exportPmod(lib, {
      ...project,
      enabledIds: [],
      maps: [
        {
          ...project.maps[0],
          nodes: [{ x: 0, y: 0, type: 'building', ref: 'chest_room', npcs: ['legacy_npc'] }],
        },
      ],
    }).text
    expect(out).toContain('### NPCs\n')
    expect(out).toContain('id: legacy_npc')
    expect(out).not.toContain('type: chat')
    expect(out).not.toContain('type: prop')
    expect(out).not.toContain('根层的答复')
  })

  it('NPC 挂在非建筑节点上 → 剔除并提示（§4.9.3，手改文件）', () => {
    const wrong = [
      '# 手改的一局',
      '',
      '## Maps',
      '',
      '### 测试地穴',
      '```yaml',
      'nodes:',
      '  - { x: 0, y: 0, type: road, ref: path, npcs: [grave_keeper], dialog: Mod1 }',
      '```',
      '',
    ].join('\n')
    const parsed = parsePmod(wrong)
    expect(parsed.warnings.join()).toContain('不该带 NPC')
    expect(parsed.maps[0].nodes[0].npcs).toBeUndefined()
    expect(parsed.maps[0].nodes[0].dialog).toBeUndefined()
  })
})

describe('地图名去重（§8.3 设定 6：导出时对重名地图自动加后缀）', () => {
  it('第一张保持原名，第 2 张起追加 (2) / (3)…，后缀名被占用就顺延', () => {
    const maps = ['地图 1', '地图 1', '地图 1', '地图 1 (2)', '地图 2'].map((name, i) => ({
      ...project.maps[0],
      id: `m_dup${i}`,
      name,
    }))
    const { names, renamed } = uniqueMapNames(maps)

    expect(names).toEqual(['地图 1', '地图 1 (2)', '地图 1 (3)', '地图 1 (2) (2)', '地图 2'])
    expect(renamed).toEqual([
      { from: '地图 1', to: '地图 1 (2)' },
      { from: '地图 1', to: '地图 1 (3)' },
      { from: '地图 1 (2)', to: '地图 1 (2) (2)' },
    ])
  })

  it('导出的文件里地图名一定唯一，且往返无损', () => {
    const dup: Project = {
      ...project,
      maps: ['地图 1', '地图 1', '地图 1'].map((name, i) => ({
        ...project.maps[0],
        id: `m_dup${i}`,
        name,
      })),
    }
    const { text, renamed } = exportPmod(library, dup)

    expect(text).toContain('### 地图 1\n')
    expect(text).toContain('### 地图 1 (2)\n')
    expect(text).toContain('### 地图 1 (3)\n')
    expect(renamed.length).toBe(2)

    const parsed = parsePmod(text)
    expect(parsed.maps.map((m) => m.name)).toEqual(['地图 1', '地图 1 (2)', '地图 1 (3)'])
    expect(parsed.warnings).toEqual([])
  })

  it('没有重名时一个名字都不动', () => {
    const { text, renamed } = exportPmod(library, project)
    expect(renamed).toEqual([])
    for (const map of project.maps) expect(text).toContain(`### ${map.name}\n`)
  })
})
