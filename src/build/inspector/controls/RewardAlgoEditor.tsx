/**
 * 抽取算法覆盖（§4.8.5② / §4.8.7）：
 * `pick`（件数：`tiers` 档位表 / `count` 区间）+ `copies`（份数：`fixed` / `value` / `multiplier`）。
 * **没有 `all`** —— 件数恒被 `|池|` 夹住，这里也实时把夹完之后的说明写出来。
 */

import type { CopiesAlgo, PickAlgo } from '../../../types'
import { copiesText, pickText } from '../../../lib/human'
import { Field, NumberBox, SelectBox, TextBox } from '../../../ui/primitives'
import DiceInput from './DiceInput'

export function PickEditor({
  value,
  onChange,
  poolSize,
  label = '件数（覆盖默认算法）',
  allowClear = true,
}: {
  value?: PickAlgo
  onChange: (value: PickAlgo | undefined) => void
  poolSize: number
  label?: string
  allowClear?: boolean
}) {
  const pick = value
  return (
    <Field label={label} hint={pick ? pickText(pick, poolSize) : '未配置时使用规则面板中的抽取算法'}>
      <div className="row" style={{ gap: 4, marginBottom: 4 }}>
        <SelectBox
          value={pick?.algo ?? ''}
          options={[
            ...(allowClear ? [{ value: '', label: '用默认' }] : []),
            { value: 'tiers', label: '档位表（可以写空箱档）' },
            { value: 'count', label: '区间取值' },
          ]}
          onChange={(v) => {
            if (v === '') return onChange(undefined)
            onChange(
              v === 'tiers'
                ? { algo: 'tiers', dice: '1D6', tiers: [{ upto: 2, n: 0 }, { upto: 6, n: 1 }] }
                : { algo: 'count', dice: '1D6', range: [1, 2] },
            )
          }}
        />
      </div>

      {pick && (
        <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6 }}>
          <DiceInput value={pick.dice} onChange={(d) => onChange({ ...pick, dice: d ?? '1D6' })} label="采用哪枚骰子" />

          {pick.algo === 'tiers' && (
            <>
              {pick.tiers.map((tier, index) => (
                <div key={index} className="row" style={{ gap: 4, marginBottom: 3 }}>
                  <span className="faint">掷到</span>
                  <div style={{ width: 62 }}>
                    <NumberBox
                      value={tier.upto}
                      onChange={(n) => {
                        const tiers = [...pick.tiers]
                        tiers[index] = { ...tier, upto: n ?? 0 }
                        onChange({ ...pick, tiers })
                      }}
                    />
                  </div>
                  <span className="faint">及以下 → 给</span>
                  <div style={{ width: 62 }}>
                    <NumberBox
                      value={tier.n}
                      onChange={(n) => {
                        const tiers = [...pick.tiers]
                        tiers[index] = { ...tier, n: n ?? 0 }
                        onChange({ ...pick, tiers })
                      }}
                    />
                  </div>
                  <span className="faint">件</span>
                  <button
                    className="btn small"
                    onClick={() => onChange({ ...pick, tiers: pick.tiers.filter((_, i) => i !== index) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn small"
                onClick={() => {
                  const last = pick.tiers[pick.tiers.length - 1]
                  onChange({ ...pick, tiers: [...pick.tiers, { upto: (last?.upto ?? 0) + 1, n: (last?.n ?? 0) + 1 }] })
                }}
              >
                ＋ 加一档
              </button>
            </>
          )}

          {pick.algo === 'count' && (
            <div className="row" style={{ gap: 4 }}>
              <span className="faint">件数区间</span>
              <div style={{ width: 70 }}>
                <NumberBox value={pick.range[0]} onChange={(n) => onChange({ ...pick, range: [n ?? 0, pick.range[1]] })} />
              </div>
              <span className="faint">~</span>
              <div style={{ width: 70 }}>
                <NumberBox value={pick.range[1]} onChange={(n) => onChange({ ...pick, range: [pick.range[0], n ?? 0] })} />
              </div>
            </div>
          )}
        </div>
      )}
    </Field>
  )
}

export function CopiesEditor({
  value,
  onChange,
  label = '份数（覆盖默认算法）',
  allowClear = true,
}: {
  value?: CopiesAlgo
  onChange: (value: CopiesAlgo | undefined) => void
  label?: string
  allowClear?: boolean
}) {
  const copies = value
  return (
    <Field label={label} hint={copies ? copiesText(copies) : '未配置时使用规则面板中的份数算法'}>
      <SelectBox
        value={copies?.algo ?? ''}
        options={[
          ...(allowClear ? [{ value: '', label: '用默认' }] : []),
          { value: 'fixed', label: '固定份数' },
          { value: 'value', label: '掷骰取区间' },
          { value: 'multiplier', label: '掷骰查档位（倍率）' },
        ]}
        onChange={(v) => {
          if (v === '') return onChange(undefined)
          onChange(
            v === 'fixed'
              ? { algo: 'fixed', n: 1 }
              : v === 'value'
                ? { algo: 'value', dice: '1D6', range: [1, 3] }
                : { algo: 'multiplier', dice: '1D6', steps: [1, 1, 1, 2, 2, 3] },
          )
        }}
      />

      {copies && (
        <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginTop: 4 }}>
          {copies.algo === 'fixed' && (
            <div className="row" style={{ gap: 4 }}>
              <span className="faint">每件</span>
              <div style={{ width: 70 }}>
                <NumberBox value={copies.n} onChange={(n) => onChange({ ...copies, n: n ?? 1 })} />
              </div>
              <span className="faint">份</span>
            </div>
          )}

          {copies.algo === 'value' && (
            <>
              <DiceInput value={copies.dice} onChange={(d) => onChange({ ...copies, dice: d ?? '1D6' })} />
              <div className="row" style={{ gap: 4 }}>
                <span className="faint">份数区间</span>
                <div style={{ width: 70 }}>
                  <NumberBox value={copies.range[0]} onChange={(n) => onChange({ ...copies, range: [n ?? 0, copies.range[1]] })} />
                </div>
                <span className="faint">~</span>
                <div style={{ width: 70 }}>
                  <NumberBox value={copies.range[1]} onChange={(n) => onChange({ ...copies, range: [copies.range[0], n ?? 0] })} />
                </div>
              </div>
            </>
          )}

          {copies.algo === 'multiplier' && (
            <>
              <DiceInput value={copies.dice} onChange={(d) => onChange({ ...copies, dice: d ?? '1D6' })} />
              <Field label="档位（逗号分隔，掷到几点取第几个）">
                <TextBox
                  value={copies.steps.join(',')}
                  onChange={(text) => {
                    const steps = text
                      .split(/[,，]/)
                      .map((s) => Number(s.trim()))
                      .filter((n) => Number.isFinite(n))
                    onChange({ ...copies, steps: steps.length ? steps : [1] })
                  }}
                />
              </Field>
            </>
          )}
        </div>
      )}
    </Field>
  )
}
