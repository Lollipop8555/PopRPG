/**
 * `.pmod` 读写（§3）—— 单文件 Markdown：散文背景 + ```yaml 围栏的结构化数据。
 *
 * **自包含规则（§3.3）**：只装这一局真正用到的组件（启用 ∪ 铺设 ∪ 传递引用），
 * 组件定义**原样带出、没有来源字段**；导入时这些定义**并入本地组件库**。
 */

import { dump, load } from 'js-yaml'
import {
  DEFAULT_RULES,
  type AnyComponent,
  type ComponentKind,
  type GameMap,
  type Library,
  type LibraryKey,
  type Project,
  type Rules,
} from '../types'
import { emptyLibrary } from '../types'
import { referenceIdsOf } from '../lib/refs'
import { newMapId } from '../lib/ids'

const ARRAY_OF_KIND: Record<ComponentKind, LibraryKey> = {
  road: 'roads',
  building: 'buildings',
  item: 'items',
  monster: 'monsters',
  class: 'classes',
  skill: 'skills',
  background: 'backgrounds',
}

const KIND_OF_ARRAY: Record<LibraryKey, ComponentKind> = {
  roads: 'road',
  buildings: 'building',
  items: 'item',
  monsters: 'monster',
  classes: 'class',
  skills: 'skill',
  backgrounds: 'background',
}

/* ------------------------------------------------------------------ */
/* ① 本局用到的组件闭包（§3.3）                                        */
/* ------------------------------------------------------------------ */

/** 地图上的铺设（§4.0：地图件铺到格才算内容） */
export function placedIds(project: Project): string[] {
  const out = new Set<string>()
  for (const map of project.maps) for (const node of map.nodes) if (node.ref) out.add(node.ref)
  return [...out]
}

/**
 * 内容集合 = 启用 ∪ 铺设，**再沿引用往下传递**。
 * 指向不存在组件的悬空引用会被剔除并记进 missing（导出时自动剔除，§5.7）。
 */
export function collectUsedComponents(
  library: Library,
  project: Project,
): { used: Library; missing: string[] } {
  const index = new Map<string, { kind: ComponentKind; def: AnyComponent }>()
  for (const key of Object.keys(KIND_OF_ARRAY) as LibraryKey[]) {
    for (const def of library[key] as AnyComponent[]) index.set(def.id, { kind: KIND_OF_ARRAY[key], def })
  }

  const enabled = new Set(project.enabledIds)
  const placed = new Set(placedIds(project))
  const out = emptyLibrary()
  const seen = new Set<string>()
  const missing = new Set<string>()
  const queue: string[] = [...enabled, ...placed]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const found = index.get(id)
    if (!found || !(enabled.has(id) || placed.has(id))) {
      missing.add(id)
      continue
    }
    ;(out as unknown as Record<string, AnyComponent[]>)[ARRAY_OF_KIND[found.kind]].push(found.def)
    for (const next of referenceIdsOf(found.kind, found.def)) queue.push(next)
  }
  return { used: out, missing: [...missing] }
}

/** 背景始终算内容（§3.3）：没启用任何背景时至少带一条默认底色 */
function ensureBackground(library: Library, used: Library): void {
  if (used.backgrounds.length === 0 && library.backgrounds.length > 0) {
    used.backgrounds.push(library.backgrounds[0])
  }
}

/* ------------------------------------------------------------------ */
/* ② 序列化                                                            */
/* ------------------------------------------------------------------ */

function yamlBlock(value: unknown): string {
  const text = typeof value === 'string' ? value : dump(value, { lineWidth: 9999, noRefs: true })
  return '```yaml\n' + (text.endsWith('\n') ? text : `${text}\n`) + '```\n'
}

function serializeNodes(map: GameMap): unknown {
  return {
    start: map.start,
    end: map.end,
    nodes: map.nodes.map((n) => {
      const row: Record<string, unknown> = { x: n.x, y: n.y, type: n.type }
      if (n.ref) row.ref = n.ref
      if ((n.w ?? 1) > 1) row.w = n.w
      if ((n.h ?? 1) > 1) row.h = n.h
      return row
    }),
  }
}

export function exportPmod(library: Library, project: Project): { text: string; missing: string[] } {
  const { used, missing } = collectUsedComponents(library, project)
  ensureBackground(library, used)

  const parts: string[] = [`# ${project.name}\n\n`]

  // 版本写在 HTML 注释里：不混入 yaml，也不影响人读（§7.3 迁移钩子）
  parts.push(`<!-- poprpg-version: ${PMOD_VERSION} -->\n\n`)

  parts.push('## 背景\n\n')
  parts.push(project.background.trim() ? `${project.background.trim()}\n\n` : '（还没有写背景）\n\n')

  parts.push('## 设定\n\n')
  const groups: { title: string; list: AnyComponent[] }[] = [
    { title: '怪物', list: used.monsters },
    { title: '道具', list: used.items },
    { title: '建筑', list: used.buildings },
    { title: '道路', list: used.roads },
    { title: '职业', list: used.classes },
    { title: '技能', list: used.skills },
  ]
  for (const group of groups) {
    if (group.list.length === 0) continue
    parts.push(`### ${group.title}\n\n`)
    parts.push(yamlBlock(group.list))
    parts.push('\n')
  }
  parts.push('### 背景\n\n')
  parts.push(yamlBlock(used.backgrounds))
  parts.push('\n')

  parts.push('## 规则配置\n\n')
  parts.push(yamlBlock(project.rules))
  parts.push('\n')

  parts.push('## 地图\n\n')
  for (const map of project.maps) {
    parts.push(`### ${map.name}\n\n`)
    parts.push(yamlBlock(serializeNodes(map)))
    parts.push('\n')
  }

  return { text: parts.join(''), missing }
}

/* ------------------------------------------------------------------ */
/* ③ 反序列化                                                          */
/* ------------------------------------------------------------------ */

/** `.pmod` 格式版本（§7.3 迁移钩子）：没写 = 初版 1 */
export const PMOD_VERSION = 1

export interface ParsedPmod {
  version: number
  name: string
  background: string
  rules: Rules
  maps: GameMap[]
  components: Library
  warnings: string[]
}

const GROUP_TO_KEY: Record<string, LibraryKey> = {
  怪物: 'monsters',
  道具: 'items',
  建筑: 'buildings',
  道路: 'roads',
  职业: 'classes',
  技能: 'skills',
  背景: 'backgrounds',
}

function pullYaml(lines: string[], startIndex: number, endIndex: number): { value?: string; until: number } {
  let i = startIndex
  while (i < endIndex && !/^```yaml/.test(lines[i].trim())) i++
  if (i >= endIndex) return { until: endIndex }
  i++
  const body: string[] = []
  while (i < endIndex && !/^```/.test(lines[i].trim())) body.push(lines[i++])
  return { value: body.join('\n'), until: i + 1 }
}

function safeLoad<T>(text: string | undefined, fallback: T, warn: (msg: string) => void): T {
  if (!text || !text.trim()) return fallback
  try {
    return (load(text) as T) ?? fallback
  } catch (err) {
    warn(`有一段 YAML 解析失败，已跳过：${(err as Error).message}`)
    return fallback
  }
}

/** 缺 rules / 残留 diceConfig 的老文件 → DEFAULT_RULES 兜底（§0.6 / A7） */
function mergeRules(loaded: Partial<Rules> | null, warn: (msg: string) => void): Rules {
  if (!loaded || typeof loaded !== 'object') {
    warn('这个文件没有「规则配置」段，已用默认规则补齐')
    return structuredClone(DEFAULT_RULES)
  }
  if ('diceConfig' in (loaded as Record<string, unknown>)) warn('发现旧字段 `diceConfig`（已废弃），已忽略')

  const rules = structuredClone(DEFAULT_RULES)
  if (loaded.move?.dice) rules.move.dice = loaded.move.dice
  if (loaded.combat?.stat_dice) rules.combat.stat_dice = loaded.combat.stat_dice
  if (loaded.combat?.pick_dice) rules.combat.pick_dice = loaded.combat.pick_dice
  if (loaded.combat?.atk_roll) rules.combat.atk_roll = loaded.combat.atk_roll
  if (loaded.combat?.def_roll) rules.combat.def_roll = loaded.combat.def_roll
  if (loaded.treasure) rules.treasure = loaded.treasure
  if (loaded.loot) rules.loot = loaded.loot
  if (typeof loaded.state?.max_duration === 'number') rules.state.max_duration = loaded.state.max_duration
  if (loaded.shop?.price) rules.shop.price = loaded.shop.price
  if (loaded.event?.dice) rules.event.dice = loaded.event.dice
  if (Array.isArray(loaded.class_pool)) rules.class_pool = loaded.class_pool
  return rules
}

export function parsePmod(text: string): ParsedPmod {
  const warnings: string[] = []
  const warn = (msg: string) => warnings.push(msg)
  const versionMatch = /<!--\s*poprpg-version:\s*(\d+)\s*-->/.exec(text)
  const version = versionMatch ? Number(versionMatch[1]) : 1
  if (version > PMOD_VERSION) warn(`这个 .pmod 是 v${version}，当前应用只认到 v${PMOD_VERSION}（可能有字段读不出来）`)
  const lines = text.split(/\r?\n/)
  const headings = lines.map((line) => {
    const m = /^(#{1,3})\s+(.*)$/.exec(line)
    return { level: m ? m[1].length : 0, title: m ? m[2].trim() : '' }
  })

  const sectionEnd = (level: number, from: number): number => {
    for (let i = from + 1; i < lines.length; i++) {
      if (headings[i].level > 0 && headings[i].level <= level) return i
    }
    return lines.length
  }

  let name = '导入的一局'
  let background = ''
  let rules: Rules = DEFAULT_RULES
  let sawRules = false
  const maps: GameMap[] = []
  const components = emptyLibrary()
  let section = ''

  for (let i = 0; i < lines.length; i++) {
    const h = headings[i]
    if (h.level === 1) {
      if (h.title) name = h.title
      continue
    }
    if (h.level === 2) {
      section = h.title
      if (section === '背景') {
        const end = sectionEnd(2, i)
        background = lines.slice(i + 1, end).join('\n').trim()
      }
      if (section === '规则配置') {
        const end = sectionEnd(2, i)
        const { value } = pullYaml(lines, i + 1, end)
        if (value) {
          rules = mergeRules(safeLoad<Partial<Rules> | null>(value, null, warn), warn)
          sawRules = true
        }
      }
      continue
    }
    if (h.level === 3) {
      const end = sectionEnd(3, i)
      if (section === '设定') {
        const key = GROUP_TO_KEY[h.title]
        if (key) {
          const { value } = pullYaml(lines, i + 1, end)
          const list = safeLoad<AnyComponent[]>(value, [], warn)
          if (Array.isArray(list)) {
            ;(components as unknown as Record<string, AnyComponent[]>)[key].push(
              ...list.filter((c): c is AnyComponent => !!c && typeof c.id === 'string'),
            )
          }
        } else {
          warn(`「设定」里出现了未知分组：${h.title}（已忽略）`)
        }
      } else if (section === '地图') {
        const { value } = pullYaml(lines, i + 1, end)
        const loaded = safeLoad<{ start?: [number, number]; end?: [number, number]; nodes?: GameMap['nodes'] } | null>(
          value,
          null,
          warn,
        )
        if (loaded) {
          maps.push({
            id: newMapId(),
            name: h.title,
            start: loaded.start,
            end: loaded.end,
            nodes: (loaded.nodes ?? [])
              .filter((n) => typeof n?.x === 'number' && typeof n?.y === 'number')
              .map((n) => ({
                x: n.x,
                y: n.y,
                type: n.type,
                ref: n.ref,
                w: n.w,
                h: n.h,
              })),
          })
        }
      }
    }
  }

  if (!sawRules) warn('这个文件没有「规则配置」段，已用默认规则补齐')
  if (maps.length === 0) warn('没有解析到任何地图')

  return { version, name, background, rules, maps, components, warnings }
}
