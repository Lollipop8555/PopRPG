/**
 * 导入 / 导出 / 示例局（A11 · §0.6 · §5.7）
 *
 * 导入的规矩：**定义并入本地组件库**（同名但内容不同 → 另生成新 id 并提示，原来的引用一起搬家），
 * 再把「启用 + 铺设」还原到项目。
 */

import type { AnyComponent, GameMap, Library, LibraryKey, Project } from '../types'
import { LIBRARY_KEY_TO_KIND, LIBRARY_KEYS, emptyLibrary } from '../types'
import { exportPmod, parsePmod } from '../io/pmod'
import { downloadText, pickTextFile } from '../io/download'
import { librarySnapshot, useLibraryStore } from '../store/library'
import { newProject, projectSnapshot, useProjectStore } from '../store/project'
import { commit } from '../store/commit'
import { useUiStore } from '../store/ui'
import { newComponentId, newMapId } from '../lib/ids'
import { sampleProject } from '../lib/sample'

const notify = (text: string, tone: 'info' | 'warn' | 'error' = 'info') => useUiStore.getState().notify(text, tone)

function mapsMissing(project: Project): { noStart: string[]; noEnd: string[] } {
  const noStart = project.maps.filter((m) => !m.nodes.some((n) => n.type === 'start')).map((m) => m.name)
  const noEnd = project.maps.filter((m) => !m.nodes.some((n) => n.type === 'end')).map((m) => m.name)
  return { noStart, noEnd }
}

/* ------------------------------------------------------------------ */
/* 导出                                                                */
/* ------------------------------------------------------------------ */

export function exportCurrentPmod(): void {
  const library = librarySnapshot()
  const project = projectSnapshot()
  const { text, missing } = exportPmod(library, project)
  downloadText(`${project.name || '未命名的一局'}.pmod`, text)

  // §5.7：起终点缺 → toast 提示但**不阻塞导出**；悬空引用自动剔除后也告知一声
  const { noStart, noEnd } = mapsMissing(project)
  const parts: string[] = [`已导出 ${project.name || '这一局'}.pmod`]
  if (noStart.length) parts.push(`缺起点：${noStart.join('、')}`)
  if (noEnd.length) parts.push(`缺终点：${noEnd.join('、')}`)
  if (missing.length) parts.push(`剔除了 ${missing.length} 个悬空引用`)
  notify(parts.join('；'), noStart.length || noEnd.length || missing.length ? 'warn' : 'info')
}

/* ------------------------------------------------------------------ */
/* 导入                                                                */
/* ------------------------------------------------------------------ */

function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** id 改名的场合：把这份定义里的引用跟着搬过去 */
function remapComponent(def: AnyComponent, idMap: Map<string, string>): AnyComponent {
  const clone = structuredClone(def) as unknown as Record<string, unknown>
  const rename = (value: string) => idMap.get(value) ?? value

  const remapIds = (ids: unknown) => {
    if (!Array.isArray(ids)) return
    ids.forEach((raw, i) => {
      ids[i] = typeof raw === 'string' ? rename(raw) : { ...(raw as object), id: rename((raw as { id: string }).id) }
    })
  }

  const effects = clone.effects as { op: string; skill?: string }[] | undefined
  if (effects) for (const eff of effects) if ('skill' in eff && eff.skill) eff.skill = rename(eff.skill)

  for (const key of ['reward_pool', 'monster_pool', 'stock', 'mimic'] as const) {
    const pool = clone[key] as { ids?: unknown; monster?: string; reward_pool?: { ids?: unknown } } | undefined
    if (!pool) continue
    remapIds(pool.ids)
    if (pool.monster) pool.monster = rename(pool.monster)
    if (pool.reward_pool) remapIds(pool.reward_pool.ids)
  }

  const price = clone.price as { currency?: string } | undefined
  if (price?.currency) price.currency = rename(price.currency)

  if (Array.isArray(clone.starting_items)) {
    clone.starting_items = (clone.starting_items as string[]).map(rename)
  }

  if (clone.attack_weights && typeof clone.attack_weights === 'object') {
    const weights: Record<string, number> = {}
    for (const [key, weight] of Object.entries(clone.attack_weights as Record<string, number>)) {
      weights[rename(key)] = weight
    }
    clone.attack_weights = weights
  }

  if (clone.event && typeof clone.event === 'object') {
    const event = clone.event as Record<string, unknown>
    for (const branch of ['on_success', 'on_fail'] as const) {
      const outcome = event[branch] as { grant?: { id: string }[]; effects?: { op: string; skill?: string }[] } | undefined
      if (!outcome) continue
      if (outcome.grant) outcome.grant = outcome.grant.map((g) => ({ ...g, id: rename(g.id) }))
      if (outcome.effects) for (const eff of outcome.effects) if ('skill' in eff && eff.skill) eff.skill = rename(eff.skill)
    }
  }

  return clone as unknown as AnyComponent
}

function remapProject(project: Project, idMap: Map<string, string>): Project {
  const rename = (value: string) => idMap.get(value) ?? value
  const maps: GameMap[] = project.maps.map((m) => ({
    ...m,
    id: m.id ?? newMapId(),
    nodes: m.nodes.map((n) => (n.ref ? { ...n, ref: rename(n.ref) } : n)),
  }))
  return {
    ...project,
    enabledIds: [...new Set(project.enabledIds.map(rename))],
    maps,
    rules: { ...project.rules, class_pool: project.rules.class_pool.map(rename) },
  }
}

/** 「启用」怎么还原：地图件靠铺设，其余**显式启用**（§4.0） */
function enabledFromComponents(components: Library): string[] {
  const keys: LibraryKey[] = ['items', 'monsters', 'classes', 'skills', 'backgrounds']
  return keys.flatMap((key) => (components[key] as AnyComponent[]).map((c) => c.id))
}

export async function importPmodFile(): Promise<void> {
  const file = await pickTextFile()
  if (!file) return
  const parsed = parsePmod(file.text)

  const idMap = new Map<string, string>()
  const notes: string[] = []
  const local = librarySnapshot()

  // ① 同名处理：内容一致就沿用本地那份；不一致 → 另起一个「自建」id
  const merged = emptyLibrary()
  for (const key of LIBRARY_KEYS) {
    const kind = LIBRARY_KEY_TO_KIND[key]
    for (const incoming of parsed.components[key] as AnyComponent[]) {
      const existing = (local[key] as AnyComponent[]).find((c) => c.id === incoming.id)
      if (!existing) {
        ;(merged[key] as AnyComponent[]).push(incoming)
        continue
      }
      if (sameContent(existing, incoming)) {
        ;(merged[key] as AnyComponent[]).push(existing)
        continue
      }
      const fresh = newComponentId(kind)
      idMap.set(incoming.id, fresh)
      notes.push(`「${incoming.name}」本地已有一份同名不同内容的，这份另记为 ${fresh}`)
      ;(merged[key] as AnyComponent[]).push({ ...incoming, id: fresh })
    }
  }

  // ② 引用改名
  const fixed = emptyLibrary()
  for (const key of LIBRARY_KEYS) {
    for (const def of merged[key] as AnyComponent[]) {
      ;(fixed[key] as AnyComponent[]).push(remapComponent(def, idMap))
    }
  }

  const project: Project = remapProject(
    {
      name: parsed.name,
      background: parsed.background,
      enabledIds: enabledFromComponents(fixed),
      rules: parsed.rules,
      maps: parsed.maps.length > 0 ? parsed.maps : [{ id: newMapId(), name: '地图 1', nodes: [] }],
    },
    idMap,
  )

  commit(() => {
    const store = useLibraryStore.getState()
    for (const key of LIBRARY_KEYS) {
      const kind = LIBRARY_KEY_TO_KIND[key]
      for (const def of fixed[key] as AnyComponent[]) {
        if (!(librarySnapshot()[key] as AnyComponent[]).some((c) => c.id === def.id)) store.upsert(kind, def)
      }
    }
    useProjectStore.getState().replaceAll(project)
  })

  useUiStore.getState().setCurrentMap(project.maps[0]?.id)
  const summary = [`已并入「${parsed.name}」`]
  if (notes.length) summary.push(notes.join('；'))
  if (parsed.warnings.length) summary.push(parsed.warnings.join('；'))
  notify(summary.join(' · '), notes.length || parsed.warnings.length ? 'warn' : 'info')
}

/* ------------------------------------------------------------------ */
/* 示例局 / 清空                                                       */
/* ------------------------------------------------------------------ */

export function loadSampleGame(): void {
  const project = sampleProject()
  commit(() => useProjectStore.getState().replaceAll(project))
  useUiStore.getState().setCurrentMap(project.maps[0]?.id)
  notify('示例场景已载入：包含五种建筑行为与四种地形，可通过「清单」查看校验结果')
}

export function resetProject(): void {
  commit(() => useProjectStore.getState().replaceAll(newProject()))
  useUiStore.getState().setCurrentMap(useProjectStore.getState().maps[0]?.id)
  notify('已新建空白场景，组件库内容保留')
}
