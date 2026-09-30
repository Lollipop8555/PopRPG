/**
 * 按钮素材的接线 hook（`skin/03-window.md` §四）：与容器衬底**同一条取图链**，
 * 只多一步「从四态里取 `normal`」。
 *
 * - 取图 `buttonOf()`（`engine/skin/lookup.ts`）→ 落图 `surfaceStyle()`（`ui/Texture.tsx`）。
 *   按钮是**随内容族**（尺寸随文字量走），**素材交了 `slice` 就走九宫格**（`border-image`）、
 *   没交即整图拉伸铺满；圆角、描边、间距仍归 `.btn` 自己的 CSS（§五「素材只提供纸面底纹」）。
 * - 九宫格已在 `surfaceStyle()` 内部落地：容器与按钮**一处改完**，本文件不动。
 * - `hover` / `active` / `disabled` 三态 V1 不读取，仍由 CSS 表现（`KW-6`）：
 *   `:disabled` 的 `opacity`、`:active` 的 `transform` 照旧生效，`:hover` 变的只是素材之下的底色。
 * - 未启用皮肤、没配该键、包里缺这张图，一律返回 `undefined`，调用方**不传 `style`**、
 *   CSS 纸面照旧（§一：素材是可选叠加层）。
 */

import type { CSSProperties } from 'react'
import { buttonOf, textureRef, type ButtonKind } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useButtonStyle(kind: ButtonKind): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return surfaceStyle(textureRef(buttonOf(win, kind)), assets)
}
