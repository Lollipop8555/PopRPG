/**
 * 右栏属性编辑（§5.6）—— 三个页签：**组件 / 实例 / 规则**。
 * 面板不自带 margin，滚动只在内层（§5.1）。
 */

import type { InspectorTab } from '../store/ui'
import { useUiStore } from '../store/ui'
import ComponentPage from './inspector/ComponentPage'
import InstancePage from './inspector/InstancePage'

const TABS: { id: InspectorTab; label: string; title: string }[] = [
  { id: 'component', label: '组件', title: '在左栏选中的那一条（改的是库里的定义）' },
  { id: 'instance', label: '实例', title: '地图上被点中的那一格（改的是这一格）' },
]

export default function Inspector() {
  const tab = useUiStore((s) => s.inspectorTab)
  const setTab = useUiStore((s) => s.setInspectorTab)

  return (
    <div className="panel inspector">
      <div className="panel-head" style={{ justifyContent: 'flex-start', gap: 4, marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn small ${tab === t.id ? 'primary' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.title}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {tab === 'component' && <ComponentPage />}
        {tab === 'instance' && <InstancePage />}
      </div>
    </div>
  )
}
