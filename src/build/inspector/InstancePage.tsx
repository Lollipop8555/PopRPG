/**
 * 实例页（右栏，§5.6）—— 选中地图上的**节点**时显示：
 * 坐标 / 类型 / 引用了哪个组件 + [编辑该组件定义] 跳转 + 建筑宽高 + 复制 / 删除。
 * 引用悬空（组件被删了）→ 标红并给快捷修复。
 */

import type { MapNode, NodeType } from '../../types'
import { nodeAt } from '../../lib/map'
import { findComponent } from '../../lib/refs'
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
