/**
 * **立绘**（`skin/02-role.md` §四）：底栏 / 状态面板头部 / 对战 VS 区 / 出身卡上那一张角色大图。
 *
 * 与形象格（`RoleGlyph`）同源不同命，三处差别都在这里收口：
 * - **缺位即整块不出现**：不渲染、不占位、不回退 emoji（§4.3）——故无法取图时返回 `null`；
 * - **尺寸跟窗口走**：高度＝窗口短边 `W`（即 `100vmin`）的固定比例，宽度由素材宽高比推出、
 *   受可用宽度 25% 上限约束，一律交给 CSS（`.portrait-hud` / `-vs` / `-card`，§4.2）；
 * - **默认底边对齐**：出身卡是唯一居中的落点（`center`）。
 *
 * 取图仍走唯一入口 `textureProps()`（`portraitTile()` 就是「立绘 → 那一份 props」的便捷包装），
 * 画图借**行内层**——它本就只取 `src` / `flip`，尺寸交给 CSS。
 */

import { CSS_SIZED_BOX, textureProps, InlineTexture, type TextureProps } from './Texture'
import { textureRef } from '../engine/skin'
import type { SkinAssets } from '../io/skin-assets'
import type { SkinPortrait } from '../types'

/** 立绘的高度档：底栏 / 状态面板头部与 VS 区、出身卡（§4.2 的三个比例值） */
export type PortraitSize = 'hud' | 'vs' | 'card'

/** 立绘取图：职业 / 怪物 / NPC 的回退链（`portraitOf()`）由调用方先走完，这里只做「这张画得出来吗」 */
export function portraitTile(
  portrait: SkinPortrait | undefined,
  assets: SkinAssets,
): TextureProps | undefined {
  return textureProps(textureRef(portrait), assets, CSS_SIZED_BOX)
}

export function Portrait({
  tile,
  size,
  center,
}: {
  /** `portraitTile()` 的结果；`undefined`（没配 / 包里缺图）即整块不渲染 */
  tile?: TextureProps
  size: PortraitSize
  /** 出身卡是唯一居中的落点，其余一律底边对齐（§4.2） */
  center?: boolean
}) {
  if (!tile) return null
  return (
    <span className={`portrait portrait-${size}${center ? ' portrait-center' : ''}`}>
      <InlineTexture {...tile} />
    </span>
  )
}
