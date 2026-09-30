/**
 * 创意模式外壳（`skin/09-creative.md` §2.1）：与构建页同一套栅格 ——
 * 顶栏 / 左栏（图片位置）/ 中栏（预览 · 还缺哪些图 · 路面填图板）/ 右栏（这一处怎么填），底下一行提示条。
 *
 * 编辑器自身的界面**不被任何 `.pp` 覆盖**：这里只用程序默认画法的基础样式与 lucide 图标，
 * 素材只出现在预览与图片位置缩略图里（§2.4）。
 */

import { useEffect, useState } from 'react'
import { PanelLeft, PanelRight, X } from 'lucide-react'
import CreativeTopBar from './CreativeTopBar'
import SlotPanel from './SlotPanel'
import CreativeInspector from './CreativeInspector'
import CreativePreview from './CreativePreview'
import HitCheckPanel from './HitCheckPanel'
import RoadBoard from './RoadBoard'
import Overlay from '../ui/Overlay'
import { useCreativeStore } from '../store/creative'
import { useCreativeSlots } from './useCreative'

/** 中栏三页 */
type CenterTab = 'preview' | 'hits' | 'road'

const TAB_LABEL: Record<CenterTab, string> = {
  preview: '预览',
  hits: '还缺哪些图',
  road: '路面填图板',
}

/** 每个中栏页做什么：中栏顶部常驻一句，避免只给一个页签名 */
const TAB_HINT: Record<CenterTab, string> = {
  preview: '按参照的游戏实跑一局：左栏换一张图，这里即可看到它在地图上的渲染结果',
  hits: '逐条核对：参照的游戏用到的贴图，哪些已经给了、哪些还没给（未给的按程序默认画法渲染）',
  road: '一整幅路网中，每一格该填哪张图；虚线标出这一格与周围哪些格相连',
}

export default function CreativeApp() {
  const [drawer, setDrawer] = useState<'none' | 'left' | 'right'>('none')
  const [tab, setTab] = useState<CenterTab>('preview')
  const slots = useCreativeSlots()

  // 刷新后把素材字节从 IndexedDB 回读、按存下来的 `.pmod` 文本重建参照的游戏（幂等）。
  // 自己没有存过靶子时，用构建页当前工程兜底（`skin/09-creative.md` §五 待确认 1）
  useEffect(() => {
    void useCreativeStore
      .getState()
      .hydrate()
      .then(() => {
        const store = useCreativeStore.getState()
        if (store.target === undefined) store.loadTargetFromProject()
      })
  }, [])

  // 还没有选中项时自动选中第一个图片位置：右栏与位置示意一进页面就有内容
  useEffect(() => {
    const store = useCreativeStore.getState()
    if (store.selectedPath === '' && slots.length > 0) store.selectSlot(slots[0].path)
  }, [slots])

  return (
    <div className="app-shell">
      <CreativeTopBar />

      <div className="workspace">
        <div className={`column left ${drawer === 'left' ? 'open' : ''}`}>
          <SlotPanel />
        </div>

        <div className="center">
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div className="panel" style={{ flex: '0 0 auto' }}>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {(Object.keys(TAB_LABEL) as CenterTab[]).map((key) => (
                  <button
                    key={key}
                    className={`btn small${tab === key ? ' primary' : ''}`}
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                  >
                    {TAB_LABEL[key]}
                  </button>
                ))}
              </div>
              <div className="faint" style={{ marginTop: 6, fontSize: 11.5 }}>
                {TAB_HINT[tab]}
              </div>
            </div>

            {tab === 'preview' ? (
              <CreativePreview />
            ) : (
              <div className="panel scroll" style={{ flex: '1 1 auto', minHeight: 0 }}>
                {tab === 'hits' ? <HitCheckPanel /> : <RoadBoard />}
              </div>
            )}

            <NoteBar />
          </div>

          <div className="row" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('left')} title="左栏：要准备哪些图">
              <PanelLeft size={13} />
            </button>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('right')} title="这一处怎么填">
              <PanelRight size={13} />
            </button>
          </div>
        </div>

        <div className={`column right ${drawer === 'right' ? 'open' : ''}`}>
          <CreativeInspector />
        </div>
      </div>

      {drawer !== 'none' && <Overlay zIndex={25} onClose={() => setDrawer('none')} />}
    </div>
  )
}

/** 底部提示条：最近若干条操作结果（绑定 / 导入 / 导出 / 校验提示） */
function NoteBar() {
  const notes = useCreativeStore((s) => s.notes)
  const clearNotes = useCreativeStore((s) => s.clearNotes)
  const latest = notes[notes.length - 1]

  return (
    <div className="panel" style={{ flex: '0 0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12 }} title={latest}>
          {latest ?? '左栏选一个图片位置并拖入图片 → 中栏「预览」看效果 → 「还缺哪些图」看还缺哪些 → 顶栏导出 .pp'}
        </span>
        {notes.length > 0 && (
          <button className="btn small" onClick={clearNotes} title="清空提示">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
