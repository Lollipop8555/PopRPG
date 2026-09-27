/**
 * `.psave` 进度存档 / 组件库携带（§7.3）
 *
 * - `.pmod` 是**场景**（静态定义，可分享）；`.psave` 是**进度**（已学技能 / 背包 / 加点 / 位置 / 状态 / 骰子流水）
 * - 组件库单独成文件带走（跨设备同步）—— 因为库是**跨项目的资产**（§4.0）
 */

import type { Library } from '../types'
import type { Session } from '../types/session'
import { downloadText, pickTextFile } from './download'

export const PSAVE_VERSION = 1

export function exportSave(session: Session): string {
  const payload = { kind: 'poprpg.psave', version: PSAVE_VERSION, savedAt: Date.now(), session }
  return JSON.stringify(payload, null, 2)
}

export function parseSave(text: string): Session | null {
  try {
    const parsed = JSON.parse(text) as { kind?: string; session?: Session }
    if (!parsed || parsed.kind !== 'poprpg.psave' || !parsed.session) return null
    const session = parsed.session
    if (!session.scenario || !session.player) return null
    return { ...session, version: PSAVE_VERSION }
  } catch {
    return null
  }
}

export function downloadSave(session: Session): void {
  downloadText(`${session.scenario.name}.psave`, exportSave(session), 'application/json')
}

export async function pickSaveFile(): Promise<Session | null> {
  const file = await pickTextFile('.psave,.json')
  if (!file) return null
  return parseSave(file.text)
}

/* ------------------------------------------------------------------ */
/* 组件库单独导入 / 导出                                               */
/* ------------------------------------------------------------------ */

export function exportLibrary(library: Library): string {
  return JSON.stringify({ kind: 'poprpg.library', version: PSAVE_VERSION, library }, null, 2)
}

export function parseLibrary(text: string): Library | null {
  try {
    const parsed = JSON.parse(text) as { kind?: string; library?: Library }
    if (!parsed || parsed.kind !== 'poprpg.library' || !parsed.library) return null
    return parsed.library
  } catch {
    return null
  }
}

export function downloadLibrary(library: Library): void {
  downloadText('poprpg-library.json', exportLibrary(library), 'application/json')
}

export async function pickLibraryFile(): Promise<Library | null> {
  const file = await pickTextFile('.json')
  if (!file) return null
  return parseLibrary(file.text)
}
