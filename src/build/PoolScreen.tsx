/**
 * 「状态池」面板（§5.6 / §6 / §9.2~9.5）—— 与「规则」「NPC 模组」并列的**第三个整页入口**。
 *
 * 一局一份的全局状态池（`psave ＝ 状态表`），作者在这里声明三组内容：
 * - **变量表**（`pool`）：作者空间变量 ＋ **并列展示**的内置 `engine-` 变量（只读）
 * - **判定模板**（`conds`）：命名条件，供 `if` / `when` / 门锁直接引用
 * - **回合判定**（`checks`）：每回合按来源分批排序执行的判定（条件 ＋ 修改动作）
 *
 * 三组都是整表替换（`setPool / setConds / setChecks`），写操作一律包在 `commit()` 里进撤销栈。
 * **引用数**为派生统计（`poolUsageCounts`，不落盘）；**成环**在面板内标红并给出环路（`K30`）。
 */

import { useState } from 'react'
import { AlertTriangle, Database, Plus, Trash2, X } from 'lucide-react'
import type { CondTpl, PoolEffect, PoolRoundCheck, PoolType, PoolValue, PoolVar, PoolWriteOp } from '../types'
import { POOL_WRITE_OPS, emptyCheck, shortName } from '../types'
import { poolReferenceInfo, poolUsageCounts } from '../check/poolValidate'
import { findDependencyCycle, orderRoundChecks } from '../engine/state-pool'
import { commit } from '../store/commit'
import { librarySnapshot } from '../store/library'
import { projectSnapshot, useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import Overlay from '../ui/Overlay'
import { Badge, Field, SelectBox, TextBox } from '../ui/primitives'
import { CheckRefEditor, CondList, PoolKeyInput } from './inspector/controls/CheckRefEditor'
import {
  type SpaceFilter,
  collectMissingVars,
  correctValueForType,
  engineRows,
  filterRows,
  refCountOf,
  type VarRow,
} from './poolPanel'

type Tab = 'pool' | 'conds' | 'checks'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pool', label: '变量表' },
  { id: 'conds', label: '判定模板' },
  { id: 'checks', label: '回合判定' },
]

const SPACE_FILTERS: { id: SpaceFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'usr', label: '只看作者' },
  { id: 'engine', label: '只看引擎' },
]

const TYPE_OPTIONS = [
  { value: 'number', label: '数值' },
  { value: 'string', label: '文本' },
  { value: 'boolean', label: '开关' },
]

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
  return shortName(name)
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

/** 短名是否合法（§9.2 / `K27`）：非空、不含连字符 */
function shortInvalid(name: string): string | undefined {
  const short = toShortName(name)
  if (short === '') return '短名不能为空'
  if (short.includes('-')) return '短名不能含连字符'
  return undefined
}

/* ------------------------------------------------------------------ */
/* 删除确认（有引用时要求确认，不自动清理引用，§9.2 / §9.7）             */
/* ------------------------------------------------------------------ */

function ConfirmDelete({
  refs,
  title,
  onConfirm,
}: {
  refs: number
  title: string
  onConfirm: () => void
}) {
  const [ask, setAsk] = useState(false)
  if (refs <= 0 || !ask) {
    return (
      <button
        className="btn small ghost"
        title={title}
        onClick={() => (refs > 0 ? setAsk(true) : onConfirm())}
      >
        <Trash2 size={12} />
      </button>
    )
  }
  return (
    <span className="row" style={{ gap: 4, alignItems: 'center' }}>
      <span className="faint" style={{ fontSize: 11, color: 'var(--err, #c0392b)' }}>
        仍有 {refs} 处引用
      </span>
      <button className="btn small" onClick={onConfirm}>
        确认删除
      </button>
      <button className="btn small ghost" onClick={() => setAsk(false)}>
        取消
      </button>
    </span>
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
        <div key={i} className="row" style={{ gap: 4, alignItems: 'flex-start' }}>
          <PoolKeyInput value={e.name} onChange={(v) => patch(i, { name: v })} placeholder="键全名" />
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
/* 页签 ①：变量表（§9.2 / §9.3 / §9.4）                                */
/* ------------------------------------------------------------------ */

function PoolVarTable({
  vars,
  usage,
  space,
  keyword,
  onSpace,
  onKeyword,
  onChange,
}: {
  vars: PoolVar[]
  usage: ReadonlyMap<string, number>
  space: SpaceFilter
  keyword: string
  onSpace: (s: SpaceFilter) => void
  onKeyword: (k: string) => void
  onChange: (next: PoolVar[]) => void
}) {
  const patch = (i: number, part: Partial<PoolVar>) => onChange(vars.map((v, k) => (k === i ? { ...v, ...part } : v)))

  // 作者行（可编辑）与内置引擎行（只读）并列；两行集合都按筛选 / 搜索裁剪
  const rows: (VarRow & { index: number })[] = []
  vars.forEach((v, i) => {
    if (!v.name) return
    rows.push({
      index: i,
      name: v.name,
      short: toShortName(v.name),
      space: 'usr',
      type: v.type,
      value: v.value,
      desc: v.desc,
      writable: true,
      refs: refCountOf(usage, v.name),
    })
  })
  const authorVisible = filterRows(rows, space, keyword)
  const engineVisible = filterRows(engineRows(usage), space, keyword)

  const dupNames = new Set<string>()
  const seen = new Set<string>()
  for (const v of vars) {
    if (!v.name) continue
    if (seen.has(v.name)) dupNames.add(v.name)
    seen.add(v.name)
  }

  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row" style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {SPACE_FILTERS.map((f) => (
          <button
            key={f.id}
            className={'btn small' + (space === f.id ? ' primary' : '')}
            onClick={() => onSpace(f.id)}
          >
            {f.label}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 160 }}>
          <TextBox value={keyword} onChange={onKeyword} placeholder="搜索短名 / 说明" />
        </div>
        <span className="faint" style={{ fontSize: 11 }}>
          作者 {rows.length} · 引擎 {engineRows(usage).length}
        </span>
      </div>

      {/* 表头 */}
      <div className="row faint" style={{ gap: 5, fontSize: 11, padding: '0 4px' }}>
        <span style={{ width: 150 }}>key</span>
        <span style={{ width: 72 }}>类型</span>
        <span style={{ width: 110 }}>初值</span>
        <span style={{ flex: 1, minWidth: 120 }}>说明</span>
        <span style={{ width: 48, textAlign: 'right' }}>引用</span>
        <span style={{ width: 88 }}>空间</span>
        <span style={{ width: 24 }} />
      </div>

      {/* 作者行：可编辑 */}
      {authorVisible.map((r) => {
        const i = r.index
        const bad = shortInvalid(r.name)
        const dup = dupNames.has(r.name)
        return (
          <div key={i} className="col" style={{ gap: 2 }}>
            <div className="row" style={{ gap: 5, alignItems: 'center' }}>
              <div style={{ width: 150 }}>
                <TextBox
                  value={toShortName(vars[i].name)}
                  onChange={(x) => patch(i, { name: toFullName(x), key: toShortName(x) })}
                  placeholder="短名"
                />
              </div>
              <div style={{ width: 72 }}>
                <SelectBox
                  value={vars[i].type}
                  options={TYPE_OPTIONS}
                  onChange={(x) => {
                    const type = x as PoolType
                    // 改类型时同时校正默认值（否则 K24）
                    patch(i, { type, value: correctValueForType(type, vars[i].value) })
                  }}
                />
              </div>
              <div style={{ width: 110 }}>
                <TextBox
                  value={valueToText(vars[i].value)}
                  onChange={(x) => patch(i, { value: parseValue(vars[i].type, x) })}
                  placeholder="初值"
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextBox value={vars[i].desc ?? ''} onChange={(x) => patch(i, { desc: x })} placeholder="说明（可省）" />
              </div>
              <span style={{ width: 48, textAlign: 'right' }}>
                <Badge tone={r.refs > 0 ? 'on' : 'off'} title="派生统计，不落盘">
                  {r.refs}
                </Badge>
              </span>
              <span style={{ width: 88 }}>
                <Badge>{r.name}</Badge>
              </span>
              <span style={{ width: 24 }}>
                <ConfirmDelete
                  refs={r.refs}
                  title="删除这个变量"
                  onConfirm={() => onChange(vars.filter((_, k) => k !== i))}
                />
              </span>
            </div>
            {(bad || dup) && (
              <div className="faint" style={{ fontSize: 11, color: 'var(--err, #c0392b)', paddingLeft: 4 }}>
                {bad ?? `「${toShortName(r.name)}」重复声明（K21）`}
              </div>
            )}
          </div>
        )
      })}

      {/* 引擎行：只读并列展示 */}
      {engineVisible.map((r) => (
        <div key={r.name} className="row" style={{ gap: 5, alignItems: 'center', opacity: 0.85 }}>
          <div style={{ width: 150 }}>
            <span className="faint" style={{ fontSize: 12 }}>
              {r.short}
            </span>
          </div>
          <span className="faint" style={{ width: 72, fontSize: 12 }}>
            {{ number: '数值', string: '文本', boolean: '开关' }[r.type]}
          </span>
          <span style={{ width: 110 }} />
          <span className="faint" style={{ flex: 1, minWidth: 120, fontSize: 11 }}>
            {r.desc}
          </span>
          <span style={{ width: 48, textAlign: 'right' }}>
            <Badge tone={r.refs > 0 ? 'on' : 'off'} title="派生统计，不落盘">
              {r.refs}
            </Badge>
          </span>
          <span style={{ width: 88 }}>
            <Badge tone="preset" title={r.writable ? '作者可写' : '作者只读'}>
              引擎{r.writable ? '·可写' : '·只读'}
            </Badge>
          </span>
          <span style={{ width: 24 }} />
        </div>
      ))}

      {authorVisible.length === 0 && engineVisible.length === 0 && (
        <div className="hintbox warn">没有匹配的行。换个关键词，或切到「全部」。</div>
      )}

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

/* ------------------------------------------------------------------ */
/* 页签 ②：判定模板（§9.7）                                            */
/* ------------------------------------------------------------------ */

function CondTplList({
  conds,
  usage,
  varNames,
  onChange,
}: {
  conds: CondTpl[]
  usage: ReadonlyMap<string, number>
  varNames: Set<string>
  onChange: (next: CondTpl[]) => void
}) {
  const patch = (i: number, part: Partial<CondTpl>) => onChange(conds.map((c, k) => (k === i ? { ...c, ...part } : c)))
  return (
    <div className="col" style={{ gap: 6 }}>
      {conds.length === 0 && <div className="hintbox warn">还没有判定模板。模板是「命名的条件」，供 `if` / 门锁 / 回合判定直接引用。</div>}
      {conds.map((c, i) => {
        const dupVar = !!c.name && varNames.has(c.name)
        const selfRef = typeof c.when === 'string'
        const refs = usage.get(c.name) ?? 0
        return (
          <div key={i} className="panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="row" style={{ gap: 5, alignItems: 'center' }}>
              <div style={{ width: 180 }}>
                <TextBox
                  value={toShortName(c.name)}
                  onChange={(x) => patch(i, { name: toFullName(x), key: toShortName(x) })}
                  placeholder="模板名"
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextBox value={c.desc ?? ''} onChange={(x) => patch(i, { desc: x })} placeholder="说明（可省）" />
              </div>
              <Badge tone={refs > 0 ? 'on' : 'off'} title="被引用处数（派生统计）">
                引用 {refs}
              </Badge>
              <ConfirmDelete
                refs={refs}
                title="删除这个模板"
                onConfirm={() => onChange(conds.filter((_, k) => k !== i))}
              />
            </div>
            {(dupVar || selfRef) && (
              <div className="faint" style={{ fontSize: 11, color: 'var(--err, #c0392b)', paddingLeft: 2 }}>
                {dupVar && `与变量「${toShortName(c.name)}」重名（K36）`}
                {dupVar && selfRef && '；'}
                {selfRef && `引用了另一个模板名「${c.when}」——不支持模板引用模板`}
              </div>
            )}
            <CondList check={typeof c.when === 'string' ? emptyCheck() : c.when} onChange={(when) => patch(i, { when })} />
          </div>
        )
      })}
      <div>
        <button className="btn small" onClick={() => onChange([...conds, { name: '', when: emptyCheck() }])}>
          <Plus size={11} /> 加模板
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页签 ③：回合判定（§9.5 / §8.4）                                     */
/* ------------------------------------------------------------------ */

function RoundCheckList({
  checks,
  condNames,
  onChange,
}: {
  checks: PoolRoundCheck[]
  condNames: string[]
  onChange: (next: PoolRoundCheck[]) => void
}) {
  const ordered = orderRoundChecks(checks)
  const namedOrder = ordered.filter((c) => !!c.alias)
  const orderIndex = new Map<string, number>()
  namedOrder.forEach((c, i) => {
    if (c.alias && !orderIndex.has(c.alias)) orderIndex.set(c.alias, i + 1)
  })

  const aliases = [...new Set(checks.map((c) => c.alias).filter((a): a is string => !!a))]
  const cycle = findDependencyCycle(checks)

  /** 按拓扑序展示，但保留原数组下标以正确回写 */
  const entries = ordered
    .map((c) => ({ c, index: checks.indexOf(c) }))
    .filter((e) => e.index >= 0)
  const namedEntries = entries.filter((e) => !!e.c.alias)
  const anonEntries = entries.filter((e) => !e.c.alias)

  const patch = (i: number, part: Partial<PoolRoundCheck>) =>
    onChange(checks.map((c, k) => (k === i ? { ...c, ...part } : c)))

  const row = ({ c, index }: { c: PoolRoundCheck; index: number }) => (
    <div key={index} className="panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div className="row" style={{ gap: 5, alignItems: 'center' }}>
        {c.alias ? (
          <Badge tone="on" title="执行序号（拓扑序）">
            {orderIndex.get(c.alias) ?? '–'}
          </Badge>
        ) : (
          <Badge tone="off">匿名</Badge>
        )}
        <div style={{ width: 150 }}>
          <TextBox
            value={c.alias ?? ''}
            onChange={(x) => patch(index, { alias: x.trim() === '' ? undefined : x })}
            placeholder="别名（可省）"
          />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <SelectBox
            value=""
            options={[
              { value: '', label: (c.deps ?? []).length ? `依赖：${(c.deps ?? []).join(', ')}` : '依赖（下拉选已有别名）' },
              ...aliases.filter((a) => a !== c.alias).map((a) => ({ value: a, label: `＋ 依赖 ${a}` })),
            ]}
            onChange={(v) => {
              if (!v) return
              const deps = [...new Set([...(c.deps ?? []), v])]
              patch(index, { deps })
            }}
          />
        </div>
        {(c.deps ?? []).map((d) => (
          <button
            key={d}
            className="btn small ghost"
            title={`去掉依赖 ${d}`}
            onClick={() => patch(index, { deps: (c.deps ?? []).filter((x) => x !== d) })}
          >
            <X size={11} /> {d}
          </button>
        ))}
        {c.source && <Badge tone="off">来源：{c.source}</Badge>}
        <ConfirmDelete
          refs={0}
          title="删除这条回合判定"
          onConfirm={() => onChange(checks.filter((_, k) => k !== index))}
        />
      </div>
      <Field label="触发条件">
        <CheckRefEditor value={c.when} onChange={(when) => patch(index, { when })} tplNames={condNames} />
      </Field>
      <Field label="修改动作">
        <EffectList effects={c.pool ?? []} onChange={(pool) => patch(index, { pool })} />
      </Field>
    </div>
  )

  return (
    <div className="col" style={{ gap: 6 }}>
      {cycle && (
        <div className="hintbox error">
          <span className="row" style={{ gap: 4, alignItems: 'center' }}>
            <AlertTriangle size={13} /> 依赖成环（K30）：{cycle.join(' → ')}
          </span>
          <div className="faint" style={{ fontSize: 11 }}>
            请先解开环再保存 / 导出；手写文件按声明顺序兜底、不会卡死。
          </div>
        </div>
      )}

      {checks.length === 0 && (
        <div className="hintbox warn">
          还没有回合判定。回合判定每回合开始按「业务 → buff → 基础」三批执行，条件成立才跑它的修改动作。
        </div>
      )}

      {namedEntries.map(row)}

      {anonEntries.length > 0 && (
        <div className="col" style={{ gap: 5 }}>
          <div className="faint" style={{ fontSize: 11, paddingTop: 2 }}>
            匿名（最后执行）
          </div>
          {anonEntries.map(row)}
        </div>
      )}

      {/* 依赖图小视图 */}
      {aliases.length > 0 && (
        <div className="panel" style={{ padding: 8 }}>
          <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>
            依赖图（← 表示「依赖」）
          </div>
          <div className="col" style={{ gap: 2 }}>
            {namedOrder.map((c) => (
              <div key={c.alias} className="row" style={{ gap: 4, fontSize: 12 }}>
                <Badge tone="on">{orderIndex.get(c.alias as string)}</Badge>
                <span>{c.alias}</span>
                {(c.deps ?? []).length > 0 && (
                  <span className="faint" style={{ fontSize: 11 }}>
                    ← {(c.deps ?? []).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
  const notify = useUiStore((s) => s.notify)
  const pool = useProjectStore((s) => s.pool)
  const conds = useProjectStore((s) => s.conds)
  const checks = useProjectStore((s) => s.checks)
  const [tab, setTab] = useState<Tab>('pool')
  const [space, setSpace] = useState<SpaceFilter>('all')
  const [keyword, setKeyword] = useState('')

  if (!open) return null

  const writePool = (next: PoolVar[]) => commit(() => useProjectStore.getState().setPool(next))
  const writeConds = (next: CondTpl[]) => commit(() => useProjectStore.getState().setConds(next))
  const writeChecks = (next: PoolRoundCheck[]) => commit(() => useProjectStore.getState().setChecks(next))

  // 派生统计（引用数 / 引用明细），不落盘
  const usage = poolUsageCounts(librarySnapshot(), projectSnapshot())
  const refs = poolReferenceInfo(librarySnapshot(), projectSnapshot())

  const condNames = conds.map((c) => c.name).filter(Boolean)
  const varNames = new Set(pool.map((v) => v.name).filter(Boolean))
  const declared = pool.filter((v) => v.name)

  // 自动收录：被引用但未声明的作者空间键
  const missing = collectMissingVars(refs, declared)

  const collect = () => {
    if (missing.length === 0) return
    commit(() => useProjectStore.getState().setPool([...pool, ...missing]))
    notify(`已自动收录 ${missing.length} 个新键`, 'info')
  }

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

        <div className="row" style={{ gap: 5, alignItems: 'center' }}>
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
          {missing.length > 0 && (
            <button className="btn small" onClick={collect} title="把被引用但未声明的新键收进作者空间">
              <Plus size={11} /> 收录缺失键（{missing.length}）
            </button>
          )}
          <span className="faint" style={{ fontSize: 11 }}>
            三组全空时 `.pmod` 不写 `## Pool` 段
          </span>
        </div>

        <div className="scroll" style={{ flex: 1, minHeight: 0, paddingRight: 4 }}>
          {tab === 'pool' && (
            <PoolVarTable
              vars={pool}
              usage={usage.vars}
              space={space}
              keyword={keyword}
              onSpace={setSpace}
              onKeyword={setKeyword}
              onChange={writePool}
            />
          )}
          {tab === 'conds' && (
            <CondTplList conds={conds} usage={usage.templates} varNames={varNames} onChange={writeConds} />
          )}
          {tab === 'checks' && <RoundCheckList checks={checks} condNames={condNames} onChange={writeChecks} />}
        </div>
      </div>
    </Overlay>
  )
}
