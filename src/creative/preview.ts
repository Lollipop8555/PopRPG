/**
 * 封面生成（`skin/09-creative.md` §2.5）：导出 `.pp` / `.pgame` 时顺带生成一张 `preview.png`。
 *
 * 规则很小：**画布背景 ＋ 皮肤名**。取不到背景图就退成纯纸色 —— 生成失败一律返回 `undefined`，
 * 打包时只是少写一条 `preview.png`（`KP-6` 的提示口径），绝不因为画不出封面而挡住导出。
 */

import type { SkinManifest } from '../types'
import { readSlot } from './slots'

const WIDTH = 512
const HEIGHT = 288

/** 优先拿来当封面的背景：主视觉 → 首页 → 首张地图背景 → 欢迎页 */
const COVER_CANDIDATES = ['startup.cover', 'lobby.bg', 'background.0.img', 'startup.bg']

/** 在浏览器里把字节解成图片；解不出返回 `undefined`（九宫格面板取像素也走它） */
export async function loadImageFromBytes(bytes: Uint8Array): Promise<HTMLImageElement | undefined> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return undefined
  }
  const blob = new Blob([bytes as BlobPart])
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('解不出图片'))
      image.src = url
    })
  } catch {
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 画一张封面。`assets` 的键与 manifest 里写的路径一致。
 * 任何一步失败都返回 `undefined`（调用方按「没有封面」继续）。
 */
export async function renderPreviewPng(
  manifest: SkinManifest,
  assets: Record<string, Uint8Array>,
  name?: string,
): Promise<Uint8Array | undefined> {
  try {
    if (typeof document === 'undefined') return undefined
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    ctx.fillStyle = '#f6f1e4'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    for (const path of COVER_CANDIDATES) {
      const value = readSlot(manifest, path)
      if (typeof value !== 'string' || value.trim() === '') continue
      const bytes = assets[value.replace(/^\.\//, '')]
      if (bytes === undefined) continue
      const image = await loadImageFromBytes(bytes)
      if (!image) continue
      ctx.drawImage(image, 0, 0, WIDTH, HEIGHT)
      break
    }

    const title = (name ?? manifest.name ?? '').trim()
    if (title !== '') {
      // 描边保证在任何底色上都读得清（不依赖皮肤里的字色）
      ctx.font = 'bold 38px "Noto Serif SC", serif'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(20, 16, 12, 0.75)'
      ctx.strokeText(title, 28, HEIGHT - 36)
      ctx.fillStyle = '#fdfbf5'
      ctx.fillText(title, 28, HEIGHT - 36)
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    if (!blob) return undefined
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return undefined
  }
}
