/**
 * 「NPC 模组」面板（§5.6 / §5.6.1）—— 与「规则」并列的**第二个整页入口**。
 *
 * 分工别搞混：
 * - **组件库 / 组件页** —— NPC 的基础字段 + `dialogs` 的**只读摘要**（不在这里改树）
 * - **这里** —— 对话树本身：方案（`dialogs` 的键）＋ 树（卡片 / 连线 / 骰子 / 给道具）
 * - **地图实例页** —— 谁挂这个 NPC（NPC 没有位置字段，只能被建筑实例引用）
 *
 * 方案名**不写权重**：多套方案等权，由实例的骰子（规则面板 `talk.dice`）抽一套。
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, MessageSquareText, Plus, Users, X } from 'lucide-react'
import type { DialogNode, NpcDef } from '../types'
import { commit } from '../store/commit'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { npcReferenceCounts } from '../lib/refs'
import { summarizeNpc } from '../lib/dialog'
import Overlay from '../ui/Overlay'
import { Badge } from '../ui/primitives'
import DialogCanvas from './npc/DialogCanvas'

/** `Mod1`、`Mod2`… 取第一个没被占用的编号 */
function nextPlanName(existing: string[]): string {
  for (let i = 1; i < 999; i++) if (!existing.includes(`Mod${i}`)) return `Mod${i}`
  return `Mod${existing.length + 1}`
}

/** 改 `dialogs` 的键名但**保住书写顺序**（导出才稳定可比对） */
function renamePlan(dialogs: Record<string, DialogNode[]>, from: string, to: string): Record<string, DialogNode[]> {
  const out: Record<string, DialogNode[]> = {}
  for (const [key, value] of Object.entries(dialogs)) out[key === from ? to : key] = value
  return out
}

export default function NpcModScreen() {
  const open = useUiStore((s) => s.npcModOpen)
  const target = useUiStore((s) => s.npcModTargetId)
  const setOpen = useUiStore((s) => s.setNpcModOpen)

  const npcs = useLibraryStore((s) => s.npcs)
  const items = useLibraryStore((s) => s.items)
  const project = useProjectStore()

  const [selectedId, setSelectedId] = useState<string>()
  const [planByNpc, setPlanByNpc] = useState<Record<string, string>>({})
  /** 每个「NPC::方案」的「未连接」枝（只活在本次会话里，不进 `.pmod`） */
  const [parkedByPlan, setParkedByPlan] = useState<Record<string, DialogNode[]>>({})

  const counts = useMemo(() => npcReferenceCounts(project), [project])

  /**
   * 左侧只列**本局被引用的** NPC（§5.6.1）—— 另外总把「从组件页点进来的那一条」加进来，
   * 免得「还没挂到建筑上」的 NPC 连对话都写不了。
   */
  const listed = useMemo(() => {
    const out = npcs.filter((n) => (counts.get(n.id) ?? 0) > 0)
    if (target && !out.some((n) => n.id === target)) {
      const extra = npcs.find((n) => n.id === target)
      if (extra) out.push(extra)
    }
    return out
  }, [npcs, counts, target])

  useEffect(() => {
    if (!open) return
    setSelectedId((cur) => {
      if (cur && listed.some((n) => n.id === cur)) return cur
      if (target && listed.some((n) => n.id === target)) return target
      return listed[0]?.id
    })
  }, [open, target, listed])

  const npc = listed.find((n) => n.id === selectedId)
  const plans = npc ? Object.keys(npc.dialogs ?? {}) : []
  const plan = npc ? planByNpc[npc.id] && plans.includes(planByNpc[npc.id]) ? planByNpc[npc.id] : plans[0] : undefined
  const parkKey = npc && plan ? `${npc.id}::${plan}` : ''
  const parked = parkKey ? parkedByPlan[parkKey] ?? [] : []

  const enabledItemIds = useMemo(
    () => items.filter((i) => project.enabledIds.includes(i.id)).map((i) => i.id),
    [items, project.enabledIds],
  )
  const itemLabel = (id: string) => items.find((i) => i.id === id)?.name ?? id

  if (!open) return null

  const writeNpc = (mutate: (current: NpcDef) => NpcDef) => {
    if (!npc) return
    commit(() => useLibraryStore.getState().upsert('npc', mutate(npc)))
  }

  const setTrees = (main: DialogNode[], park: DialogNode[]) => {
    if (!npc || !plan) return
    setParkedByPlan((prev) => ({ ...prev, [parkKey]: park }))
    writeNpc((current) => ({ ...current, dialogs: { ...current.dialogs, [plan]: main } }))
  }

  const addPlan = () => {
    if (!npc) return
    const name = nextPlanName(Object.keys(npc.dialogs ?? {}))
    writeNpc((current) => ({ ...current, dialogs: { ...current.dialogs, [name]: [] } }))
    setPlanByNpc((prev) => ({ ...prev, [npc.id]: name }))
  }

  const doRename = () => {
    if (!npc || !plan) return
    const name = window.prompt('新的方案名', plan)?.trim()
    if (!name || name === plan) return
    if (plans.includes(name)) {
      window.alert(`已经有叫「${name}」的方案了`)
      return
    }
    writeNpc((current) => ({ ...current, dialogs: renamePlan(current.dialogs, plan, name) }))
    setPlanByNpc((prev) => ({ ...prev, [npc.id]: name }))
  }

  const doDeletePlan = () => {
    if (!npc || !plan) return
    if (plans.length <= 1 && !window.confirm('这是最后一套方案 —— 删掉后这个 NPC 被踩到就没话说了。确定？')) return
    if (plans.length > 1 && !window.confirm(`删掉方案「${plan}」？`)) return
    const rest = Object.fromEntries(Object.entries(npc.dialogs).filter(([key]) => key !== plan))
    writeNpc((current) => ({ ...current, dialogs: rest }))
    setParkedByPlan((prev) => {
      const next = { ...prev }
      delete next[parkKey]
      return next
    })
  }

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div
        className="modal wide"
        style={{ width: 'min(1240px, 95vw)', height: '84vh', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="row" style={{ gap: 6 }}>
            <MessageSquareText size={16} />
            <span className="hand" style={{ fontSize: 16 }}>
              NPC 模组
            </span>
            <span className="badge">{listed.length} 条被引用</span>
          </span>
          <button className="btn small" onClick={() => setOpen(false)}>
            <X size={13} /> 关掉
          </button>
        </div>

        {listed.length === 0 ? (
          <div className="hintbox warn" style={{ margin: 'auto', maxWidth: 520 }}>
            这里只列<b>本局被引用的 NPC</b> —— 现在一条都没有。
            <div style={{ marginTop: 6 }}>
              先回 <b>组件库</b> 建一条 NPC（或用预设），再去地图上挑一栋建筑，在它的<b>实例页</b>里把这条 NPC 挂上。
              NPC 没有「位置」字段，它<b>住在建筑里</b>（§4.9.3）。
            </div>
          </div>
        ) : (
          <div className="row" style={{ flex: 1, minHeight: 0, gap: 8, alignItems: 'stretch' }}>
            {/* 左：本局被引用的 NPC */}
            <div className="panel" style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-title" style={{ fontSize: 12 }}>
                <Users size={12} /> 本局被引用
              </div>
              <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
                {listed.map((n) => {
                  const n0 = counts.get(n.id) ?? 0
                  return (
                    <div
                      key={n.id}
                      className={'kit-row' + (n.id === selectedId ? ' selected' : '')}
                      title={n0 > 0 ? `${n.name} —— 被 ${n0} 个建筑实例引用` : `${n.name} —— 还没有建筑用到它`}
                      style={{ opacity: n0 > 0 ? 1 : 0.62, cursor: 'pointer' }}
                      onClick={() => setSelectedId(n.id)}
                    >
                      <span className="truncate" title={n.name}>
                        {n.name}
                      </span>
                      <Badge tone={n0 > 0 ? 'on' : 'off'}>{n0 > 0 ? `×${n0}` : '未引用'}</Badge>
                    </div>
                  )
                })}
              </div>
              <div className="faint" style={{ fontSize: 11 }}>
                新建 / 删除 NPC 回组件库；这里只管对话。
              </div>
            </div>

            {/* 右：方案 + 画布 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="hand" style={{ fontSize: 14 }}>
                  {npc?.name}
                </span>
                {npc && summarizeNpc(npc).length > 0 && (
                  <span className="faint" style={{ fontSize: 11 }}>
                    {summarizeNpc(npc).length} 套方案 · 等权（哪一套由实例的骰子抽，`talk.dice`）
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <select
                  className="select"
                  style={{ width: 130, fontSize: 12 }}
                  value={plan ?? ''}
                  disabled={plans.length === 0}
                  onChange={(e) => npc && setPlanByNpc((prev) => ({ ...prev, [npc.id]: e.target.value }))}
                >
                  {plans.length === 0 && <option value="">（还没有方案）</option>}
                  {plans.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button className="btn small" onClick={addPlan} title="新建一套方案（方案名不写权重）">
                  <Plus size={11} /> 方案
                </button>
                <button className="btn small ghost" disabled={!plan} onClick={doRename}>
                  改名
                </button>
                <button className="btn small danger" disabled={!plan} onClick={doDeletePlan}>
                  删方案
                </button>
              </div>

              {plan && npc ? (
                <DialogCanvas
                  planKey={parkKey}
                  items={npc.dialogs[plan] ?? []}
                  parked={parked}
                  onChange={(next) => setTrees(next.main, next.parked)}
                  enabledItemIds={enabledItemIds}
                  itemLabel={itemLabel}
                />
              ) : (
                <div className="hintbox warn" style={{ margin: 'auto', maxWidth: 460 }}>
                  这条 NPC <b>还没有任何对话方案</b> —— 被踩到时会没有话说。
                  <div className="row" style={{ marginTop: 6, gap: 6 }}>
                    <button className="btn small primary" onClick={addPlan}>
                      <Plus size={11} /> 建一套方案
                    </button>
                    <span className="faint">
                      一套就够：只有一套方案时一定用它 <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              )}

              <div className="faint" style={{ fontSize: 11 }}>
                连线 ＝ 父子（从卡片底部端口拖到目标卡片）；「＋ 选项」＝ 加一张子卡片；卡片头部的
                <b>命中骰</b>留空 ＝ 玩家直接点选。
              </div>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}
