/**
 * 「清单」按钮（§5.7 决策 11）：一键跑**全部 K1~Kn 校验**，汇总成一张清单。
 * 它不引入新规则，也不阻止导出 —— 仅用于在导出或试玩前集中查看校验结果。
 */

import { useMemo } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { validateProject, groupIssues } from '../check/validate'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import Overlay from '../ui/Overlay'

export default function Checklist() {
  const open = useUiStore((s) => s.checklistOpen)
  const setOpen = useUiStore((s) => s.setChecklistOpen)
  const library = useLibraryStore()
  const project = useProjectStore()

  const issues = useMemo(() => (open ? validateProject(library, project) : []), [open, library, project])
  const groups = useMemo(() => groupIssues(issues), [issues])
  const errors = issues.filter((i) => i.severity === 'error').length
  const warns = issues.filter((i) => i.severity === 'warn').length

  if (!open) return null

  const jump = (issue: (typeof issues)[number]) => {
    const ui = useUiStore.getState()
    if (issue.componentId) {
      ui.setSelectedKit(issue.componentId)
      ui.setInspectorTab('component')
    }
    if (issue.mapId) ui.setCurrentMap(issue.mapId)
    if (issue.cell) ui.selectNode(`${issue.cell[0]},${issue.cell[1]}`)
    setOpen(false)
  }

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div className="modal">
        <div className="panel-head" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="row" style={{ gap: 6 }}>
            <ClipboardList size={16} />
            <span className="hand">清单</span>
            <span className="badge err">{errors} 红</span>
            <span className="badge warn">{warns} 黄</span>
          </span>
          <button className="btn small" onClick={() => setOpen(false)}>
            <X size={13} />
          </button>
        </div>

        {issues.length === 0 && (
          <div className="hintbox ok">未发现问题：引用完整，起点与终点齐备，事件判定有效。</div>
        )}

        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          {groups.map((group) => (
            <div key={group.key} style={{ marginBottom: 10 }}>
              <div className="panel-title hand" style={{ fontSize: 13 }}>
                {group.key} · {group.label}（{group.issues.length}）
              </div>
              {group.issues.map((issue, i) => (
                <div
                  key={`${group.key}-${i}`}
                  className={`hintbox ${issue.severity === 'error' ? 'error' : 'warn'}`}
                  style={{ marginTop: 4, cursor: issue.componentId || issue.cell ? 'pointer' : 'default' }}
                  onClick={() => jump(issue)}
                  title="点击定位到对应位置"
                >
                  <div style={{ fontWeight: 700 }}>{issue.title}</div>
                  <div>{issue.detail}</div>
                  {(issue.mapName || issue.cell) && (
                    <div className="faint">
                      {issue.mapName ? `${issue.mapName}` : ''}
                      {issue.cell ? ` (${issue.cell[0]}, ${issue.cell[1]})` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="faint" style={{ marginTop: 8 }}>
          红色：会导致运行中断；黄色：提示性风险。均不会阻止导出。
        </div>
      </div>
    </Overlay>
  )
}
