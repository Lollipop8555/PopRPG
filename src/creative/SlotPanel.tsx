/**
 * 创意模式左栏：**图片位置树** ＋ 参照的游戏状态 ＋ 未绑定素材暂存区（`skin/09-creative.md` §2.2）。
 *
 * 一条图片位置行只回答两件事：**这里该不该有图**（参照的游戏要求 / 可选）与**现在有没有图**。
 * 绑定动作统一走拖放与右栏的文件选择，行本身不做弹窗。
 */

import { useMemo, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronRight, FileWarning, Link2, Target, Trash2, Upload } from 'lucide-react'
import type { SkinManifestKey } from '../types'
import { useCreativeStore } from '../store/creative'
import { groupSlots, isFilled, readSlot } from './slots'
import { locationOf, ZONE_LABEL } from './location'
import { hitCheck } from './hits'
import { useCreativeSlots } from './useCreative'

/** 行上的状态徽章 */
function StatusBadge({ required, status, filled }: { required: boolean; status?: 'hit' | 'generic' | 'drawn'; filled: boolean }) {
  if (!required) return filled ? <span className="badge on">有图</span> : <span className="badge off">可留空</span>
  if (status === 'hit') return <span className="badge on">已命中</span>
  if (status === 'generic') return <span className="badge warn">走通用</span>
  if (status === 'drawn') return <span className="badge err">程序绘制</span>
  return <span className="badge off">可留空</span>
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
          <div className="panel-title">要准备哪些图</div>
          <span className="faint">
            {filledCount}/{slots.length}
          </span>
        </div>
        <div className="muted" style={{ marginTop: 4, display: 'flex', gap: 4 }}>
          <Target size={12} />
          {target ? (
            <span>
              参照游戏「{targetSource}」：{target.maps.length} 张地图 · {target.slots.length} 个道路朝向 ·{' '}
              {target.keys.items.length} 件道具 · {target.keys.buildings.length} 座建筑
            </span>
          ) : (
            <span>
              还没选游戏包：当前只列出固定不变的位置。选一份游戏包，或用构建页当前工程当靶子，它用到的道具与路面图片位置才会全部列出
            </span>
          )}
        </div>
        <div className="faint" style={{ marginTop: 6 }}>
          行尾徽章：<b>已命中</b>＝这一处有专用素材，游戏按它渲染；<b>走通用</b>＝这一处空着，游戏回退到同类通用素材；
          <b>程序绘制</b>＝游戏要用这一处，当前按程序默认画法渲染；<b>可留空</b>＝这一处可以不给图；<b>图片丢失</b>＝清单里写了这个路径，包内没有这份文件。
        </div>
        {report.drawn.length > 0 && (
          <div className="hintbox warn" style={{ marginTop: 6, display: 'flex', gap: 4 }}>
            <FileWarning size={12} />
            <span>
              还有 {report.drawn.length} 处按程序绘制（游戏要用、当前没有素材），清单见中栏「还缺哪些图」
            </span>
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
          <div className="panel-title">按部位分组</div>
          <span
            className="faint"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
            title="命名约定：<元素>_<变体>.<扩展名>。文件名符合约定的自动绑定到对应图片位置；匹配不上的进入下方「未绑定素材」"
          >
            <Upload size={11} /> 把图片文件拖进本栏：文件名符合命名约定的自动绑定
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
                    const loc = locationOf(slot)
                    return (
                      <div
                        key={slot.path}
                        className={`kit-row npc-item${slot.path === selectedPath ? ' selected' : ''}`}
                        onClick={() => selectSlot(slot.path)}
                        title={`${slot.path} · ${loc.where}`}
                        style={{ marginTop: 3 }}
                      >
                        <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12.5 }}>
                          {slot.label}
                        </span>
                        {loc.zone !== 'none' && (
                          <span className="faint" style={{ flex: '0 0 auto', fontSize: 11 }}>
                            {ZONE_LABEL[loc.zone]}
                          </span>
                        )}
                        {path !== undefined && assets[path] === undefined && <span className="badge err">图片丢失</span>}
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
            <span className="faint">{unbound.length} 张</span>
          </div>
          {unbound.length === 0 ? (
            <div className="faint" style={{ marginTop: 2 }}>
              暂无未绑定素材
            </div>
          ) : (
            <>
              <div className="faint" style={{ marginTop: 2 }}>
                下列素材的文件名未能匹配任何图片位置：先在左栏选中一个图片位置，再点右侧「绑定到选中位置」。
              </div>
              {unbound.map((file, index) => (
                <div key={`${file.name}-${index}`} className="row" style={{ marginTop: 3 }}>
                  <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12 }}>
                    {file.name}
                  </span>
                  <button
                    className="btn small"
                    disabled={selectedSlot === undefined}
                    title={selectedSlot ? `绑定到「${selectedSlot.label}」` : '先在左栏选中一个图片位置'}
                    onClick={() => selectedSlot && bindUnbound(index, selectedSlot)}
                  >
                    <Link2 size={12} /> 绑定到选中位置
                  </button>
                  <button className="btn small" onClick={() => removeUnbound(index)} title="移出未绑定素材">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
