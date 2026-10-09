/**
 * 构建页外壳（§5.1）：单一栅格 —— 顶栏 / 左栏（图层 + 组件库）/ 中栏（画布 + 模式条）/ 右栏（属性）。
 * ≤880px 时左右栏变抽屉，模式条挪到底部横排（拇指可达）。
 */

import { useEffect, useState } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'
import TopBar from './TopBar'
import LayerPanel from './LayerPanel'
import KitPanel from './KitPanel'
import Canvas from './Canvas'
import ModeBar from './ModeBar'
import Inspector from './Inspector'
import Checklist from './Checklist'
import RulesScreen from './RulesScreen'
import NpcModScreen from './NpcModScreen'
import PoolScreen from './PoolScreen'
import Overlay from '../ui/Overlay'
import { useShortcuts } from './useShortcuts'
import { useUiStore } from '../store/ui'

export default function BuildApp() {
  const [drawer, setDrawer] = useState<'none' | 'left' | 'right'>('none')
  useShortcuts()

  return (
    <div className="app-shell">
      <TopBar />

      <div className="workspace">
        <div className={`column left ${drawer === 'left' ? 'open' : ''}`}>
          <LayerPanel />
          <KitPanel />
        </div>

        <div className="center">
          <Canvas />
          <ModeBar />
          <div className="row" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('left')} title="组件库">
              <PanelLeft size={13} />
            </button>
            <button className="btn small drawer-toggle" onClick={() => setDrawer('right')} title="属性">
              <PanelRight size={13} />
            </button>
          </div>
        </div>

        <div className={`column right ${drawer === 'right' ? 'open' : ''}`}>
          <Inspector />
        </div>
      </div>

      {drawer !== 'none' && <Overlay zIndex={25} onClose={() => setDrawer('none')} />}

      <Checklist />
      <RulesScreen />
      <NpcModScreen />
      <PoolScreen />
      <ToastView />
    </div>
  )
}

function ToastView() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(dismiss, 4200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  if (!toast) return null
  return (
    <div className={`toast ${toast.tone === 'info' ? '' : toast.tone}`} onClick={dismiss} title="点击关闭">
      {toast.text}
    </div>
  )
}
