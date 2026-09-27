/**
 * 技能（§4.8.3）—— **取哪一维 + 攻击目标 + 附带什么**，全是下拉与数字框，不改一行代码就能造出
 * 普通攻击 / 治疗术 / 力量祝福 / 虚弱诅咒 / 毒牙。
 * 编辑器不认识「火球术」「治疗术」这些词；面板底部反查「本局中可获得该技能的途径」（存在 ≠ 谁会）。
 */

import type { SkillDef, SkillTarget, StatKey } from '../../../types'
import { STAT_KEYS, STAT_LABEL } from '../../../types'
import { useProjectStore } from '../../../store/project'
import { skillText } from '../../../lib/human'
import { Field, NumberBox, SelectBox } from '../../../ui/primitives'
import { CostEditor } from '../controls/CostGateEditor'
import EffectsEditor from '../controls/EffectsEditor'
import RollSetEditor from '../controls/RollSetEditor'

export default function SkillEditor({
  def,
  onChange,
  sources,
}: {
  def: SkillDef
  onChange: (patch: Partial<SkillDef>) => void
  sources: string[]
}) {
  const maxDuration = useProjectStore((s) => s.rules.state.max_duration)

  return (
    <div>
      <div className="grid2">
        <Field label="① 取哪一维（dim）" hint="基准属性，力值链从这里取值">
          <SelectBox
            value={def.dim}
            options={STAT_KEYS.map((k) => ({ value: k, label: STAT_LABEL[k] }))}
            onChange={(v) => onChange({ dim: v as StatKey })}
          />
        </Field>

        <Field label="② 攻击目标（target）" hint="opponent：进行比较，可能未命中；self：不进行比较，必定生效">
          <SelectBox
            value={def.target}
            options={[
              { value: 'opponent', label: '对手' },
              { value: 'self', label: '自己' },
            ]}
            onChange={(v) => onChange({ target: v as SkillTarget })}
          />
        </Field>

        <Field label="③ 对手拿哪一维防（vs）" hint="auto = 物理族对物理族、法术族对法术族">
          <SelectBox
            value={def.vs}
            options={[
              { value: 'auto', label: 'auto（按 dim 自动配对）' },
              { value: 'none', label: 'none（不对抗）' },
              ...STAT_KEYS.map((k) => ({ value: k, label: STAT_LABEL[k] })),
            ]}
            onChange={(v) => onChange({ vs: v as SkillDef['vs'] })}
          />
        </Field>

        <Field label="④ 技能自身加值（bonus）" hint="计入力值链第 ② 环节（加法）">
          <NumberBox value={def.bonus} onChange={(n) => onChange({ bonus: n ?? 0 })} />
        </Field>

        <Field label="⑤ 力值作用到哪（apply）" hint="hp：造成伤害或治疗；mp：影响法力；none：仅附加效果">
          <SelectBox
            value={def.apply}
            options={[
              { value: 'hp', label: '生命' },
              { value: 'mp', label: '法力' },
              { value: 'none', label: 'none（不改数值）' },
            ]}
            onChange={(v) => onChange({ apply: v as SkillDef['apply'] })}
          />
        </Field>
      </div>

      <CostEditor
        value={def.cost}
        onChange={(cost) => onChange({ cost })}
        step={false}
        label="⑥ 施放成本（cost）"
      />
      <div className="faint" style={{ marginTop: -4, marginBottom: 6 }}>
        资源不足时无法选择该技能，且不扣除、不掷骰。默认保底技能的成本为空（免费），可按需修改。
      </div>

      <RollSetEditor value={def.roll} onChange={(roll) => onChange({ roll })} label="⑦ 力值骰覆盖（可省）" />

      <EffectsEditor
        effects={def.effects}
        onChange={(effects) => onChange({ effects })}
        maxDuration={maxDuration}
        label="⑧ 附带效果（只有命中才执行）"
      />

      <div className="hintbox ok" style={{ marginTop: 6 }}>
        <b>说明预览</b>：{skillText(def)}
      </div>

      <Field label="本局中可获得该技能的途径" hint="「存在」与「已掌握」是两个概念；已掌握的技能属于存档数据，不在此配置">
        {sources.length ? (
          <div className="row" style={{ gap: 4 }}>
            {sources.map((s) => (
              <span key={s} className="badge">
                {s}
              </span>
            ))}
          </div>
        ) : (
          <div className="hintbox warn">
            已启用，但这一局里<b>没有任何地方能学到它</b> —— 要么放一本技能书，要么让某个事件教它（也可能你只是想留给怪物用）。
          </div>
        )}
      </Field>
    </div>
  )
}
