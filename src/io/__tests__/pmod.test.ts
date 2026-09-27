/** `.pmod` round-trip（A11 / §3.3）：导出 → 导入，启用集合 / 铺设 / 地图顺序 / 定义 / rules 全一致 */

import { describe, expect, it } from 'vitest'
import { presetLibrary } from '../../presets'
import { sampleProject } from '../../lib/sample'
import { collectUsedComponents, exportPmod, parsePmod, placedIds } from '../pmod'
import type { Project } from '../../types'

const library = presetLibrary()
const project = sampleProject()

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
    expect(parsed.background).toContain('误入地穴')
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

  it('旧文件缺 rules / 残留 diceConfig → 使用 DEFAULT_RULES 补齐并提示（§0.6 / A7）', () => {
    const legacy = `# 老档\n\n## 背景\n\n一段旧文字\n\n## 地图\n### 老图\n\`\`\`yaml\nnodes:\n  - { x: 0, y: 0, type: start }\n\`\`\`\n`
    const parsed = parsePmod(legacy)
    expect(parsed.rules.move.dice).toBe('1D6')
    expect(parsed.warnings.join()).toContain('规则配置')

    const withLegacyDice = `# 老档\n\n## 规则配置\n\`\`\`yaml\ndiceConfig:\n  default: 1D6\n\`\`\`\n`
    const parsed2 = parsePmod(withLegacyDice)
    expect(parsed2.warnings.join()).toContain('diceConfig')
  })
})
