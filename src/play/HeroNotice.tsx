/**
 * 「主角得到了什么」的**浮条**（§4.9.2 对话赠予 / §4.8.11 商店成交）。
 *
 * 开箱 / 战利品 / 事件本来就有遭遇弹层揭晓，提示写在弹层里；**对话赠予**以前只往
 * `session.log` 写一行（那一行只在「流水」抽屉里看得见）—— 玩家选完就以为东西没到手。
 * 这里补上**没有揭晓处时的那个落点**：`heroGain()` 排进 `session.notices` 的队头在这儿弹出。
 *
 * 只认队列队头：弹完（自动 / 点掉）队头出队，下一条接着弹 —— 同一样东西**只提示一次**，
 * 也不会一次糊一屏。
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '../types/session'
import GainNoteView from './GainNoteView'

/** 停这么久自动收（玩家也能点掉；别指望他一定盯着看） */
const HOLD_MS = 3600

export default function HeroNotice({ session, onDismiss }: { session: Session; onDismiss: () => void }) {
  const note = session.notices?.[0]

  // 回调每次渲染都是新的，用 ref 兜住 —— 否则定时器会被反复重置、永远不关
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => dismiss.current(), HOLD_MS)
    return () => clearTimeout(t)
  }, [note])

  if (!note) return null

  // 挂到 `body`：跟遭遇 / 对话弹层（也是 `Overlay` 的 portal）站在同一层上，
  // 只靠 `z-index` 分上下 —— 免得被页面里哪个带 `transform` 的祖先拉进它的层级里压住
  return createPortal(
    <button className="gain-pop" onClick={onDismiss} title="点掉">
      <span className="gain-pop-src">{note.source}</span>
      <GainNoteView note={note} compact />
    </button>,
    document.body,
  )
}
