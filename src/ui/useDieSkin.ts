/**
 * 骰子的接线 hook（`skin/04-misc.md` §三）：本体与骰面各一条取图链，共用 `store/skin` 的两份状态。
 *
 * - **本体**走 CSS 背景：`.die` 盒（46 / 38 / 34 三档）已有尺寸与描边，素材**等比缩放进盒**
 *   （`contain`，三档尺寸共用一张、绝不拉伸），描边与圆角照旧归 CSS。
 * - **骰面**走**行内层**：尺寸随本体、交给 CSS；1–6 取点阵 `d1`–`d6`，其余点数取数字面 `numeric`。
 *
 * 未启用皮肤、没配该键、包里缺这张图，一律返回 `undefined`：`DieFace` 照旧画程序点阵或数字文本。
 */

import type { CSSProperties } from 'react'
import { dieBodyOf, dieFaceOf, textureRef } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { CSS_SIZED_BOX, surfaceStyle, textureProps, type TextureProps } from './Texture'

/** 骰子本体：铺进 `.die` 盒（等比、不拉伸）；没配即不传 `style`，CSS 纸面照旧 */
export function useDieBodyStyle(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const misc = useSkinStore((s) => s.skin?.manifest.misc)
  return surfaceStyle(textureRef(dieBodyOf(misc)), assets, 'contain')
}

/** 骰面素材（1–6 点阵 / 其余数字面）：尺寸随本体，故借行内层的 `.die-face` 盒 */
export function useDieFace(pips: number): TextureProps | undefined {
  const assets = useSkinStore((s) => s.assets)
  const misc = useSkinStore((s) => s.skin?.manifest.misc)
  return textureProps(textureRef(dieFaceOf(misc, pips)), assets, CSS_SIZED_BOX, {
    className: 'die-face',
  })
}
