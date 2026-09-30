/**
 * 常驻骰子区（HUD 底栏最右）：**在面板上直接掷骰** ——
 * 发起投掷时骰子旋转、点数滚动，转完定格出新点数；不再弹任何对话框。
 */

import { useEffect, useState } from 'react'
import { StepForward } from 'lucide-react'
import type { Session } from '../types/session'
import { useDieBodyStyle } from '../ui/useDieSkin'
import { useButtonStyle } from '../ui/useButtonStyle'
import { DieFace } from './DiceLog'

export default function DiceHud({
  session,
  canRoll,
  spinning,
  onRoll,
}: {
  session: Session
  canRoll: boolean
  spinning: boolean
  onRoll: () => void
}) {
  const last = session.rolls[session.rolls.length - 1]
  const [spinPips, setSpinPips] = useState<number | null>(null)
  // 骰子本体（`skin/04-misc.md` §三）：三档尺寸共用一张，底下这盒就是最大那一档
  const dieBody = useDieBodyStyle()
  // 掷骰按钮（`skin/03-window.md` §四）：HUD 上的主行动走 `primary`
  const primaryBtn = useButtonStyle('primary')

  // 旋转期间点数快速滚动，营造「正在掷」的手感
  useEffect(() => {
    if (!spinning) {
      setSpinPips(null)
      return
    }
    const t = setInterval(() => setSpinPips(1 + Math.floor(Math.random() * 6)), 70)
    return () => clearInterval(t)
  }, [spinning])

  const shown = spinning ? spinPips : last?.pips ?? null

  return (
    <div className="hud-dice">
      <span
        key={spinning ? 'spinning' : `pips-${session.rolls.length}`}
        className={`die ${spinning ? 'spinning' : 'rolled'}`}
        style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', ...dieBody }}
      >
        {shown ? <DieFace pips={shown} /> : '🎲'}
      </span>
      <div className="hud-dice-info">
        {spinning ? (
          <div>掷骰中…</div>
        ) : last ? (
          <div>
            {last.label} = <b>{last.pips}</b>
          </div>
        ) : (
          <div className="faint">尚未掷骰</div>
        )}
        <div className="faint">
          {session.awaitingEncounter
            ? '点「掷骰」结算当前遭遇'
            : session.stepsLeft > 0
              ? `还能走 ${session.stepsLeft} 步`
              : '步数已用尽'}
        </div>
      </div>
      <button
        className="btn primary"
        disabled={!canRoll || spinning}
        onClick={onRoll}
        style={{ whiteSpace: 'nowrap', ...primaryBtn }}
      >
        <StepForward size={13} />{' '}
        {session.awaitingEncounter ? '掷骰' : session.stepsLeft > 0 ? '下一回合' : '投掷前进'}
      </button>
    </div>
  )
}
