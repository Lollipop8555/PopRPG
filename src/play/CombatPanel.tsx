/**
 * 交锋面板（§4.8.3，决策 3 / 12）：
 * ① 玩家攻击回合（在技能栏点攻击）→ ② 怪物反击回合（这里点“防御”或“不防御”）。
 * 单人游戏**没有倒计时** —— 引擎一直等玩家点。
 */

import type { Session } from '../types/session'

export default function CombatPanel({
  session,
  onDefend,
}: {
  session: Session
  onDefend: (willDefend: boolean) => void
}) {
  const monster = session.monster
  if (!monster) return null

  const hpPct = monster.stats.hp > 0 ? Math.max(0, monster.resources.hp / monster.stats.hp) : 0

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>
          {monster.icon} {monster.name}
        </span>
        <span className="badge err">交锋中</span>
      </div>

      <div className="bar hp">
        <div className="fill" style={{ width: `${hpPct * 100}%` }} />
        <div className="label">
          hp {monster.resources.hp} / {monster.stats.hp}
        </div>
      </div>

      <div className="row" style={{ gap: 4, marginTop: 4 }}>
        <span className="badge">物攻 {monster.stats.patk}</span>
        <span className="badge">魔攻 {monster.stats.matk}</span>
        <span className="badge">物防 {monster.stats.pdef}</span>
        <span className="badge">魔防 {monster.stats.mdef}</span>
        <span className="badge">mp {monster.resources.mp}</span>
      </div>

      {monster.states.length > 0 && (
        <div className="row" style={{ gap: 4, marginTop: 4 }}>
          {monster.states.map((st) => (
            <span key={st.tag} className="chip state">
              {st.tag} · {st.duration}
            </span>
          ))}
        </div>
      )}

      {session.combatStage === 'defend' && (
        <>
          <div className="sketch-line" style={{ margin: '8px 0' }} />
          <div className="hand" style={{ fontSize: 13, marginBottom: 6 }}>
            进入反击阶段，请选择是否防御
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary" onClick={() => onDefend(true)}>
              防御（掷防骰）
            </button>
            <button className="btn danger" onClick={() => onDefend(false)}>
              不防御
            </button>
          </div>
        </>
      )}

    </div>
  )
}
