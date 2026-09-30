/**
 * 画布背景取层（`skin/05-canvas.md` §二）。
 *
 * 逐图清单以下标即地图下标：**下标越界即 clamp 到最后一层**；
 * 选中的那一层不可用（没有 `img`）时**向前找最近可用的一层**；
 * 一路到首层都没有可用图，则整节未接管，渲染侧回退程序绘制背景。
 *
 * 未参与本函数取舍的其它字段（`cellSize` / `startX` / `startY`）缺失时由渲染侧取默认值，
 * `color` 每层各自携带、漏写即全局主题色（**不做层级回退**）。
 */

import type { SkinBackground, SkinBackgroundLayer } from '../../types'

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
 * 取该地图下标应绘制的背景层。
 *
 * @param bg        `background` 节，整体缺省或全部层不可用即 `undefined`（未接管）
 * @param mapIndex  地图下标（负数按 `0` 处理）
 */
export function backgroundOf(
  bg: SkinBackground | undefined,
  mapIndex: number,
): BackgroundPick | undefined {
  const layers = backgroundLayers(bg)
  if (layers.length === 0) return undefined

  const wanted = Math.max(0, Math.trunc(mapIndex))
  for (let i = Math.min(wanted, layers.length - 1); i >= 0; i--) {
    if (layers[i].img) return { layer: layers[i], index: i }
  }
  return undefined
}
