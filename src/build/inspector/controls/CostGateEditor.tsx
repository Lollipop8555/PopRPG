/**
 * 消耗 cost + 权限 gate（§4.5）—— 地图件（道路 / 建筑）与事件共用**同一套**控件。
 * 权限框旁边实时反查「谁带这个标签」，一个都没有就标黄（§5.6 / §5.7 权限死路）。
 */

import type { Gate, MapCost } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { componentsWithTag } from '../../../lib/refs'
import { costText } from '../../../lib/human'
import { Field, NumberBox, SelectBox } from '../../../ui/primitives'
import TagsInput from './TagsInput'

export function CostEditor({
  value,
  onChange,
  label = '消耗',
  step = true,
}: {
  value?: MapCost
  onChange: (value: MapCost | undefined) => void
  label?: string
  step?: boolean
}) {
  const cost = value ?? {}
  const patch = (part: Partial<MapCost>) => {
    const next = { ...cost, ...part }
    const cleaned: MapCost = {}
    if (next.step !== undefined) cleaned.step = next.step
    if (next.hp) cleaned.hp = next.hp
    if (next.mp) cleaned.mp = next.mp
    onChange(Object.keys(cleaned).length ? cleaned : undefined)
  }

  return (
    <Field label={label} hint={`现在：${costText(value)}（省略 = 走一格花一步）`}>
      <div className="grid3">
        {step && (
          <label className="row" style={{ gap: 3 }}>
            <span className="faint">步</span>
            <NumberBox value={cost.step} placeholder="1" onChange={(n) => patch({ step: n })} />
          </label>
        )}
        <label className="row" style={{ gap: 3 }}>
          <span className="faint">血</span>
          <NumberBox value={cost.hp} placeholder="0" onChange={(n) => patch({ hp: n })} />
        </label>
        <label className="row" style={{ gap: 3 }}>
          <span className="faint">蓝</span>
          <NumberBox value={cost.mp} placeholder="0" onChange={(n) => patch({ mp: n })} />
        </label>
      </div>
    </Field>
  )
}

export function GateEditor({
  value,
  onChange,
  label = '权限',
  withPenalty = true,
}: {
  value?: Gate
  onChange: (value: Gate | undefined) => void
  label?: string
  withPenalty?: boolean
}) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const gate = value
  const tags = gate?.tags ?? []

  const carriers = tags.length
    ? tags.map((tag) => ({ tag, list: componentsWithTag(library, enabledIds, tag) }))
    : []

  const patch = (part: Partial<Gate>) => {
    if (!gate && !part.tags) return
    const next: Gate = { ...(gate ?? { tags: [] }), ...part }
    if (next.tags.length === 0) return onChange(undefined)
    onChange(next)
  }

  const penalty = gate?.penalty ?? {}

  return (
    <div>
      <TagsInput
        label={label}
        value={tags}
        onChange={(next) => patch({ tags: next })}
        hint="标签为自由文本，引擎不解析其语义，仅按标签进行匹配"
      />

      {tags.length > 0 && (
        <>
          <div className="grid2">
            <Field label="怎么算满足">
              <SelectBox
                value={gate?.mode ?? 'any'}
                options={[
                  { value: 'any', label: '有任一即可' },
                  { value: 'all', label: '全都要有' },
                ]}
                onChange={(v) => patch({ mode: v as 'any' | 'all' })}
              />
            </Field>
            <Field label="不满足时">
              <SelectBox
                value={gate?.missing ?? 'block'}
                options={[
                  { value: 'block', label: '走不进去' },
                  ...(withPenalty ? [{ value: 'penalty', label: '能硬闯但加罚' }] : []),
                ]}
                onChange={(v) => patch({ missing: v as 'block' | 'penalty' })}
              />
            </Field>
          </div>

          {withPenalty && gate?.missing === 'penalty' && (
            <CostEditor
              label="额外代价"
              step={false}
              value={penalty}
              onChange={(p) => patch({ penalty: p })}
            />
          )}

          <div>
            {carriers.map(({ tag, list }) => (
              <div key={tag} className={list.length === 0 ? 'hintbox warn' : 'hintbox'} style={{ marginTop: 4 }}>
                {list.length === 0 ? (
                  <>目前没有任何已启用的装备 / 职业 / 状态带「{tag}」 —— 这条现在是死路（先铺路、东西还没做也算正常）。</>
                ) : (
                  <>带「{tag}」的：{list.map((c) => `${c.icon}${c.name}`).join(' / ')}</>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
