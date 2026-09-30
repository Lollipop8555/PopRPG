/**
 * 皮肤包的测试夹具：用**真 zip**（走 `zipEntries`）构造 `.pp` / `.pgame`，不手搓二进制。
 */

import { textBytes, zipEntries, type ZipEntries } from '../io/zip'

/** 合法 PNG 头部 ＋ 几个字节：够 `preview.png` 的签名判定用 */
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])

/** 任意一段「图」字节：内容无关紧要，加载器只按键取用 */
export function img(tag = 'a'): Uint8Array {
  return textBytes(`img:${tag}`)
}

/** 「条目名 → 文本 / 字节」打成一个包 */
export function packZip(files: Record<string, string | Uint8Array>): Uint8Array {
  const entries: ZipEntries = {}
  for (const [name, value] of Object.entries(files)) {
    entries[name] = typeof value === 'string' ? textBytes(value) : value
  }
  return zipEntries(entries)
}

/** 一份最小 manifest：道路一套样式（`base` ＋ 相对文件名） */
export function minimalManifest(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '小径',
    author: '测试',
    road: {
      styles: [{ tags: [], base: 'art/road' }],
      tiles: { straight: 'straight_ns.png' },
    },
    ...over,
  }
}

/** 最小可用 `.pp`：包根 manifest ＋ 它引用的那张素材（＋ 追加条目） */
export function minimalPp(
  over: Record<string, unknown> = {},
  extra: Record<string, string | Uint8Array> = {},
): Uint8Array {
  return packZip({
    'manifest.json': JSON.stringify(minimalManifest(over)),
    'art/road/straight_ns.png': img('straight'),
    ...extra,
  })
}
