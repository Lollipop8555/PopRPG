/**
 * 「状态池」面板（§5.6 / §6）—— 与「规则」「NPC 模组」并列的**第三个整页入口**。
 *
 * 一局一份的全局状态池（`psave ＝ 状态表`），作者在这里声明三组内容：
 * - **变量表**（`pool`）：作者空间的变量（短名存盘时补 `usr-`）
 * - **判定模板**（`conds`）：命名条件，供 `if` / `when` / 门锁直接引用
 * - **回合判定**（`checks`）：每回合按来源分批排序执行的判定（条件 ＋ 修改动作）
 *
 * 三组都是整表替换（`setPool / setConds / setChecks`），写操作一律包在 `commit()` 里进撤销栈。
 */

import { useState } from 'react'
import { Database, Plus, Trash2, X } from 'lucide-react'
import type {
  CondTpl,
  PoolCheck,
  PoolCheckRef,
  PoolCondItem,
  PoolEffect,
  PoolReadOp,
  PoolRoundCheck,
  PoolType,
  PoolValue,
  PoolVar,
  PoolWriteOp,
} from '../types'
import { POOL_READ_OPS, POOL_WRITE_OPS, emptyCheck } from '../types'
import { commit } from '../store/commit'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import Overlay from '../ui/Overlay'
import { Badge, Field, SelectBox, TextBox } from '../ui/primitives'

type Tab = 'pool' | 'conds' | 'checks'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pool', label: '变量表' },
  { id: 'conds', label: '判定模板' },
  { id: 'checks', label: '回合判定' },
]

const TYPE_OPTIONS = [
  { value: 'number', label: '数值' },
  { value: 'string', label: '文本' },
  { value: 'boolean', label: '开关' },
]

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

const WRITE_OP_LABEL: Record<PoolWriteOp, string> = {
  set: '设为',
  append: '追加',
  add: '加',
  minus: '减',
  multiply: '乘',
  divide: '除以',
  toggle: '翻转',
}

/* ------------------------------------------------------------------ */
/* 名称与取值的小工具                                                   */
/* ------------------------------------------------------------------ */

/** 作者输入短名 → 规范全名（`engine-` / `usr-` 原样，其余补 `usr-`，§2.3） */
function toFullName(raw: string): string {
  const t = raw.trim()
  if (t === '') return ''
  return t.startsWith('usr-') || t.startsWith('engine-') ? t : `usr-${t}`
}

/** 规范全名 → 作者看得见的短名（去掉 `usr-`） */
function toShortName(name: string): string {
  return name.startsWith('usr-') ? name.slice(4) : name
}

function parseValue(type: PoolType, raw: string): PoolValue {
  if (type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  if (type === 'boolean') return raw === 'true'
  return raw
}

function valueToText(v: PoolValue | undefined): string {
  if (v === undefined) return ''
  return String(v)
}

/* ------------------------------------------------------------------ */
/* 条件体编辑（读算子，§4.2 / §4.4）                                    */
/* ------------------------------------------------------------------ */

function CondList({ check, onChange }: { check: PoolCheck; onChange: (next: PoolCheck) => void }) {
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
        {items.length === 0 && <span className="faint" style={{ fontSize: 11 }}>（空条件视为成立）</span>}
      </div>

      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 4, alignItems: 'center' }}>
          <div style={{ width: 150 }}>
            <TextBox value={it.name} onChange={(v) => patch(i, { name: v })} placeholder="键全名" />
          </div>
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
          <div style={{ width: 150 }}>
            <TextBox
              value={it.ref ?? ''}
              onChange={(v) => patch(i, { ref: v.trim() === '' ? undefined : v, value: undefined })}
              placeholder="比另一个键"
            />
          </div>
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

/** 判定位置编辑（§4.5）：可写模板名，也可写条件体；两者互斥 */
function CheckRefEditor({
  value,
  onChange,
  tplNames,
}: {
  value: PoolCheckRef
  onChange: (next: PoolCheckRef) => void
  tplNames: string[]
}) {
  const tpl = typeof value === 'string' ? value : ''
  const check = typeof value === 'string' ? emptyCheck() : value
  return (
    <div className="col" style={{ gap: 4 }}>
      <Field label="判定模板" hint="选了模板就等于把该模板的条件原样内联；留空则用下面的条件体">
        <SelectBox
          value={tpl}
          options={[{ value: '', label: '（不用模板，写下条件）' }, ...tplNames.map((n) => ({ value: n, label: n }))]}
          onChange={(v) => onChange(v === '' ? check : v)}
        />
      </Field>
      {tpl === '' && <CondList check={check} onChange={onChange} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 修改动作编辑（写算子，§4.3）                                         */
/* ------------------------------------------------------------------ */

function EffectList({ effects, onChange }: { effects: PoolEffect[]; onChange: (next: PoolEffect[]) => void }) {
  const patch = (i: number, part: Partial<PoolEffect>) =>
    onChange(effects.map((it, k) => (k === i ? { ...it, ...part } : it)))

  const parse = (op: PoolWriteOp, raw: string): PoolValue => {
    if (op === 'append') return raw
    if (op === 'toggle') return raw === 'true'
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  return (
    <div className="col" style={{ gap: 4 }}>
      {effects.length === 0 && (
        <span className="faint" style={{ fontSize: 11 }}>
          （没有修改动作，条件成立时什么也不改）
        </span>
      )}
      {effects.map((e, i) => (
        <div key={i} className="row" style={{ gap: 4, alignItems: 'center' }}>
          <div style={{ width: 150 }}>
            <TextBox value={e.name} onChange={(v) => patch(i, { name: v })} placeholder="键全名" />
          </div>
          <SelectBox
            value={e.op}
            options={POOL_WRITE_OPS.map((op) => ({ value: op, label: WRITE_OP_LABEL[op] }))}
            onChange={(v) => patch(i, { op: v as PoolWriteOp })}
          />
          <div style={{ width: 130 }}>
            <TextBox
              value={valueToText(e.value)}
              onChange={(v) => patch(i, { value: parse(e.op, v) })}
              placeholder="值"
            />
          </div>
          <button className="btn small ghost" title="删除这一条动作" onClick={() => onChange(effects.filter((_, k) => k !== i))}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div>
        <button className="btn small" onClick={() => onChange([...effects, { name: '', op: 'set', value: 0 }])}>
          <Plus size={11} /> 加动作
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 三个页签                                                             */
/* ------------------------------------------------------------------ */

function PoolVarTable({ vars, onChange }: { vars: PoolVar[]; onChange: (next: PoolVar[]) => void }) {
  const patch = (i: number, part: Partial<PoolVar>) => onChange(vars.map((v, k) => (k === i ? { ...v, ...part } : v)))
  return (
    <div className="col" style={{ gap: 5 }}>
      {vars.length === 0 && (
        <div className="hintbox warn">还没有变量。变量是作者空间的账本：`usr-` 前缀会自动补上。</div>
      )}
      {vars.map((v, i) => (
        <div key={i} className="row" style={{ gap: 5, alignItems: 'center' }}>
          <span className="faint" style={{ fontSize: 11, width: 26 }}>
            usr-
          </span>
          <div style={{ width: 150 }}>
            <TextBox
              value={toShortName(v.name)}
              onChange={(x) => patch(i, { name: toFullName(x), key: toShortName(x) })}
              placeholder="短名"
            />
          </div>
          <SelectBox
            value={v.type}
            options={TYPE_OPTIONS}
            onChange={(x) => patch(i, { type: x as PoolType })}
          />
          <div style={{ width: 130 }}>
            <TextBox
              value={valueToText(v.value)}
              onChange={(x) => patch(i, { value: parseValue(v.type, x) })}
              placeholder="初值"
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <TextBox value={v.desc ?? ''} onChange={(x) => patch(i, { desc: x })} placeholder="说明（可省）" />
          </div>
          <Badge>{v.name}</Badge>
          <button className="btn small ghost" title="删除这个变量" onClick={() => onChange(vars.filter((_, k) => k !== i))}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div>
        <button
          className="btn small"
          onClick={() => onChange([...vars, { name: '', key: '', type: 'number', value: 0 }])}
        >
          <Plus size={11} /> 加变量
        </button>
      </div>
    </div>
  )
}

function CondTplList({ conds, onChange }: { conds: CondTpl[]; onChange: (next: CondTpl[]) => void }) {
  const patch = (i: number, part: Partial<CondTpl>) => onChange(conds.map((c, k) => (k === i ? { ...c, ...part } : c)))
  return (
    <div className="col" style={{ gap: 6 }}>
      {conds.length === 0 && <div className="hintbox warn">还没有判定模板。模板是「命名的条件」，供 `if` / 门锁 / 回合判定直接引用。</div>}
      {conds.map((c, i) => (
        <div key={i} className="panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="row" style={{ gap: 5, alignItems: 'center' }}>
            <div style={{ width: 180 }}>
              <TextBox value={c.name} onChange={(x) => patch(i, { name: x })} placeholder="模板名" />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <TextBox value={c.desc ?? ''} onChange={(x) => patch(i, { desc: x })} placeholder="说明（可省）" />
            </div>
            <button className="btn small ghost" title="删除这个模板" onClick={() => onChange(conds.filter((_, k) => k !== i))}>
              <Trash2 size={12} />
            </button>
          </div>
          <CondList check={c.when ?? emptyCheck()} onChange={(when) => patch(i, { when })} />
        </div>
      ))}
      <div>
        <button className="btn small" onClick={() => onChange([...conds, { name: '', when: emptyCheck() }])}>
          <Plus size={11} /> 加模板
        </button>
      </div>
    </div>
  )
}

function RoundCheckList({
  checks,
  condNames,
  onChange,
}: {
  checks: PoolRoundCheck[]
  condNames: string[]
  onChange: (next: PoolRoundCheck[]) => void
}) {
  const patch = (i: number, part: Partial<PoolRoundCheck>) =>
    onChange(checks.map((c, k) => (k === i ? { ...c, ...part } : c)))
  return (
    <div className="col" style={{ gap: 6 }}>
      {checks.length === 0 && (
        <div className="hintbox warn">
          还没有回合判定。回合判定每回合开始按「业务 → buff → 基础」三批执行，条件成立才跑它的修改动作。
        </div>
      )}
      {checks.map((c, i) => (
        <div key={i} className="panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="row" style={{ gap: 5, alignItems: 'center' }}>
            <div style={{ width: 150 }}>
              <TextBox
                value={c.alias ?? ''}
                onChange={(x) => patch(i, { alias: x.trim() === '' ? undefined : x })}
                placeholder="别名（可省）"
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <TextBox
                value={(c.deps ?? []).join(', ')}
                onChange={(x) =>
                  patch(i, {
                    deps: x
                      .split(',')
                      .map((d) => d.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="前置别名，逗号分隔（可省）"
              />
            </div>
            {c.source && <Badge tone="off">来源：{c.source}</Badge>}
            <button className="btn small ghost" title="删除这条回合判定" onClick={() => onChange(checks.filter((_, k) => k !== i))}>
              <Trash2 size={12} />
            </button>
          </div>
          <Field label="触发条件">
            <CheckRefEditor value={c.when} onChange={(when) => patch(i, { when })} tplNames={condNames} />
          </Field>
          <Field label="修改动作">
            <EffectList effects={c.pool ?? []} onChange={(pool) => patch(i, { pool })} />
          </Field>
        </div>
      ))}
      <div>
        <button className="btn small" onClick={() => onChange([...checks, { when: emptyCheck(), pool: [] }])}>
          <Plus size={11} /> 加回合判定
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 面板本体                                                             */
/* ------------------------------------------------------------------ */

export default function PoolScreen() {
  const open = useUiStore((s) => s.poolOpen)
  const setOpen = useUiStore((s) => s.setPoolOpen)
  const pool = useProjectStore((s) => s.pool)
  const conds = useProjectStore((s) => s.conds)
  const checks = useProjectStore((s) => s.checks)
  const [tab, setTab] = useState<Tab>('pool')

  if (!open) return null

  const writePool = (next: PoolVar[]) => commit(() => useProjectStore.getState().setPool(next))
  const writeConds = (next: CondTpl[]) => commit(() => useProjectStore.getState().setConds(next))
  const writeChecks = (next: PoolRoundCheck[]) => commit(() => useProjectStore.getState().setChecks(next))

  const condNames = conds.map((c) => c.name).filter(Boolean)
  // 变量表里可能混着引擎键（如直接声明 `engine-...`），展示时也提示类型
  const declared = pool.filter((v) => v.name)

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div
        className="modal wide"
        style={{ width: 'min(1240px, 95vw)', height: '84vh', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="row" style={{ gap: 6 }}>
            <Database size={16} />
            <span className="hand" style={{ fontSize: 16 }}>
              状态池
            </span>
            <span className="badge">
              变量 {declared.length} · 模板 {conds.length} · 回合判定 {checks.length}
            </span>
          </span>
          <button className="btn small" onClick={() => setOpen(false)}>
            <X size={13} /> 关闭
          </button>
        </div>

        <div className="row" style={{ gap: 5 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'btn small' + (tab === t.id ? ' primary' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="faint" style={{ fontSize: 11 }}>
            三组全空时 `.pmod` 不写 `## Pool` 段
          </span>
        </div>

        <div className="scroll" style={{ flex: 1, minHeight: 0, paddingRight: 4 }}>
          {tab === 'pool' && <PoolVarTable vars={pool} onChange={writePool} />}
          {tab === 'conds' && <CondTplList conds={conds} onChange={writeConds} />}
          {tab === 'checks' && <RoundCheckList checks={checks} condNames={condNames} onChange={writeChecks} />}
        </div>
      </div>
    </Overlay>
  )
}
