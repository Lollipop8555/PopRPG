/**
 * 模组面板的一张卡片，即**一条对话记录**（§4.9.2 / §5.6.1）。
 *
 * 全树同构：`message`（台词，逐行）＋ `dice`（本层答复骰子）＋ `hit`（当自己是别人的选项时）
 * ＋ `give`（赠予道具，可重复）＋ `items`（后续项，由连线 / 「＋ 选项」产生）。
 *
 * 卡片自上而下的排布即这张卡的读法：
 * `hit`（这一条何时轮到）→ `result`（玩家答复）→ `message`（NPC 台词）
 * → `give`（这一条附带什么）→ `dice`（**下面那些答复**如何被选中）＋ `items`（＋选项）。
 * **「＋ 选项」**、连接端口与折叠箭头同排在**卡片底部一行**（依次为：「＋ 选项」→ 端口 → 折叠箭头）；**断开**与**删除**并排固定在**卡片右上角**（断开在删除左侧）。
 * `hit` 与 `result` 描述的是**相对上一级**的关系，故根卡片不显示（它上面没有一级）；
 * `give` 写在**当前这条记录**自身、`dice` 只作用于**它下面**的答复，故二者都排在自家后续项之前。
 *
 * **每一段都自带段名**，段名写在段间的分隔线上（`— 答复 —` / `— 台词 —` / `— 赠予道具 —` / `— 后续项 —`）：
 * 卡片自身即可看清哪块是哪块，不必回头翻窗口说明；根卡片的第一行「命中」也带同名行内标签。
 * 卡片自身的操作按作用对象归位：**断开**与**删除**都不属于任何一段内容，
 * 故并排固定于卡片**右上角**（断开在删除**左侧**），不占正文行；
 * **「＋ 选项」**（直接新增一条后续项）、**连接端口**（拖出后续项）与**折叠**（作用于挂在卡片底部的后续项子树）都在卡片底部一行。
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, Link2, Plus, Scissors, Trash2, X } from 'lucide-react'
import type { DialogNode } from '../../types'
import { diceFaces, formatHit, hitCoverage, listPoints, parseHit } from '../../lib/dialog'
import { CARD_W, type LaidOutNode } from '../../lib/dialogTree'
import { Badge } from '../../ui/primitives'

const DICE_CHOICES = ['', '1D4', '1D6', '1D8', '1D10', '1D12', '1D20', '2D6']

export default function DialogCard({
  card,
  group,
  selected,
  collapsed,
  linking,
  isLinkSource,
  enabledItemIds,
  itemLabel,
  onSelect,
  onHover,
  onMeasure,
  onToggleCollapse,
  onChange,
  onSetDice,
  onAddChild,
  onRemove,
  onDisconnect,
  onStartLink,
}: {
  card: LaidOutNode
  group: 'main' | 'parked'
  selected: boolean
  collapsed: boolean
  linking: boolean
  isLinkSource: boolean
  enabledItemIds: string[]
  itemLabel: (id: string) => string
  onSelect: () => void
  /** 只有连线过程中才给：光标进入 / 离开这张卡片（进入时是落点候选，离开必须撤掉） */
  onHover?: (over: boolean) => void
  /** 上报**实测高度**：画布要靠它把连线的线头接在卡片边上 */
  onMeasure?: (height: number) => void
  onToggleCollapse: () => void
  onChange: (fn: (node: DialogNode) => DialogNode) => void
  onSetDice: (dice?: string) => void
  onAddChild: () => void
  onRemove: () => void
  onDisconnect?: () => void
  onStartLink: (e: React.MouseEvent) => void
}) {
  const { node, path, key, parentHasDice, parentDice, x, y } = card
  // 路径**含根下标**（`[0]` 就是根层第一条），所以「根层」＝ 长度 1（§4.9.2）
  const isRoot = path.length === 1
  const kids = node.items?.length ?? 0
  const coverage = node.dice ? hitCoverage(node.dice, node.items) : null
  const [dragLine, setDragLine] = useState<number>()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef(onMeasure)
  measureRef.current = onMeasure

  /** 卡片长高长矮（改台词 / 折叠 / 命中覆盖提示）都立刻上报 —— 连线跟着走 */
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const report = () => measureRef.current?.(el.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const patchMessage = (next: string[]) => onChange((n) => ({ ...n, message: next }))

  const setLine = (i: number, text: string) => {
    const next = [...node.message]
    next[i] = text
    patchMessage(next)
  }

  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...node.message]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchMessage(next)
  }

  const hitRange = node.hit ? parseHit(node.hit) : null
  const hitTone = node.hit && (!hitRange || (coverage?.faces ?? 0) < (hitRange?.[1] ?? 0)) ? 'err' : undefined
  /** 命中能选的点数 ＝ 父层骰子的面数（父层的写法解析不出来时按 1D20 兜底） */
  const faces = diceFaces(parentDice) ?? 20
  const points = Array.from({ length: faces }, (_, i) => i + 1)
  /**
   * 下拉的可选点数：`1..faces`，外加**当前值** —— 父层骰子被改小后旧 `hit` 会越界，
   * 得把它摆出来（配红框）让用户看见并改掉，而不是让下拉显示成空白。
   */
  const withCurrent = (list: number[], current: number) =>
    list.includes(current) ? list : [...list, current].sort((a, b) => a - b)
  /** 起点下拉的值：能解析就用解析值，写坏了的原文照样显示出来（好让用户改掉它） */
  const hitLo = hitRange ? String(hitRange[0]) : (node.hit ?? '')

  return (
    <div
      ref={boxRef}
      className={
        'dlg-card' +
        (selected ? ' selected' : '') +
        (group === 'parked' ? ' parked' : '') +
        (linking && !isLinkSource ? ' linkable' : '') +
        (isLinkSource ? ' linking' : '')
      }
      data-dlg-key={key}
      style={{ left: x, top: y, width: CARD_W }}
      onMouseDown={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* 卡片右上角：断开 ＋ 删除（断开在删除左侧）。
          二者都不属于任何一段内容，故固定于右上角、不占正文行 */}
      <div className="dlg-card-ops">
        {onDisconnect && (
          <button
            className="btn small ghost dlg-card-cut"
            title="断开与上一级的连接：该分支移至「未连接」，内容保留"
            onClick={(e) => {
              e.stopPropagation()
              onDisconnect()
            }}
          >
            <Scissors size={11} />
          </button>
        )}
        <button
          className="btn small ghost dlg-card-del"
          title="删除该记录及其后续项"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* ① 命中（作用于**这张卡片**）：父层掷骰时，这一条在哪些点数上轮到。
          它是「这个选项何时出现」的条件，故置于 result 之前。
          父层未开骰子时这一条无从命中：不可选，仅提示（§5.7：只提示、不拦截） */}
      {!isRoot && (
        <div className="row dlg-hit-row" style={{ gap: 4, marginBottom: 4 }}>
          <span className="faint" style={{ fontSize: 11, flex: '0 0 auto' }}>
            命中
          </span>
          {parentHasDice ? (
            <>
              {/* 命中**不给人打字**：可选点数就是父层骰子的面数，非法值根本选不出来 */}
              <select
                className="select"
                style={{
                  fontSize: 12,
                  padding: '1px 4px',
                  width: 'auto',
                  flex: '0 0 auto',
                  borderColor: hitTone === 'err' ? 'var(--red)' : undefined,
                }}
                value={hitLo}
                title={`命中区间起点：上一级答复骰子为 ${parentDice ?? ''}，共 ${faces} 面；选「—」表示该条不按点数进入`}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const lo = Number(e.target.value)
                  if (!lo) {
                    onChange((n) => (n.hit === undefined ? n : { ...n, hit: undefined }))
                    return
                  }
                  onChange((n) => ({ ...n, hit: formatHit(lo, hitRange ? Math.max(lo, hitRange[1]) : lo) }))
                }}
              >
                <option value="">—</option>
                {/* 历史数据里写坏的 `hit`（`abc` / `2-1`）照样摆出来，好让用户改掉它 */}
                {node.hit && !hitRange && <option value={node.hit}>{node.hit}</option>}
                {(hitRange ? withCurrent(points, hitRange[0]) : points).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {hitRange && (
                <>
                  <span className="faint" style={{ fontSize: 11 }}>
                    ~
                  </span>
                  <select
                    className="select"
                    style={{
                      fontSize: 12,
                      padding: '1px 4px',
                      width: 'auto',
                      flex: '0 0 auto',
                      borderColor: hitTone === 'err' ? 'var(--red)' : undefined,
                    }}
                    value={String(hitRange[1])}
                    title={`命中区间终点（含）：掷到 ${hitRange[0]} ~ ${hitRange[1]} 时进入该条`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((n) => ({ ...n, hit: formatHit(hitRange[0], Number(e.target.value)) }))}
                  >
                    {withCurrent(
                      points.filter((p) => p >= hitRange[0]),
                      hitRange[1],
                    ).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          ) : (
            <>
              <select
                className="select"
                style={{ fontSize: 12, padding: '1px 4px', width: 'auto', flex: '0 0 auto' }}
                value=""
                disabled
                title="上一级未设答复骰子，该条无法按点数进入；请先在上一级选定答复骰子"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <option value="">—</option>
              </select>
              <span className="faint" style={{ fontSize: 11 }}>
                上一级未设骰子
              </span>
            </>
          )}
        </div>
      )}

      {/* 命中 与 答复 之间的分隔线：其上为「这一条何时轮到」，其下为「轮到后玩家看到什么」。
          段名直接写在线上（「— 答复 —」），卡片自身即可看清每段是什么 */}
      {!isRoot && (
        <div className="dlg-sep">
          <span>答复</span>
        </div>
      )}

      {/* ② 答复（子卡片）：玩家点击的选项文本。
          行首的箭头图标标出这一行，表示它是**玩家点击的那句话**，与下方的 NPC 台词区分 */}
      <div className="dlg-card-head">
        {!isRoot ? (
          <>
            <span className="dlg-reply-mark" title="玩家点击的答复文本（选项文本）">
              <ArrowRight size={12} />
            </span>
            <input
              className="input dlg-result"
              value={node.result ?? ''}
              placeholder="玩家答复（选项文本）"
              title="玩家点击的答复文本，同时作为卡片标题"
              onChange={(e) => onChange((n) => ({ ...n, result: e.target.value || undefined }))}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <span className="dlg-card-title">
            根 {path[0] + 1}
            {group === 'parked' && <Badge tone="warn">未连接</Badge>}
          </span>
        )}
      </div>

      {/* 答复 与 台词 之间的分隔线：其上为玩家所说，其下为 NPC 所说 */}
      <div className="dlg-sep">
        <span>台词</span>
      </div>

      {/* ③ 台词：一行一条，可拖动排序；删除空行即少一句 */}
      <div className="dlg-lines">
        {node.message.map((line, i) => (
          <div
            key={i}
            className={'dlg-line' + (dragLine === i ? ' dragging' : '')}
            onDragOver={(e) => {
              if (dragLine === undefined) return
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragLine === undefined) return
              reorder(dragLine, i)
              setDragLine(undefined)
            }}
          >
            <span
              className="dlg-grip"
              draggable
              title="按住拖动以调整顺序"
              onDragStart={() => setDragLine(i)}
              onDragEnd={() => setDragLine(undefined)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              ⋮⋮
            </span>
            <input
              className="input"
              style={{ fontSize: 12, padding: '2px 5px' }}
              value={line}
              placeholder="NPC 说的一句"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setLine(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && line === '' && node.message.length > 1) {
                  e.preventDefault()
                  patchMessage(node.message.filter((_, j) => j !== i))
                }
              }}
            />
            <button
              className="btn small ghost"
              title="删除这一句"
              disabled={node.message.length <= 1}
              onClick={(e) => {
                e.stopPropagation()
                patchMessage(node.message.filter((_, j) => j !== i))
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          className="btn small ghost"
          onClick={(e) => {
            e.stopPropagation()
            patchMessage([...node.message, ''])
          }}
        >
          <Plus size={11} /> 一句
        </button>
      </div>

      {/* 台词 与 赠予道具 之间的分隔线：其上为「这一条说什么」，其下为「这一条附带什么」 */}
      <div className="dlg-sep">
        <span>赠予道具</span>
      </div>

      {/* ④ 赠予道具（`give`）：可重复添加，同一种道具添加两次即两份。
          它写在**当前这条记录**自身，不属于子树，因此折叠后续项时照常显示 */}
      <div className="dlg-gives">
        {(node.give ?? []).map((id, i) => {
          const bad = !enabledItemIds.includes(id)
          return (
            <span key={`${id}-${i}`} className={`chip${bad ? ' state' : ''}`} title={bad ? '这件道具未启用或已删除，引用失效' : itemLabel(id)}>
              {itemLabel(id)}
              <button
                className="btn small ghost"
                style={{ padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange((n) => ({ ...n, give: (n.give ?? []).filter((_, j) => j !== i) }))
                }}
              >
                <X size={10} />
              </button>
            </span>
          )
        })}
        <select
          className="select"
          style={{ fontSize: 11, padding: '1px 2px', width: 104 }}
          value=""
          title="赠予道具：只列已启用道具；同一种道具可重复添加，即多份"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const id = e.target.value
            if (id) onChange((n) => ({ ...n, give: [...(n.give ?? []), id] }))
          }}
        >
          <option value="">＋ 赠予道具</option>
          {enabledItemIds.map((id) => (
            <option key={id} value={id}>
              {itemLabel(id)}
            </option>
          ))}
        </select>
      </div>

      {/* 赠予道具 与 后续项 之间的分隔线：其上为「这一条自身有什么」，其下为「这一条之后接什么」 */}
      <div className="dlg-sep">
        <span>后续项</span>
      </div>

      {/* ⑤ 答复骰子（后续项这一段的第一行，作用于**下面那些后续项**）：决定它们如何被选中。
          它紧邻所作用的后续项之上；修改此处，下方各条的「命中」随之变化 */}
      <div className="row" style={{ gap: 4, marginBottom: 4 }}>
        <span className="faint" style={{ fontSize: 11, flex: '0 0 auto' }}>
          答复骰子
        </span>
        {/* 宽度随最长选项自适应：写死宽度会把「无（直接点选）」截成「无（直接点」 */}
        <select
          className="select"
          style={{ fontSize: 12, padding: '1px 4px', width: 'auto', flex: '0 0 auto', minWidth: 72 }}
          value={node.dice ?? ''}
          title="后续项的选取方式：留空表示玩家直接点选；选定骰子则掷骰，按各后续项的「命中」决定进入哪一条"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onSetDice(e.target.value || undefined)}
        >
          {[...new Set([...DICE_CHOICES, node.dice ?? ''])].map((d) => (
            <option key={d || 'none'} value={d}>
              {d || '无（直接点选）'}
            </option>
          ))}
        </select>
      </div>

      {collapsed && kids > 0 && <div className="faint">（已折叠 {kids} 条后续项）</div>}

      {/* ⑥ 命中覆盖检查（属于「后续项」这一段）：仅提示，不拦截（§5.7） */}
      {coverage && !collapsed && (
        <div className={`dlg-coverage${coverage.missing.length || coverage.overlaps.length || coverage.outOfRange.length || coverage.badHit.length ? ' warn' : ''}`}>
          {coverage.badHit.length > 0 && (
            <div>
              第 {coverage.badHit.map((b) => b.index).join('、')} 条的命中写法无法解析（应写成 `6` 或 `1-2`）。
            </div>
          )}
          {coverage.outOfRange.length > 0 && (
            <div>第 {coverage.outOfRange.map((b) => b.index).join('、')} 条的命中超出骰子面数（最多 {coverage.faces}）。</div>
          )}
          {coverage.overlaps.length > 0 && (
            <div>点数 {listPoints(coverage.overlaps)} 同时命中多条，运行时取最先命中的一条。</div>
          )}
          {coverage.missing.length > 0 && (
            <div>
              掷到 {listPoints(coverage.missing)} 时没有任何选项命中，运行时将要求重掷。
            </div>
          )}
          {coverage.missing.length === 0 &&
            coverage.overlaps.length === 0 &&
            coverage.outOfRange.length === 0 &&
            coverage.badHit.length === 0 &&
            coverage.faces > 0 && <div>1~{coverage.faces} 全被覆盖 ✓</div>}
        </div>
      )}

      {/* ⑦ 卡片底部一行：「＋ 选项」＋ 连接端口 ＋ 折叠箭头。
          新增后续项的两条路（直接加一条 / 从端口拖到已有卡片）与折叠都只作用于后续项，
          故同排、同款式同尺寸（`.dlg-foot-row > *` 统一给样式）：端口在「＋ 选项」右侧，
          箭头在最后（它折叠的正是挂在卡片底部的后续项子树，只影响显示、不影响导出） */}
      <div className="dlg-foot-row">
        <button
          title="新增一条后续项"
          onClick={(e) => {
            e.stopPropagation()
            onAddChild()
          }}
        >
          <Plus size={11} /> 选项
        </button>
        <div
          className="dlg-port"
          title="按住并拖动到另一张卡片，将其设为该记录的后续项；不能指向自身或自身的后续项"
          onMouseDown={onStartLink}
        >
          <Link2 size={11} />
        </div>
        <button
          title={collapsed ? '展开后续项（只影响显示）' : '折叠后续项（只影响显示）'}
          disabled={kids === 0}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
    </div>
  )
}
