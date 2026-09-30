/**
 * 手绘分隔线的接线 hook（`skin/03-window.md` §二「单向族」/ §四 `rules.line`）。
 *
 * CSS 那条线是 `repeat-x` 的手绘图（`theme.css` 的 `.sketch-line`）；素材接管后改由
 * **单轴九宫格**铺一条：切片上下给 0，`border-image` 只在左右拉伸，与「一端固定一端伸缩」逐字对应。
 *
 * §七.2 还在问「是否改用平铺素材」——那是同一处的另一档（`tile`），**未裁决前不引入第二套字段**：
 * 现在只读 `rules.line` 一条键。
 */

import type { CSSProperties } from 'react'
import { ruleOf, textureRef } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useRuleStyle(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return surfaceStyle(textureRef(ruleOf(win)), assets)
}
