/**
 * 怪物（§4.1）：属性是**区间**（登场时摇定一次，本场固定）、会哪些技能靠权重表、
 * 命中玩家时可以挂状态（只能用三 op，不能教 / 夺技能）。
 */

import type { MonsterDef } from '../../../types'
import { useProjectStore } from '../../../store/project'
import { Field, NumberBox } from '../../../ui/primitives'
import { StatsIntervalEditor } from '../controls/StatGrid'
import EffectsEditor from '../controls/EffectsEditor'
import RollSetEditor from '../controls/RollSetEditor'
import SkillWeightsEditor from '../controls/SkillWeightsEditor'
import PoolEditor from '../controls/PoolEditor'
import { CopiesEditor, PickEditor } from '../controls/RewardAlgoEditor'
import DiceInput from '../controls/DiceInput'

export default function MonsterEditor({
  def,
  onChange,
}: {
  def: MonsterDef
  onChange: (patch: Partial<MonsterDef>) => void
}) {
  const maxDuration = useProjectStore((s) => s.rules.state.max_duration)
  const poolSize = (def.reward_pool?.ids ?? []).length

  return (
    <div>
      <StatsIntervalEditor value={def.stats} onChange={(stats) => onChange({ stats })} />

      <div className="hintbox">
        档位参考：小怪 hp 6~12、物攻 2~4；精英 hp 24~40、物攻 6~10，并以 <code>tags: [精英]</code> 标注（通过区间区分档位，不新增字段）。
      </div>

      <DiceInput
        value={def.stat_dice}
        onChange={(stat_dice) => onChange({ stat_dice })}
        label="属性骰覆盖（可省）"
        hint="留空就用规则页的 stat_dice"
      />

      <SkillWeightsEditor value={def.attack_weights} onChange={(attack_weights) => onChange({ attack_weights })} />

      <EffectsEditor
        effects={def.effects}
        onChange={(effects) => onChange({ effects })}
        maxDuration={maxDuration}
        allowedOps={['add_stat', 'add_tag', 'remove_tag']}
        label="命中玩家时施加（只能改数值 / 挂解状态，不能教技能）"
      />

      <div className="grid2">
        <RollSetEditor value={def.atk_roll} onChange={(atk_roll) => onChange({ atk_roll })} label="攻骰覆盖（可省）" />
        <RollSetEditor value={def.def_roll} onChange={(def_roll) => onChange({ def_roll })} label="防骰覆盖（可省）" />
      </div>

      <Field label="胜利后给予的自由属性点（point_reward）" hint="固定数值，不掷骰；结算后计入剩余自由点">
        <NumberBox value={def.point_reward} min={0} onChange={(n) => onChange({ point_reward: n ?? 0 })} />
      </Field>

      <PoolEditor value={def.reward_pool} onChange={(reward_pool) => onChange({ reward_pool })} kind="item" label="战利品池（可省）" />

      {def.reward_pool && (
        <>
          <PickEditor value={def.pick} onChange={(pick) => onChange({ pick })} poolSize={poolSize} label="件数覆盖（可省）" />
          <CopiesEditor value={def.copies} onChange={(copies) => onChange({ copies })} label="份数覆盖（可省）" />
        </>
      )}
    </div>
  )
}
