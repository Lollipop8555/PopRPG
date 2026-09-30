/**
 * 技能格（HUD 底栏用）：玩家**自己选**（怪物才掷骰随机 —— 两侧故意不对称）。
 * 成本付不起的技能**置灰**；选中后由底栏的「攻击」触发。
 */

import { canUseSkill, costText } from '../engine/skill'
import { useSlotStyle } from '../ui/useSlotStyle'
import type { Session } from '../types/session'

export default function SkillBar({
  session,
  selected,
  onSelect,
}: {
  session: Session
  selected: string | undefined
  onSelect: (id: string) => void
}) {
  const inCombat = session.phase === 'combat'
  const canAct = inCombat && session.combatStage === 'player'
  const skills = session.player.skills
  const slot = useSlotStyle('skill')

  return (
    <div className="skill-slots">
      {skills.length === 0 && <span className="faint">这一局没有可用的招式</span>}
      {skills.map((skill) => {
        const usable = canUseSkill(session.player, skill)
        return (
          <button
            key={skill.id}
            className={`skill-slot ${selected === skill.id ? 'selected' : ''}`}
            style={slot}
            disabled={!usable || !canAct}
            onClick={() => onSelect(skill.id)}
            title={`${skill.name}　成本：${costText(skill.cost)}`}
          >
            <span className="skill-ico">{skill.icon ?? '✦'}</span>
            <span className="skill-name">{skill.name}</span>
          </button>
        )
      })}
    </div>
  )
}
