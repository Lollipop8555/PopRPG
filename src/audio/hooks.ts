/**
 * 音效触发钩子（`skin/07-audio.md` §三）：把「事件的边沿」翻译成一次 `sfx()` 调用。
 *
 * 音效是**一次性**的，钩子只认**边沿**（掷骰开始、骰子落定、掉血、弹层开合、道具入手、
 * 操作被拒），不做轮询也不重复发。会话里没有「正在挨打 / 刚开盘」这类字段，
 * 于是都靠**记住上一拍**再比出边沿——与 `ui/useHitPulse.ts` 同一套思路。
 */

import { useEffect, useRef } from 'react'
import type { Session } from '../types/session'
import { useAudioStore } from '../store/audio'

/** 掷骰：`spinning` 起跳＝`dice_roll`；`rollCount` 增加＝`dice_land` */
export function useDiceSfx(spinning: boolean, rollCount: number): void {
  const wasSpinning = useRef(false)
  const wasCount = useRef(rollCount)

  useEffect(() => {
    if (spinning && !wasSpinning.current) useAudioStore.getState().sfx('dice_roll')
    wasSpinning.current = spinning
  }, [spinning])

  useEffect(() => {
    if (rollCount > wasCount.current) useAudioStore.getState().sfx('dice_land')
    wasCount.current = rollCount
  }, [rollCount])
}

/**
 * 掉血（`hit`）：主角或怪物 hp 下落的那一拍各响一次；**换怪物不算挨打**（只挪基准），
 * 与 `useHitPulse(anchor, key)` 同口径。放在常驻的游玩主界面上，交锋内外都覆盖。
 */
export function useBattleSfx(session: Session): void {
  const playerHp = session.player.resources.hp
  const monsterHp = session.monster?.resources.hp
  const monsterKey = session.monster?.id
  const prev = useRef({ playerHp, monsterHp, key: monsterKey })

  useEffect(() => {
    const before = prev.current
    const sameFoe = before.key === monsterKey
    const heroDropped = playerHp < before.playerHp
    const foeDropped = monsterHp !== undefined && before.monsterHp !== undefined && monsterHp < before.monsterHp
    if (sameFoe && (heroDropped || foeDropped)) useAudioStore.getState().sfx('hit')
    prev.current = { playerHp, monsterHp, key: monsterKey }
  }, [playerHp, monsterHp, monsterKey])
}

/** 弹层 / 抽屉开合：`open` 上升沿响「开」、下降沿响「关」；**卸载时还开着就补一声「关」** */
export function useModalSfx(open: boolean): void {
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) useAudioStore.getState().sfx('open')
    if (!open && wasOpen.current) useAudioStore.getState().sfx('close')
    wasOpen.current = open
  }, [open])
  useEffect(
    () => () => {
      if (wasOpen.current) useAudioStore.getState().sfx('close')
    },
    [],
  )
}

/** 道具入手（`pickup`）：浮条队头一换（新的一样东西到手）响一次 */
export function useNoticeSfx(session: Session): void {
  const head = session.notices?.[0]
  const prev = useRef(head)
  useEffect(() => {
    if (head && head !== prev.current) useAudioStore.getState().sfx('pickup')
    prev.current = head
  }, [head])
}

function countBy(inventory: Session['player']['inventory']): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of inventory) map.set(entry.id, (map.get(entry.id) ?? 0) + entry.count)
  return map
}

/**
 * 买 / 卖成交（`coin`）：商店开着时**某件道具件数变多**的那一拍响一次。
 * 不比对总数——成交往往「货币减少 ＋ 商品增加」，总数可能不升反降；逐件比才准。
 */
export function useCoinSfx(session: Session): void {
  const counts = countBy(session.player.inventory)
  const shopOpen = session.encounter?.kind === 'shop'
  const prev = useRef(counts)
  useEffect(() => {
    let gained = false
    counts.forEach((count, id) => {
      if (count > (prev.current.get(id) ?? 0)) gained = true
    })
    if (shopOpen && gained) useAudioStore.getState().sfx('coin')
    prev.current = counts
  }, [counts, shopOpen])
}

/** 操作被拒（`error`）：日志里冒出一条 `bad` 语气的新行进（背包已满、点数不够…）响一次 */
export function useErrorSfx(session: Session): void {
  const log = session.log
  const prevLen = useRef(log.length)
  useEffect(() => {
    if (log.length > prevLen.current) {
      const fresh = log.slice(prevLen.current)
      if (fresh.some((line) => line.tone === 'bad')) useAudioStore.getState().sfx('error')
    }
    prevLen.current = log.length
  }, [log])
}
