/**
 * 素材路径的收集与校验（`skin/00-package.md` §2.2、§六 `KP-2` / `KP-4`）。
 *
 * 路径**一律由描述文件给出、相对包根写全**：加载器不推断前缀、不假设目录约定（裁决 19 / 22）。
 * 唯一的例外是道路样式集——`road.styles[].base` 是**目录前缀**、`road.tiles` 的值是**相对文件名**，
 * 拼接后才是包内路径（`skin/01-road.md` §七）。样式集由标签在**运行期**选取，
 * 故这类引用按**候选组**收集：一组候选里**只要有一套能取到**就算有效。
 *
 * 本文件不碰 zip，只回答两件事——manifest 里哪些字符串是素材路径、这些路径是否合法。
 */

import { joinSkinPath, type SkinManifest, type SkinRoad, type SkinSprite } from '../types'

/** 视为素材路径的扩展名（图片 / 音频 / 字体） */
const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|avif|mp3|ogg|wav|m4a|aac|flac|ttf|otf|woff2?)$/i

/**
 * 不参与通用收集的键。三类：
 * - `theme` 的值是 CSS 变量（颜色 / 字体栈），与被引用的素材无关；
 * - 元信息与枚举值（`name` / `tags` / `mode` …）是自由文本，不含条目引用；
 * - `road` 与 `extends` **单独处理**（前者见 `roadGroups`，后者见 `pp.ts` 的 `KP-8`）。
 */
const SKIP_KEYS = new Set([
  'theme',
  'road',
  'extends',
  'tags',
  'mode',
  'name',
  'author',
  'description',
  'kind',
  'entry',
])

/** 路径禁止项（`KP-4`） */
export type PathViolation = 'absolute' | 'parent' | 'external'

/**
 * 一处路径引用。
 *
 * 单候选即普通素材字段；多候选只出现在道路样式集（`base` 有几种，就有几个候选）。
 */
export interface PathGroup {
  /** 候选路径（原样，未做拼接之外的加工） */
  candidates: string[]
  /** 出处，形如 `road.tiles.straight[0]`，供清单定位 */
  where: string
}

export interface InvalidPath {
  path: string
  violation: PathViolation
  /** 全部出处 */
  wheres: string[]
}

export interface MissingPath {
  /** 该处列出的全部候选路径 */
  candidates: string[]
  where: string
}

/** 该字符串是否像素材路径（按扩展名判定） */
export function isAssetPath(value: string): boolean {
  return ASSET_EXT.test(value)
}

/**
 * `KP-4`：禁止绝对路径、`..`、外部地址（`http(s)://` / `data:` 等）。
 * 纯静态约束下产物必须离线可用（[`08-deploy.md`](../../docs/design/08-deploy.md) §9）。
 */
export function pathViolation(path: string): PathViolation | undefined {
  const p = path.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) && !/^[a-z]:[\\/]/i.test(p)) return 'external'
  if (p.startsWith('/') || p.startsWith('\\') || /^[a-z]:[\\/]/i.test(p)) return 'absolute'
  if (p.split(/[\\/]/).includes('..')) return 'parent'
  return undefined
}

/** 三写法（字符串 / 对象 / 四张数组）统一取「文件名 ＋ 出处」 */
function spriteGroups(sprite: SkinSprite, where: string): PathGroup[] {
  if (typeof sprite === 'string') return [{ candidates: [sprite], where }]
  if (Array.isArray(sprite)) {
    return sprite.flatMap((item, index) => spriteGroups(item, `${where}[${index}]`))
  }
  if (sprite === null || typeof sprite !== 'object' || typeof sprite.img !== 'string') return []
  return [{ candidates: [sprite.img], where: `${where}.img` }]
}

/** 道路：`tiles` 的值与每条样式集的 `base` 各成一候选（裁决 22 / §七 路径定义） */
function roadGroups(road: SkinRoad | undefined): PathGroup[] {
  if (!road || !road.tiles) return []
  const bases = (road.styles ?? [])
    .map((style) => style.base)
    .filter((base): base is string => typeof base === 'string' && base !== '')

  const out: PathGroup[] = []
  for (const [slot, sprite] of Object.entries(road.tiles)) {
    if (sprite === undefined) continue
    for (const group of spriteGroups(sprite, `road.tiles.${slot}`)) {
      const candidates =
        bases.length === 0
          ? group.candidates
          : group.candidates.flatMap((file) => bases.map((base) => joinSkinPath(base, file)))
      out.push({ candidates: [...new Set(candidates)], where: group.where })
    }
  }
  return out
}

function walk(node: unknown, where: string, out: PathGroup[]): void {
  if (typeof node === 'string') {
    if (isAssetPath(node)) out.push({ candidates: [node], where })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => walk(value, `${where}[${index}]`, out))
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (SKIP_KEYS.has(key)) continue
    walk(value, where === '' ? key : `${where}.${key}`, out)
  }
}

/** 收集 manifest 中的全部素材路径引用（按出现顺序，含重复） */
export function collectSkinPathGroups(manifest: SkinManifest | undefined): PathGroup[] {
  if (!manifest) return []
  const out: PathGroup[] = []
  walk(manifest, '', out)
  return [...out, ...roadGroups(manifest.road)]
}

/** `KP-4`：列出全部违规路径（候选组的每个候选都要合法） */
export function invalidSkinPaths(groups: readonly PathGroup[]): InvalidPath[] {
  const wheres = new Map<string, string[]>()
  for (const group of groups) {
    for (const path of group.candidates) {
      const list = wheres.get(path)
      if (list) list.push(group.where)
      else wheres.set(path, [group.where])
    }
  }

  const out: InvalidPath[] = []
  for (const [path, list] of wheres) {
    const violation = pathViolation(path)
    if (violation) out.push({ path, violation, wheres: list })
  }
  return out
}

/**
 * `KP-2`：列出取不到条目的路径引用。
 * 候选组里**有一个候选存在即算有效**；整组都不存在才报，并把全部候选列出。
 */
export function missingSkinPaths(
  groups: readonly PathGroup[],
  exists: (name: string) => boolean,
): MissingPath[] {
  const out: MissingPath[] = []
  const reported = new Set<string>()

  for (const group of groups) {
    // 违规路径另有 `KP-4` 报告，此处不重复计
    const candidates = group.candidates.filter((path) => !pathViolation(path))
    if (candidates.length === 0) continue
    if (candidates.some((path) => exists(path))) continue

    const key = candidates.join('\u0000')
    if (reported.has(key)) continue
    reported.add(key)
    out.push({ candidates, where: group.where })
  }
  return out
}

/** `KP-4` 的提示文案 */
export const PATH_VIOLATION_LABEL: Record<PathViolation, string> = {
  absolute: '绝对路径',
  parent: '含 `..`',
  external: '外部地址',
}
