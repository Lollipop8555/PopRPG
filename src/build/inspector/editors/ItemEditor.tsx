/** 道具（§4.3）：kind 切换 → 装备（槽位 + 6 属性加值）/ 消耗品（使用场合 + 五 op 效果） */

import type { EquipSlot, ItemDef, UsableScene } from '../../../types'
import { EQUIP_SLOTS, SLOT_LABEL } from '../../../types'
import { itemText } from '../../../lib/human'
import { Field, Toggle } from '../../../ui/primitives'
import { StatValuesEditor } from '../controls/StatGrid'
import EffectsEditor from '../controls/EffectsEditor'
import { useProjectStore } from '../../../store/project'

export default function ItemEditor({
  def,
  onChange,
}: {
  def: ItemDef
  onChange: (patch: Partial<ItemDef>) => void
}) {
  const maxDuration = useProjectStore((s) => s.rules.state.max_duration)
  const isEquip = def.kind === 'equipment'

  return (
    <div>
      <Field label="种类">
        <div className="row" style={{ gap: 4 }}>
          <button
            className={`btn small ${!isEquip ? 'primary' : ''}`}
            onClick={() => onChange({ kind: 'consumable', slots: undefined, modifiers: undefined, usable: ['move'], effects: [] })}
          >
            消耗品（一次性）
          </button>
          <button
            className={`btn small ${isEquip ? 'primary' : ''}`}
            onClick={() => onChange({ kind: 'equipment', usable: undefined, effects: undefined, slots: [], modifiers: {} })}
          >
            装备（持续）
          </button>
        </div>
      </Field>

      <div className="hintbox">{itemText(def)}</div>

      {isEquip ? (
        <>
          <Field label="占用槽位" hint="装备槽共 5 个，占用同一槽位的装备不可同时穿戴">
            <div className="row" style={{ gap: 4 }}>
              {EQUIP_SLOTS.map((slot: EquipSlot) => (
                <Toggle
                  key={slot}
                  label={SLOT_LABEL[slot]}
                  checked={(def.slots ?? []).includes(slot)}
                  onChange={(on) => {
                    const slots = new Set(def.slots ?? [])
                    on ? slots.add(slot) : slots.delete(slot)
                    onChange({ slots: [...slots] })
                  }}
                />
              ))}
            </div>
          </Field>

          <StatValuesEditor
            label="属性加值（力值链 ②）"
            value={def.modifiers}
            onChange={(modifiers) => onChange({ modifiers })}
            hint="普通装备 +1~2，强力装备 +4~6；装备加值计入加法环节"
          />
        </>
      ) : (
        <>
          <Field label="可用阶段" hint="battle：对战阶段；move：探索阶段">
            <div className="row" style={{ gap: 8 }}>
              {(['battle', 'move'] as UsableScene[]).map((scene) => (
                <Toggle
                  key={scene}
                  label={scene === 'battle' ? '对战' : '前进'}
                  checked={(def.usable ?? []).includes(scene)}
                  onChange={(on) => {
                    const set = new Set(def.usable ?? [])
                    on ? set.add(scene) : set.delete(scene)
                    onChange({ usable: [...set] })
                  }}
                />
              ))}
            </div>
          </Field>

          <EffectsEditor
            effects={def.effects}
            onChange={(effects) => onChange({ effects })}
            maxDuration={maxDuration}
            label="用掉之后发生什么"
          />
        </>
      )}

      <div className="faint">
        技能书为消耗品：添加 `learn_skill` 效果即可；奖励池、事件、商店、战利品等所有产出途径均可给予技能，无需额外机制。
      </div>
    </div>
  )
}
