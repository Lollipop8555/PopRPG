/**
 * 皮肤主题变量的落地与卸载（`skin/00-package.md` §3.3，取舍 `S-23`）。
 *
 * 变量写到 `document.documentElement` 的**内联样式**上：`:root` 里其它变量（缺省观感）照旧，
 * 皮肤没覆盖的 token 自然落回缺省值。卸载时把**本次写过的键逐个移除**，不做「清空内联样式」
 * ——避免抹掉别处写在同一元素上的变量。
 *
 * 过滤在 `engine/skin/theme.ts` 里完成：只有观感 token 会写出去，布局 token 与未知键名被忽略。
 */

import { themeVars, type ThemeVars } from '../engine/skin/theme'
import type { SkinTheme } from '../types'

export interface AppliedTheme extends ThemeVars {
  /** 卸载：逐键移除本次写入的变量 */
  release(): void
}

/** 落地一份 `theme`；返回实际生效的变量、被忽略的键与卸载函数 */
export function applySkinTheme(
  theme: SkinTheme | undefined,
  root: HTMLElement = document.documentElement,
): AppliedTheme {
  const { vars, ignored } = themeVars(theme)
  const written = Object.keys(vars)
  for (const key of written) root.style.setProperty(key, vars[key])

  return {
    vars,
    ignored,
    release() {
      for (const key of written) root.style.removeProperty(key)
    },
  }
}
