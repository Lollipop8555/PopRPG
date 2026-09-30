/**
 * 图标替换的接线 hook（`skin/04-misc.md` §四）：把 `store/skin` 的两份状态接到纯函数上。
 *
 * 只做一件事——取图 `iconOf()`（`engine/skin/lookup.ts`）→ 取图属性 `textureProps()`
 * （`ui/Texture.tsx`，唯一入口，故「包里缺这张图」「皮肤没启用」都自动落到 `undefined`）。
 * 拿到 `undefined` 即该处照旧渲染 lucide 元件，调用方**不判断素材类型**。
 */

import { iconOf, textureRef, type IconName } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { CSS_SIZED_BOX, textureProps, type TextureProps } from './Texture'

/** 按 lucide 图标名取替换素材；未配该名 / 包里缺图 / 未启用皮肤一律 `undefined` */
export function useIconTexture(name: IconName | string): TextureProps | undefined {
  const assets = useSkinStore((s) => s.assets)
  const misc = useSkinStore((s) => s.skin?.manifest.misc)
  return textureProps(textureRef(iconOf(misc, name)), assets, CSS_SIZED_BOX)
}
