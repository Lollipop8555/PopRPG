/** 标签输入框：回车 / 逗号加一个，点 × 删一个（§4.0 tags 的三个用途共用同一个字段） */

import { useId, useState } from 'react'
import { Field } from '../../../ui/primitives'

export default function TagsInput({
  value,
  onChange,
  label = '标签',
  hint,
  suggestions = [],
}: {
  value?: string[]
  onChange: (tags: string[]) => void
  label?: string
  hint?: string
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const tags = value ?? []

  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
  }

  return (
    <Field label={label} hint={hint}>
      <div className="row" style={{ gap: 4 }}>
        {tags.map((tag) => (
          <span key={tag} className="tagchip">
            {tag}
            <button onClick={() => onChange(tags.filter((t) => t !== tag))} title="删掉">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="input"
        style={{ marginTop: 4 }}
        value={draft}
        placeholder="回车加一个标签（如 火抗 / 渡河 / 精英）"
        onChange={(e) => {
          const raw = e.target.value
          if (raw.includes('，') || raw.includes(',')) {
            raw.split(/[,，]/).forEach(add)
            setDraft('')
            return
          }
          setDraft(raw)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            add(draft)
            setDraft('')
          }
        }}
        list={listId}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  )
}
