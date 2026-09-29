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
