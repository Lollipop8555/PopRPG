/**
 * 血蓝条的接线 hook（`skin/03-window.md` §二「单向族」/ §四 `bars`）。
 *
 * 一个 `.bar` 拆成**两层**分别取图：轨道 (`track`) 铺在 `.bar` 本身、填充 (`fill`) 铺在 `.bar > .fill`。
 * 两张图各自独立——只配轨道就只换轨道，填充仍是 CSS 那条实色。**条名不跨档借用**（`hp` 不会拿到 `mp` 的图）。
 *
 * 落法复用容器那条链：`barOf()` → `textureRef()` → `surfaceStyle()`。单向族的**单轴九宫格**不是新代码：
 * 素材把切片的上下给 0，`border-image` 就只在左右拉伸（`skin.md` §3.3）。
 * 未启用皮肤 / 未配该档 / 包里缺这张图一律返回 `undefined`，调用方原样保留自己的 CSS。
 */

import type { CSSProperties } from 'react'
import { barOf, textureRef, type BarTone } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useBarStyle(tone: BarTone): { track?: CSSProperties; fill?: CSSProperties } {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  const bar = barOf(win, tone)
  return {
    track: surfaceStyle(textureRef(bar?.track), assets),
    fill: surfaceStyle(textureRef(bar?.fill), assets),
  }
}
