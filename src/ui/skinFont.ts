/**
 * **皮肤包字体**（`skin/06-item-building.md` §2.3 的 `building.*.font`）：
 * 把包内字体文件接进页面，供地图上的建筑名称使用。
 *
 * - **两种写法**：包内文件路径（按扩展名认，如 `resource/font/hand.ttf`）与浏览器内置字体名
 *   （如 `serif`、`Microsoft YaHei`）。前者注入 `@font-face`、族名取**文件名去扩展名**；
 *   后者原样交给 CSS，不注入。
 * - **缺文件即回退内置字体**（校验项 `KIB-4`）：文件不在包里时返回 `undefined`，调用方
 *   不写 `font-family`，落回 CSS 默认字体——与「字体文件失败」同一结果。
 * - **幂等**：同一族名只维护一条 `@font-face`（换皮肤时改写 `src`），不随渲染次数增长。
 */

import { useEffect } from 'react'
import type { SkinPath } from '../types'
import { useSkinStore } from '../store/skin'

/** 认得出的字体扩展名；**只有**带这几种扩展名的才算包内字体 */
const FONT_EXT = /\.(?:ttf|otf|ttc|woff2?)$/i

/** 是不是包内字体文件（按扩展名判：`hand.ttf` 是，`serif` 不是） */
export function isPackFontFile(font: string | undefined): boolean {
  return font !== undefined && FONT_EXT.test(font)
}

/**
 * 字体族名：**文件名去扩展名**（§2.3 末条）。
 * 带目录时只取最后一段：`resource/font/hand.ttf` → `hand`。
 */
export function fontFamilyOf(font: string): string {
  const base = font.slice(font.lastIndexOf('/') + 1)
  return base.replace(FONT_EXT, '')
}

/** 已注入的族名 → 地址（同一个族换地址时改写同一条规则） */
const injected = new Map<string, string>()
let styleEl: HTMLStyleElement | undefined

function rule(family: string, url: string): string {
  // `font-display: swap`：字体没到位时先用回退字体排出来，不阻塞地图
  return `@font-face{font-family:"${family}";src:url("${url}");font-display:swap;}`
}

/** 注入一条 `@font-face`；同族同地址重复调用无副作用 */
function injectFontFace(family: string, url: string): void {
  if (typeof document === 'undefined') return
  if (injected.get(family) === url) return

  injected.set(family, url)
  styleEl ??= document.head.appendChild(document.createElement('style'))
  styleEl.setAttribute('data-skin-font', '')
  styleEl.textContent = [...injected].map(([f, u]) => rule(f, u)).join('\n')
}

/** 清空注入表（测试用；换皮肤不需要——同族会改写 `src`） */
export function resetPackFonts(): void {
  injected.clear()
  styleEl?.remove()
  styleEl = undefined
}

/**
 * 接线：`font` 字段 → 可用的 CSS 字体族名。
 *
 * - 包内文件：在包里才注入并返回族名；缺文件返回 `undefined`（回退内置字体，`KIB-4`）
 * - 内置字体名：原样返回
 * - 未启用皮肤、该建筑没配 `font`：返回 `undefined`，调用方不写 `font-family`
 */
export function usePackFont(font: SkinPath | undefined): string | undefined {
  const assets = useSkinStore((s) => s.assets)
  const isFile = isPackFontFile(font)
  const family = font === undefined ? undefined : isFile ? fontFamilyOf(font) : font
  const usable = font !== undefined && (!isFile || assets.has(font))

  useEffect(() => {
    if (!usable || !isFile || font === undefined || family === undefined) return
    const url = assets.urlOf(font)
    if (url !== undefined) injectFontFace(family, url)
  }, [assets, font, family, isFile, usable])

  return usable ? family : undefined
}
