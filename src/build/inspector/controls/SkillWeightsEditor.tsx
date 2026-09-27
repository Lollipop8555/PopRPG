/**
 * 怪物会用哪些技能（§4.1 / §4.8.3）：键就是技能 id，值就是权重。
 * 行动时掷 `pick_dice` 按权重选择技能，因此玩家需兼顾两维防御。
 */

import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { skillText } from '../../../lib/human'
import { Field, NumberBox } from '../../../ui/primitives'

export default function SkillWeightsEditor({
  value,
  onChange,
  label = '会哪些技能（权重）',
}: {
  value?: Record<string, number>
  onChange: (value: Record<string, number> | undefined) => void
  label?: string
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const weights = value ?? {}
  const skills = library.skills.filter((s) => enabledIds.includes(s.id))
  const picked = Object.entries(weights).filter(([, w]) => w > 0)

  const setWeight = (id: string, weight: number | undefined) => {
    const next: Record<string, number> = { ...weights }
    if (!weight || weight <= 0) delete next[id]
    else next[id] = weight
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <Field
      label={label}
      hint={
        picked.length
          ? `掷 pick_dice 按 ${picked.map(([id, w]) => `${library.skills.find((s) => s.id === id)?.name ?? id} ${w}`).join(' : ')} 挑；没配 / 权重全 0 → 用引擎内建的普通攻击`
          : '没配 → 用引擎内建的普通攻击（与玩家的保底对组件无关）'
      }
    >
      {skills.length === 0 && <div className="hintbox warn">这一局没启用任何技能 —— 这只怪只能靠内建普通攻击。</div>}
      {skills.map((skill) => (
        <div key={skill.id} className="row" style={{ gap: 4, marginBottom: 3 }}>
          <span style={{ flex: 1, fontSize: 12.5 }} title={skillText(skill)}>
            {skill.icon} {skill.name}
          </span>
          <div style={{ width: 60 }}>
            <NumberBox value={weights[skill.id]} placeholder="0" min={0} onChange={(n) => setWeight(skill.id, n)} />
          </div>
          <span className="faint" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {skillText(skill)}
          </span>
        </div>
      ))}
    </Field>
  )
}
