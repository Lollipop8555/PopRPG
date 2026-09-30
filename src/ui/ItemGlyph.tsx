/**
 * **道具图标**（`skin/06-item-building.md` §3.2）：背包 / 穿戴格子里那一格道具字形。
 *
 * 与 [`RoleGlyph`](./RoleGlyph.tsx) 同一套路：有素材就出图（行内层 `1em` 方框、等比内缩，
 * 尺寸跟着所在处的 `.bag-ico` / `.equip-ico` 字号走），没有就把组件原本的 `icon` 交出去——
 * 取图沿用唯一入口 `textureProps()`，故「包里缺这张图」「皮肤没启用」都自动落到字形上，
 * 调用方**只看这里渲染出什么、不判断素材类型**（[`skin.md`](../../docs/design/skin.md) §四）。
 *
 * 只画调用方查出来的那一张（`itemSkinOf()` 的结果），**不跨键借用**：别的道具配了图标，
 * 这一件也不会去借（§2.3 回退表）。
 */

import { CSS_SIZED_BOX, textureProps, InlineTexture } from './Texture'
import { textureRef } from '../engine/skin'
import type { SkinAssets } from '../io/skin-assets'
import type { SkinItemSkin } from '../types'

export function ItemGlyph({
  skin,
  assets,
  icon,
  className,
}: {
  /** `itemSkinOf()` 查出来的那一份（`undefined` 即该道具缺位） */
  skin?: SkinItemSkin
  assets: SkinAssets
  /** 素材缺位时的原样回退：组件定义里的 `icon` 字形 */
  icon: string
  /** 所在处的图标类名（`bag-ico` / `equip-ico`）：**素材与字形共用**，尺寸只此一处 */
  className?: string
}) {
  const tile = textureProps(textureRef(skin?.icon), assets, CSS_SIZED_BOX, { className })
  return tile ? <InlineTexture {...tile} /> : <span className={className}>{icon}</span>
}
