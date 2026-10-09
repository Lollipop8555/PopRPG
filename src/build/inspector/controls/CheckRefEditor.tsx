/**
 * 判定位置编辑（§4.5 / §6.4）：可写**判定模板名**，也可写**条件体**，两者互斥。
 *
 * 门锁 `gate.pool`、回合判定 `when`、建筑 `encounter` 前置（§6.4 / §8.3③）共用同一控件，
 * 保证「与门锁同构」在编辑器层面也是同一套交互。
 *
 * 条件项左侧的键名输入同时承担 **§9.3 自动推荐**：输入关键词即跨两个空间联想
 * （含内置 `engine-` 变量），并给键标出声明状态（`new` / 引擎只读 / 未声明的引擎键）。
 */

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { PoolCheck, PoolCheckRef, PoolCondItem, PoolReadOp, PoolValue } from '../../../types'
import { POOL_READ_OPS, emptyCheck, engineVarWritable, forceUsrPrefix } from '../../../types'
import { Badge, Field, SelectBox, TextBox } from '../../../ui/primitives'
import { commit } from '../../../store/commit'
import { useProjectStore } from '../../../store/project'
import { useUiStore } from '../../../store/ui'
import { declStateOf, freeTemplateShort, suggestVars } from '../../poolPanel'

const READ_OP_LABEL: Record<PoolReadOp, string> = {
  equals: '等于',
  notEquals: '不等于',
  greater: '大于',
  less: '小于',
  greaterEqual: '不小于',
  lessEqual: '不大于',
  contain: '包含',
  notContain: '不包含',
}

function valueToText(v: PoolValue | undefined): string {
  if (v === undefined) return ''
  return String(v)
}

/** 条件体是否为空（空集合视为成立，等价于没写判定，§4.4） */
export function isEmptyCheckRef(ref: PoolCheckRef | undefined): boolean {
  if (ref === undefined) return true
  if (typeof ref === 'string') return ref.trim() === ''
  return (ref.items ?? []).length === 0
}

/* ------------------------------------------------------------------ */
/* 键名输入 ＋ 自动推荐（§9.3）                                        */
/* ------------------------------------------------------------------ */

/**
 * 池键输入框：输入关键词即**跨两个空间**联想（作者变量 / 内置 `engine-` / 判定模板），
 * 并在右侧标出该键的**声明状态**——
 * - `new`：作者空间尚未声明 → 保存时**自动收录**（§9.4）
 * - `引擎·只读` / `引擎·可写`：内置键，只能选不能改（写只读键将出 `K23`）
 * - `未知引擎键`：`engine-` 开头但不在 §三 总表内 → **不收录**，交给 `K20`
 */
export function PoolKeyInput({
  value,
  onChange,
  placeholder = '键全名',
  width,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  width?: number
}) {
  const vars = useProjectStore((s) => s.pool)
  const conds = useProjectStore((s) => s.conds)
  const [open, setOpen] = useState(false)

  const trimmed = value.trim()
  const state = trimmed === '' ? null : declStateOf(trimmed, vars)
  const sugs = open ? suggestVars(value, vars, conds) : []

  const badge = (() => {
    if (state === 'new') return <Badge tone="warn" title="作者空间里还没声明，保存时会自动收录">new</Badge>
    if (state === 'engine') {
      const writable = engineVarWritable(trimmed)
      return (
        <Badge tone="preset" title={writable ? '内置键：本键允许作者修改（写权限：可写）' : '内置键：本键只读，写它会出现 K23（写权限：只读）'}>
          {writable ? '引擎·可写' : '引擎·只读'}
        </Badge>
      )
    }
    if (state === 'unknown-engine') return <Badge tone="err" title="engine- 开头但不在 §三 总表内；不自动收录，将出现 K20">未知引擎键</Badge>
    return <Badge title="已在变量表里声明">已声明</Badge>
  })()

  return (
    <div className="col" style={{ gap: 2, position: 'relative' }}>
      <div className="row" style={{ gap: 4, alignItems: 'center' }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        <div style={{ width: width ?? 150 }}>
          <TextBox value={value} onChange={onChange} placeholder={placeholder} />
        </div>
        {badge}
      </div>
      {sugs.length > 0 && (
        <div
          className="col"
          style={{ gap: 2, border: '1.2px dashed var(--line)', borderRadius: 8, padding: 4, background: 'var(--bg)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {sugs.map((s) => (
            <button
              key={s.name}
              className="btn small ghost"
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => {
                onChange(s.name)
                setOpen(false)
              }}
            >
              <Badge tone={s.space === 'engine' ? 'preset' : 'default'}>{s.space === 'engine' ? '引擎' : '作者'}</Badge>
              <span>{s.short}</span>
              {s.desc && (
                <span className="faint" style={{ fontSize: 11 }}>
                  {s.desc}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 条件体编辑（读算子，§4.2 / §4.4）                                    */
/* ------------------------------------------------------------------ */

export function CondList({ check, onChange }: { check: PoolCheck; onChange: (next: PoolCheck) => void }) {
  const items = check.items ?? []
  const patch = (i: number, part: Partial<PoolCondItem>) =>
    onChange({ ...check, items: items.map((it, k) => (k === i ? { ...it, ...part } : it)) })

  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <span className="faint" style={{ fontSize: 11 }}>
          满足
        </span>
        <SelectBox
          value={check.mode ?? 'all'}
          options={[
            { value: 'all', label: '全部条件' },
            { value: 'any', label: '任一条件' },
          ]}
          onChange={(v) => onChange({ ...check, mode: v as 'all' | 'any' })}
        />
        {items.length === 0 && (
          <span className="faint" style={{ fontSize: 11 }}>
            （空条件视为成立）
          </span>
        )}
      </div>

      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 4, alignItems: 'flex-start' }}>
          <PoolKeyInput value={it.name} onChange={(v) => patch(i, { name: v })} />
          <SelectBox
            value={it.op}
            options={POOL_READ_OPS.map((op) => ({ value: op, label: READ_OP_LABEL[op] }))}
            onChange={(v) => patch(i, { op: v as PoolReadOp })}
          />
          <div style={{ width: 130 }}>
            <TextBox
              value={valueToText(it.value)}
              onChange={(v) => patch(i, { value: v, ref: undefined })}
              placeholder="值"
            />
          </div>
          <span className="faint" style={{ fontSize: 11 }}>
            或
          </span>
          <PoolKeyInput
            value={it.ref ?? ''}
            onChange={(v) => patch(i, { ref: v.trim() === '' ? undefined : v, value: undefined })}
            placeholder="比另一个键"
          />
          <button
            className="btn small ghost"
            title="删除这一条条件"
            onClick={() => onChange({ ...check, items: items.filter((_, k) => k !== i) })}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <div>
        <button
          className="btn small"
          onClick={() => onChange({ ...check, items: [...items, { name: '', op: 'equals', value: 1 }] })}
        >
          <Plus size={11} /> 加条件
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 判定位置编辑                                                         */
/* ------------------------------------------------------------------ */

export function CheckRefEditor({
  value,
  onChange,
  tplNames,
  label = '判定模板',
}: {
  value: PoolCheckRef
  onChange: (next: PoolCheckRef) => void
  tplNames: string[]
  label?: string
}) {
  const tpl = typeof value === 'string' ? value : ''
  const check = typeof value === 'string' ? emptyCheck() : value
  const hasItems = (check.items ?? []).length > 0

  /** 「转存为模板」（§9.7）：把当前条件体收进 `## Pool` 的判定模板表，并把本处改用该模板名 */
  const saveAsTemplate = () => {
    if (!hasItems) return
    const st = useProjectStore.getState()
    const short = freeTemplateShort(st.conds, st.pool)
    const name = forceUsrPrefix(short)
    commit(() =>
      useProjectStore.getState().setConds([
        ...st.conds,
        { key: short, name, when: { mode: check.mode ?? 'all', items: (check.items ?? []).map((it) => ({ ...it })) } },
      ]),
    )
    useUiStore.getState().notify(`已转存为模板「${short}」，可在「判定模板」页签里复用`, 'info')
    onChange(name)
  }

  return (
    <div className="col" style={{ gap: 4 }}>
      <Field label={label} hint="选了模板就等于把该模板的条件原样内联；留空则用下面的条件体">
        <SelectBox
          value={tpl}
          options={[{ value: '', label: '（不用模板，写下条件）' }, ...tplNames.map((n) => ({ value: n, label: n }))]}
          onChange={(v) => onChange(v === '' ? check : v)}
        />
      </Field>
      {tpl === '' && (
        <>
          <CondList check={check} onChange={onChange} />
          <div>
            <button
              className="btn small ghost"
              disabled={!hasItems}
              title={hasItems ? '把上面这组条件收进「判定模板」，本处改用模板名' : '先写至少一条条件再转存'}
              onClick={saveAsTemplate}
            >
              <Save size={11} /> 转存为模板
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default CheckRefEditor
