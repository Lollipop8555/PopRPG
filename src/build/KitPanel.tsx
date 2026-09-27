/**
 * 组件库面板（左栏 ②，§5.3）—— **只有一个面板、一份列表**，预设与自建同列同权。
 *
 * 每行的徽章把两件事一次说清：左半是**库的身份**（预设 / 自建，由 id 派生），
 * 右半是**这一局的状态**（启用 / 铺设 / 被引用）。
 */

import { useMemo } from 'react'
import { Plus, Search } from 'lucide-react'
import type { AnyComponent, ComponentKind } from '../types'
import { isMapPiece } from '../types'
import { SECTIONS, componentsOfSection, type SectionDef } from '../lib/sections'
import { tallyUsage } from '../lib/refs'
import { isPresetId } from '../presets'
import { blankComponent, duplicateOf } from '../lib/blank'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { commit } from '../store/commit'
import { useUiStore } from '../store/ui'
import { Badge, TextBox } from '../ui/primitives'
import { fallbackColor, withAlpha } from '../lib/color'
import RowMenu from '../ui/RowMenu'

export default function KitPanel() {
  const library = useLibraryStore()
  const project = useProjectStore()
  const ui = useUiStore()
  const { setSelectedKit, setInspectorTab, kitFilter, setKitFilter, kitSearch, setKitSearch, toggleSection, collapsedSections, setMode } =
    ui

  const enabledIds = project.enabledIds

  const referenced = useMemo(() => tallyUsage(library, enabledIds).referenced, [library, enabledIds])

  const placed = useMemo(() => {
    const counts = new Map<string, number>()
    for (const map of project.maps) {
      for (const node of map.nodes) {
        if (!node.ref) continue
        counts.set(node.ref, (counts.get(node.ref) ?? 0) + 1)
      }
    }
    return counts
  }, [project.maps])

  const isUsed = (id: string) => enabledIds.includes(id) || (placed.get(id) ?? 0) > 0 || (referenced.get(id) ?? 0) > 0

  const openComponent = (kind: ComponentKind, id: string) => {
    setSelectedKit(id)
    setInspectorTab('component')
    if (isMapPiece(kind)) setMode('place')
  }

  const createIn = (section: SectionDef) => {
    const def = blankComponent(section.kind, section.filterItemKind)
    commit(() => useLibraryStore.getState().upsert(section.kind, def))
    setSelectedKit(def.id)
    setInspectorTab('component')
  }

  return (
    <div className="panel kit-panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>组件库</span>
        <span className="row" style={{ gap: 4 }}>
          <button
            className={`btn small ${kitFilter === 'all' ? 'primary' : ''}`}
            onClick={() => setKitFilter('all')}
          >
            全部
          </button>
          <button
            className={`btn small ${kitFilter === 'used' ? 'primary' : ''}`}
            onClick={() => setKitFilter('used')}
            title="本局已启用、已铺设或被引用"
          >
            本局已用
          </button>
        </span>
      </div>

      <div className="row" style={{ margin: '6px 0', gap: 4 }}>
        <Search size={13} color="var(--ink-faint)" />
        <TextBox value={kitSearch} onChange={setKitSearch} placeholder="搜索名称或标签" />
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {SECTIONS.map((section) => {
          const all = componentsOfSection(library, section)
          const keyword = kitSearch.trim().toLowerCase()
          const visible = all.filter((def) => {
            if (kitFilter === 'used' && !isUsed(def.id)) return false
            if (!keyword) return true
            const haystack = [def.name, def.id, ...(def.tags ?? [])].join(' ').toLowerCase()
            return haystack.includes(keyword)
          })
          const collapsed = collapsedSections[section.id] === true

          return (
            <div key={section.id} style={{ marginBottom: 8 }}>
              <div className="panel-head" style={{ justifyContent: 'space-between' }}>
                <button
                  className="row"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit' }}
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{collapsed ? '▸' : '▾'}</span>
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                  <span className="badge">{all.length}</span>
                </button>
                <button className="btn small ghost" onClick={() => createIn(section)} title="新建一条库组件">
                  <Plus size={11} /> 新建
                </button>
              </div>

              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visible.length === 0 && <div className="faint" style={{ padding: '3px 4px' }}>（空）</div>}
                  {visible.map((def) => (
                    <KitRow
                      key={def.id}
                      section={section}
                      def={def}
                      selected={ui.selectedKitId === def.id}
                      enabled={enabledIds.includes(def.id)}
                      placedCount={placed.get(def.id) ?? 0}
                      referencedCount={referenced.get(def.id) ?? 0}
                      onSelect={() => openComponent(section.kind, def.id)}
                      onToggleEnabled={() => commit(() => useProjectStore.getState().toggleEnabled(def.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KitRow({
  section,
  def,
  selected,
  enabled,
  placedCount,
  referencedCount,
  onSelect,
  onToggleEnabled,
}: {
  section: SectionDef
  def: AnyComponent
  selected: boolean
  enabled: boolean
  placedCount: number
  referencedCount: number
  onSelect: () => void
  onToggleEnabled: () => void
}) {
  const kind = section.kind
  const rowColor = def.color ?? fallbackColor(def.id)
  const mapPiece = isMapPiece(kind)

  const duplicate = () => {
    const copy = duplicateOf(kind, def)
    commit(() => useLibraryStore.getState().upsert(kind, copy))
    useUiStore.getState().setSelectedKit(copy.id)
    useUiStore.getState().setInspectorTab('component')
  }

  // 编辑 / 复制 / 启用已提为第三行独立按钮；菜单只保留删除与恢复默认
  const menu: { label: string; onClick: () => void; tone?: 'danger'; disabled?: boolean; title?: string }[] = [
    {
      label: '删除',
      tone: 'danger' as const,
      onClick: () => {
        const uses = placedCount + (enabled ? 1 : 0) + referencedCount
        const ok = uses > 0
          ? window.confirm(`「${def.name}」被 ${uses} 处用到（铺设 ${placedCount} · 被引用 ${referencedCount}）。确认删除？留下的引用会变成悬空。`)
          : window.confirm(`确认删除「${def.name}」？`)
        if (!ok) return
        commit(() => useLibraryStore.getState().remove(kind, def.id))
      },
    },
    {
      label: '恢复默认',
      disabled: !isPresetId(def.id),
      title: '拿 id 去内置预设表取原始定义覆盖回来（仅预设条目）',
      onClick: () => commit(() => useLibraryStore.getState().resetToPreset(def.id)),
    },
  ]

  return (
    <div
      onClick={onSelect}
      className={'kit-row' + (selected ? ' selected' : '')}
      style={{
        gap: 0,
        padding: '4px 6px',
        cursor: 'pointer',
        opacity: mapPiece || enabled ? 1 : 0.62,
      }}
      title={mapPiece ? '地图件：铺到地图格才算内容' : '非地图件：显式启用才算内容'}
    >
      {/* 第一行：图标 + 名称 */}
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <span
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flex: '0 0 auto' }}
        >
          {rowColor && (
            <span
              style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `1.5px solid ${rowColor}`, background: withAlpha(rowColor, 0.3) }}
            />
          )}
          <span style={{ position: 'relative', fontSize: 14 }}>{def.icon}</span>
        </span>
        <span className="hand" style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {def.name}
        </span>
      </div>

      {/* 第二行：状态 */}
      <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        {isPresetId(def.id) ? (
          <Badge tone="preset" title="id 命中内置预设表">预设</Badge>
        ) : (
          <Badge tone="custom" title="用户自建">自建</Badge>
        )}
        {mapPiece ? (
          placedCount > 0 ? (
            <Badge tone="on" title="已铺到地图上">已铺设 ×{placedCount}</Badge>
          ) : (
            <Badge tone="off" title="还没铺到格子上">未铺设</Badge>
          )
        ) : null}
        {referencedCount > 0 && <Badge title="被几处引用">被引用 ×{referencedCount}</Badge>}
      </div>

      {/* 第三行：操作 */}
      <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        {!mapPiece && (
          <button
            className="btn small"
            style={{ fontSize: 11, padding: '2px 7px' }}
            onClick={(e) => { e.stopPropagation(); onToggleEnabled() }}
            title="本局是否启用（算不算内容）"
          >
            {enabled ? '已启用' : '未启用'}
          </button>
        )}
        <button className="btn small" style={{ fontSize: 11, padding: '2px 7px' }} onClick={(e) => { e.stopPropagation(); onSelect() }} title="编辑定义">编辑</button>
        <button className="btn small" style={{ fontSize: 11, padding: '2px 7px' }} onClick={(e) => { e.stopPropagation(); duplicate() }} title="复制成新组件">复制</button>
        <RowMenu items={menu} />
      </div>
    </div>
  )
}
