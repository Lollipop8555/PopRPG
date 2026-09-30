/**
 * Creative 模式的**打包导出**（`skin/00-package.md` §2、§2.3）。
 *
 * 导出只做「装配」：manifest 写成包根 `manifest.json`、被引用到的素材按原路径放进包、
 * 可选的 `preview.png` 放包根；`.pgame` 再多写一份 `pack.json` 与 `.pmod`。
 * 校验一律交给既有的 `pp.ts` / `pgame.ts`（本文件**不解释**任何皮肤语义）。
 */

import {
  PGAME_DEFAULT_PMOD,
  PGAME_DEFAULT_SKIN_DIR,
  PGAME_KIND,
  type PGamePack,
  type SkinManifest,
} from '../types'
import { SKIN_MANIFEST_ENTRY, SKIN_PREVIEW_ENTRY, readSkin, readSkinEntries, type SkinLoadResult } from '../io/pp'
import { readPGame, type LoadedPGame } from '../io/pgame'
import { collectSkinPathGroups } from '../io/skin-paths'
import { textBytes, zipEntries, type ZipEntries } from '../io/zip'

/** 打包输入：一份 manifest ＋ 已绑定素材 ＋ 可选预览图 */
export interface PackInput {
  manifest: SkinManifest
  /** 已绑定素材：**包内路径 → 字节**（键与 manifest 里写的路径一致） */
  assets: Record<string, Uint8Array>
  /** 可选预览图（`preview.png`，必须是真 PNG 才写） */
  preview?: Uint8Array
}

/** 打包结果 */
export interface PackResult {
  bytes: Uint8Array
  /** 实际写进包的素材路径（升序） */
  written: string[]
  /** manifest 引用了、但工程里没有对应字节的路径（升序） */
  missing: string[]
  /** 工程里有、manifest 没引用的路径（不进包，升序；`KP-5` 的口径） */
  unused: string[]
}

/** 路径归一化：反斜杠归一、去掉开头的 `./`（与 `joinSkinPath` 同一约定） */
export function normalizeEntryPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

/** 目录里的一份文件（`pickDirectory()` 的产物：路径是相对**所选目录**的，含顶层目录名） */
export interface DirectoryEntry {
  path: string
  bytes: Uint8Array
}

/** 全部路径共有的**顶层目录名**（目录选择器总会带一层）；没有则返回空串 */
function sharedTopDir(paths: string[]): string {
  if (paths.length === 0) return ''
  const head = paths[0].split('/')[0]
  if (head === '' || head === paths[0]) return ''
  return paths.every((path) => path.startsWith(`${head}/`)) ? head : ''
}

/**
 * 本地目录 → 走与 `.pp` **同一条装载路径**（`readSkinEntries`）：去掉公共顶层目录后，
 * 相对路径即包内条目。顺带 `zipEntries()` 出一份等价字节，好让「导入即入皮肤库」把这份目录也原样存档。
 */
export function readSkinDirectory(
  files: DirectoryEntry[],
  source = '本地目录',
): { result: SkinLoadResult; bytes: Uint8Array } {
  const normalized = files.map((file) => ({ path: normalizeEntryPath(file.path), bytes: file.bytes }))
  const root = sharedTopDir(normalized.map((file) => file.path))
  const entries: ZipEntries = {}
  for (const file of normalized) {
    const path = root === '' ? file.path : file.path.slice(root.length + 1)
    if (path === '') continue
    entries[path] = file.bytes
  }
  return { result: readSkinEntries(entries, source), bytes: zipEntries(entries) }
}

/** manifest 引用的全部素材路径（含道路样式集 `base` 拼接后的候选） */
export function referencedPaths(manifest: SkinManifest): string[] {
  const out = new Set<string>()
  for (const group of collectSkinPathGroups(manifest)) {
    for (const candidate of group.candidates) out.add(normalizeEntryPath(candidate))
  }
  return [...out]
}

/** 装配皮肤条目：`manifest.json` ＋ 被引用素材 ＋ 可选 `preview.png` */
export function buildSkinEntries(input: PackInput): {
  entries: ZipEntries
  written: string[]
  missing: string[]
  unused: string[]
} {
  const referenced = new Set(referencedPaths(input.manifest))
  const assets = new Map<string, Uint8Array>()
  for (const [path, bytes] of Object.entries(input.assets)) assets.set(normalizeEntryPath(path), bytes)

  const entries: ZipEntries = {}
  const written: string[] = []
  const missing: string[] = []

  for (const path of [...referenced].sort()) {
    const bytes = assets.get(path)
    if (bytes === undefined) missing.push(path)
    else {
      entries[path] = bytes
      written.push(path)
    }
  }

  const unused = [...assets.keys()].filter((path) => !referenced.has(path)).sort()

  entries[SKIN_MANIFEST_ENTRY] = textBytes(`${JSON.stringify(input.manifest, null, 2)}\n`)
  if (input.preview !== undefined && input.preview.byteLength > 0) entries[SKIN_PREVIEW_ENTRY] = input.preview

  return { entries, written, missing, unused }
}

/** 打包成 `.pp` 字节 */
export function packSkin(input: PackInput): PackResult {
  const { entries, written, missing, unused } = buildSkinEntries(input)
  return { bytes: zipEntries(entries), written, missing, unused }
}

/** 打包输入：在皮肤之外再给一份 `.pmod` */
export interface PGameInput extends PackInput {
  /** 显示名（写进 `pack.name`） */
  name: string
  /** `.pmod` 原文本 */
  pmod: string
  /** `.pmod` 在包内的路径，缺省 `game.pmod` */
  pmodPath?: string
}

/** 打包成 `.pgame` 字节：`pack.json` ＋ `.pmod` ＋ `skin/` */
export function packPGame(input: PGameInput): PackResult {
  const pmodPath = normalizeEntryPath(input.pmodPath ?? PGAME_DEFAULT_PMOD)
  const skinDir = PGAME_DEFAULT_SKIN_DIR
  const skin = buildSkinEntries(input)

  const entries: ZipEntries = {}
  // 皮肤条目整体挪进 `skin/`（`.pp` 的包根语义在子目录里原样成立）
  for (const [path, data] of Object.entries(skin.entries)) entries[`${skinDir}${path}`] = data
  entries[pmodPath] = textBytes(input.pmod)

  const pack: PGamePack = { kind: PGAME_KIND, name: input.name, pmod: pmodPath, skin: skinDir }
  entries[PGAME_PACK_PATH] = textBytes(`${JSON.stringify(pack, null, 2)}\n`)

  return {
    bytes: zipEntries(entries),
    written: skin.written,
    missing: skin.missing,
    unused: skin.unused,
  }
}

/** `.pgame` 的入口描述文件名（界面提示用） */
export const PGAME_PACK_PATH = 'pack.json'

/* ------------------------------------------------------------------ */
/* 导入（复用既有加载器，不自建解析）                                    */
/* ------------------------------------------------------------------ */

/** 读一份 `.pp`；失败仍返回结果（`skin` 为 `undefined`，提示在 `issues` 里） */
export function readSkinPackage(bytes: Uint8Array, source = ''): SkinLoadResult {
  return readSkin(bytes, source)
}

/** 读一份 `.pgame`（拿它的 `.pmod` 当参照的游戏） */
export function readGamePackage(bytes: Uint8Array, source = ''): LoadedPGame {
  return readPGame(bytes, source)
}
