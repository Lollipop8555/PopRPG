/**
 * `.pgame` 整体分发容器加载（`skin/00-package.md` §2.3、`00a-formats.md` §2.2）。
 *
 * `.pgame` 只声明「内含哪些文件」，不给自身增设计算语义：本文件把 `pack.json` 读成
 * 「`.pmod` 文本 ＋ 一份 `.pp`」，皮肤的校验与加载完全复用 `pp.ts`。
 *
 * 缺 `pack.json`（或它读不出、`kind` 不符）时按**约定文件名**回退探测并提示 `KP-7`。
 */

import {
  PGAME_DEFAULT_PMOD,
  PGAME_DEFAULT_SKIN_DIR,
  PGAME_KIND,
  type PGamePack,
  type SkinIssue,
} from '../types'
import { PATH_VIOLATION_LABEL, pathViolation } from './skin-paths'
import { readSkinEntries, type LoadedSkin } from './pp'
import {
  hasEntry,
  jsonEntry,
  subEntries,
  textEntry,
  unzipEntries,
  type ZipEntries,
} from './zip'

/** `.pgame` 的入口描述文件（必须在包根） */
export const PGAME_PACK_ENTRY = 'pack.json'

export interface LoadedPGame {
  /** 显示名：`pack.name` 缺省取文件名（§2.3） */
  name: string
  /** 生效的容器描述（回退探测时为按约定补出的默认值） */
  pack: PGamePack
  /** `.pmod` 原文本；条目取不到时为 `undefined` */
  pmod?: string
  /** 皮肤；`.pgame` 未携带或读不出时为 `undefined`（按「无皮肤」启动） */
  skin?: LoadedSkin
  /** 容器层提示（皮肤自身的提示在 `skin.issues` 里） */
  issues: SkinIssue[]
  entries: ZipEntries
  source: string
}

function issue(code: SkinIssue['code'], detail: string): SkinIssue {
  return { code, detail }
}

/** 取描述文件里的一条路径；违规（`KP-4`）或不存在（`KP-2`）时返回 `undefined` */
function entryPath(
  entries: ZipEntries,
  path: string,
  issues: SkinIssue[],
  label: string,
): string | undefined {
  const violation = pathViolation(path)
  if (violation) {
    issues.push(issue('KP-4', `${label} 路径${PATH_VIOLATION_LABEL[violation]}：${path}`))
    return undefined
  }
  if (!hasEntry(entries, path)) {
    issues.push(issue('KP-2', `${label} 在包内不存在：${path}`))
    return undefined
  }
  return path
}

/** 读容器描述；缺文件 / 解析失败 / `kind` 不符都返回 `undefined`（调用方按 `KP-7` 回退） */
function readPack(entries: ZipEntries): PGamePack | undefined {
  let raw: PGamePack | undefined
  try {
    raw = jsonEntry<PGamePack>(entries, PGAME_PACK_ENTRY)
  } catch {
    return undefined
  }
  if (raw === null || typeof raw !== 'object') return undefined
  if (typeof raw.kind === 'string' && raw.kind !== PGAME_KIND) return undefined
  return raw
}

/** 从已解压的条目加载 `.pgame` */
export function readPGameEntries(entries: ZipEntries, source = ''): LoadedPGame {
  const issues: SkinIssue[] = []

  let pack = readPack(entries)
  if (!pack) {
    issues.push(
      issue('KP-7', `缺少可用的 ${PGAME_PACK_ENTRY}，按约定文件名回退（${PGAME_DEFAULT_PMOD} ＋ ${PGAME_DEFAULT_SKIN_DIR}）`),
    )
    pack = {}
  }

  const pmodPath = typeof pack.pmod === 'string' && pack.pmod !== '' ? pack.pmod : PGAME_DEFAULT_PMOD
  const pmodEntry = entryPath(entries, pmodPath, issues, '`.pmod`')
  const pmod = pmodEntry === undefined ? undefined : textEntry(entries, pmodEntry)

  let skin: LoadedSkin | undefined
  const skinDir = typeof pack.skin === 'string' ? pack.skin : PGAME_DEFAULT_SKIN_DIR
  if (skinDir !== '') {
    // 皮肤目录整体缺失按「无皮肤」处理（§2.3），不算缺陷；只有声明了具体路径才报 `KP-4`
    const violation = pathViolation(skinDir)
    if (violation) {
      issues.push(issue('KP-4', `皮肤目录${PATH_VIOLATION_LABEL[violation]}：${skinDir}`))
    } else if (hasEntry(subEntries(entries, skinDir), 'manifest.json')) {
      const result = readSkinEntries(subEntries(entries, skinDir), `${source} › ${skinDir}`)
      skin = result.skin
      issues.push(...result.issues)
    }
  }

  return {
    name: typeof pack.name === 'string' && pack.name !== '' ? pack.name : source,
    pack,
    pmod,
    skin,
    issues,
    entries,
    source,
  }
}

/** 从 `.pgame` 包体加载；无法解压时按 `KP-7` 报错并返回空壳 */
export function readPGame(bytes: Uint8Array, source = ''): LoadedPGame {
  try {
    return readPGameEntries(unzipEntries(bytes), source)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      name: source,
      pack: {},
      issues: [issue('KP-7', `无法解压 .pgame：${detail}`)],
      entries: {},
      source,
    }
  }
}
