/**
 * `effects` 控件 —— 消耗品 / 技能 / 怪物 / 事件**四处共用**（§4.8.10）。
 * 五个 op：`add_stat` / `add_tag` / `remove_tag` / `learn_skill` / `forget_skill`
 * （怪物命中只用前三种 —— 不能教 / 夺技能，见 §4.1）。
 */

import type { EffectOp, SkillDef, StatKey } from '../../../types'
import { STAT_KEYS, STAT_LABEL } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { skillText } from '../../../lib/human'
import { Field, NumberBox, SelectBox, TextBox } from '../../../ui/primitives'
import { StatValuesEditor } from './StatGrid'

const OP_LABEL: Record<EffectOp['op'], string> = {
  add_stat: '改数值',
  add_tag: '挂状态',
  remove_tag: '解状态',
  learn_skill: '学会技能',
  forget_skill: '忘掉技能',
}

export default function EffectsEditor({
  effects,
  onChange,
  maxDuration,
  allowedOps = ['add_stat', 'add_tag', 'remove_tag', 'learn_skill', 'forget_skill'],
  label = '附带效果',
}: {
  effects?: EffectOp[]
  onChange: (effects: EffectOp[] | undefined) => void
  maxDuration: number
  allowedOps?: EffectOp['op'][]
  label?: string
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const list = effects ?? []
  const enabledSkills = library.skills.filter((s) => enabledIds.includes(s.id))

  const patch = (index: number, eff: EffectOp) => {
    const next = [...list]
    next[index] = eff
    onChange(next)
  }

  const add = () => {
    const op = allowedOps[0]
    const base: EffectOp =
      op === 'add_stat'
        ? { op: 'add_stat', target: 'self', stat: 'hp', delta: 0 }
        : op === 'add_tag'
          ? { op: 'add_tag', tag: '', duration: 1 }
          : op === 'remove_tag'
            ? { op: 'remove_tag', tag: '' }
            : op === 'learn_skill'
              ? { op: 'learn_skill', skill: '' }
              : { op: 'forget_skill', skill: '' }
    onChange([...list, base])
  }

  return (
    <Field label={label} hint={`每条一行；仅命中时生效（未命中不附加效果）`}>
      {list.map((eff, index) => (
        <div
          key={index}
          style={{
            border: '1.2px dashed var(--line)',
            borderRadius: 10,
            padding: 6,
            marginBottom: 6,
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <SelectBox
              value={eff.op}
              options={allowedOps.map((op) => ({ value: op, label: OP_LABEL[op] }))}
              onChange={(op) => {
                if (op === eff.op) return
                const fresh: EffectOp =
                  op === 'add_stat'
                    ? { op: 'add_stat', target: 'self', stat: 'hp', delta: 0 }
                    : op === 'add_tag'
                      ? { op: 'add_tag', tag: '', duration: 1 }
                      : op === 'remove_tag'
                        ? { op: 'remove_tag', tag: '' }
                        : op === 'learn_skill'
                          ? { op: 'learn_skill', skill: '' }
                          : { op: 'forget_skill', skill: '' }
                patch(index, fresh)
              }}
            />
            <button className="btn small danger" onClick={() => onChange(list.filter((_, i) => i !== index))}>
              删
            </button>
          </div>

          {eff.op === 'add_stat' && (
            <div className="grid3">
              <Field label="给谁">
                <SelectBox
                  value={eff.target}
                  options={[
                    { value: 'self', label: '自己' },
                    { value: 'opponent', label: '对手' },
                  ]}
                  onChange={(v) => patch(index, { ...eff, target: v as 'self' | 'opponent' })}
                />
              </Field>
              <Field label="哪一维">
                <SelectBox
                  value={eff.stat}
                  options={STAT_KEYS.map((k) => ({ value: k, label: STAT_LABEL[k] }))}
                  onChange={(v) => patch(index, { ...eff, stat: v as StatKey })}
                />
              </Field>
              <Field label="增减">
                <NumberBox value={eff.delta} onChange={(n) => patch(index, { ...eff, delta: n ?? 0 })} />
              </Field>
            </div>
          )}

          {eff.op === 'add_tag' && (
            <>
              <div className="grid2">
                <Field label="状态名">
                  <TextBox value={eff.tag} onChange={(v) => patch(index, { ...eff, tag: v })} placeholder="中毒 / 力量祝福 / 火抗" />
                </Field>
                <Field
                  label="回合数（必填）"
                  hint={
                    !eff.duration ? (
                      <span style={{ color: 'var(--red)' }}>未填写将持续存在且无法结束，必须指定回合数</span>
                    ) : eff.duration > maxDuration ? (
                      <span style={{ color: 'var(--amber)' }}>超过上限 {maxDuration}，结算时会被夹到 {maxDuration}</span>
                    ) : (
                      `还剩 ${eff.duration} 个回合`
                    )
                  }
                >
                  <NumberBox value={eff.duration} min={0} max={maxDuration} onChange={(n) => patch(index, { ...eff, duration: n ?? 0 })} />
                </Field>
              </div>
              <StatValuesEditor
                label="每回合增减（可省）"
                value={eff.per_turn}
                onChange={(v) => patch(index, { ...eff, per_turn: Object.keys(v).length ? v : undefined })}
              />
              <StatValuesEditor
                label="期间属性加减（可省）"
                suffix="进力值链 ②"
                value={eff.modifiers}
                onChange={(v) => patch(index, { ...eff, modifiers: Object.keys(v).length ? v : undefined })}
              />
            </>
          )}

          {eff.op === 'remove_tag' && (
            <Field label="解除的状态">
              <TextBox value={eff.tag} onChange={(v) => patch(index, { ...eff, tag: v })} placeholder="中毒" />
            </Field>
          )}

          {(eff.op === 'learn_skill' || eff.op === 'forget_skill') && (
            <Field
              label={eff.op === 'learn_skill' ? '学会哪个技能' : '忘掉哪个技能'}
              hint={
                <>
                  只能指向<b>已启用</b>的技能（未启用的世界里不存在这一招）。
                  {(() => {
                    const skill: SkillDef | undefined = enabledSkills.find((s) => s.id === eff.skill)
                    return skill ? <> 预览：{skill.icon}{skill.name} —— {skillText(skill)}</> : null
                  })()}
                </>
              }
            >
              <SelectBox
                value={eff.skill}
                options={[
                  { value: '', label: '（选一个技能）' },
                  ...enabledSkills.map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` })),
                ]}
                onChange={(v) => patch(index, { ...eff, skill: v })}
              />
            </Field>
          )}
        </div>
      ))}

      <button className="btn small" onClick={add}>
        ＋ 加一条效果
      </button>
    </Field>
  )
}
