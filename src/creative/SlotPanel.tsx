/**
 * 创意模式左栏：**槽位树** ＋ 靶子状态 ＋ 未绑定素材暂存区（`skin/09-creative.md` §2.2）。
 *
 * 一条槽位行只回答两件事：**这里该不该有图**（靶子要求 / 可选）与**现在有没有图**。
 * 绑定动作统一走拖放与右栏的文件选择，行本身不做弹窗。
 */

import { useMemo, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronRight, FileWarning, Link2, Target, Trash2, Upload } from 'lucide-react'
import type { SkinManifestKey } from '../types'
import { useCreativeStore } from '../store/creative'
import { groupSlots, isFilled, readSlot } from './slots'
import { hitCheck } from './hits'
import { useCreativeSlots } from './useCreative'

/** 行上的状态徽章 */
function StatusBadge({ required, status, filled }: { required: boolean; status?: 'hit' | 'generic' | 'drawn'; filled: boolean }) {
  if (!required) return filled ? <span className="badge on">已填</span> : <span className="badge off">未填</span>
  if (status === 'hit') return <span className="badge on">已命中</span>
  if (status === 'generic') return <span className="badge warn">走通用</span>
  if (status === 'drawn') return <span className="badge err">缺图</span>
  return <span className="badge off">未填</span>
}

export default function SlotPanel() {
  const slots = useCreativeSlots()
  const manifest = useCreativeStore((s) => s.manifest)
  const assets = useCreativeStore((s) => s.assets)
  const target = useCreativeStore((s) => s.target)
  const targetSource = useCreativeStore((s) => s.targetSource)
  const unbound = useCreativeStore((s) => s.unbound)
  const selectedPath = useCreativeStore((s) => s.selectedPath)
  const selectSlot = useCreativeStore((s) => s.selectSlot)
  const dropFiles = useCreativeStore((s) => s.dropFiles)
  const bindUnbound = useCreativeStore((s) => s.bindUnbound)
  const removeUnbound = useCreativeStore((s) => s.removeUnbound)

  const dragging = useRef(0)
  const [hot, setHot] = useState(false)

  const report = useMemo(() => hitCheck(manifest, slots), [manifest, slots])
  const statusOf = useMemo(() => {
    const map = new Map<string, 'hit' | 'generic' | 'drawn'>()
    for (const item of report.hits) map.set(item.slot.path, 'hit')
    for (const item of report.generic) map.set(item.slot.path, 'generic')
    for (const item of report.drawn) map.set(item.slot.path, 'drawn')
    return map
  }, [report])

  const groups = useMemo(() => groupSlots(slots), [slots])
  const [open, setOpen] = useState<Set<SkinManifestKey>>(() => new Set<SkinManifestKey>(['road', 'role']))

  const toggle = (section: SkinManifestKey) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })

  const onDrop = async (event: DragEvent) => {
    event.preventDefault()
    dragging.current = 0
    setHot(false)
    const files = [...event.dataTransfer.files]
    if (files.length === 0) return
    const loaded = await Promise.all(
      files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })),
    )
    dropFiles(loaded)
  }

  const selectedSlot = slots.find((slot) => slot.path === selectedPath)
  const filledCount = slots.filter((slot) => isFilled(readSlot(manifest, slot.path))).length

  return (
    <>
      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="panel-title">槽位</div>
          <span className="faint">
            {filledCount}/{slots.length}
          </span>
        </div>
        <div className="muted" style={{ marginTop: 4, display: 'flex', gap: 4 }}>
          <Target size={12} />
          {target ? (
            <span>
              靶子 {targetSource}：{target.maps.length} 张地图 · {target.slots.length} 个道路姿态 ·{' '}
              {target.keys.items.length} 件道具 · {target.keys.buildings.length} 座建筑
            </span>
          ) : (
            <span>尚未载入靶子：只列固定槽位，组件与道路槽位要载入 `.pmod` 后才齐</span>
          )}
        </div>
        {report.drawn.length > 0 && (
          <div className="hintbox warn" style={{ marginTop: 6, display: 'flex', gap: 4 }}>
            <FileWarning size={12} />
            <span>还有 {report.drawn.length} 个槽位会落到程序绘制（见中栏「命中检查」）</span>
          </div>
        )}
      </div>

      <div
        className="panel kit-panel"
        onDragEnter={(e) => {
          e.preventDefault()
          dragging.current += 1
          setHot(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragging.current -= 1
          if (dragging.current <= 0) setHot(false)
        }}
        onDrop={(e) => void onDrop(e)}
        style={hot ? { outline: '2px dashed var(--accent, var(--line))', outlineOffset: -4 } : undefined}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="panel-title">槽位清单</div>
          <span className="faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Upload size={11} /> 拖图片进来即自动归属
          </span>
        </div>

        <div className="scroll" style={{ flex: '1 1 auto', minHeight: 0, marginTop: 6 }}>
          {groups.map((group) => {
            const expanded = open.has(group.section)
            const groupFilled = group.slots.filter((slot) => isFilled(readSlot(manifest, slot.path))).length
            return (
              <div key={group.section} style={{ marginBottom: 6 }}>
                <button
                  className="row"
                  onClick={() => toggle(group.section)}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer' }}
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{group.label}</span>
                  <span className="faint">
                    {groupFilled}/{group.slots.length}
                  </span>
                </button>

                {expanded &&
                  group.slots.map((slot) => {
                    const value = readSlot(manifest, slot.path)
                    const filled = isFilled(value)
                    const path = typeof value === 'string' ? value : undefined
                    return (
                      <div
                        key={slot.path}
                        className={`kit-row npc-item${slot.path === selectedPath ? ' selected' : ''}`}
                        onClick={() => selectSlot(slot.path)}
                        title={slot.path}
                        style={{ marginTop: 3 }}
                      >
                        <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12.5 }}>
                          {slot.label}
                        </span>
                        {path !== undefined && assets[path] === undefined && <span className="badge err">缺字节</span>}
                        <StatusBadge required={statusOf.has(slot.path)} status={statusOf.get(slot.path)} filled={filled} />
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>

        <div style={{ flex: '0 0 auto', marginTop: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="panel-title" style={{ fontSize: 13 }}>
              未绑定素材
            </div>
            <span className="faint">{unbound.length} 份</span>
          </div>
          {unbound.length === 0 ? (
            <div className="faint" style={{ marginTop: 2 }}>
              没有落单的素材
            </div>
          ) : (
            unbound.map((file, index) => (
              <div key={`${file.name}-${index}`} className="row" style={{ marginTop: 3 }}>
                <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12 }}>
                  {file.name}
                </span>
                <button
                  className="btn small"
                  disabled={selectedSlot === undefined}
                  title={selectedSlot ? `绑到 ${selectedSlot.path}` : '先在左栏选中一个槽位'}
                  onClick={() => selectedSlot && bindUnbound(index, selectedSlot)}
                >
                  <Link2 size={12} /> 绑到选中
                </button>
                <button className="btn small" onClick={() => removeUnbound(index)} title="丢掉这份素材">
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
