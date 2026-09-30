/**
 * 按钮素材的接线 hook（`skin/03-window.md` §四 / §4.1）：与容器衬底**同一条取图链**，
 * 只多一步「从四态里取图」。
 *
 * - 取图 `buttonStatesOf()`（`engine/skin/lookup.ts`，`buttonOf()` 就是它的 `normal` 那一项）
 *   → 落图 `buttonStyle()`（`ui/Texture.tsx`）。
 *   按钮是**随内容族**（尺寸随文字量走），**素材交了 `slice` 就走九宫格**（`border-image`）、
 *   没交即整图拉伸铺满；圆角、描边、间距仍归 `.btn` 自己的 CSS（§五「素材只提供纸面底纹」）。
 * - **四态分两种落法**：`normal` 是行内属性（与容器 / 格子同档），`hover` / `active` / `disabled`
 *   是行内写下的 CSS 变量（`--sk-<态>-bg` / `-bi`），由 `theme.css` 的伪类规则按状态取用——
 *   行内写不进伪类，这是唯一的落法（两处变量名要一起改）。
 * - **缺省回退链**（§4.1）：某态没写、或该态的图不在包里，就不写那对变量，
 *   `theme.css` 的 `var(--sk-hover-*, var(--sk-normal-*))` 自然回落 `normal` ＋ CSS 表现；
 *   而 `normal` 缺位即**整颗按钮算没配**（三态写了也一并作废）。
 * - 未启用皮肤、没配该键、包里缺 `normal` 那张图，一律返回 `undefined`，调用方**不传 `style`**、
 *   CSS 纸面照旧（§一：素材是可选叠加层）。
 */

import type { CSSProperties } from 'react'
import { buttonStatesOf, type ButtonKind } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { buttonStyle } from './Texture'

export function useButtonStyle(kind: ButtonKind): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return buttonStyle(buttonStatesOf(win, kind), assets)
}
