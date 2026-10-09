/**
 * 建筑（§4.4 / §5.6）—— **五种行为并列，面板只显示选中行为对应的那一块**（§6.2 11g）。
 * 通用部分永远是「消耗 + 权限 + 给几点」；算法在规则页里定义一次，这里只给池。
 */

import type {
  BuildingDef,
  EncounterKind,
  EventBlock,
  EventOutcome,
  GrantEntry,
  StatKey,
} from '../../../types'
import { ENCOUNTER_KINDS, STAT_KEYS, STAT_LABEL, emptyCheck } from '../../../types'
import { useLibraryStore } from '../../../store/library'
import { useProjectStore } from '../../../store/project'
import { useUiStore } from '../../../store/ui'
import { resolveItemPool } from '../../../engine/pool'
import { checkAnalysis } from '../../../engine/event'
import { makePlayerUnit } from '../../../engine/units'
import { eventText } from '../../../lib/human'
import { Field, NumberBox, SelectBox, TextBox, Toggle } from '../../../ui/primitives'
import { CostEditor, GateEditor } from '../controls/CostGateEditor'
import { CheckRefEditor } from '../controls/CheckRefEditor'
import EffectsEditor from '../controls/EffectsEditor'
import PoolEditor from '../controls/PoolEditor'
import PriceEditor from '../controls/PriceEditor'
import DiceInput from '../controls/DiceInput'
import { CopiesEditor, PickEditor } from '../controls/RewardAlgoEditor'

const ENCOUNTER_LABEL: Record<EncounterKind, string> = {
  empty: '空地（纯装饰 / 占位）',
  treasure: '宝箱（开箱赠予）',
  monster: '怪物房（抽一只开打）',
  event: '事件（门槛 + 判定 + 后果）',
  shop: '商店（用钱换东西）',
  talk: '对话（建筑事件留空，以 NPC 对话为主体）',
}

export default function BuildingEditor({
  def,
  onChange,
}: {
  def: BuildingDef
  onChange: (patch: Partial<BuildingDef>) => void
}) {
  const poolSize = (def.reward_pool?.ids ?? []).length
  const stockSize = (def.stock?.ids ?? []).length
  const tplNames = useProjectStore((s) => s.conds)
    .map((c) => c.name)
    .filter(Boolean)

  const patchEvent = (part: Partial<EventBlock>) => {
    onChange({ event: { ...(def.event ?? {}), ...part } })
  }

  return (
    <div>
      <Field label="踩到时发生什么（encounter）">
        <SelectBox
          value={def.encounter}
          options={ENCOUNTER_KINDS.map((k) => ({ value: k, label: ENCOUNTER_LABEL[k] }))}
          onChange={(v) => onChange({ encounter: v as EncounterKind })}
        />
      </Field>

      {/* 通用：消耗 + 权限 + 给点数（§4.4 与道路同一套） */}
      <CostEditor value={def.cost} onChange={(cost) => onChange({ cost })} />
      <GateEditor value={def.gate} onChange={(gate) => onChange({ gate })} />

      {/* 建筑 `encounter` 前置判定（§6.4 / §8.3③）：与门锁同构，在门锁与 NPC 之后、建筑行为之前求值 */}
      <Field
        label="到访触发判定（encounterPool）"
        hint="与门锁同构：不成立 → 本次到访不触发建筑行为（也不等掷骰）；不写 ＝ 恒成立。反馈由文案 / 对话树 if 承担"
      >
        <Toggle
          label="开启"
          checked={def.encounterPool !== undefined}
          onChange={(on) => onChange({ encounterPool: on ? emptyCheck() : undefined })}
        />
      </Field>
      {def.encounterPool !== undefined && (
        <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginBottom: 6 }}>
          <CheckRefEditor
            value={def.encounterPool}
            onChange={(encounterPool) => onChange({ encounterPool })}
            tplNames={tplNames}
            label="判定模板"
          />
        </div>
      )}

      <Field label="结算时给予的自由属性点（point_reward）" hint="开箱与事件成功均可给予">
        <NumberBox value={def.point_reward} min={0} onChange={(n) => onChange({ point_reward: n ?? 0 })} />
      </Field>

      <div className="sketch-line" style={{ margin: '10px 0' }} />

      {def.encounter === 'empty' && (
        <div className="hintbox">不触发任何效果，可用于装饰或占位。</div>
      )}

      {def.encounter === 'treasure' && (
        <>
          <PoolEditor value={def.reward_pool} onChange={(reward_pool) => onChange({ reward_pool })} kind="item" label="奖励池" />
          <EmptyChestHint def={def} />
          <PickEditor value={def.pick} onChange={(pick) => onChange({ pick })} poolSize={poolSize} label="件数覆盖（可省）" />
          <CopiesEditor value={def.copies} onChange={(copies) => onChange({ copies })} label="份数覆盖（可省）" />

          <Field label="宝箱怪物（mimic）" hint="按概率触发伪装怪物：先进入战斗，胜利后按战利品算法结算">
            <Toggle
              label="开启"
              checked={!!def.mimic}
              onChange={(on) =>
                onChange({
                  mimic: on
                    ? { chance: def.mimic?.chance ?? 0.2, monster: def.mimic?.monster ?? '', reward_pool: def.mimic?.reward_pool }
                    : undefined,
                })
              }
            />
            {def.mimic && (
              <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginTop: 4 }}>
                <Field label="伪装概率（0~1）">
                  <NumberBox value={def.mimic.chance} onChange={(n) => onChange({ mimic: { ...def.mimic!, chance: n ?? 0 } })} />
                </Field>
                <MonsterSelect
                  value={def.mimic.monster}
                  onChange={(monster) => onChange({ mimic: { ...def.mimic!, monster } })}
                />
                <PoolEditor
                  value={def.mimic.reward_pool}
                  onChange={(reward_pool) => onChange({ mimic: { ...def.mimic!, reward_pool } })}
                  kind="item"
                  label="打赢后的战利品池（可省）"
                />
              </div>
            )}
          </Field>
        </>
      )}

      {def.encounter === 'monster' && (
        <PoolEditor value={def.monster_pool} onChange={(monster_pool) => onChange({ monster_pool })} kind="monster" label="怪物池" />
      )}

      {def.encounter === 'event' && (
        <EventEditor event={def.event} onChange={patchEvent} />
      )}

      {def.encounter === 'shop' && (
        <>
          <PoolEditor value={def.stock} onChange={(stock) => onChange({ stock })} kind="item" label="上架池" />
          {def.stock && (
            <PickEditor
              value={def.stock.pick}
              onChange={(pick) =>
                onChange({
                  stock: { source: def.stock!.source, ids: def.stock!.ids, filter: def.stock!.filter, pick },
                })
              }
              poolSize={stockSize}
              label="这次上架几件"
              allowClear={false}
            />
          )}
          <PriceEditor value={def.price} onChange={(price) => onChange({ price })} allowClear />
          <div className="faint">
            货币为普通道具（`tags: [货币]` 仅用于筛选）；获得货币与获得其他道具走同一套产出机制。
          </div>
        </>
      )}

      {def.encounter === 'talk' && <TalkGuide />}
    </div>
  )
}

/**
 * 空宝箱（§5.7）：奖励池筛出 0 项，**且所有实例都没挂 NPC** → 建筑页标黄。
 * 挂了 NPC 就是**合法配置**（NPC 就是内容物，进入时走对话），一条都不报。
 */
function EmptyChestHint({ def }: { def: BuildingDef }) {
  const library = useLibraryStore()
  const project = useProjectStore()
  const size = def.reward_pool ? resolveItemPool(library, project.enabledIds, def.reward_pool).length : 0
  if (size > 0) return null

  const hasNpc = project.maps.some((m) =>
    m.nodes.some((n) => n.type === 'building' && n.ref === def.id && (n.npcs?.length ?? 0) > 0),
  )
  if (hasNpc) return null

  return (
    <div className="hintbox warn">
      这个宝箱<b>什么都没装</b> —— 配个奖励池，或者给它挂一位 NPC（NPC 就是它的内容物）。
    </div>
  )
}

/**
 * `talk` 建筑**不在组件页配 NPC**（§5.6 / §4.9.3）：遇到谁、用哪套对话方案都挂在**实例**上，
 * 同一栋建筑铺到多格可以遇到不同的人 —— 这里只给一句指路和一个快捷按钮。
 */
function TalkGuide() {
  return (
    <div>
      <div className="hintbox">
        <div>
          <b>NPC 挂在建筑实例上</b>（遇到谁、用哪套对话方案），请到实例页挑。
        </div>
        <div className="faint">同一栋建筑铺到多格，可以遇到不同的人。</div>
      </div>
      <button
        className="btn small"
        onClick={() => {
          useUiStore.getState().setInspectorTab('instance')
        }}
      >
        去实例页配置
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 事件块（§4.8.9）                                                     */
/* ------------------------------------------------------------------ */

function EventEditor({ event, onChange }: { event?: EventBlock; onChange: (part: Partial<EventBlock>) => void }) {
  const library = useLibraryStore()
  const project = useProjectStore()
  const block: EventBlock = event ?? {}
  const check = block.check

  const probes = library.classes.filter((c) => project.enabledIds.includes(c.id) && project.rules.class_pool.includes(c.id))
  const reference = probes[0] ?? library.classes[0]
  const analysis = check && reference ? checkAnalysis(makePlayerUnit({ cls: reference }), check, project.rules) : undefined

  return (
    <div>
      <Field label="文本">
        <TextBox value={block.text ?? ''} rows={2} onChange={(text) => onChange({ text })} placeholder="触发时展示的文本" />
      </Field>

      <GateEditor value={block.gate} onChange={(gate) => onChange({ gate })} label="① 门槛（能否参与）" />

      <Field label="② 判定（是否成功）" hint={check ? undefined : '不写判定 = 过了门槛就必成（纯叙事 / 有钥匙就能开）'}>
        <Toggle
          label="进行判定"
          checked={!!check}
          onChange={(on) => onChange({ check: on ? { add: 'patk', target: 10 } : undefined })}
        />
        {check && (
          <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginTop: 4 }}>
            <DiceInput
              value={check.dice}
              onChange={(dice) => onChange({ check: { ...check, dice } })}
              hint="留空就用规则页的 event.dice"
            />
            <div className="grid2">
              <Field label="计入的属性维度">
                <SelectBox
                  value={check.add}
                  options={[{ value: 'none', label: '不靠属性' }, ...STAT_KEYS.map((k) => ({ value: k, label: STAT_LABEL[k] }))]}
                  onChange={(v) => onChange({ check: { ...check, add: v as StatKey | 'none' } })}
                />
              </Field>
              <Field label="难度（固定值）">
                <NumberBox value={check.target} onChange={(n) => onChange({ check: { ...check, target: n ?? 0 } })} />
              </Field>
            </div>

            {analysis && (
              <div className={`hintbox ${analysis.verdict === 'always' ? 'ok' : analysis.verdict === 'never' ? 'warn' : ''}`}>
                <div>
                  以「{reference?.name}」为参照：手艺 {analysis.min} ~ {analysis.max}，命中率约{' '}
                  <b>{Math.round(analysis.rate * 100)}%</b>
                  {analysis.needPips !== null ? `（至少要掷出 ${analysis.needPips}）` : '（掷到顶也不够）'}
                </div>
                {analysis.verdict === 'always' && <div>判定结果<b>必定成功</b>：对当前配置而言该判定不具备挑战性。</div>}
                {analysis.verdict === 'never' && (
                  <div>判定结果<b>必定失败</b>。建议提升相关属性、更换装备，或下调难度值。</div>
                )}
              </div>
            )}
          </div>
        )}
      </Field>

      <OutcomeEditor label="成功会发生什么" value={block.on_success} onChange={(on_success) => onChange({ on_success })} />
      <OutcomeEditor label="失败会发生什么" value={block.on_fail} onChange={(on_fail) => onChange({ on_fail })} />

      <Toggle label="once：成功后本格降级为空地" checked={!!block.once} onChange={(once) => onChange({ once })} />

      <div className="hintbox">{eventText(block)}</div>
    </div>
  )
}

function OutcomeEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value?: EventOutcome
  onChange: (value: EventOutcome | undefined) => void
}) {
  const library = useLibraryStore()
  const project = useProjectStore()
  const maxDuration = project.rules.state.max_duration
  const outcome = value
  const items = library.items.filter((i) => project.enabledIds.includes(i.id))
  const grants = outcome?.grant ?? []

  return (
    <Field label={label}>
      <Toggle
        label="有后果"
        checked={!!outcome}
        onChange={(on) => onChange(on ? { text: '' } : undefined)}
      />
      {outcome && (
        <div style={{ border: '1.2px dashed var(--line)', borderRadius: 10, padding: 6, marginTop: 4 }}>
          <Field label="文本">
            <TextBox value={outcome.text ?? ''} onChange={(text) => onChange({ ...outcome, text })} />
          </Field>
          <CostEditor value={outcome.cost} onChange={(cost) => onChange({ ...outcome, cost })} step={false} label="扣资源" />
          <Field label="给自由点">
            <NumberBox value={outcome.point_reward} min={0} onChange={(n) => onChange({ ...outcome, point_reward: n ?? 0 })} />
          </Field>

          <Field label="赠予道具（grant）">
            {grants.map((grant, index) => (
              <GrantRow
                key={index}
                grant={grant}
                items={items}
                onChange={(next) => {
                  const list = [...grants]
                  list[index] = next
                  onChange({ ...outcome, grant: list })
                }}
                onRemove={() => onChange({ ...outcome, grant: grants.filter((_, i) => i !== index) })}
              />
            ))}
            <SelectBox
              value=""
              options={[
                { value: '', label: '＋ 给一件' },
                ...items.map((i) => ({ value: i.id, label: `${i.icon} ${i.name}` })),
              ]}
              onChange={(v) => v && onChange({ ...outcome, grant: [...grants, { id: v, count: 1 }] })}
            />
          </Field>

          <EffectsEditor
            effects={outcome.effects}
            onChange={(effects) => onChange({ ...outcome, effects })}
            maxDuration={maxDuration}
            label="挂 / 解状态"
          />
        </div>
      )}
    </Field>
  )
}

function GrantRow({
  grant,
  items,
  onChange,
  onRemove,
}: {
  grant: GrantEntry
  items: { id: string; name: string; icon: string }[]
  onChange: (grant: GrantEntry) => void
  onRemove: () => void
}) {
  return (
    <div className="row" style={{ gap: 4, marginBottom: 3 }}>
      <SelectBox
        value={grant.id}
        options={items.map((i) => ({ value: i.id, label: `${i.icon} ${i.name}` }))}
        onChange={(id) => onChange({ ...grant, id })}
      />
      <div style={{ width: 60 }}>
        <NumberBox value={grant.count} min={1} onChange={(n) => onChange({ ...grant, count: n ?? 1 })} />
      </div>
      <button className="btn small" onClick={onRemove}>
        ×
      </button>
    </div>
  )
}

function MonsterSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const monsters = library.monsters.filter((m) => enabledIds.includes(m.id))
  return (
    <Field label="伪装成哪只怪（单只，不用池）">
      <SelectBox
        value={value}
        options={[
          { value: '', label: '（选一只）' },
          ...monsters.map((m) => ({ value: m.id, label: `${m.icon} ${m.name}` })),
        ]}
        onChange={onChange}
      />
    </Field>
  )
}
