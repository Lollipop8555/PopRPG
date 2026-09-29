/**
 * 实例页（右栏，§5.6）—— 选中地图上的**节点**时显示：
 * 坐标 / 类型 / 引用了哪个组件 + [编辑该组件定义] 跳转 + 建筑宽高 + 复制 / 删除。
 * 引用悬空（组件被删了）→ 标红并给快捷修复。
 */

import type { MapNode, NodeType, NpcDef } from '../../types'
import { nodeAt } from '../../lib/map'
import { findComponent } from '../../lib/refs'
import { diceFaces } from '../../lib/dialog'
import { useLibraryStore } from '../../store/library'
import { useProjectStore } from '../../store/project'
import { commit } from '../../store/commit'
import { useUiStore } from '../../store/ui'
import { Badge, Field, NumberBox, SelectBox } from '../../ui/primitives'

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

      {node.type === 'building' && <NpcBlock node={node} patch={patch} />}

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
 * 建筑实例专有 · NPC / 对话（§5.6 实例页 / §4.9.3）——
 * **任何建筑都能挂**（`npcs` 与 `encounter` 正交）；对话在「进入建筑后、建筑事件前」执行。
 */
function NpcBlock({ node, patch }: { node: MapNode; patch: (part: Partial<MapNode>) => void }) {
  const library = useLibraryStore()
  const talkDice = useProjectStore((s) => s.rules.talk.dice)
  const def = node.ref ? library.buildings.find((b) => b.id === node.ref) : undefined
  const ids = node.npcs ?? []
  const alive = ids
    .map((id) => library.npcs.find((n) => n.id === id))
    .filter((n): n is NpcDef => Boolean(n))

  /** `dialog` 下拉的候选 ＝ 所选 NPC 的**全部方案**（去重，保持书写顺序） */
  const plans = [...new Set(alive.flatMap((n) => Object.keys(n.dialogs ?? {})))]
  const dangling = !!node.dialog && !plans.includes(node.dialog)
  const faces = diceFaces(talkDice)

  const setIds = (next: string[]) => patch({ npcs: next.length > 0 ? next : undefined })

  const note =
    ids.length === 0
      ? '这个建筑不触发对话（只跑自己的建筑事件）。'
      : ids.length === 1
        ? '玩家踩到一定遇到他。'
        : faces === null
          ? `掷 ${talkDice} 等权抽一位（对话骰写法看不懂，请在规则面板改成如 1D6）。`
          : faces < ids.length
            ? `掷 ${talkDice} 等权抽一位 —— 骰子只有 ${faces} 个点数却有 ${ids.length} 位候选，会有候选抽不到；建议换更大的对话骰。`
            : `掷 ${talkDice} 等权抽一位 —— 现在是 ${talkDice}，${ids.length} 位 → 各占 ${Math.floor(faces / ids.length)} 面${
                faces % ids.length > 0 ? `（余 ${faces % ids.length} 面）` : ''
              }。`

  return (
    <div style={{ marginTop: 8 }}>
      <div className="panel-title hand" style={{ fontSize: 13 }}>
        NPC / 对话
      </div>

      {ids.map((id, i) => (
        <Field key={`${id}-${i}`} label={`第 ${i + 1} 位`}>
          <div className="row" style={{ gap: 4 }}>
            <SelectBox
              value={id}
              options={[
                { value: '', label: '（不指定）' },
                ...library.npcs.map((n) => ({ value: n.id, label: `${n.icon} ${n.name}` })),
              ]}
              onChange={(v) => setIds(ids.map((old, j) => (j === i ? v : old)).filter(Boolean))}
            />
            <button className="btn small danger" onClick={() => setIds(ids.filter((_, j) => j !== i))}>
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
        ＋ 加一位 NPC
      </button>

      <div className="faint" style={{ marginTop: 4 }}>
        {note}
      </div>

      {ids.length === 0 && def?.encounter === 'talk' && (
        <div className="hintbox warn">
          这个建筑<b>没有对话</b> —— 要么加 NPC，要么把行为改回 `empty`（§4.9.3）。
        </div>
      )}

      <Field
        label="这一套对话方案"
        hint={
          plans.length === 1 && !dangling
            ? '只有一套方案，必定用它。'
            : '留空 ＝ 由骰子选一套；写死某个方案名 ＝ 不掷骰。'
        }
      >
        <SelectBox
          value={node.dialog ?? ''}
          options={[
            { value: '', label: '（留空：由骰子抽一套）' },
            ...plans.map((p) => ({ value: p, label: p })),
          ]}
          onChange={(v) => patch({ dialog: v || undefined })}
        />
      </Field>

      {dangling && (
        <div className="hintbox error">
          「{node.dialog}」这个方案不存在 —— 换一个，或者留空由骰子抽。导出时**不会**剔除这个字段，运行时直接跳过对话、当这个实例没有 NPC。
        </div>
      )}

      {!dangling && !node.dialog && plans.length > 1 && (
        <div className="hintbox">将由骰子抽一套（{talkDice}）；想要固定就写下一个方案名。</div>
      )}

      <div className="faint">
        先抽人、再抽方案，两次各掷一次骰子；<b>进入建筑时</b>抽定，整场不变。
      </div>
      <div className="faint">
        只在<b>从建筑外踏入</b>时触发一次；在建筑内部走动不再触发。首次进入一定进对话（不弹框）；已触发过的实例再入会先弹选择对话框 —— 未走完给【继续对话】【重新对话】，走完过再加【路过】。
      </div>
    </div>
  )
}
