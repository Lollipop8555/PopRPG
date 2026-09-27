/**
 * 职业（§4.2.3）：**只给先天的牌面** —— 属性起点 + 开局自由点 + 优劣百分比 + 背包 + 家当。
 * **没有 skills**（技能一律后天学），也没有属性区间。
 */

import type { ClassDef } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { Field, NumberBox, Toggle } from '../../../ui/primitives'
import { StatValuesEditor } from '../controls/StatGrid'

export default function ClassEditor({
  def,
  onChange,
}: {
  def: ClassDef
  onChange: (patch: Partial<ClassDef>) => void
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const items = library.items.filter((i) => enabledIds.includes(i.id))
  const starting = def.starting_items ?? []
  const infinite = (def.inventory_size ?? 50) === 0

  return (
    <div>
      <StatValuesEditor
        label="初始属性（先天）"
        value={def.base_stats}
        onChange={(base_stats) => onChange({ base_stats: { ...def.base_stats, ...base_stats } })}
        hint="玩家属性 = 这个起点 + 玩家自己分配的自由点（全程不摇）"
      />

      <Field
        label="开局自由点"
        hint="该数值由职业设定决定；「1 点 = +1、不可撤销、余点保留」为固定规则"
      >
        <NumberBox value={def.free_points} min={0} onChange={(n) => onChange({ free_points: n ?? 0 })} />
      </Field>

      <StatValuesEditor
        label="优劣百分比（力值链 ③）"
        suffix="%（100 = 不增不减）"
        placeholders={{ hp: 100, mp: 100, patk: 100, matk: 100, pdef: 100, mdef: 100 }}
        value={def.buffs}
        onChange={(buffs) => onChange({ buffs })}
        hint="职业百分比为固有加成，始终生效"
      />

      <Field label="背包格数" hint="按条目数计算，同一道具叠加仅占 1 格；0 表示无限">
        <div className="row" style={{ gap: 6 }}>
          <div style={{ width: 90 }}>
            <NumberBox value={def.inventory_size ?? 50} min={0} disabled={infinite} onChange={(n) => onChange({ inventory_size: n ?? 50 })} />
          </div>
          <Toggle
            label="无限"
            checked={infinite}
            onChange={(on) => onChange({ inventory_size: on ? 0 : (def.inventory_size ?? 50) || 50 })}
          />
        </div>
      </Field>

      <Field label="初始物品（可选）" hint="初始物品均为道具；技能书同样属于道具，可丢弃或出售">
        <div>
          {items.length === 0 && <div className="faint">这一局还没启用任何道具</div>}
          {items.map((item) => (
            <Toggle
              key={item.id}
              label={`${item.icon} ${item.name}`}
              checked={starting.includes(item.id)}
              onChange={(on) =>
                onChange({
                  starting_items: on
                    ? [...starting, item.id]
                    : starting.filter((id) => id !== item.id),
                })
              }
            />
          ))}
        </div>
      </Field>

      <div className="hintbox">
        <div>① 开局自由点：<b>{def.free_points}</b>。</div>
        <div>② 百分比加成决定属性分配效率，低于 100% 的按折扣计算。</div>
        <div>③ 职业只给初始牌面，<b>不给技能</b>。</div>
      </div>
    </div>
  )
}
