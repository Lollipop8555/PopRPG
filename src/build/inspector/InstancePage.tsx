/**
 * 实例页（右栏，§5.6）—— 选中地图上的**节点**时显示：
 * 坐标 / 类型 / 引用了哪个组件 + [编辑该组件定义] 跳转 + 建筑宽高 + 复制 / 删除。
 * 引用悬空（组件被删了）→ 标红并给快捷修复。
 */

import type { MapNode, NodeType, NpcDef, NpcSlot } from '../../types'
import { nodeAt } from '../../lib/map'
import { findComponent } from '../../lib/refs'
import { diceFaces } from '../../lib/dialog'
import { resolveSlots, slotCap, slotColor, slotIds, type ResolvedSlot } from '../../lib/npcSlots'
import { useLibraryStore } from '../../store/library'
import { useProjectStore } from '../../store/project'
import { commit } from '../../store/commit'
import { useUiStore } from '../../store/ui'
import { Badge, Field, NumberBox, SelectBox, Toggle } from '../../ui/primitives'
import {
  clearRootFirstIf,
  findOnceCond,
  freeOnceShort,
  makeOnceCond,
  onceRollModKey,
  rootFirstIfName,
  setRootFirstIf,
} from '../oncePreset'

const TYPE_LABEL: Record<NodeType, string> = {
  start: '起点',
  end: '终点',
  road: '道路',
  building: '建筑',
}

export default function InstancePage() {
  const library = useLibraryStore()
  const project = useProjectStore()
  const ui = useUiStore()
  const mapId = project.maps.find((m) => m.id === ui.currentMapId)?.id ?? project.maps[0]?.id
  const map = project.maps.find((m) => m.id === mapId)

  const key = ui.selectedNodeKey
  const node = key && map ? map.nodes.find((n) => `${n.x},${n.y}` === key) : undefined

  if (!map || !node) {
    return <div className="hintbox">请在画布「选择」模式下点击节点，此处可修改其位置与尺寸。</div>
  }

  const ref = node.ref ? findComponent(library, node.ref) : undefined
  const dangling = !!node.ref && !ref

  const patch = (part: Partial<MapNode>) => {
    commit(() => {
      const nodes = map.nodes.map((n) => (n === node ? { ...n, ...part } : n))
      useProjectStore.setState({ maps: project.maps.map((m) => (m.id === map.id ? { ...m, nodes } : m)) })
    })
  }

  const candidates =
    node.type === 'road'
      ? library.roads
      : node.type === 'building'
        ? library.buildings
        : []

  return (
    <div>
      <div className="row" style={{ gap: 4 }}>
        <Badge>{TYPE_LABEL[node.type]}</Badge>
        <Badge>
          ({node.x}, {node.y})
        </Badge>
        {node.ref && <Badge tone={dangling ? 'err' : 'default'}>{ref ? `${ref.def.icon} ${ref.def.name}` : `${node.ref}（已被删除）`}</Badge>}
      </div>

      {dangling && (
        <div className="hintbox error" style={{ marginTop: 6 }}>
          这个节点引用的组件已经不在库里了 —— 它是个悬空引用（导出时会被自动剔除）。
        </div>
      )}

      {(node.type === 'road' || node.type === 'building') && (
        <Field label="换成哪个组件" hint={node.type === 'road' ? '不同路的消耗 / 权限不同' : undefined}>
          <SelectBox
            value={node.ref ?? ''}
            options={[{ value: '', label: '（没指定）' }, ...candidates.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]}
            onChange={(v) => patch({ ref: v || undefined })}
          />
        </Field>
      )}

      {ref && (
        <button
          className="btn small"
          onClick={() => {
            ui.setSelectedKit(ref.def.id)
            ui.setInspectorTab('component')
          }}
        >
          编辑该组件定义
        </button>
      )}

      {node.type === 'building' && (
        <div className="grid2">
          <Field label="宽（格）">
            <NumberBox value={node.w ?? 1} min={1} onChange={(w) => patch({ w })} />
          </Field>
          <Field label="高（格）">
            <NumberBox value={node.h ?? 1} min={1} onChange={(h) => patch({ h })} />
          </Field>
        </div>
      )}

      {node.type === 'building' && <NpcBlock node={node} patch={patch} mapName={map.name} />}

      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <button
          className="btn small"
          onClick={() => {
            const target: [number, number] = [node.x + 1, node.y]
            const free = !nodeAt(map, target[0], target[1])
            const cell: [number, number] = free ? target : [node.x, node.y + 1]
            if (nodeAt(map, cell[0], cell[1])) return
            commit(() => useProjectStore.getState().placeNode(map.id, { ...node, x: cell[0], y: cell[1] }))
            ui.selectNode(`${cell[0]},${cell[1]}`)
          }}
        >
          复制该节点
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            commit(() => useProjectStore.getState().removeCells(map.id, [[node.x, node.y]]))
            useUiStore.getState().selectNode(undefined)
          }}
        >
          删除该节点
        </button>
      </div>
    </div>
  )
}

/**
 * 建筑实例专有 · NPC **槽位列表**（§5.6 实例页 / §4.9.3 / V2.4 裁决 65）——
 * **任何建筑都能挂**（`npcs` 与 `encounter` 正交）；槽号 ＝ 声明序（`slot0` / `slot1`…）。
 *
 * 每槽独立配置：候选池（`ids`，1 位固定 / 多位掷 `talk.dice` 等权抽一位 / 空留空）＋ 方案（`dialog.mod`）
 * ＋ 落点 `at`（画布上可直接拖动，此处只读显示生效落点）。槽位数到 `w × h` 上限后 `[＋ 槽位]` 禁用。
 */
function NpcBlock({
  node,
  patch,
  mapName,
}: {
  node: MapNode
  patch: (part: Partial<MapNode>) => void
  mapName: string
}) {
  const project = useProjectStore()
  const talkDice = project.rules.talk.dice
  const slots: NpcSlot[] = node.npcs ?? []
  const resolved = resolveSlots(node)
  const cap = slotCap(node)

  const writeSlots = (next: NpcSlot[]) => patch({ npcs: next.length > 0 ? next : undefined })
  const setSlot = (i: number, part: Partial<NpcSlot>) => writeSlots(slots.map((s, j) => (j === i ? { ...s, ...part } : s)))
  const removeSlot = (i: number) => writeSlots(slots.filter((_, j) => j !== i))
  const addSlot = () => {
    if (slots.length >= cap) return
    writeSlots([...slots, { ids: [] }])
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="panel-title hand" style={{ fontSize: 13 }}>
        NPC / 对话（{slots.length} / {cap} 槽）
      </div>

      {slots.length === 0 && <div className="faint">没有槽位 —— 这个建筑不触发 NPC 对话，只运行自身的建筑事件。</div>}

      {slots.map((slot, i) => (
        <SlotRow
          key={i}
          slotN={i}
          slot={slot}
          resolved={resolved[i]}
          node={node}
          mapName={mapName}
          talkDice={talkDice}
          onChange={(part) => setSlot(i, part)}
          onRemove={() => removeSlot(i)}
        />
      ))}

      <button className="btn small" disabled={slots.length >= cap} onClick={addSlot} style={{ marginTop: 4 }}>
        ＋ 槽位
      </button>
      {slots.length >= cap && (
        <div className="faint">已达上限（`w × h` = {cap}）—— 想加槽就先放大建筑，或删掉一个槽。</div>
      )}

      {slots.length === 0 && node.ref && project.maps.length > 0 && <TalkEncounterHint node={node} />}
    </div>
  )
}

/** `talk` 行为却没配任何槽位 → 与校验 K14 同源的提示 */
function TalkEncounterHint({ node }: { node: MapNode }) {
  const library = useLibraryStore()
  const def = node.ref ? library.buildings.find((b) => b.id === node.ref) : undefined
  if (def?.encounter !== 'talk') return null
  return (
    <div className="hintbox warn">
      这个建筑<b>没有对话</b> —— 要么加一个槽位、挂上 NPC，要么把行为改回 `empty`（§4.9.3）。
    </div>
  )
}

/** 一个槽位行：槽号色点 ＋ 候选池 ＋ 方案 ＋ 落点 ＋ 一次性对话预设 */
function SlotRow({
  slotN,
  slot,
  resolved,
  node,
  mapName,
  talkDice,
  onChange,
  onRemove,
}: {
  slotN: number
  slot: NpcSlot
  resolved: ResolvedSlot | undefined
  node: MapNode
  mapName: string
  talkDice: string
  onChange: (part: Partial<NpcSlot>) => void
  onRemove: () => void
}) {
  const library = useLibraryStore()
  const project = useProjectStore()
  const color = slotColor(slotN)
  const ids = slotIds(slot)
  const alive = ids.map((id) => library.npcs.find((n) => n.id === id)).filter((n): n is NpcDef => Boolean(n))

  /** 该槽方案的候选 ＝ 该槽各候选 NPC 的方案并集（去重，保持书写顺序） */
  const plans = [...new Set(alive.flatMap((n) => Object.keys(n.dialogs ?? {})))]
  const plan = slot.dialog?.mod
  const dangling = !!plan && !plans.includes(plan)
  const faces = diceFaces(talkDice)

  const setIds = (next: string[]) => onChange({ ids: next })
  /** 写该槽 `dialog`（§4.9.3）：只剩「这一套方案」（`retalk` 已退役）。空 → 该字段不写。 */
  const setPlan = (mod: string) => onChange({ dialog: mod ? { mod } : undefined })

  /* —— 一次性对话预设（§6.7 / 裁决 61）—— 只在该槽「单一候选 ＋ 写死方案 ＋ 方案存在 ＋ 首层非空」时可套用 */
  const npc = alive[0]
  const onceOk = alive.length === 1 && !!npc && !!plan && !dangling && (npc.dialogs[plan as string]?.length ?? 0) > 0
  const onceKey = onceOk ? onceRollModKey(mapName, node, npc!.id, plan as string) : ''
  const onceTpl = onceOk ? findOnceCond(project.conds, onceKey) : undefined
  const onceOn = !!onceTpl && rootFirstIfName(npc, plan as string) === onceTpl.name

  const toggleOnce = (on: boolean) => {
    if (!onceOk) return
    const nid = npc!.id
    const mid = plan as string
    if (on) {
      commit(() => {
        const st = useProjectStore.getState()
        let tpl = findOnceCond(st.conds, onceKey)
        if (!tpl) {
          tpl = makeOnceCond(
            freeOnceShort(st.conds, st.pool),
            onceKey,
            `「${npc!.name}」在「${mapName}」(${node.x},${node.y}) 的「${mid}」方案尚未执行过`,
          )
          useProjectStore.setState({ conds: [...st.conds, tpl] })
        }
        const li = useLibraryStore.getState()
        const target = li.npcs.find((n) => n.id === nid)
        if (target) li.upsert('npc', setRootFirstIf(target, mid, tpl.name))
      })
    } else if (onceTpl) {
      const name = onceTpl.name
      commit(() => {
        const li = useLibraryStore.getState()
        const target = li.npcs.find((n) => n.id === nid)
        if (target) li.upsert('npc', clearRootFirstIf(target, mid, name))
      })
    }
  }

  const note =
    ids.length === 0
      ? '这一槽留空（不抽、不触发对话）。'
      : ids.length === 1
        ? '只有一位候选，不掷骰，必定站定该 NPC。'
        : faces === null
          ? `掷 ${talkDice} 等权抽一位（对话骰写法有误，请在规则面板改为如 1D6）。`
          : faces < ids.length
            ? `掷 ${talkDice} 等权抽一位 —— 骰子只有 ${faces} 个点数，候选却有 ${ids.length} 位，会有候选抽不到；建议改用更大的对话骰。`
            : `掷 ${talkDice} 等权抽一位 —— 当前是 ${talkDice}，${ids.length} 位候选各占 ${Math.floor(faces / ids.length)} 面${
                faces % ids.length > 0 ? `（余 ${faces % ids.length} 面）` : ''
              }。`

  return (
    <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: `3px solid ${color}` }}>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
        <span className="hand">槽 {slotN}</span>
        <span className="faint" style={{ marginLeft: 'auto' }}>
          落点 {resolved ? `(${resolved.at[0]}, ${resolved.at[1]})` : '—'}
        </span>
        <button className="btn small danger" onClick={onRemove}>
          删除该槽
        </button>
      </div>

      {ids.map((id, i) => (
        <Field key={`${id}-${i}`} label={`候选 ${i + 1}`}>
          <div className="row" style={{ gap: 4 }}>
            <SelectBox
              value={id}
              options={[
                { value: '', label: '（不指定）' },
                ...library.npcs.map((n) => ({ value: n.id, label: `${n.icon} ${n.name}` })),
              ]}
              onChange={(v) => setIds(ids.map((old, j) => (j === i ? v : old)).filter(Boolean))}
            />
            <button className="btn small" onClick={() => setIds(ids.filter((_, j) => j !== i))}>
              删
            </button>
          </div>
        </Field>
      ))}

      <button
        className="btn small"
        onClick={() => {
          const free = library.npcs.find((n) => !ids.includes(n.id)) ?? library.npcs[0]
          if (free) setIds([...ids, free.id])
        }}
      >
        ＋ 候选
      </button>

      <div className="faint" style={{ marginTop: 4 }}>
        {note}
      </div>

      {resolved?.outOfRange && (
        <div className="hintbox warn">
          K39：这一槽的落点越界了 —— 运行时已落回缺省格 ({resolved.at[0]}, {resolved.at[1]})。在画布上把标记拖回建筑内即可。
        </div>
      )}
      {resolved?.duplicateAt && (
        <div className="hintbox warn">
          K40：这一槽的落点与前面的槽重复 —— 运行时保留先声明的槽、这一槽落回缺省格 ({resolved.at[0]}, {resolved.at[1]})。
        </div>
      )}

      <Field
        label="这一槽的对话方案"
        hint={
          plans.length === 1 && !dangling
            ? '只有一套方案，必定用它。'
            : '留空 ＝ 由骰子抽一套；写死某个方案名 ＝ 不掷骰。'
        }
      >
        <SelectBox
          value={plan ?? ''}
          options={[
            { value: '', label: '（留空：由骰子抽一套）' },
            ...plans.map((p) => ({ value: p, label: p })),
          ]}
          onChange={setPlan}
        />
      </Field>

      {dangling && (
        <div className="hintbox error">
          「{plan}」这个方案不在该槽所抽到的 NPC 的方案里 —— **这一槽**运行时直接跳过对话（同实例其它槽照常）。
          导出时**不会**剔除这个字段。换一个，或者留空由骰子抽。
        </div>
      )}

      {!dangling && !plan && plans.length > 1 && (
        <div className="hintbox">将由骰子抽一套（{talkDice}）；想要固定就写下一个方案名。</div>
      )}

      <Field
        label="一次性对话"
        hint={
          !onceOk
            ? '只在「该槽单一候选 ＋ 写死一套方案（且方案存在、首层非空）」时可套用；多候选 / 留空由骰子抽时请改用「判定模板 ＋ if」自定义（§6.7）。'
            : onceOn
              ? '首次进入走 `if` 分支（带 `give` 就会给一次）；再次进入走同层的无 `if` 记录 ＝ `else`。取消勾选只撤回首层 `if`，模板留给「状态池」面板处理。'
              : '勾选 → 生成一条「mod 一次性」判定模板（条件 ＝ `engine-roll.mod.*` 尚未为 `true`）＋ 写到首层第一条的 `if`。'
        }
      >
        <Toggle
          checked={onceOn}
          disabled={!onceOk}
          onChange={toggleOnce}
          label={onceOn ? '这一槽方案只说一次' : onceOk ? '套用「一次性对话」' : '（当前不可套用）'}
        />
      </Field>
    </div>
  )
}
