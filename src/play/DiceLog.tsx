/**
 * 掷骰流水（§7.2）：**所有电脑掷骰都上屏** —— 怪物掷了什么、为什么这么打、力值链五环分别出了多少。
 * 道具不占回合，日志里用另一种颜色（tone: 'item'）标出来。
 */

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Session } from '../types/session'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useButtonStyle } from '../ui/useButtonStyle'
import { useDieBodyStyle, useDieFace } from '../ui/useDieSkin'
import { InlineTexture } from '../ui/Texture'

/** 骰面：1–6 用点阵，更大的点数值（如 2D6=7）回退为数字；配了素材则素材优先（`04-misc.md` §三） */
export function DieFace({ pips }: { pips: number }) {
  const face = useDieFace(pips)
  if (face) return <InlineTexture {...face} />
  if (pips < 1 || pips > 6) return <span>{pips}</span>
  const layout: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  }
  const on = new Set(layout[pips])
  return (
    <span
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 7px)',
        gridTemplateRows: 'repeat(3, 7px)',
        gap: 2,
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: on.has(i) ? 'var(--ink)' : 'transparent',
          }}
        />
      ))}
    </span>
  )
}

export default function DiceLog({ session, onClose }: { session: Session; onClose?: () => void }) {
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

  // 抽屉纸面底纹（`skin/03-window.md` §四）：流水也在抽屉里，与三个面板同吃 `surfaces.drawer`
  const surface = useSurfaceStyle('drawer')
  // 骰子本体（`skin/04-misc.md` §三）：铺进 `.die` 盒，三档尺寸共用一张
  const dieBody = useDieBodyStyle()
  // 标题栏的关闭按钮（`skin/03-window.md` §四）：只有图形、无文字的按钮走 `close`
  const closeBtn = useButtonStyle('close')

  const replay = () => {
    if (lastRoll) setDie({ pips: lastRoll.pips, key: Date.now() })
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...surface }}>
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>流水</span>
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="dice-tray">
            {die && (
              <span
                key={die.key}
                className="die rolled"
                title="最近一次掷骰（点击重看）"
                onClick={replay}
                style={{ cursor: 'pointer', ...dieBody }}
              >
                <DieFace pips={die.pips} />
              </span>
            )}
            {lastRoll && (
              <span className="faint">
                最近：{lastRoll.label} {lastRoll.dice} = {lastRoll.pips}
              </span>
            )}
          </span>
          {onClose && (
            <button
              className="btn small"
              title="关闭"
              onClick={onClose}
              style={{ padding: '0 6px', ...closeBtn }}
            >
              <X size={14} />
            </button>
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
