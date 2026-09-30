/**
 * 创意模式外壳（`skin/09-creative.md` §2.1）：与构建页同一套栅格 ——
 * 顶栏 / 左栏（槽位）/ 中栏（预览 · 命中检查 · 道路矩阵）/ 右栏（检视器），底下一行提示条。
 *
 * 编辑器自身的界面**不被任何 `.pp` 覆盖**：这里只用程序绘制的基础样式与 lucide 图标，
 * 素材只出现在预览与槽位缩略图里（§2.4）。
 */

import { useEffect, useState } from 'react'
import { PanelLeft, PanelRight, X } from 'lucide-react'
import CreativeTopBar from './CreativeTopBar'
import SlotPanel from './SlotPanel'
import CreativeInspector from './CreativeInspector'
import CreativePreview from './CreativePreview'
import HitCheckPanel from './HitCheckPanel'
import RoadMatrixPanel from './RoadMatrixPanel'
import Overlay from '../ui/Overlay'
import { useCreativeStore } from '../store/creative'

/** 中栏三页 */
type CenterTab = 'preview' | 'hits' | 'road'

const TAB_LABEL: Record<CenterTab, string> = {
  preview: '预览',
  hits: '命中检查',
  road: '道路矩阵',
}

export default function CreativeApp() {
  const [drawer, setDrawer] = useState<'none' | 'left' | 'right'>('none')
  const [tab, setTab] = useState<CenterTab>('preview')

  // 刷新后把素材字节从 IndexedDB 回捞、按存下来的 `.pmod` 文本重建靶子（幂等）
  useEffect(() => {
    void useCreativeStore.getState().hydrate()
  }, [])

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
            </div>

            {tab === 'preview' ? (
              <CreativePreview />
            ) : (
              <div className="panel scroll" style={{ flex: '1 1 auto', minHeight: 0 }}>
                {tab === 'hits' ? <HitCheckPanel /> : <RoadMatrixPanel />}
              </div>
            )}

            <NoteBar />
          </div>

          <div className="row" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('left')} title="槽位">
              <PanelLeft size={13} />
            </button>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('right')} title="检视器">
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
          {latest ?? '提示：拖图片进左栏即自动归属；载入靶子后中栏给出缺图清单'}
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
