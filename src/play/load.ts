/**
 * 把「静态定义」装成可开局的 `Scenario`（B0）：
 * ① 从 `.pmod` 文件 ② 从构建页当前这一局（导出时用的同一套自包含闭包）
 */

import type { AnyComponent, Library, LibraryKey, Project } from '../types'
import { collectUsedComponents } from '../io/pmod'
import { parsePmod } from '../io/pmod'
import type { Scenario } from '../types/session'

const NON_MAP_KEYS: LibraryKey[] = ['items', 'monsters', 'classes', 'skills', 'backgrounds']

/** 「启用」怎么还原：地图件靠铺设，其余靠显式启用（§4.0） */
function enabledFrom(library: Library): string[] {
  return NON_MAP_KEYS.flatMap((key) => (library[key] as AnyComponent[]).map((c) => c.id))
}

export function scenarioFromLibrary(
  library: Library,
  meta: { version: number; name: string; background: string; rules: Scenario['rules']; maps: Scenario['maps'] },
): Scenario {
  return {
    version: meta.version,
    name: meta.name,
    background: meta.background,
    rules: meta.rules,
    maps: meta.maps,
    enabledIds: enabledFrom(library),
    library,
  }
}

/** 从 `.pmod` 文本装一局（解析警告一并返回，给 UI 提示） */
export function scenarioFromPmod(text: string): { scenario: Scenario | null; warnings: string[] } {
  const parsed = parsePmod(text)
  if (parsed.maps.length === 0 && parsed.components.monsters.length === 0) {
    return { scenario: null, warnings: [...parsed.warnings, '这份文件里既没有地图也没有怪物，看不出是个什么局'] }
  }
  return {
    scenario: scenarioFromLibrary(parsed.components, {
      version: parsed.version,
      name: parsed.name,
      background: parsed.background,
      rules: parsed.rules,
      maps: parsed.maps,
    }),
    warnings: parsed.warnings,
  }
}

/** 从构建页当前这一局装（用导出时同一套「本局用到的」闭包，§3.3） */
export function scenarioFromProject(library: Library, project: Project, version = 1): Scenario {
  const { used } = collectUsedComponents(library, project)
  // 若传递引用未被闭包带出，则补齐库内已启用的组件，避免开局缺失
  const merged: Library = { ...used }
  for (const key of NON_MAP_KEYS) {
    const have = new Set((used[key] as AnyComponent[]).map((c) => c.id))
    const missing = (library[key] as AnyComponent[]).filter((c) => project.enabledIds.includes(c.id) && !have.has(c.id))
    if (missing.length) merged[key] = [...(used[key] as AnyComponent[]), ...missing] as never
  }
  return {
    version,
    name: project.name,
    background: project.background,
    rules: project.rules,
    maps: project.maps.map((m) => ({ ...m, nodes: m.nodes.map((n) => ({ ...n })) })),
    enabledIds: enabledFrom(merged),
    library: merged,
  }
}
