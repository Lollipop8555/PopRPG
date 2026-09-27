/**
 * 掷骰流水（§7.2）：**所有电脑掷骰都上屏** —— 怪物掷了什么、为什么这么打、力值链五环分别出了多少。
 * 道具不占回合，日志里用另一种颜色标出来。
 */

import { useEffect, useRef, useState } from 'react'
import type { Session } from '../types/session'

export default function DiceLog({ session }: { session: Session }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [die, setDie] = useState<{ pips: number; key: number } | null>(null)
  const lastRoll = session.rolls[session.rolls.length - 1]

  useEffect(() => {
    if (!lastRoll) return
    setDie({ pips: lastRoll.pips, key: session.rolls.length })
  }, [lastRoll, session.rolls.length])

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [session.log.length])

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>流水</span>
        <span className="dice-tray">
          {die && (
            <span key={die.key} className="die rolled" title="最近一次掷骰">
              {die.pips}
            </span>
          )}
          {lastRoll && (
            <span className="faint">
              最近：{lastRoll.label} {lastRoll.dice} = {lastRoll.pips}
            </span>
          )}
        </span>
      </div>

      <div ref={boxRef} className="scroll" style={{ flex: 1, minHeight: 120, maxHeight: 220 }}>
        {session.log.slice(-60).map((line, i) => (
          <div key={i} className={`logline ${line.tone ?? 'info'}`}>
            {line.text}
          </div>
        ))}
      </div>

      {session.rolls.length > 0 && (
        <div className="row" style={{ gap: 4, marginTop: 6, maxHeight: 64, overflow: 'auto' }}>
          {session.rolls.slice(-12).map((r, i) => (
            <span key={i} className="badge" title={r.label}>
              {r.dice}→{r.pips}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
