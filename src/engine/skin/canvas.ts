/**
 * 画布背景取层与落位（`skin/05-canvas.md` §二 / §三）。
 *
 * 逐图清单以下标即地图下标：**下标越界即 clamp 到最后一层**；
 * 选中的那一层不可用（没有 `img`）时**向前找最近可用的一层**；
 * 一路到首层都没有可用图，则整节未接管，渲染侧回退程序绘制背景。
 *
 * 本函数只看「有没有 `img`」这一条形状约束——`cellSize` 缺失（`KB-1`）与
 * **路径在包内取不到**（`KB-2`）须由调用方经 `available` 一并判掉，才符合 §二.3
 * 「该层素材不可用即继续向前回退」。`startX` / `startY` 缺省按 `0`（图片原点对齐格 `[0,0]` 中心，
 * 见 `backgroundPlacement()`），`color` 每层各自携带、漏写即全局主题色（**不做层级回退**）。
 */

import type { SkinBackground, SkinBackgroundLayer, SkinPath } from '../../types'

/** 取层结果 */
export interface BackgroundPick {
  layer: SkinBackgroundLayer
  /** 实际选中的层下标（可能因 clamp 或向前回退而不同于传入的地图下标） */
  index: number
}

/** 把单对象写法规整为逐图清单 */
export function backgroundLayers(bg: SkinBackground | undefined): SkinBackgroundLayer[] {
  if (!bg) return []
  return Array.isArray(bg) ? bg : [bg]
}

/**
 * 可绘制的背景层：`img` 与 `cellSize` 齐备（`KB-1`）。
 *
 * 路径是否存在（`KB-2`）属 IO 侧的事，由调用方用素材源 `has()` 另行判掉；
 * 本判定只收紧到「对齐参数齐全」。
 */
export type UsableBackgroundLayer = SkinBackgroundLayer & { img: SkinPath; cellSize: number }

/** 该层是否具备绘制条件（`img` ＋ 正的 `cellSize`） */
export function backgroundUsable(layer: SkinBackgroundLayer | undefined): layer is UsableBackgroundLayer {
  const size = layer?.cellSize
  return !!layer?.img && typeof size === 'number' && Number.isFinite(size) && size > 0
}

/**
 * 取该地图下标应绘制的背景层。
 *
 * @param bg        `background` 节，整体缺省或全部层不可用即 `undefined`（未接管）
 * @param mapIndex  地图下标（负数按 `0` 处理）
 * @param available 额外的可用性判定（如路径是否存在）；**不给即只要求有 `img`**
 */
export function backgroundOf(
  bg: SkinBackground | undefined,
  mapIndex: number,
  available?: (layer: SkinBackgroundLayer) => boolean,
): BackgroundPick | undefined {
  const layers = backgroundLayers(bg)
  if (layers.length === 0) return undefined

  const wanted = Math.max(0, Math.trunc(mapIndex))
  for (let i = Math.min(wanted, layers.length - 1); i >= 0; i--) {
    const layer = layers[i]
    if (!layer.img) continue
    if (available && !available(layer)) continue
    return { layer, index: i }
  }
  return undefined
}

/** 画布坐标映射结果：把背景图放进「格」坐标系（`05-canvas.md` §三） */
export interface BackgroundPlacement {
  /** 缩放倍率 ＝ 屏幕每格像素 ÷ `cellSize` */
  scale: number
  /** 图片左上角在屏幕坐标中的位置（屏幕 `[0,0]` 格的中心为 `(screenCell/2, screenCell/2)`） */
  x: number
  y: number
}

/**
 * 坐标映射（`05-canvas.md` §三）：图片点 `(startX, startY)` ≡ 格 `[0,0]` 的中心。
 *
 * 图**不自带像素尺寸**——渲染侧把图片放进取图盒的 `auto` 尺寸里（`ui/Texture.tsx`），
 * 于是只需交出「缩放倍率 ＋ 左上角落点」，图片自己的像素数由浏览器按素材原样读。
 *
 * @param screenCell 屏幕上一格多少像素（本工程恒为 `MapView` 的 `CELL`）
 */
export function backgroundPlacement(
  layer: SkinBackgroundLayer | undefined,
  screenCell: number,
): BackgroundPlacement | undefined {
  if (!backgroundUsable(layer)) return undefined
  if (!Number.isFinite(screenCell) || screenCell <= 0) return undefined

  const scale = screenCell / layer.cellSize
  const center = screenCell / 2
  return { scale, x: center - (layer.startX ?? 0) * scale, y: center - (layer.startY ?? 0) * scale }
}
