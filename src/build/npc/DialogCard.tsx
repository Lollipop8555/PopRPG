/**
 * 模组面板的一张卡片 ＝ **一条对话记录**（§4.9.2 / §5.6.1）。
 *
 * 全树同构：`message`（台词，逐行）＋ `dice`（本层命中骰）＋ `hit`（当自己是别人的选项时）
 * ＋ `give`（给道具，可重复）＋ `items`（子卡片，由连线 / 「＋ 选项」产生）。
 * **根层卡片不显示 `result`**（它只在"作为上层选项"时有意义）。
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Link2, Plus, Scissors, Trash2, X } from 'lucide-react'
import type { DialogNode } from '../../types'
import { hitCoverage, listPoints, parseHit } from '../../lib/dialog'
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
  /** 只有在连线过程中才给：光标压在这张卡片上 ＝ 松手就落在它身上 */
  onHover?: () => void
  onToggleCollapse: () => void
  onChange: (fn: (node: DialogNode) => DialogNode) => void
  onSetDice: (dice?: string) => void
  onAddChild: () => void
  onRemove: () => void
  onDisconnect?: () => void
  onStartLink: (e: React.MouseEvent) => void
}) {
  const { node, path, key, parentHasDice, x, y } = card
  // 路径**含根下标**（`[0]` 就是根层第一条），所以「根层」＝ 长度 1（§4.9.2）
  const isRoot = path.length === 1
  const kids = node.items?.length ?? 0
  const coverage = node.dice ? hitCoverage(node.dice, node.items) : null
  const [dragLine, setDragLine] = useState<number>()

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

  return (
    <div
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
      onMouseEnter={onHover}
    >
      {/* ① 卡片头：选项文本（子卡片）／骰子下拉／折叠／删除 */}
      <div className="dlg-card-head">
        {!isRoot ? (
          <input
            className="input dlg-result"
            value={node.result ?? ''}
            placeholder="玩家答复（选项文本）"
            title="这是玩家看到并点下的选项文本；也作卡片标题"
            onChange={(e) => onChange((n) => ({ ...n, result: e.target.value || undefined }))}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="dlg-card-title">
            根 {path[0] + 1}
            {group === 'parked' && <Badge tone="warn">未连接</Badge>}
          </span>
        )}

        <button
          className="btn small ghost"
          title={collapsed ? '展开子卡片（只影响显示）' : '折叠子卡片（只影响显示）'}
          disabled={kids === 0}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          className="btn small ghost"
          title="删掉这张卡片（连同它的后续节点）"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ② 本层命中骰：填了 → 子卡片按点数命中；留空 → 玩家直接点选 */}
      <div className="row" style={{ gap: 4, marginBottom: 4 }}>
        <span className="faint" style={{ fontSize: 11 }}>
          命中骰
        </span>
        <select
          className="select"
          style={{ fontSize: 12, padding: '1px 4px', width: 84 }}
          value={node.dice ?? ''}
          title="这一层的后续项怎么选：留空 ＝ 玩家直接点选；填了 ＝ 掷骰按 hit 命中"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onSetDice(e.target.value || undefined)}
        >
          {[...new Set([...DICE_CHOICES, node.dice ?? ''])].map((d) => (
            <option key={d || 'none'} value={d}>
              {d || '无（直接点选）'}
            </option>
          ))}
        </select>
        {parentHasDice && (
          <>
            <span className="faint" style={{ fontSize: 11 }}>
              命中
            </span>
            <input
              className="input"
              style={{ width: 62, fontSize: 12, padding: '1px 4px', borderColor: hitTone === 'err' ? 'var(--red)' : undefined }}
              value={node.hit ?? ''}
              placeholder="1-2"
              title="父层有骰子，这里填它命中哪些点数（`6` 或 `1-2`）"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onChange((n) => ({ ...n, hit: e.target.value || undefined }))}
            />
          </>
        )}
      </div>

      {/* ③ 台词：一行一条，可拖动排序；空行删掉即少一句 */}
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
              title="拖动排序"
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
              title="删掉这一句"
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

      {collapsed && kids > 0 && <div className="faint">（已折叠 {kids} 条后续）</div>}

      {/* ④ 命中覆盖检查：只提示、不拦截（§5.7） */}
      {coverage && !collapsed && (
        <div className={`dlg-coverage${coverage.missing.length || coverage.overlaps.length || coverage.outOfRange.length || coverage.badHit.length ? ' warn' : ''}`}>
          {coverage.badHit.length > 0 && (
            <div>
              第 {coverage.badHit.map((b) => b.index).join('、')} 条的命中写法看不懂（要像 `6` 或 `1-2`）。
            </div>
          )}
          {coverage.outOfRange.length > 0 && (
            <div>第 {coverage.outOfRange.map((b) => b.index).join('、')} 条的命中超出骰子面数（最多 {coverage.faces}）。</div>
          )}
          {coverage.overlaps.length > 0 && (
            <div>点数 {listPoints(coverage.overlaps)} 同时命中不止一条 —— 运行时会取先命中的那条。</div>
          )}
          {coverage.missing.length > 0 && (
            <div>
              掷到 {listPoints(coverage.missing)} 没有任何选项命中 —— 运行时会要求重掷。
            </div>
          )}
          {coverage.missing.length === 0 &&
            coverage.overlaps.length === 0 &&
            coverage.outOfRange.length === 0 &&
            coverage.badHit.length === 0 &&
            coverage.faces > 0 && <div>1~{coverage.faces} 全被覆盖 ✓</div>}
        </div>
      )}

      {/* ⑤ 给道具（`give`，与后续项可并存；同一种添两次 ＝ 两份） */}
      {!collapsed && (
        <>
          <div className="dlg-gives">
            {(node.give ?? []).map((id, i) => {
              const bad = !enabledItemIds.includes(id)
              return (
                <span key={`${id}-${i}`} className={`chip${bad ? ' state' : ''}`} title={bad ? '这件道具没启用 / 已删除 —— 引用失效' : itemLabel(id)}>
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
              title="给道具：只列已启用道具；同一种可以添两次（＝两份）"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const id = e.target.value
                if (id) onChange((n) => ({ ...n, give: [...(n.give ?? []), id] }))
              }}
            >
              <option value="">＋ 给道具</option>
              {enabledItemIds.map((id) => (
                <option key={id} value={id}>
                  {itemLabel(id)}
                </option>
              ))}
            </select>
          </div>

          <div className="dlg-card-foot">
            <button
              className="btn small"
              title="加一条后续项（＝一张子卡片）"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild()
              }}
            >
              <Plus size={11} /> 选项
            </button>
            {onDisconnect && (
              <button
                className="btn small ghost"
                title="断开与父卡片的连线：整枝挪到「未连接」，内容不删"
                onClick={(e) => {
                  e.stopPropagation()
                  onDisconnect()
                }}
              >
                <Scissors size={11} /> 断开
              </button>
            )}
          </div>
        </>
      )}

      {/* ⑥ 底部端口：从这里拖到另一张卡片，让它成为后续项 */}
      <div
        className="dlg-port"
        title="按住拖到另一张卡片 → 它成为这条的后续项（拖向自己或自己的子孙会被拒绝）"
        onMouseDown={onStartLink}
      >
        <Link2 size={11} />
      </div>
    </div>
  )
}
