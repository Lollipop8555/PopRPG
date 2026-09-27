/**
 * 技能栏（§4.8.3 / §7.1）：玩家**自己选**（怪物才掷骰随机 —— 两侧故意不对称）。
 * 成本付不起的技能**置灰**（选之前先查 `cost`，不扣也不掷，§4.8.3）。
 */

import { canUseSkill, costText } from '../engine/skill'
import type { Session } from '../types/session'

export default function SkillBar({
  session,
  selected,
  onSelect,
  onAttack,
}: {
  session: Session
  selected: string | undefined
  onSelect: (id: string) => void
  onAttack: () => void
}) {
  const inCombat = session.phase === 'combat'
  const canAct = inCombat && session.combatStage === 'player'
  const skills = session.player.skills

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>技能栏</span>
        <span className="faint">{skills.length} 招</span>
      </div>

      {skills.length === 0 && <div className="hintbox warn">技能栏是空的 —— 这一局里没有可用的招式。</div>}

      <div className="row" style={{ gap: 6 }}>
        {skills.map((skill) => {
          const usable = canUseSkill(session.player, skill)
          return (
            <button
              key={skill.id}
              className={`skill-btn ${selected === skill.id ? 'selected' : ''}`}
              disabled={!usable || !canAct}
              onClick={() => onSelect(skill.id)}
              title={usable ? `成本：${costText(skill.cost)}` : `付不起：${costText(skill.cost)}`}
            >
              <span>
                {skill.icon} {skill.name}
              </span>
              <span className="faint">{costText(skill.cost)}</span>
            </button>
          )
        })}
      </div>

      {canAct && (
        <button className="btn primary" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={onAttack}>
          {selected ? '攻击' : '先选一招'}
        </button>
      )}

      {!inCombat && (
        <div className="faint" style={{ marginTop: 6 }} title="一次技能施放即一次交锋，计为一个回合">
          探索阶段无法施放技能
        </div>
      )}
    </div>
  )
}
