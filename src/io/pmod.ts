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
  type NpcDef,
  type Project,
  type Rules,
} from '../types'
import { emptyLibrary } from '../types'
import { npcIdsOf, referenceIdsOf } from '../lib/refs'
import { normalizeNpc, normalizeNodeDialog } from '../lib/dialog'
import { newMapId } from '../lib/ids'

const ARRAY_OF_KIND: Record<ComponentKind, LibraryKey> = {
  road: 'roads',
  building: 'buildings',
  item: 'items',
  monster: 'monsters',
  class: 'classes',
  skill: 'skills',
  npc: 'npcs',
  background: 'backgrounds',
}

const KIND_OF_ARRAY: Record<LibraryKey, ComponentKind> = {
  roads: 'road',
  buildings: 'building',
  items: 'item',
  monsters: 'monster',
  classes: 'class',
  skills: 'skill',
  npcs: 'npc',
  backgrounds: 'background',
}

/* ------------------------------------------------------------------ */
/* ⓪ 结构标题与字符集（§3）                                            */
/* ------------------------------------------------------------------ */

/**
 * **结构标题一律用英文**（`## Background` / `### Skills` …）。
 * 理由：`.pmod` 是纯文本，浏览器/编辑器有时会按 GBK 解码 —— 中文标题一旦乱码就**再也匹配不上**，
 * 整段组件会被静默丢弃；英文标题不受编码影响。
 *
 * 导入时**先按英文标题匹配，未命中再降级中文** —— 旧文件照旧能读（向后兼容）。
 */
const SECTION_TITLE = {
  background: 'Background',
  components: 'Components',
  rules: 'Rules',
  maps: 'Maps',
} as const

type SectionId = keyof typeof SECTION_TITLE

/** 把「id → 导出标题」翻成「标题 → id」：英文标题**只有一份来源**，导出与解析不会各认一套 */
function invertTitles<T extends string>(table: Record<string, string>): Record<string, T> {
  return Object.fromEntries(Object.entries(table).map(([id, title]) => [title, id])) as Record<string, T>
}

const SECTION_ALIASES: Record<string, SectionId> = {
  ...invertTitles<SectionId>(SECTION_TITLE),
  // —— 向后兼容（旧文件的中文标题；**只读不写**，导出永不产生）——
  背景: 'background',
  设定: 'components',
  规则配置: 'rules',
  地图: 'maps',
}

/** 分组标题（导出用；顺序见 `GROUP_ORDER`，§3.1） */
const GROUP_TITLE: Record<LibraryKey, string> = {
  monsters: 'Monsters',
  items: 'Items',
  buildings: 'Buildings',
  roads: 'Roads',
  classes: 'Classes',
  skills: 'Skills',
  npcs: 'NPCs',
  backgrounds: 'Backgrounds',
}

/** 导出时的分组书写顺序（`Backgrounds` 恒在最后，单独一段） */
const GROUP_ORDER: LibraryKey[] = ['monsters', 'items', 'buildings', 'roads', 'classes', 'skills', 'npcs']

const GROUP_ALIASES: Record<string, LibraryKey> = {
  ...invertTitles<LibraryKey>(GROUP_TITLE),
  // —— 向后兼容（旧文件的中文标题；**只读不写**，导出永不产生）——
  怪物: 'monsters',
  道具: 'items',
  建筑: 'buildings',
  道路: 'roads',
  职业: 'classes',
  技能: 'skills',
  NPC: 'npcs',
  背景: 'backgrounds',
}

/** 查标题：**先精确、再忽略大小写**（`NPCs` / `npcs` / `Npc` 都认） */
function lookupTitle<T>(table: Record<string, T>, title: string): T | undefined {
  if (title in table) return table[title]
  const lower = title.toLowerCase()
  for (const [key, value] of Object.entries(table)) if (key.toLowerCase() === lower) return value
  return undefined
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
  // NPC 不走 `enabledIds`（§4.9.3）：**被建筑实例点到**才算这一局的内容
  const talkedTo = new Set(npcIdsOf(project))
  const out = emptyLibrary()
  const seen = new Set<string>()
  const missing = new Set<string>()
  const queue: string[] = [...enabled, ...placed, ...talkedTo]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const found = index.get(id)
    if (!found || !(enabled.has(id) || placed.has(id) || talkedTo.has(id))) {
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
      // NPC 只挂在**建筑实例**上（§4.9.3）：同一栋建筑铺到多格可以遇到不同的人
      if (n.type === 'building') {
        if (n.npcs && n.npcs.length > 0) row.npcs = n.npcs
        // `dialog` 是对象 `{ mod, retalk }`：两边都空就不写；`retalk` 只在**关闭**时写出（缺省 ＝ 允许）
        const dialog = normalizeNodeDialog(n.dialog)
        if (dialog) row.dialog = dialog
      }
      return row
    }),
  }
}

/**
 * **地图名去重**（§8.3 设定 6）：地图名是**建筑实例 key**（`<地图名>#<ref>@<锚点>`）的一部分，
 * 两张地图同名会让对话抽取结果 / `give` 交付终态在 `.psave` 里撞车。
 *
 * 规矩：**第一张保持原名**，第 2 张起追加 ` (2)` / ` (3)`…（若后缀名也被占用就继续顺延）。
 * 编辑器里**不改名、只标黄提示**——去重发生在**离开构建页的两个出口**：导出文件、直接开局。
 */
export function uniqueMapNames(maps: GameMap[]): {
  names: string[]
  renamed: { from: string; to: string }[]
} {
  const taken = new Set<string>()
  const names: string[] = []
  const renamed: { from: string; to: string }[] = []

  for (const map of maps) {
    let name = map.name
    if (taken.has(name)) {
      let n = 2
      while (taken.has(`${name} (${n})`)) n += 1
      const fixed = `${name} (${n})`
      renamed.push({ from: map.name, to: fixed })
      name = fixed
    }
    taken.add(name)
    names.push(name)
  }

  return { names, renamed }
}

export function exportPmod(
  library: Library,
  project: Project,
): { text: string; missing: string[]; renamed: { from: string; to: string }[] } {
  const { used, missing } = collectUsedComponents(library, project)
  ensureBackground(library, used)

  const parts: string[] = []

  // ① 文件头：**UTF-8 BOM** ＋ 显式字符集声明 —— 让浏览器按 UTF-8 解码，不会被 GBK 抢走（§3）
  parts.push('\uFEFF')
  parts.push('<!-- charset: utf-8 -->\n')
  // 版本写在 HTML 注释里：不混入 yaml，也不影响人读（§7.3 迁移钩子）
  parts.push(`<!-- poprpg-version: ${PMOD_VERSION} -->\n\n`)

  parts.push(`# ${project.name}\n\n`)

  parts.push(`## ${SECTION_TITLE.background}\n\n`)
  parts.push(project.background.trim() ? `${project.background.trim()}\n\n` : '（还没有写背景）\n\n')

  parts.push(`## ${SECTION_TITLE.components}\n\n`)
  for (const key of GROUP_ORDER) {
    const list = used[key] as AnyComponent[]
    if (list.length === 0) continue
    parts.push(`### ${GROUP_TITLE[key]}\n\n`)
    parts.push(yamlBlock(list))
    parts.push('\n')
  }
  parts.push(`### ${GROUP_TITLE.backgrounds}\n\n`)
  parts.push(yamlBlock(used.backgrounds))
  parts.push('\n')

  parts.push(`## ${SECTION_TITLE.rules}\n\n`)
  parts.push(yamlBlock(project.rules))
  parts.push('\n')

  parts.push(`## ${SECTION_TITLE.maps}\n\n`)
  const { names, renamed } = uniqueMapNames(project.maps)
  project.maps.forEach((map, i) => {
    parts.push(`### ${names[i]}\n\n`)
    parts.push(yamlBlock(serializeNodes(map)))
    parts.push('\n')
  })

  return { text: parts.join(''), missing, renamed }
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
    warn(`这个文件没有「${SECTION_TITLE.rules}」段，已用默认规则补齐`)
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
  if (loaded.talk?.dice) rules.talk.dice = loaded.talk.dice
  if (Array.isArray(loaded.class_pool)) rules.class_pool = loaded.class_pool
  return rules
}

export function parsePmod(raw: string): ParsedPmod {
  // 去掉导出时写在文件头的 BOM（`\uFEFF`），否则首行标题会匹配不上
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
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
      // 英文标题优先；未命中降级中文（旧文件，§3）
      section = lookupTitle(SECTION_ALIASES, h.title) ?? ''
      if (section === 'background') {
        const end = sectionEnd(2, i)
        background = lines.slice(i + 1, end).join('\n').trim()
      }
      if (section === 'rules') {
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
      if (section === 'components') {
        const key = lookupTitle(GROUP_ALIASES, h.title)
        if (key) {
          const { value } = pullYaml(lines, i + 1, end)
          const list = safeLoad<AnyComponent[]>(value, [], warn)
          if (Array.isArray(list)) {
            const clean = list.filter((c): c is AnyComponent => !!c && typeof c.id === 'string')
            const ready =
              key === 'npcs'
                ? clean.map((def) => {
                    // §4.9.2 导入容错：旧 `type` / 根层 `result` / 父层没 `dice` 的 `hit` 一律忽略并提示
                    const { npc, notes } = normalizeNpc(def as NpcDef)
                    for (const note of notes) {
                      const where = note.path ? `对话方案「${note.path}」` : '对话树'
                      warn(`NPC「${npc.name || npc.id}」的${where}：${note.text}`)
                    }
                    return npc
                  })
                : clean
            ;(components as unknown as Record<string, AnyComponent[]>)[key].push(...ready)
          }
        } else {
          warn(`「${SECTION_TITLE.components}」里出现了未知分组：${h.title}（已忽略）`)
        }
      } else if (section === 'maps') {
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
              .map((n) => {
                // road / start / end 恒为 1×1：写了 w / h 也归一为 1（§4.9.3 / §8.3 设定 6）
                if (n.type !== 'building' && ((n.w ?? 1) !== 1 || (n.h ?? 1) !== 1)) {
                  warn(`(${n.x}, ${n.y}) 的 ${n.type} 不该有大小，已按 1×1 处理`)
                  return { x: n.x, y: n.y, type: n.type, ref: n.ref }
                }
                // NPC 只挂在建筑实例上（§4.9.3）：挂在别处的一律剔除并提示
                // `dialog` 是对象 `{ mod, retalk }`；旧包写的是**裸方案名**，在这里升级成对象
                let npcs = n.npcs
                let dialog = normalizeNodeDialog(n.dialog)
                if (n.type !== 'building' && ((n.npcs?.length ?? 0) > 0 || dialog)) {
                  warn(`(${n.x}, ${n.y}) 的 ${n.type} 不该带 NPC —— NPC 只挂在建筑实例上，已忽略`)
                  npcs = undefined
                  dialog = undefined
                }
                const size = (v: number | undefined) => Math.max(1, Math.trunc(v ?? 1))
                return {
                  x: n.x,
                  y: n.y,
                  type: n.type,
                  ref: n.ref,
                  w: n.type === 'building' ? size(n.w) : undefined,
                  h: n.type === 'building' ? size(n.h) : undefined,
                  npcs: npcs && npcs.length > 0 ? npcs.map((id) => String(id)) : undefined,
                  dialog,
                }
              }),
          })
        }
      }
    }
  }

  if (!sawRules) warn(`这个文件没有「${SECTION_TITLE.rules}」段，已用默认规则补齐`)
  if (maps.length === 0) warn('没有解析到任何地图')

  return { version, name, background, rules, maps, components, warnings }
}
