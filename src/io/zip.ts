/**
 * zip 读写（裁决 14：`.pp` 与 `.pgame` 都是 zip 容器）。
 *
 * 只暴露本项目需要的两个动作——整包解压成「条目名 → 字节」、把「条目名 → 字节」打成包；
 * 调用方不接触 `fflate` 的选项，将来换实现（或换成流式解压）只改本文件。
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * 解压结果：条目名（`/` 分隔、相对包根、无前导 `./`）→ 字节。
 * 目录占位条目（`skin/` 这类以 `/` 结尾的零字节项）照常保留，但取条目时通常忽略。
 */
export type ZipEntries = Record<string, Uint8Array>

/** 规整条目名：去掉前导 `./` 与 `/`（zip 里两种写法都常见） */
function normalizeEntryName(name: string): string {
  return name.replace(/^(?:\.\/|\/)+/, '')
}

/** 解压整包；条目名按 `normalizeEntryName` 规整 */
export function unzipEntries(bytes: Uint8Array): ZipEntries {
  const raw = unzipSync(bytes)
  const out: ZipEntries = {}
  for (const [name, data] of Object.entries(raw)) out[normalizeEntryName(name)] = data
  return out
}

/** 打包（压缩级别取中档：皮肤多为已压缩的图片，再压收益有限） */
export function zipEntries(entries: ZipEntries): Uint8Array {
  return zipSync(entries, { level: 6 })
}

/** 文本转条目字节（UTF-8） */
export function textBytes(text: string): Uint8Array {
  return strToU8(text)
}

/** 条目是否存在（真取到条目，且不是目录占位项） */
export function hasEntry(entries: ZipEntries, name: string): boolean {
  const data = entries[normalizeEntryName(name)]
  return data !== undefined && !(data.length === 0 && name.endsWith('/'))
}

/** 读文本条目；缺条目返回 `undefined` */
export function textEntry(entries: ZipEntries, name: string): string | undefined {
  const data = entries[normalizeEntryName(name)]
  return data === undefined ? undefined : strFromU8(data)
}

/** 读 JSON 条目；缺条目返回 `undefined`，**解析失败向上抛**（由调用方按 `KP-1` 处理） */
export function jsonEntry<T>(entries: ZipEntries, name: string): T | undefined {
  const text = textEntry(entries, name)
  return text === undefined ? undefined : (JSON.parse(text) as T)
}

/**
 * 截取某个目录下的条目，并**剥掉该前缀**——`.pgame` 的 `skin/` 就是一份独立 `.pp`，
 * 其 manifest 里的路径相对**皮肤根**而非 `.pgame` 包根（`skin/00-package.md` §2.3）。
 */
export function subEntries(entries: ZipEntries, prefix: string): ZipEntries {
  const dir = normalizeEntryName(prefix)
  if (dir === '') return { ...entries }
  const head = dir.endsWith('/') ? dir : `${dir}/`
  const out: ZipEntries = {}
  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith(head)) continue
    const rest = name.slice(head.length)
    if (rest === '') continue
    out[rest] = data
  }
  return out
}
