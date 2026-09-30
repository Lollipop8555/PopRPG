/**
 * 道路样式集选取（`skin/01-road.md` §六），并列情况有确定兜底顺序：
 *
 * ① 未标标签的样式集优先（空 `tags` 即通配底样）；
 * ② 标签命中数多者优先（`|tags ∩ R|` 降序，按集合交去重计数）；
 * ③ 声明顺序靠前者优先（同分不动）。
 *
 * `mode` 缺省 `any`（命中任意一个标签即候选）；`mode: all` 要求 `s.tags ⊆ R`。
 */

import type { SkinRoadStyle } from '../../types'

/** 选出该格子标签对应的样式集；无样式集或无候选时返回 `undefined` */
export function pickRoadStyle(
  tags: readonly string[],
  styles: readonly SkinRoadStyle[] | undefined,
): SkinRoadStyle | undefined {
  if (!styles || styles.length === 0) return undefined

  const wanted = new Set(tags)
  let best: SkinRoadStyle | undefined
  let bestHits = 0
  let bestUntagged = false

  for (const style of styles) {
    const declared = [...new Set(style.tags ?? [])]
    const untagged = declared.length === 0
    const hits = untagged ? 0 : declared.filter((t) => wanted.has(t)).length

    if (!untagged) {
      if (style.mode === 'all') {
        if (hits !== declared.length) continue
      } else if (hits === 0) continue
    }

    if (best === undefined) {
      best = style
      bestHits = hits
      bestUntagged = untagged
      continue
    }
    const better = untagged && !bestUntagged
      ? true
      : untagged === bestUntagged && !untagged && hits > bestHits
    if (better) {
      best = style
      bestHits = hits
      bestUntagged = untagged
    }
  }

  return best
}
