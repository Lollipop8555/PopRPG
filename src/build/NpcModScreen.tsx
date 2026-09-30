/**
 * 「NPC 模组」面板（§5.6 / §5.6.1）—— 与「规则」并列的**第二个整页入口**。
 *
 * 两者的分工不要混淆：
 * - **组件库 / 组件页** —— NPC 的基础字段（图标 / 名称 / 标签）+ `dialogs` 的**只读摘要**（不在这里改树）
 * - **这里** —— 对话树本身：方案（`dialogs` 的键）＋ 树（卡片 / 连线 / 骰子 / 赠予道具）；
 *   顺带把公共字段里的**描述**与**颜色**也放在这儿（本页盖住整屏、组件页看不见，来回切换太别扭）
 * - **地图实例页** —— 谁挂这个 NPC（NPC 没有位置字段，只能被建筑实例引用）
 *
 * 本页也提供**新建 NPC** 入口（库中无 NPC 时按钮直接位于提示框内，一次点击即建出一条并选中）：
 * 由此取消「先到组件库新建、再回到本页写对话」的多余往返；**删除**仍归组件库（与其它组件一致）。
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
import { blankComponent } from '../lib/blank'
import Overlay from '../ui/Overlay'
import { Badge, Field, TextBox } from '../ui/primitives'
import { randomComponentColor } from '../lib/color'
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
   * 左侧列出**库里的全部 NPC**（§5.6.1）：被引用的显示 `×N`，未被引用的显示「未引用」并降低不透明度。
   * **引用数是本局状态，不是能否撰写对话的前提** —— 故不按引用过滤列表。
   */
  const listed = useMemo(() => [...npcs], [npcs])
  const referencedCount = useMemo(() => listed.filter((n) => (counts.get(n.id) ?? 0) > 0).length, [listed, counts])

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
      window.alert(`方案「${name}」已存在，请换一个名称。`)
      return
    }
    writeNpc((current) => ({ ...current, dialogs: renamePlan(current.dialogs, plan, name) }))
    setPlanByNpc((prev) => ({ ...prev, [npc.id]: name }))
  }

  const doDeletePlan = () => {
    if (!npc || !plan) return
    if (plans.length <= 1 && !window.confirm('这是最后一套方案，删除后该 NPC 将没有任何对话内容。确定删除？'))
      return
    if (plans.length > 1 && !window.confirm(`确定删除方案「${plan}」？`)) return
    const rest = Object.fromEntries(Object.entries(npc.dialogs).filter(([key]) => key !== plan))
    writeNpc((current) => ({ ...current, dialogs: rest }))
    setParkedByPlan((prev) => {
      const next = { ...prev }
      delete next[parkKey]
      return next
    })
  }

  /** 新建一条空 NPC 并选中：与组件库「＋ 新建」采用同一构造（`blankComponent`），区别仅在于无须先离开本页 */
  const createNpc = () => {
    const def = blankComponent('npc')
    commit(() => useLibraryStore.getState().upsert('npc', def))
    setSelectedId(def.id)
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
            <span className="badge">
              共 {listed.length} 条 · 被引用 {referencedCount} 条
            </span>
          </span>
          <button className="btn small" onClick={() => setOpen(false)}>
            <X size={13} /> 关闭
          </button>
        </div>

        {listed.length === 0 ? (
          <div className="hintbox warn" style={{ margin: 'auto', maxWidth: 520 }}>
            组件库里<b>还没有任何 NPC</b>。
            <div style={{ marginTop: 6 }}>
              点下面的<b>新建</b>即可在本页建出一条（也可以到组件库新建、或使用内置预设），随后在这里写它的对话树。
              NPC 不含位置字段，出场位置由所挂的建筑决定（§4.9.3）：要让它在游戏中出现，请到地图实例页把它挂到某栋建筑上。
            </div>
            <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
              <button className="btn primary" onClick={createNpc} title="新建一条空 NPC">
                <Plus size={12} /> 新建 NPC
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ flex: 1, minHeight: 0, gap: 8, alignItems: 'stretch' }}>
            {/* 左：全部 NPC —— 引用数只作标注，未被引用者同样可选中并撰写对话 */}
            <div className="panel" style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                className="panel-title"
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span className="row" style={{ gap: 4 }}>
                  <Users size={12} /> 全部 NPC
                </span>
                <button className="btn small ghost" onClick={createNpc} title="新建一条空 NPC">
                  <Plus size={11} /> 新建
                </button>
              </div>
              <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {listed.map((n) => {
                  const n0 = counts.get(n.id) ?? 0
                  return (
                    <div
                      key={n.id}
                      className={'kit-row npc-item' + (n.id === selectedId ? ' selected' : '')}
                      title={
                        n0 > 0
                          ? `${n.name} —— 被 ${n0} 个建筑实例引用`
                          : `${n.name} —— 尚未被任何建筑引用（对话仍可编辑）`
                      }
                      style={{ opacity: n0 > 0 ? 1 : 0.62 }}
                      onClick={() => setSelectedId(n.id)}
                    >
                      <span className="truncate" style={{ flex: 1 }} title={n.name}>
                        {n.name}
                      </span>
                      <Badge tone={n0 > 0 ? 'on' : 'off'}>{n0 > 0 ? `×${n0}` : '未引用'}</Badge>
                    </div>
                  )
                })}
              </div>
              <div className="faint" style={{ fontSize: 11 }}>
                NPC 可在此新建（删除仍在组件库中进行）；此处编辑对话，兼改「描述」与「颜色」。
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
                    {summarizeNpc(npc).length} 套方案 · 等权
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
                <button className="btn small" onClick={addPlan} title="新建一套方案">
                  <Plus size={11} /> 方案
                </button>
                <button className="btn small ghost" disabled={!plan} onClick={doRename}>
                  改名
                </button>
                <button className="btn small danger" disabled={!plan} onClick={doDeletePlan}>
                  删方案
                </button>
              </div>

              {/* 基础字段（§5.6）：描述与颜色都是 `ComponentBase` 的公共字段，组件页里能改，
                  但本页是盖住整屏的整页面板（组件页根本看不见），故把这俩也搬进来 ——
                  给一条 NPC 写说明、定颜色时不必先关掉整页再回组件库找它 */}
              {npc && (
                <div className="row" style={{ gap: 6, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Field label="描述">
                      <TextBox
                        value={npc.desc ?? ''}
                        rows={2}
                        placeholder="这条 NPC 的一句话说明"
                        onChange={(v) => writeNpc((cur) => ({ ...cur, desc: v }))}
                      />
                    </Field>
                  </div>
                  <Field label="颜色">
                    <div className="row" style={{ gap: 4 }}>
                      <input
                        className="color-input"
                        type="color"
                        value={npc.color ?? '#cccccc'}
                        title="NPC 的颜色（描边 100% alpha ＋ 填充 30% alpha）"
                        onChange={(e) => writeNpc((cur) => ({ ...cur, color: e.target.value }))}
                      />
                      <button
                        className="btn small"
                        title="随机换一个颜色"
                        onClick={() => writeNpc((cur) => ({ ...cur, color: randomComponentColor() }))}
                      >
                        随机
                      </button>
                      {npc.color && (
                        <button
                          className="btn small"
                          title="清除，改为按 id 取兜底色"
                          onClick={() => writeNpc((cur) => ({ ...cur, color: undefined }))}
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </Field>
                </div>
              )}

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
                  该 NPC <b>还没有任何对话方案</b>，与其对话时将没有内容可显示。
                  <div className="row" style={{ marginTop: 6, gap: 6 }}>
                    <button className="btn small primary" onClick={addPlan}>
                      <Plus size={11} /> 建一套方案
                    </button>
                    <span className="faint">
                      仅一套方案时必定使用该方案 <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              )}

              <div className="faint" style={{ fontSize: 11 }}>
                在卡片底部的连接端口按住并拖到另一张卡片，后者即成为这条记录的后续项；「＋ 选项」也可直接新增一条后续项。
                卡片自上而下分五段，<b>段名就写在卡片的分隔线上</b>：<b>命中</b>（该条记录在哪些点数上轮到）→{' '}
                <b>答复</b>（玩家可见的选项文本）→ <b>台词</b>（NPC 台词）→ <b>赠予道具</b>（走到这一条赠予什么）→{' '}
                <b>后续项</b>（之后接哪些答复；「答复骰子」留空表示玩家直接点选，选定骰子后按各后续项的「命中」判定）。
              </div>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}
