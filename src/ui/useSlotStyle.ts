/**
 * 固定族格子底纹的接线 hook（`skin/03-window.md` §二 / §四）：与容器衬底**同一条取图链**。
 *
 * - 取图 `slotOf()`（`engine/skin/lookup.ts`）→ 落图 `surfaceStyle()`（`ui/Texture.tsx`）。
 *   格子属**固定族**（尺寸写死在程序里：技能格 54、奖励卡 92、部位标签 44），**整图等比拉伸就够**
 *   （`KW-4`：尺寸写死不会变形）；素材若交了 `slice` 也照样走九宫格。
 *   圆角、描边、间距仍归格子自己的 CSS（§五「素材只提供纸面底纹」）。
 * - 九宫格已在 `surfaceStyle()` 内部落地：容器 / 按钮 / 格子**一处改完**，本文件不动。
 * - 未启用皮肤、没配该键、包里缺这张图，一律返回 `undefined`，调用方**不传 `style`**、
 *   CSS 纸面照旧（§一：素材是可选叠加层）。
 * - **背包格是唯一的交叠处**：`.bag-cell` 已有 `item.background`（`06-item-building.md` §3.2）。
 *   取「**道具衬底优先、格位底纹兜底**」——道具配了 `background` 就整格归它，没配才铺 `slots.bag`。
 *   这条优先级只写在调用点（`play/BagPanel.tsx`），hook 本身仍是纯读取、不判别的。
 */

import type { CSSProperties } from 'react'
import { slotOf, textureRef, type SlotKind } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { surfaceStyle } from './Texture'

export function useSlotStyle(kind: SlotKind): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const win = useSkinStore((s) => s.skin?.manifest.window)
  return surfaceStyle(textureRef(slotOf(win, kind)), assets)
}
