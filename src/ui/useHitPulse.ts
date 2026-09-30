/**
 * 「受击瞬间」这一拍（`skin/02-role.md` §4.4）。
 *
 * 结算全在纯函数里，会话里**没有**「正在挨打」这个字段——最贴近 §4.4「受击瞬间」的信号
 * 就是**锚点（hp）掉下来的那一帧**：谁掉血谁受击，掉多少、是谁打的都不问。
 * 回血 / 升级 / 换局 / 换怪物都不是受击，故 `key` 一变只把基准挪过去、不发这一拍。
 *
 * 这一拍的长度是 `HIT_MS`（与 CSS 里 `.portrait` / `.piece-hit` 的回弹时长同值）：
 * 有 `hurt` 素材时它决定受击图显示多久，没有素材时它决定形变何时回弹。
 */

import { useEffect, useRef, useState } from 'react'

/** 受击一拍的时长（§4.4：约 `120ms` 回弹；**写死、不做逐素材配置**，取舍 `S-32`） */
export const HIT_MS = 120

/**
 * @param anchor 受击锚点（一般就是这一位的 `hp`）
 * @param key    主体标识（怪物 id 之类）：换了主体就不算受击，只挪基准
 */
export function useHitPulse(anchor: number, key?: string): boolean {
  const [hit, setHit] = useState(false)
  const seen = useRef({ anchor, key })

  useEffect(() => {
    const before = seen.current
    seen.current = { anchor, key }
    if (before.key === key && anchor < before.anchor) setHit(true)
  }, [anchor, key])

  // 单独一个 effect 管计时：`hit` 没变时重复执行也不会把这一拍续上
  useEffect(() => {
    if (!hit) return
    const timer = setTimeout(() => setHit(false), HIT_MS)
    return () => clearTimeout(timer)
  }, [hit])

  return hit
}
