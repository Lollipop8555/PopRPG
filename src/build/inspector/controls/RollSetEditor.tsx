/**
 * 力值骰（§4.8.2 ⑤⑥）：只有**叠加 add_dice** 与**倍率 mult** 两个插点，没有 base_dice
 * （属性值由 stat_dice 在登场时摇定，不在这里再摇一次）。
 */

import type { RollSet } from '../../../types'
import { Field, TextBox } from '../../../ui/primitives'
import DiceInput from './DiceInput'

export default function RollSetEditor({
  value,
  onChange,
  label = '力值骰',
}: {
  value?: RollSet
  onChange: (value: RollSet | undefined) => void
  label?: string
}) {
  const roll = value
  const patch = (part: Partial<RollSet>) => {
    const next: RollSet = { ...(roll ?? {}), ...part }
    const empty = !next.add_dice && !next.mult
    onChange(empty ? undefined : next)
  }

  return (
    <Field label={label} hint="两项均留空时不掷骰，取固有数值">
      <DiceInput
        value={roll?.add_dice}
        onChange={(d) => patch({ add_dice: d })}
        label="⑤ 叠加骰"
        hint="掷出的点数直接加到力值上"
      />
      <DiceInput
        value={roll?.mult?.dice}
        onChange={(d) => patch({ mult: d ? { dice: d, steps: roll?.mult?.steps ?? [0.5, 1, 1, 1.5, 2, 3] } : undefined })}
        label="⑥ 倍率骰"
        hint="留空就不乘倍率"
      />
      {roll?.mult && (
        <Field label="倍率档位（逗号分隔，对应掷点从小到大）">
          <TextBox
            value={roll.mult.steps.join(',')}
            onChange={(text) => {
              const steps = text
                .split(/[,，]/)
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n))
              patch({ mult: { ...roll.mult!, steps: steps.length ? steps : [1] } })
            }}
          />
        </Field>
      )}
    </Field>
  )
}
