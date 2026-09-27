/**
 * 定价（§4.8.11）—— **货币就是一件道具**，`currency` 只是那件道具的 id。
 * `fixed` 明码标价不掷骰；`value` 掷骰定价（同一件东西每局价格不同）。
 */

import type { PriceDef } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { priceText } from '../../../lib/human'
import { Field, NumberBox, SelectBox } from '../../../ui/primitives'
import DiceInput from './DiceInput'

export default function PriceEditor({
  value,
  onChange,
  label = '定价',
  allowClear = false,
}: {
  value?: PriceDef
  onChange: (value: PriceDef | undefined) => void
  label?: string
  allowClear?: boolean
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const currencies = library.items.filter((i) => enabledIds.includes(i.id))
  const price = value
  const currencyName = currencies.find((c) => c.id === price?.currency)?.name ?? price?.currency ?? '（没选货币）'

  return (
    <Field
      label={label}
      hint={price ? priceText(price, currencyName) : allowClear ? '未配置时使用规则面板中的商店默认定价' : undefined}
    >
      <div className="row" style={{ gap: 4 }}>
        <SelectBox
          value={price?.currency ?? ''}
          options={[
            { value: '', label: '（选一件道具当钱）' },
            ...currencies.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
          ]}
          onChange={(v) => {
            if (!v) return onChange(undefined)
            onChange({ currency: v, algo: price?.algo ?? 'value', dice: price?.dice ?? '1D6', range: price?.range ?? [5, 15], n: price?.n })
          }}
        />
        {price && (
          <SelectBox
            value={price.algo}
            options={[
              { value: 'fixed', label: '明码标价' },
              { value: 'value', label: '掷骰定价' },
            ]}
            onChange={(v) => onChange({ ...price, algo: v as 'fixed' | 'value' })}
          />
        )}
      </div>

      {price && (
        <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginTop: 4 }}>
          {price.algo === 'fixed' ? (
            <div className="row" style={{ gap: 4 }}>
              <span className="faint">每件</span>
              <div style={{ width: 80 }}>
                <NumberBox value={price.n} onChange={(n) => onChange({ ...price, n: n ?? 0 })} />
              </div>
              <span className="faint">枚{currencyName}</span>
            </div>
          ) : (
            <>
              <DiceInput value={price.dice} onChange={(d) => onChange({ ...price, dice: d ?? '1D6' })} />
              <div className="row" style={{ gap: 4 }}>
                <span className="faint">价格区间</span>
                <div style={{ width: 70 }}>
                  <NumberBox
                    value={price.range?.[0]}
                    onChange={(n) => onChange({ ...price, range: [n ?? 0, price.range?.[1] ?? 0] })}
                  />
                </div>
                <span className="faint">~</span>
                <div style={{ width: 70 }}>
                  <NumberBox
                    value={price.range?.[1]}
                    onChange={(n) => onChange({ ...price, range: [price.range?.[0] ?? 0, n ?? 0] })}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Field>
  )
}
