/**
 * 骰子输入：**两个数字框**（枚数 / 面数），不再让人手动输入 `1D6` 这种格式。
 * 内部仍然是 `nDf` 字符串（`.pmod` 与引擎都用这个），但界面上就是两个数字 —— 不会再有「格式不对」这种事。
 */

import { parseDice } from '../../../engine/dice'
import { Field, NumberBox } from '../../../ui/primitives'

export default function DiceInput({
  value,
  onChange,
  label = '骰子',
  hint,
  allowEmpty = true,
}: {
  value?: string
  onChange: (value: string | undefined) => void
  label?: string
  hint?: string
  allowEmpty?: boolean
}) {
  const dice = parseDice(value)
  const count = dice?.count
  const faces = dice?.faces

  const patch = (nextCount: number | undefined, nextFaces: number | undefined) => {
    if (nextCount === undefined || nextFaces === undefined) {
      onChange(undefined)
      return
    }
    const c = Math.max(1, Math.round(nextCount))
    const f = Math.max(2, Math.round(nextFaces))
    onChange(`${c}D${f}`)
  }

  const range = count && faces ? `${count}~${count * faces}` : null

  return (
    <Field
      label={label}
      hint={
        <>
          {range ? (
            <span>
              点数范围 {range}（{count} 枚骰子，每枚 {faces} 面）
            </span>
          ) : (
            <span>留空表示该项不掷骰</span>
          )}
          {hint ? <span> · {hint}</span> : null}
        </>
      }
    >
      <div className="row" style={{ gap: 4 }}>
        <span className="faint">枚数</span>
        <div style={{ width: 64 }}>
          <NumberBox
            value={count}
            min={1}
            placeholder={allowEmpty ? '—' : '1'}
            onChange={(n) => patch(n, faces)}
          />
        </div>
        <span className="faint">面数</span>
        <div style={{ width: 64 }}>
          <NumberBox
            value={faces}
            min={2}
            placeholder={allowEmpty ? '—' : '6'}
            onChange={(n) => patch(count, n)}
          />
        </div>
        {value && <span className="badge">{value}</span>}
        {value && allowEmpty && (
          <button className="btn small" onClick={() => onChange(undefined)} title="清空 = 不掷骰">
            清空
          </button>
        )}
      </div>
    </Field>
  )
}
