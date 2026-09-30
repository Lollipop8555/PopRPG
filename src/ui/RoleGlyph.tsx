/**
 * **形象格**（`skin/02-role.md` §三）：文字行里那一格职业 / 怪物 / NPC 形象。
 *
 * 有素材就出图（行内层 `1em` 方框、等比内缩），没有就把原来的 emoji 原样交出去——
 * 取图沿用唯一入口 `textureProps()`，故「包里缺这张图」「皮肤没启用」都自动落到 emoji 上，
 * 调用方**只看这里渲染出什么，不判断素材类型**（[`skin.md`](../../docs/design/skin.md) §四）。
 *
 * 各分组**互不借用**：这里只画调用方查出来的那一个 `sprite`（`roleSprite()` 的结果），
 * 职业 / 怪物 / NPC 缺位时不会去借别的组的图（§三 回退表）。
 */

import { CSS_SIZED_BOX, textureProps, InlineTexture } from './Texture'
import { spriteRef } from '../engine/skin'
import type { SkinAssets } from '../io/skin-assets'
import type { SkinSprite } from '../types'

export function RoleGlyph({
  sprite,
  assets,
  icon,
}: {
  /** `roleSprite()` 查出来的那一张（`undefined` 即该组缺位） */
  sprite?: SkinSprite
  assets: SkinAssets
  /** 素材缺位时的原样回退：该组自己的 `icon` emoji */
  icon?: string
}) {
  const tile = textureProps(spriteRef(sprite), assets, CSS_SIZED_BOX)
  return tile ? <InlineTexture {...tile} /> : <>{icon}</>
}
