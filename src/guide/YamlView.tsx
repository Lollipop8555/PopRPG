/**
 * `guide/rules.yaml` 的速查视图（Guide.md §七）。
 *
 * `rules.yaml` 是**同源同义**的机读镜像：形状随内容而变（对象 / 对象数组 / 标量数组混排），
 * 因此这里不做字段硬编码，而是**通用树渲染** ——
 *   - 对象 → 键值表；
 *   - 对象数组 → 取并集列的表；
 *   - 标量数组 → 一行胶囊；
 *   - 标量 → 文本。
 * 顶部一个搜索框：命中子串的叶子连同其祖先一起保留，其余折叠，便于按编号 / 字段名速查。
 *
 * 冲突以格式手册为准（`Guide.md` §七）：本页只做呈现，不改写事实。
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

const isObj = (v: Json): v is { [k: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v)
const isScalar = (v: Json): v is null | boolean | number | string => v === null || typeof v !== 'object'

/** 子树里是否存在含查询串的键或叶子 */
function matches(v: Json, q: string): boolean {
  if (q === '') return true
  if (isScalar(v)) return String(v ?? '').toLowerCase().includes(q)
  if (Array.isArray(v)) return v.some((x) => matches(x, q))
  return Object.entries(v).some(([k, val]) => k.toLowerCase().includes(q) || matches(val, q))
}

/** 命中的子串高亮 */
function hl(text: string, q: string, keyBase: string): ReactNode {
  if (q === '') return text
  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let at = 0
  let n = 0
  for (;;) {
    const idx = lower.indexOf(q, at)
    if (idx < 0) break
    if (idx > at) out.push(text.slice(at, idx))
    out.push(
      <mark key={`${keyBase}-m${n++}`} className="gx-mark">
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    at = idx + q.length
  }
  if (out.length === 0) return text
  if (at < text.length) out.push(text.slice(at))
  return out
}

const scalarText = (v: Json): string => {
  if (v === null) return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

/** 数组的列：对象数组取各元素键的并集，保持首次出现顺序 */
function columns(arr: Json[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of arr) {
    if (!isObj(item)) continue
    for (const k of Object.keys(item)) {
      if (!seen.has(k)) {
        seen.add(k)
        out.push(k)
      }
    }
  }
  return out
}

function inferType(v: Json): string {
  if (Array.isArray(v)) return 'array'
  if (isObj(v)) return 'object'
  if (v === null) return 'null'
  return typeof v
}

type Ctx = { q: string; base: string }

function renderValue(v: Json, ctx: Ctx): ReactNode {
  if (isScalar(v)) return <span className="gx-yv">{hl(scalarText(v), ctx.q, ctx.base)}</span>

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="gx-yv empty">[]（空）</span>
    const allObj = v.every(isObj)
    if (allObj) {
      const cols = columns(v)
      return (
        <div className="gx-tablewrap">
          <table className="gx-table gx-ytable">
            <thead>
              <tr>
                <th className="gx-idx">#</th>
                {cols.map((c) => (
                  <th key={c}>{hl(c, ctx.q, `${ctx.base}-h-${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.map((row, ri) => (
                <tr key={ri}>
                  <td className="gx-idx">{ri + 1}</td>
                  {cols.map((c) => {
                    const val = (row as { [k: string]: Json })[c]
                    return (
                      <td key={c} className={val === undefined ? 'gx-idx' : undefined}>
                        {val === undefined ? '—' : renderValue(val, { q: ctx.q, base: `${ctx.base}-r${ri}-${c}` })}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    const scalars = v.every(isScalar)
    if (scalars) {
      return (
        <div className="gx-chips">
          {v.map((s, si) => (
            <span key={si} className="badge">
              {hl(scalarText(s), ctx.q, `${ctx.base}-c${si}`)}
            </span>
          ))}
        </div>
      )
    }
    // 混合数组：逐项竖排
    return (
      <div className="gx-ylist">
        {v.map((item, ii) => (
          <div key={ii} className="gx-yitem">
            <span className="gx-yidx">{ii + 1}</span>
            {renderValue(item, { q: ctx.q, base: `${ctx.base}-i${ii}` })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <dl className="gx-yobj">
      {Object.entries(v).map(([k, val]) => {
        if (!matches(val, ctx.q) && !k.toLowerCase().includes(ctx.q)) return null
        return (
          <div key={k} className="gx-yrow">
            <dt className="gx-ykey" title={k}>
              {hl(k, ctx.q, `${ctx.base}-k-${k}`)}
              <span className="gx-ytype">{inferType(val)}</span>
            </dt>
            <dd className="gx-yval">{renderValue(val, { q: ctx.q, base: `${ctx.base}-v-${k}` })}</dd>
          </div>
        )
      })}
    </dl>
  )
}

export default function YamlView({ data }: { data: Json }) {
  const [raw, setRaw] = useState('')
  const q = raw.trim().toLowerCase()

  const sections = useMemo(() => {
    if (!isObj(data)) return []
    return Object.entries(data)
      .map(([k, val]) => ({ k, val }))
      .filter(({ k, val }) => matches(val, q) || k.toLowerCase().includes(q))
  }, [data, q])

  return (
    <div className="gx-yaml">
      <div className="gx-yaml-bar">
        <span className="gx-search">
          <Search size={13} />
          <input
            className="input"
            value={raw}
            placeholder="搜索字段 / 取值 / 校验编号，如 K30、attack_weights、slice"
            onChange={(e) => setRaw(e.target.value)}
          />
          {raw && (
            <button className="gx-search-clear" onClick={() => setRaw('')} title="清空">
              <X size={13} />
            </button>
          )}
        </span>
        <span className="faint">{sections.length} 个顶层段</span>
      </div>

      {sections.length === 0 && <div className="hintbox warn">没有匹配「{raw.trim()}」的条目。</div>}

      {sections.map(({ k, val }) => (
        <section key={k} className="gx-ysec panel">
          <h3 className="gx-ysec-title">{hl(k, q, `sec-${k}`)}</h3>
          <div className="gx-ysec-body">{renderValue(val, { q, base: `sec-${k}` })}</div>
        </section>
      ))}
    </div>
  )
}
