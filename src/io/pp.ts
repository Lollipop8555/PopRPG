/**
 * `.pp` 皮肤包加载（`skin/00-package.md` §2.1 / §3.2 / §五 / §六）。
 *
 * 三条纪律：
 * - **强制结构只有两项**：包根 `manifest.json` 与可选包根 `preview.png`；素材的目录名、
 *   层级、文件名一律自由（裁决 22）。
 * - **素材位置以描述文件为准**：按 manifest 各字段写的路径逐条取条目，不推断前缀。
 * - **加载期的任何问题都只是提示**：`KP-1`~`KP-10` 都不抛异常、不中断，整包无效时整体忽略。
 */

import {
  SKIN_FORMAT,
  type SkinIssue,
  type SkinIssueCode,
  type SkinManifest,
} from '../types'
import {
  PATH_VIOLATION_LABEL,
  collectSkinPathGroups,
  invalidSkinPaths,
  missingSkinPaths,
  pathViolation,
} from './skin-paths'
import { hasEntry, jsonEntry, type ZipEntries, unzipEntries } from './zip'
import { themeVars } from '../engine/skin/theme'

/** 入口描述文件（必须在包根） */
export const SKIN_MANIFEST_ENTRY = 'manifest.json'
/** 可选预览图（必须在包根） */
export const SKIN_PREVIEW_ENTRY = 'preview.png'

/** PNG 文件头，用于「给了预览图但读不出」的廉价判定（`KP-6`） */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** 一份加载完成的皮肤 */
export interface LoadedSkin {
  /** 皮肤名；缺省为空串，展示层回退 `source`（§3.1） */
  name: string
  author?: string
  description?: string
  /** 包格式版本（整数，缺省 `1`） */
  format: number
  /** `extends` 链**逐节点覆盖**后的 manifest（本包优先） */
  manifest: SkinManifest
  /** 解压出的全部条目；取素材一律走 `skinBytesOf` */
  entries: ZipEntries
  /** 包根 `preview.png` 的字节；无图或读不出时为 `undefined`（列表回退文件名） */
  preview?: Uint8Array
  /** 来源（文件名 / `.pgame` 名），皮肤列表回退显示 */
  source: string
  /** 本次加载产生的提示（与 `SkinLoadResult.issues` 同一份） */
  issues: SkinIssue[]
}

export interface SkinLoadResult {
  /** 整包被忽略（`KP-1`）时为 `undefined`，调用方按「无皮肤」继续 */
  skin?: LoadedSkin
  issues: SkinIssue[]
}

function issue(code: SkinIssueCode, detail: string): SkinIssue {
  return { code, detail }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 版本号：必须是正整数，否则按缺省 `1`（§五） */
function formatOf(manifest: SkinManifest): number {
  const raw = (manifest as { format?: unknown }).format
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : SKIN_FORMAT
}

/** `KP-3` 的「控制台只警告一次」标记 */
let warnedHighFormat = false

/** 深合并：对象逐键递归，数组与标量整体替换，`undefined` 不覆盖（§3.2 逐节点覆盖） */
export function mergeManifest(base: SkinManifest, over: SkinManifest): SkinManifest {
  return mergeDeep(base, over) as SkinManifest
}

function mergeDeep(base: unknown, over: unknown): unknown {
  if (over === undefined) return base
  const bothPlain =
    base !== null &&
    typeof base === 'object' &&
    !Array.isArray(base) &&
    over !== null &&
    typeof over === 'object' &&
    !Array.isArray(over)
  if (!bothPlain) return over
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    out[key] = mergeDeep((base as Record<string, unknown>)[key], value)
  }
  return out
}

/**
 * 沿 `extends` 链读出的全部 manifest，**从最外层基座到本包**。
 * 缺路径 / 解析失败 / 成环都按 `KP-8` 处理：截断继承链，已读到的部分照常参与合并。
 */
function manifestChain(
  entries: ZipEntries,
  startPath: string,
  issues: SkinIssue[],
): SkinManifest[] {
  const visited = new Set<string>()
  const chain: SkinManifest[] = []
  let path = startPath

  for (;;) {
    if (visited.has(path)) {
      issues.push(issue('KP-8', `extends 链成环，已忽略：${[...visited, path].join(' → ')}`))
      break
    }
    visited.add(path)

    let manifest: SkinManifest | undefined
    try {
      manifest = jsonEntry<SkinManifest>(entries, path)
    } catch (error) {
      issues.push(issue('KP-8', `extends 目标无法解析：${path}（${reason(error)}）`))
      break
    }
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      issues.push(issue('KP-8', `extends 路径不存在或不是对象：${path}`))
      break
    }

    chain.push(manifest)

    const next = manifest.extends
    if (typeof next !== 'string' || next === '') break
    const violation = pathViolation(next)
    if (violation) {
      issues.push(issue('KP-4', `extends 路径${PATH_VIOLATION_LABEL[violation]}：${next}`))
      break
    }
    path = next
  }

  return chain
}

/** 预览图：给了却读不出才提示 `KP-6`（可选文件缺失是正常状态） */
function previewBytes(entries: ZipEntries, issues: SkinIssue[]): Uint8Array | undefined {
  const data = entries[SKIN_PREVIEW_ENTRY]
  if (data === undefined || data.length === 0) return undefined
  const isPng = PNG_SIGNATURE.every((byte, index) => data[index] === byte)
  if (!isPng) {
    issues.push(issue('KP-6', `${SKIN_PREVIEW_ENTRY} 不是可解码的 PNG，列表回退为文件名`))
    return undefined
  }
  return data
}

/** `KP-2` / `KP-3` / `KP-4` / `KP-9` / `KP-10`：针对**合并后**的 manifest 逐项检查 */
function checkManifest(entries: ZipEntries, manifest: SkinManifest, issues: SkinIssue[]): void {
  if ('resource' in (manifest as Record<string, unknown>)) {
    issues.push(issue('KP-10', '已废除的 resource 键被忽略，路径一律以各字段自身为准'))
  }

  const ignored = themeVars(manifest.theme).ignored
  if (ignored.length > 0) {
    issues.push(issue('KP-9', `theme 中被忽略的键：${ignored.join('、')}`))
  }

  const format = formatOf(manifest)
  if (format > SKIN_FORMAT) {
    issues.push(issue('KP-3', `包格式版本 ${format} 高于实现版本 ${SKIN_FORMAT}，新增字段可能读不出`))
    if (!warnedHighFormat) {
      warnedHighFormat = true
      console.warn(`[skin] manifest.format = ${format} 高于实现版本 ${SKIN_FORMAT}`)
    }
  }

  const groups = collectSkinPathGroups(manifest)
  for (const bad of invalidSkinPaths(groups)) {
    issues.push(
      issue('KP-4', `${bad.path}（${PATH_VIOLATION_LABEL[bad.violation]}，出处 ${bad.wheres.join('、')}）`),
    )
  }

  const missing = missingSkinPaths(groups, (name) => hasEntry(entries, name))
  if (missing.length > 0) {
    issues.push(
      issue('KP-2', `包内不存在：${missing.map((m) => `${m.candidates.join(' / ')}（${m.where}）`).join('、')}`),
    )
  }
}

/** 从**已解压的条目**加载皮肤（`.pgame` 的 `skin/` 走这条路，先剥前缀再进来） */
export function readSkinEntries(entries: ZipEntries, source = ''): SkinLoadResult {
  const issues: SkinIssue[] = []

  let raw: SkinManifest | undefined
  try {
    raw = jsonEntry<SkinManifest>(entries, SKIN_MANIFEST_ENTRY)
  } catch (error) {
    issues.push(issue('KP-1', `${SKIN_MANIFEST_ENTRY} 无法解析：${reason(error)}`))
    return { issues }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(issue('KP-1', `包根缺少可解析的 ${SKIN_MANIFEST_ENTRY}`))
    return { issues }
  }

  // 链的顺序是「本包 → 基座」，合并要从最外层基座开始逐层往上覆盖，故先反转
  const manifest = manifestChain(entries, SKIN_MANIFEST_ENTRY, issues)
    .reverse()
    .reduce<SkinManifest>((acc, next) => mergeDeep(acc, next) as SkinManifest, {})

  checkManifest(entries, manifest, issues)

  const skin: LoadedSkin = {
    name: typeof manifest.name === 'string' ? manifest.name : '',
    author: typeof manifest.author === 'string' ? manifest.author : undefined,
    description: typeof manifest.description === 'string' ? manifest.description : undefined,
    format: formatOf(manifest),
    manifest,
    entries,
    preview: previewBytes(entries, issues),
    source,
    issues,
  }
  return { skin, issues }
}

/** 从 `.pp` 包体加载；整包无法解压时按 `KP-1` 忽略 */
export function readSkin(bytes: Uint8Array, source = ''): SkinLoadResult {
  try {
    return readSkinEntries(unzipEntries(bytes), source)
  } catch (error) {
    return { issues: [issue('KP-1', `无法解压皮肤包：${reason(error)}`)] }
  }
}

/** 按 manifest 写的路径取素材字节；取不到即该节点降级（渲染侧回退程序绘制） */
export function skinBytesOf(skin: LoadedSkin, path: string): Uint8Array | undefined {
  return skin.entries[path.replace(/^(?:\.\/|\/)+/, '')]
}
