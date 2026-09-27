/**
 * 图层块（左栏 ①，§5.2）—— 图层 = 本项目的**多张地图**。
 * 顶栏不再有地图 Tab，全部挪到这里：切换 / 新建 / 重命名 / 排序 / 删除。
 */

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Layers, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../store/project'
import { commit } from '../store/commit'
import { useUiStore } from '../store/ui'

export default function LayerPanel() {
  const maps = useProjectStore((s) => s.maps)
  const currentMapId = useUiStore((s) => s.currentMapId)
  const setCurrentMap = useUiStore((s) => s.setCurrentMap)
  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const activeId = maps.find((m) => m.id === currentMapId)?.id ?? maps[0]?.id

  return (
    <div className="panel layer-panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <button
          className="row"
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit' }}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <Layers size={14} />
          <span>图层</span>
        </button>
        <span className="faint">
          共 {maps.length} 张 · 当前「{maps.find((m) => m.id === activeId)?.name ?? '—'}」
        </span>
      </div>

      {!collapsed && (
        <>
          <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
            {maps.map((map, index) => {
              const hasStart = map.nodes.some((n) => n.type === 'start')
              const hasEnd = map.nodes.some((n) => n.type === 'end')
              const isActive = map.id === activeId
              return (
                <div
                  key={map.id}
                  onClick={() => setCurrentMap(map.id)}
                  onDoubleClick={() => setEditingId(map.id)}
                  className="row"
                  style={{
                    gap: 4,
                    padding: '3px 4px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    background: isActive ? 'rgba(242,230,200,.6)' : 'transparent',
                    border: isActive ? '1.2px solid var(--line)' : '1.2px solid transparent',
                  }}
                  title="单击切换 · 双击改名"
                >
                  <span className="faint" style={{ minWidth: 16 }}>
                    {index + 1}
                  </span>

                  {editingId === map.id ? (
                    <input
                      className="input"
                      autoFocus
                      defaultValue={map.name}
                      style={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        commit(() => useProjectStore.getState().renameMap(map.id, e.target.value.trim() || map.name))
                        setEditingId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <span className="hand" style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {map.name}
                    </span>
                  )}

                  <span className="faint">{map.nodes.length} 节点</span>

                  {!hasStart && <span title="缺少起点" style={{ color: 'var(--red)' }}>●</span>}
                  {!hasEnd && <span title="缺少终点" style={{ color: 'var(--red)' }}>●</span>}

                  {(!hasStart || !hasEnd) && (
                    <span className="row" style={{ gap: 2 }}>
                      {!hasStart && (
                        <button
                          className="btn small"
                          title="在这张图上放置起点"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentMap(map.id)
                            useUiStore.getState().setMode('mark', { markTarget: 'start' })
                            useUiStore.getState().notify('在画布上点一下，放下起点')
                          }}
                        >
                          放起点
                        </button>
                      )}
                      {!hasEnd && (
                        <button
                          className="btn small"
                          title="在这张图上放置终点"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentMap(map.id)
                            useUiStore.getState().setMode('mark', { markTarget: 'end' })
                            useUiStore.getState().notify('在画布上点一下，放下终点')
                          }}
                        >
                          放终点
                        </button>
                      )}
                    </span>
                  )}

                  <span className="row" style={{ gap: 2 }}>
                    <button
                      className="btn small"
                      title="上移"
                      onClick={(e) => {
                        e.stopPropagation()
                        commit(() => useProjectStore.getState().moveMap(map.id, -1))
                      }}
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      className="btn small"
                      title="下移"
                      onClick={(e) => {
                        e.stopPropagation()
                        commit(() => useProjectStore.getState().moveMap(map.id, 1))
                      }}
                    >
                      <ArrowDown size={11} />
                    </button>
                    <button
                      className="btn small"
                      title={maps.length >= 2 ? '删除这张图' : '至少要留一张图'}
                      disabled={maps.length < 2}
                      onClick={(e) => {
                        e.stopPropagation()
                        commit(() => useProjectStore.getState().removeMap(map.id))
                        const rest = useProjectStore.getState().maps
                        setCurrentMap(rest[0]?.id)
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>

          <button
            className="btn small ghost"
            style={{ marginTop: 6, alignSelf: 'flex-start' }}
            onClick={() => {
              let created: string | undefined
              commit(() => {
                created = useProjectStore.getState().addMap()
              })
              if (created) {
                setCurrentMap(created)
                useUiStore.getState().notify('新地图还没有起点和终点 —— 点模式条上的「起点 / 终点」，再在画布上点一下')
              }
            }}
          >
            <Plus size={12} /> 新建地图
          </button>
        </>
      )}
    </div>
  )
}
