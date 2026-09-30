/**
 * 容器衬底的接线 hook（`skin/03-window.md`）：对话框 / 抽屉 / 气泡三处共用这一条取图链。
 *
 * 只做一件事——把 `store/skin` 的两份状态（素材源 ＋ `window` 节）接到纯函数上：
 * 取图 `surfaceOf()`（`engine/skin/lookup.ts`）→ 落图 `surfaceStyle()`（`ui/Texture.tsx`）。
 * 未启用皮肤、没配该键、包里缺这张图，一律返回 `undefined`，调用方**不传 `style`**、
 * CSS 纸面照旧（§一：素材是可选叠加层）。
 */

import type { CSSProperties } from 'react'
import { surfaceOf, textureRef, type SurfaceKind } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useSurfaceStyle(kind: SurfaceKind): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return surfaceStyle(textureRef(surfaceOf(win, kind)), assets)
}
