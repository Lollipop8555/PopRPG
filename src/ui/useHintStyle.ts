/**
 * 提示条的接线 hook（`skin/03-window.md` §二「随内容族」/ §四 `hints`）。
 *
 * 随内容族**禁止硬拉伸**，故这类元素**必须**靠九宫格：素材带 `slice` 时 `surfaceStyle()`
 * 自动落到 `border-image`（四角原样、四边单向、中心双向），没带就整图拉伸（`KW-3` 会点名）。
 *
 * `.hintbox` 有**四种外观**（中性 ＋ `warn` / `error` / `ok`），字段只定义**三档 tone**：
 * 中性那档**没有键**，调用方**别调这个 hook**、让它继续走 CSS——这也是「三档」的字面意思。
 */

import type { CSSProperties } from 'react'
import { hintOf, textureRef, type HintTone } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useHintStyle(tone: HintTone): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return surfaceStyle(textureRef(hintOf(win, tone)), assets)
}
