/**
 * 规则面板（顶栏「规则」按钮打开）—— 整局共用的一套算法，不进右栏（右栏只管组件 / 实例）。
 * 内容就是 §4.8.6 那 13 项；每个字段一句说明 + 「模拟 10 次」。
 */

import { SlidersHorizontal, X } from 'lucide-react'
import { useUiStore } from '../store/ui'
import Overlay from '../ui/Overlay'
import RulesPage from './inspector/RulesPage'

export default function RulesScreen() {
  const open = useUiStore((s) => s.rulesOpen)
  const setOpen = useUiStore((s) => s.setRulesOpen)
  if (!open) return null

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div className="modal wide">
        <div className="panel-head" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="row" style={{ gap: 6 }}>
            <SlidersHorizontal size={16} />
            <span className="hand" style={{ fontSize: 16 }}>
              这一局的规则
            </span>
            <span className="badge">13 项</span>
          </span>
          <button className="btn small" onClick={() => setOpen(false)}>
            <X size={13} /> 关掉
          </button>
        </div>

        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <RulesPage />
        </div>
      </div>
    </Overlay>
  )
}
