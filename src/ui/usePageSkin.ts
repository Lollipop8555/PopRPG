/**
 * 欢迎页与游戏首页的接线 hook（`skin/08-pages.md`）：两屏各一条取图链，共用 `store/skin` 的两份状态。
 *
 * 只做一件事——把 `store/skin` 的两份状态接到纯函数上：
 * 取图（`engine/skin/lookup.ts`）→ 落图（`ui/Texture.tsx`）。
 * 未启用皮肤、没配该键、包里缺这张图，一律返回 `undefined`，调用方**不传 `style` / 不换字形**、
 * 现有 CSS 手绘封面照旧（§一：素材是可选叠加层，两屏均可整体缺省）。
 *
 * 四个落点各一条链，**互不借用**（§2.3 逐节点降级）：
 * - 整屏背景：`startup.bg` / `lobby.bg`（`pageBgStyle()`）
 * - 「这一局的世界」面板底：`lobby.panel`（`surfaceStyle()`）
 * - 出身卡底 ＋ 选中态描边：`lobby.card` / `card.selected`（`lobbyCardPaint()`）
 * - 欢迎页三件图形：`startup.title` / `cover` / `dice`（`startupArtOf()`）
 */

import type { CSSProperties } from 'react'
import { lobbyCardPaint, pageBgOf, pageFitOf, startupArtOf, textureRef, type StartupArt } from '../engine/skin'
import type { TextureBox } from '../engine/skin/texture'
import { useSkinStore } from '../store/skin'
import { pageBgStyle, surfaceStyle, textureProps, type TextureProps } from './Texture'

/** 欢迎页整屏背景；`fit` 缺省 `cover`，非法值也按 `cover`（`KPG-1`） */
export function useStartupBgStyle(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const startup = useSkinStore((s) => s.skin?.manifest.startup)
  const bg = pageBgOf(startup)
  return pageBgStyle(textureRef(bg), assets, pageFitOf(bg))
}

/** 游戏首页整屏背景；**不借用 `startup.bg`** */
export function useLobbyBgStyle(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const lobby = useSkinStore((s) => s.skin?.manifest.lobby)
  const bg = pageBgOf(lobby)
  return pageBgStyle(textureRef(bg), assets, pageFitOf(bg))
}

/** 「这一局的世界」正文面板的底（`.panel.scroll`）；铺法看素材有没有交 `slice`（九宫格已落地） */
export function useLobbyPanelStyle(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const lobby = useSkinStore((s) => s.skin?.manifest.lobby)
  return surfaceStyle(textureRef(lobby?.panel), assets)
}

/** 出身卡底：`img` 铺满整卡（没交切片即拉伸，`KPG-2`），`stroke` 只写在配了的那一态 */
export function useLobbyCardStyle(selected: boolean): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const lobby = useSkinStore((s) => s.skin?.manifest.lobby)
  const paint = lobbyCardPaint(lobby, selected)
  if (paint === undefined) return undefined

  const style = surfaceStyle(textureRef(paint.img), assets)
  if (paint.stroke === undefined) return style
  return { ...style, borderColor: paint.stroke }
}

/** 欢迎页图形：取图 → 落进给定盒（标题走行内层，主视觉走洞穴 SVG 的 120×92 盒） */
export function useStartupArt(art: StartupArt, box: TextureBox): TextureProps | undefined {
  const assets = useSkinStore((s) => s.assets)
  const startup = useSkinStore((s) => s.skin?.manifest.startup)
  return textureProps(textureRef(startupArtOf(startup, art)), assets, box)
}

/**
 * 主视觉上的装饰骰子**本体**：铺进 `.die.cover-die` 盒（46×46，与游戏里那三档同一个 `.die`），
 * 故与 `misc.dice.body` 同一档落法——**等比缩放进盒、绝不拉伸**。
 *
 * 骰面**不在这里**：按 §2.1 复用 `skin/04-misc.md` §三的 `misc.dice.faces`，
 * 故装饰骰子直接用 `useDieFace()` / `DieFace`，本节不另设骰面字段（`KPG-4`）。
 */
export function useStartupDiceBody(): CSSProperties | undefined {
  const assets = useSkinStore((s) => s.assets)
  const startup = useSkinStore((s) => s.skin?.manifest.startup)
  return surfaceStyle(textureRef(startupArtOf(startup, 'dice')), assets, 'contain')
}
