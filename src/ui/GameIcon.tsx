/**
 * **游戏图标**（`skin/04-misc.md` §四）：游玩态那个「按图标名替换」的唯一入口。
 *
 * 各处原来直接写 `<Sword size={22} />` 这样的 lucide 元件；现在统一写成
 * `<GameIcon name="Sword" size={22} icon={Sword} />`——配了 `misc.icons.Sword` 就出素材，
 * 没配 / 包里缺图 / 未启用皮肤就原样交给 lucide 元件（`icon` 那一个）。
 *
 * 两条与 §四 对齐的规矩：
 * - **不套手绘滤镜**：素材是位图，走 `InlineTexture`（`<img>`）不带 `url(#poprpg-sketch)`；
 *   程序绘制的 lucide 元件照旧套。
 * - **不加衬底**：图标在游玩态就是一行内元素，没有方框（与组件库的圆角矩形衬底区分开）。
 *
 * 尺寸按 lucide 的 `size`（px）走：素材也占同一个 `size × size` 的盒、`object-fit: contain`
 * 等比内缩，因此**有没有素材都不改布局**。
 */

import type { LucideIcon } from 'lucide-react'
import { InlineTexture } from './Texture'
import { useIconTexture } from './useIconSkin'
import type { IconName } from '../engine/skin'

export function GameIcon({
  name,
  icon: Icon,
  size = 16,
  className,
}: {
  /** lucide 图标名，同时也是 `misc.icons` 的键 */
  name: IconName
  /** 素材缺位时的原样回退：原来的那个 lucide 元件 */
  icon: LucideIcon
  /** 与 lucide 同一档的像素尺寸，缺省 16 */
  size?: number
  className?: string
}) {
  const tile = useIconTexture(name)
  if (tile) {
    return <InlineTexture {...tile} className={className} style={{ width: size, height: size }} />
  }
  return <Icon size={size} className={className} />
}
