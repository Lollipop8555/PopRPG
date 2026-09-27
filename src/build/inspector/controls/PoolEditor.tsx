/**
 * 池编辑器（§4.8.5①）—— 奖励池 / 怪物池 / 商店上架池**三处结构完全相同**。
 * - `ids`   手选（可带权重；写纯 id 视为 1）
 * - `filter` 按条件筛（只留**已启用**的那些）
 * 旁边实时显示命中数，命中 0 就标黄提醒「这个池是空的」（§5.7 K6）。
 */

import type { AnyComponent, PoolEntry, PoolRef } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { resolveItemPool, resolveMonsterPool } from '../../../engine/pool'
import { collectKnownTags } from '../../../lib/refs'
import { Field, NumberBox, SelectBox } from '../../../ui/primitives'
import TagsInput from './TagsInput'

export default function PoolEditor({
  value,
  onChange,
  kind,
  label = '池',
}: {
  value?: PoolRef
  onChange: (value: PoolRef | undefined) => void
  kind: 'item' | 'monster'
  label?: string
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const pool = value

  const candidates: AnyComponent[] =
    kind === 'item'
      ? library.items.filter((i) => enabledIds.includes(i.id))
      : library.monsters.filter((m) => enabledIds.includes(m.id))

  const hits = pool ? (kind === 'item' ? resolveItemPool(library, enabledIds, pool) : resolveMonsterPool(library, enabledIds, pool)) : []

  const setSource = (source: 'ids' | 'filter') => {
    onChange({ source, ids: source === 'ids' ? (pool?.ids ?? []) : pool?.ids, filter: source === 'filter' ? (pool?.filter ?? {}) : pool?.filter })
  }

  const ids: PoolEntry[] = pool?.ids ?? []

  const addId = (id: string) => {
    if (ids.some((e) => (typeof e === 'string' ? e : e.id) === id)) return
    onChange({ ...(pool ?? { source: 'ids' }), source: 'ids', ids: [...ids, id] })
  }

  const patchWeight = (index: number, weight: number | undefined) => {
    const next = [...ids]
    const entry = next[index]
    next[index] = weight === undefined || weight === 1 ? (typeof entry === 'string' ? entry : entry.id) : { id: typeof entry === 'string' ? entry : entry.id, weight }
    onChange({ ...(pool ?? { source: 'ids' }), source: 'ids', ids: next })
  }

  const removeId = (index: number) => {
    onChange({ ...(pool ?? { source: 'ids' }), source: 'ids', ids: ids.filter((_, i) => i !== index) })
  }

  return (
    <Field label={label}>
      <div className="row" style={{ gap: 4, marginBottom: 4 }}>
        <SelectBox
          value={pool?.source ?? 'ids'}
          options={[
            { value: 'ids', label: '手选' },
            { value: 'filter', label: '按条件筛' },
          ]}
          onChange={(v) => setSource(v as 'ids' | 'filter')}
        />
        <span className="faint">命中 {hits.length} 项</span>
      </div>

      {pool?.source === 'filter' && (
        <>
          <div className="grid2">
            {kind === 'item' && (
              <Field label="道具种类">
                <SelectBox
                  value={pool.filter?.itemKind ?? ''}
                  options={[
                    { value: '', label: '不限' },
                    { value: 'consumable', label: '消耗品' },
                    { value: 'equipment', label: '装备' },
                  ]}
                  onChange={(v) =>
                    onChange({
                      ...pool,
                      filter: { ...pool.filter, itemKind: v === '' ? undefined : (v as 'consumable' | 'equipment') },
                    })
                  }
                />
              </Field>
            )}
          </div>
          <TagsInput
            label="标签条件"
            value={pool.filter?.tags ?? []}
            onChange={(tags) => onChange({ ...pool, filter: { ...pool.filter, tags: tags.length ? tags : undefined } })}
            suggestions={collectKnownTags(library)}
            hint="多个标签需全部满足"
          />
        </>
      )}

      {(pool?.source ?? 'ids') === 'ids' && (
        <div>
          {ids.map((entry, index) => {
            const id = typeof entry === 'string' ? entry : entry.id
            const weight = typeof entry === 'string' ? 1 : entry.weight
            const def = candidates.find((c) => c.id === id)
            return (
              <div key={`${id}-${index}`} className="row" style={{ gap: 4, marginBottom: 3 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>
                  {def ? `${def.icon} ${def.name}` : <span style={{ color: 'var(--red)' }}>{id}（未启用 / 不存在）</span>}
                </span>
                <span className="faint">权重</span>
                <div style={{ width: 62 }}>
                  <NumberBox value={weight} min={0} onChange={(n) => patchWeight(index, n)} />
                </div>
                <button className="btn small" onClick={() => removeId(index)}>
                  ×
                </button>
              </div>
            )
          })}

          <SelectBox
            value=""
            options={[
              { value: '', label: '＋ 加一项' },
              ...candidates
                .filter((c) => !ids.some((e) => (typeof e === 'string' ? e : e.id) === c.id))
                .map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
            ]}
            onChange={(v) => v && addId(v)}
          />
        </div>
      )}

      {pool && hits.length === 0 && (
        <div className="hintbox warn" style={{ marginTop: 4 }}>
          当前条件下池内没有可用条目，触发后将无产出。请启用池内组件或调整筛选条件。
        </div>
      )}
    </Field>
  )
}
