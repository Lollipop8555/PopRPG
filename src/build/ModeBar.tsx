/**
 * 模式条（§5.4）—— 画布左上**唯一**入口。
 * 操作说明收进「?」浮层，不在条上平铺一大段文字（G4：提示要克制，别占地方）。
 */

import { useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { CanvasMode } from '../store/ui'
import { MODE_LABEL, MODE_SHORTCUT, useUiStore } from '../store/ui'
import Popover from '../ui/Popover'
import { MarkerIcon } from '../ui/Marker'

const ORDER: CanvasMode[] = ['select', 'place', 'link', 'boxselect', 'erase']

/** 每个模式的一句话说明，只在「?」浮层里出现 */
const HELP: { mode: CanvasMode; what: string; how: string }[] = [
  { mode: 'select', what: '选中与调整', how: '点击选中节点；拖动空白处平移；拖动节点移动；拖动建筑右下角柄改变尺寸' },
  { mode: 'place', what: '铺设地图件', how: '先在左侧组件库选择道路或建筑，再点击或拖动到格子上' },
  { mode: 'link', what: '连续铺设道路', how: '先选择一条道路：第一次点击为起点，第二次为终点，按正交折线自动铺设；双击结束' },
  { mode: 'boxselect', what: '框选多个节点', how: '拖动框选范围内的所有节点，可通过浮动工具栏批量删除' },
  { mode: 'erase', what: '删除节点', how: '点击删除单个节点，按住拖动可连续删除' },
  { mode: 'mark', what: '放置起点 / 终点', how: '在图层面板点「放起点 / 放终点」，或按 S / F；然后在画布上点击。每张地图各一个，已存在时移动位置' },
]

export default function ModeBar() {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const markTarget = useUiStore((s) => s.markTarget)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLButtonElement | null>(null)

  return (
    <div className="modebar">
      {ORDER.map((m) => (
        <button
          key={m}
          className={`mode-btn ${mode === m ? 'active' : ''}`}
          onClick={() => setMode(m)}
          title={`${MODE_LABEL[m]}（${MODE_SHORTCUT[m]}）`}
        >
          {MODE_LABEL[m]}
        </button>
      ))}

      {/*
        起点 / 终点：**不常驻模式条**（一张图各一个、放一次就完事，不值得长期占两个位置）。
        入口放在按需出现的地方：图层面板里缺哪个就给哪个按钮，快捷键 S / F 也随时可用。
        只有已经进入「标记」模式时（按了快捷键），这里才临时显示出来作为状态提示。
      */}
      {mode === 'mark' && (
        <span className="row" style={{ gap: 3 }}>
          <button
            className={`mode-btn ${markTarget === 'start' ? 'active' : ''}`}
            onClick={() => setMode('mark', { markTarget: 'start' })}
            title="放置起点（S）：在画布上点一下"
          >
            <MarkerIcon kind="start" size={16} /> 起点
          </button>
          <button
            className={`mode-btn ${markTarget === 'end' ? 'active' : ''}`}
            onClick={() => setMode('mark', { markTarget: 'end' })}
            title="放置终点（F）：在画布上点一下"
          >
            <MarkerIcon kind="end" size={16} /> 终点
          </button>
        </span>
      )}

      <button
        ref={helpRef}
        className="mode-btn"
        onClick={() => setHelpOpen((v) => !v)}
        title="操作说明"
        style={{ padding: '3px 6px' }}
      >
        <HelpCircle size={13} />
      </button>

      {helpOpen && helpRef.current && (
        <Popover anchor={helpRef.current} onClose={() => setHelpOpen(false)} align="left" width={300}>
          <div className="panel-title hand" style={{ fontSize: 13, padding: '2px 4px' }}>
            操作说明
          </div>
          {HELP.map((row) => (
            <div key={row.mode} style={{ padding: '2px 4px' }}>
              <div style={{ fontSize: 12.5 }}>
                <b>{MODE_LABEL[row.mode]}</b>
                <span className="faint"> · {row.what}</span>
              </div>
              <div className="faint" style={{ lineHeight: 1.5 }}>
                {row.how}
              </div>
            </div>
          ))}
          <div className="faint" style={{ padding: '2px 4px' }}>
            通用：拖动空白处平移；Esc 返回「选择」；一次连续操作记为一步撤销。
          </div>
        </Popover>
      )}
    </div>
  )
}
