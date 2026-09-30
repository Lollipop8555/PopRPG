/**
 * 主题 token 过滤（`skin/00-package.md` §3.3，取舍 `S-23`）。
 *
 * `theme` 只允许覆盖**观感** token；**布局** token 与不在 `:root` 中的未知键名一律忽略，
 * 并交给校验器报 `KP-9`。皮肤因此改不动间距与顶部栏高度。
 */

import { SKIN_LAYOUT_TOKENS, SKIN_THEME_TOKENS, type SkinTheme } from '../../types'

/** 过滤结果 */
export interface ThemeVars {
  /** 允许生效的 CSS 变量 */
  vars: Record<string, string>
  /** 被忽略的键名（布局 token 或未知 token），按声明顺序 */
  ignored: string[]
}

const ALLOWED = new Set<string>(SKIN_THEME_TOKENS)
const LAYOUT = new Set<string>(SKIN_LAYOUT_TOKENS)

/** 该键是否允许由皮肤覆盖 */
export function isSkinThemeToken(key: string): boolean {
  return ALLOWED.has(key)
}

/** 该键是否为不可覆盖的布局 token */
export function isSkinLayoutToken(key: string): boolean {
  return LAYOUT.has(key)
}

/** 过滤 `theme` 节：只留下白名单内的观感 token */
export function themeVars(theme: SkinTheme | undefined): ThemeVars {
  const vars: Record<string, string> = {}
  const ignored: string[] = []
  for (const [key, value] of Object.entries(theme ?? {})) {
    if (ALLOWED.has(key)) vars[key] = value
    else ignored.push(key)
  }
  return { vars, ignored }
}
