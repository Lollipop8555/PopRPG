/**
 * 九宫格切分（`skin/09-creative.md` §2.3；裁决 21）。
 *
 * 本文件只做**几何与判定**：四根参考线 ↔ 四角 / 四边 / 中心区的矩形，以及「中区是否被吃穿」。
 * 拖线、改数、取像素、另存切片都属界面层的事，本文件不碰 DOM。
 *
 * 两条与设计有意对齐的口径：
 * - **只产出参数与可选切片**，不改渲染规则（§2.3「不改渲染规则」）：写回的就是
 *   manifest 的 `slice: [上, 右, 下, 左]`，V1 渲染照旧（DOM 层走 `border-image`）。
 * - 黑边**只读不写**（取舍 `S-16`）：识别出的只是参考线初值，不生成、不导出 `.9.png`。
 */

import type { SkinSlice } from '../types'

/** 四根参考线（图片像素，非负整数） */
export interface NineLines {
  top: number
  right: number
  bottom: number
  left: number
}

/** 一块矩形（图片像素） */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 九块的分区结果 */
export interface NineRegions {
  width: number
  height: number
  /** 四角：原样画 */
  corners: { nw: Rect; ne: Rect; se: Rect; sw: Rect }
  /** 四边：单轴拉伸 */
  edges: { n: Rect; e: Rect; s: Rect; w: Rect }
  /** 中心：双轴拉伸；`上 ＋ 下 ≥ 图高` 或 `左 ＋ 右 ≥ 图宽` 时不存在 */
  center?: Rect
  /** 中区是否成立（不成立即当场标红，但**提示不阻断**） */
  valid: boolean
}

/** 四线初值：全零（等价于不切） */
export const NO_LINES: NineLines = { top: 0, right: 0, bottom: 0, left: 0 }

/** 九块的名字与顺序（导出切片时按此命名） */
export const SLICE_PARTS = ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'] as const
export type SlicePart = (typeof SLICE_PARTS)[number]

/** 取整并夹回 `0`–图幅：负数归零，超过图幅的归到图幅（再由图幅与对侧共同决定是否有效） */
export function normalizeLines(lines: NineLines, width: number, height: number): NineLines {
  const clamp = (value: number, limit: number) =>
    Number.isFinite(value) ? Math.min(Math.max(0, Math.round(value)), Math.max(0, limit)) : 0
  return {
    top: clamp(lines.top, height),
    right: clamp(lines.right, width),
    bottom: clamp(lines.bottom, height),
    left: clamp(lines.left, width),
  }
}

/** 中区是否成立：宽与高都必须为正 */
export function validLines(width: number, height: number, lines: NineLines): boolean {
  const clean = normalizeLines(lines, width, height)
  return width - clean.left - clean.right > 0 && height - clean.top - clean.bottom > 0
}

/** 四线 → 九块矩形 */
export function nineRegions(width: number, height: number, lines: NineLines): NineRegions {
  const { top, right, bottom, left } = normalizeLines(lines, width, height)
  const midW = width - left - right
  const midH = height - top - bottom
  const valid = midW > 0 && midH > 0

  return {
    width,
    height,
    corners: {
      nw: { x: 0, y: 0, w: left, h: top },
      ne: { x: width - right, y: 0, w: right, h: top },
      se: { x: width - right, y: height - bottom, w: right, h: bottom },
      sw: { x: 0, y: height - bottom, w: left, h: bottom },
    },
    edges: {
      n: { x: left, y: 0, w: midW, h: top },
      e: { x: width - right, y: top, w: right, h: midH },
      s: { x: left, y: height - bottom, w: midW, h: bottom },
      w: { x: 0, y: top, w: left, h: midH },
    },
    ...(valid ? { center: { x: left, y: top, w: midW, h: midH } } : {}),
    valid,
  }
}

/** 取某一块（`center` 不成立时返回 `undefined`） */
export function regionOf(regions: NineRegions, part: SlicePart): Rect | undefined {
  if (part === 'center') return regions.center
  return (regions.corners as Record<string, Rect>)[part] ?? (regions.edges as Record<string, Rect>)[part]
}

/** 四线 → 写回 manifest 的 `slice`（顺序固定 `[上, 右, 下, 左]`） */
export function sliceOf(lines: NineLines): SkinSlice {
  return [lines.top, lines.right, lines.bottom, lines.left]
}

/** `slice` → 四线 */
export function linesOfSlice(slice: SkinSlice | undefined): NineLines {
  if (slice === undefined) return { ...NO_LINES }
  const [top = 0, right = 0, bottom = 0, left = 0] = slice
  return { top, right, bottom, left }
}

/** 一个像素：`[红, 绿, 蓝, 透明度]`，各 `0`–`255` */
export type Pixel = readonly [number, number, number, number]

/** 黑边像素判定：不透明且接近纯黑（Android `.9.png` 的标记色） */
function isBlackMark(pixel: Pixel): boolean {
  const [r, g, b, a] = pixel
  return a > 0 && r < 32 && g < 32 && b < 32
}

/** 在一段像素里取「标记」的首尾；一个标记都没有时返回 `undefined` */
function spanOf(length: number, at: (index: number) => Pixel): { from: number; to: number } | undefined {
  let from = -1
  let to = -1
  for (let index = 0; index < length; index++) {
    if (!isBlackMark(at(index))) continue
    if (from < 0) from = index
    to = index
  }
  return from < 0 ? undefined : { from, to }
}

/**
 * 读 `.9.png` 的 1px 黑边标记，得到四线初值（§2.3「黑边识别」）。
 *
 * Android 约定：**上边**的黑段定左右线、**左边**的黑段定上下线；
 * 标记像素本身在图片最外一圈（不计入内容区）。四边都没有标记时返回 `undefined`。
 *
 * 取像素由调用方给（界面层用 canvas 读），故本函数保持纯函数、可在测试里喂假像素。
 */
export function detectNineBorders(
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => Pixel,
): NineLines | undefined {
  if (width < 3 || height < 3) return undefined

  // 上边（y = 0）的 x ∈ [1, width - 2]：给出 left 与 right
  const horizontal = spanOf(Math.max(0, width - 2), (index) => pixelAt(index + 1, 0))
  // 左边（x = 0）的 y ∈ [1, height - 2]：给出 top 与 bottom
  const vertical = spanOf(Math.max(0, height - 2), (index) => pixelAt(0, index + 1))

  if (!horizontal && !vertical) return undefined

  return normalizeLines(
    {
      top: vertical ? vertical.from : 0,
      bottom: vertical ? height - 1 - vertical.to : 0,
      left: horizontal ? horizontal.from : 0,
      right: horizontal ? width - 1 - horizontal.to : 0,
    },
    width,
    height,
  )
}

/** 另存切片时的文件名：`road.png` ＋ `nw` → `road_9_nw.png`（§2.3「导出切片」） */
export function sliceFileName(baseName: string, part: SlicePart): string {
  const stem = baseName.replace(/\.[a-z0-9]+$/i, '')
  return `${stem}_9_${part}.png`
}
