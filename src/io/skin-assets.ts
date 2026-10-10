/**
 * **素材源**：把解出来的皮肤包变成「路径 → 可用地址」（`skin.md` §四）。
 *
 * - **惰性**：`urlOf` 第一次被问到某条路径时才建地址——一屏只画几张图，不做整包预建
 * - **一次只解压一套**（裁决 15）：换皮肤时对新包 `createSkinAssets`、对旧包 `release()`，
 *   旧地址由 `release` 一次撤干净，不做逐张替换
 * - 取不到条目返回 `undefined`，渲染侧据此回退程序绘制（`KP-2` 在导入时提示过一次，不再刷屏）
 */

import type { SkinPath } from '../types'
import { imageSize, type ImageSize } from './image-size'
import { skinBytesOf, type LoadedSkin } from './pp'

/** 素材源：皮肤包 + 已建好的地址 */
export interface SkinAssets {
  /** 该路径的可用地址；条目缺失或环境不支持时返回 `undefined`（渲染侧回退） */
  urlOf(path: SkinPath): string | undefined
  /** 包内是否有这条素材（不看是否已建地址） */
  has(path: SkinPath): boolean
  /**
   * 该路径图片的**内在像素尺寸**；条目缺失或格式不识别时返回 `undefined`。
   *
   * 供 **SVG 层九宫格切块**量四边用（`skin/04-misc.md` §二 `node.building` 必须九宫格）：
   * CSS `border-image` 自己知道原图多大，而 SVG 内切块拼装要显式给出源区像素。
   * 只读条目字节，与 `urlOf` 无关（**不建地址**），惰性且按路径缓存。
   *
   * **可选**：这是只服务 SVG 九宫格一项的补充能力，不属于核心契约（地址 / 存在性 / 封面 / 释放），
   * 缺省即该源不支持量尺寸，取图侧据此回落整图拉伸（`textureProps()` 已作可选调用）。
   */
  sizeOf?(path: SkinPath): ImageSize | undefined
  /** 封面图地址（皮肤库里列表用），取不到返回 `undefined` */
  previewUrl(): string | undefined
  /** 撤销本源建过的全部地址；可重复调用，撤后仍可继续 `urlOf`（按需重建） */
  release(): void
}

export interface SkinAssetsOptions {
  /** 建地址；默认走 `URL.createObjectURL`。环境没有该能力时返回 `undefined` 即降级 */
  createUrl?: (bytes: Uint8Array, mime: string) => string | undefined
  /** 撤地址；默认走 `URL.revokeObjectURL` */
  revokeUrl?: (url: string) => void
}

/** 路径归一：与 `skinBytesOf` 同一口径（`./` 与前导 `/` 都当包根处理） */
function normalize(path: SkinPath): SkinPath {
  return path.replace(/^(?:\.\/|\/)+/, '')
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  // 音频（`skin/07-audio.md` §四）：`decodeAudioData` 不吃扩展名，mime 只作提示；
  // 这里给对是为了 blob 地址与调试时可读，解码真正按内容识别
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  // 字体（`skin/06-item-building.md` §2.3 的建筑名称 `font`）：`@font-face` 的地址
  // 由本模块的 blob 地址给出，mime 给对才不会被浏览器的字体嗅探挡下
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttc: 'font/collection',
}

/** 由扩展名推 mime；不认识的按二进制给（浏览器多能按内容识别） */
export function mimeOf(path: SkinPath): string {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase()
  return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream'
}

function browserCreateUrl(bytes: Uint8Array, mime: string): string | undefined {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function browserRevokeUrl(url: string): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
  URL.revokeObjectURL(url)
}

/**
 * 为一份皮肤包建素材源。`skin` 为空（未启用皮肤 / 包没解出来）时也返回可用对象，
 * 一切查询都落到 `undefined`——调用方不必到处判空。
 */
export function createSkinAssets(skin: LoadedSkin | undefined, options: SkinAssetsOptions = {}): SkinAssets {
  const createUrl = options.createUrl ?? browserCreateUrl
  const revokeUrl = options.revokeUrl ?? browserRevokeUrl

  /** 已建地址（含建失败的 `undefined`，避免对同一条重复尝试） */
  const urls = new Map<SkinPath, string | undefined>()
  /** 已量尺寸（含量不出的 `undefined`，避免对同一条重复解析字节） */
  const sizes = new Map<SkinPath, ImageSize | undefined>()
  let preview: string | undefined
  let previewTried = false

  const build = (bytes: Uint8Array | undefined, path: SkinPath): string | undefined =>
    bytes === undefined ? undefined : createUrl(bytes, mimeOf(path))

  const urlOf = (path: SkinPath): string | undefined => {
    const key = normalize(path)
    if (urls.has(key)) return urls.get(key)
    const url = skin ? build(skinBytesOf(skin, key), key) : undefined
    urls.set(key, url)
    return url
  }

  const sizeOf = (path: SkinPath): ImageSize | undefined => {
    const key = normalize(path)
    if (sizes.has(key)) return sizes.get(key)
    const bytes = skin ? skinBytesOf(skin, key) : undefined
    const size = bytes === undefined ? undefined : imageSize(bytes, key)
    sizes.set(key, size)
    return size
  }

  return {
    urlOf,
    sizeOf,
    has: (path) => skin !== undefined && skinBytesOf(skin, normalize(path)) !== undefined,
    previewUrl: () => {
      if (!previewTried && skin?.preview) {
        previewTried = true
        preview = build(skin.preview, 'preview.png')
      }
      return preview
    },
    release: () => {
      for (const url of urls.values()) if (url !== undefined) revokeUrl(url)
      urls.clear()
      sizes.clear()
      if (preview !== undefined) revokeUrl(preview)
      preview = undefined
      previewTried = false
    },
  }
}
