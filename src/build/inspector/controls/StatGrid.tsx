/** 6 属性的数字输入 / 区间输入（§4.0.1） */

import type { PartialStatValues, StatKey, Stats } from '../../../types'
import { STAT_KEYS, STAT_LABEL } from '../../../types'
import { Field, NumberBox } from '../../../ui/primitives'

/** 确定值（职业 base_stats / 装备 modifiers / 状态 modifiers / 职业 buffs） */
export function StatValuesEditor({
  value,
  onChange,
  label,
  suffix,
  placeholders,
  hint,
}: {
  value?: PartialStatValues
  onChange: (value: PartialStatValues) => void
  label: string
  suffix?: string
  placeholders?: Partial<Record<StatKey, number>>
  hint?: string
}) {
  return (
    <Field label={label} hint={hint ?? (suffix ? `单位：${suffix}` : undefined)}>
      <div className="grid3">
        {STAT_KEYS.map((key) => (
          <label key={key} className="row" style={{ gap: 3 }}>
            <span className="faint" style={{ minWidth: 26 }}>
              {STAT_LABEL[key]}
            </span>
            <NumberBox
              value={value?.[key]}
              placeholder={placeholders?.[key] !== undefined ? String(placeholders[key]) : '0'}
              onChange={(n) => {
                const next: PartialStatValues = { ...(value ?? {}) }
                if (n === undefined) delete next[key]
                else next[key] = n
                onChange(next)
              }}
            />
          </label>
        ))}
      </div>
    </Field>
  )
}

/** 区间（怪物 stats：登场时摇定一次，本场固定） */
export function StatsIntervalEditor({
  value,
  onChange,
  label = '属性区间（登场时摇定）',
}: {
  value: Stats
  onChange: (value: Stats) => void
  label?: string
}) {
  return (
    <Field label={label} hint="每项属性为一个区间；登场时按 stat_dice 摇定为具体值，本场固定">
      <div className="grid2">
        {STAT_KEYS.map((key) => {
          const [min, max] = value[key]
          return (
            <label key={key} className="row" style={{ gap: 3 }}>
              <span className="faint" style={{ minWidth: 26 }}>
                {STAT_LABEL[key]}
              </span>
              <NumberBox
                value={min}
                onChange={(n) => onChange({ ...value, [key]: [n ?? 0, max] as [number, number] })}
              />
              <span className="faint">~</span>
              <NumberBox
                value={max}
                onChange={(n) => onChange({ ...value, [key]: [min, n ?? 0] as [number, number] })}
              />
            </label>
          )
        })}
      </div>
    </Field>
  )
}
