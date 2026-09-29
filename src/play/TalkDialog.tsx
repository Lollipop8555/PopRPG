/**
 * 对话弹层（§4.9.2 / §4.8.12）。
 *
 * 一个弹层吃三种状态：
 * - `menu`：重入的**选择对话框**（继续 / 重新 / 走完过才有的路过）
 * - `line`：**逐条展示台词**，点「继续」推进
 * - `choose`：台词播完 —— 本层没 `dice` 就列**选项按钮**（文本取子记录的 `result`），有 `dice` 就点「掷骰」
 *
 * 立绘区（VS）留了位置：V2.1 皮肤接进来后填，**缺位不渲染、不回退 emoji**。
 */

import type { Session } from '../types/session'
import type { TalkMenuAction } from './talk'
import { talkView } from './talk'
import Overlay from '../ui/Overlay'

export default function TalkDialog({
  session,
  onNext,
  onChoose,
  onRoll,
  onMenu,
}: {
  session: Session
  onNext: () => void
  onChoose: (index: number) => void
  onRoll: () => void
  onMenu: (action: TalkMenuAction) => void
}) {
  const view = talkView(session)
  if (!view) return null

  const { talk, node, lines, needsRoll, options, canPass, delivered } = view
  const npc = session.scenario.library.npcs.find((n) => n.id === talk.npc)
  const cls = session.player.cls

  const vs = (
    <div className="talk-vs">
      <div className="talk-side">
        <div className="talk-portrait" aria-hidden />
        <div className="talk-who">{cls?.icon} {cls?.name ?? '你'}</div>
      </div>
      <div className="talk-mid">VS</div>
      <div className="talk-side right">
        <div className="talk-portrait" aria-hidden />
        <div className="talk-who">{npc?.icon} {npc?.name ?? talk.npc}</div>
      </div>
    </div>
  )

  // 重入：选择对话框
  if (talk.stage === 'menu') {
    return (
      <Overlay>
        <div className="modal talk-modal">
          <div className="panel-head" style={{ justifyContent: 'space-between' }}>
            <span className="hand" style={{ fontSize: 16 }}>又要交谈？</span>
            <span className="badge">{talk.dialog}</span>
          </div>
          {vs}
          <p className="muted">
            {delivered
              ? '这段对话已经交付过 —— 可以再看一遍（不会重复给东西），或者直接路过。'
              : '已经见过这位了 —— 可以接着上次的话说，也可以从头再听一遍。'}
          </p>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <button className="btn primary talk-choice" onClick={() => onMenu('continue')}>
              继续对话
            </button>
            <button className="btn talk-choice" onClick={() => onMenu('restart')}>
              重新对话
            </button>
            {canPass && (
              <button className="btn talk-choice" onClick={() => onMenu('pass')}>
                路过
              </button>
            )}
          </div>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay>
      <div className="modal talk-modal">
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="hand" style={{ fontSize: 16 }}>{npc?.name ?? talk.npc}</span>
          <span className="badge">{talk.dialog}</span>
        </div>

        {vs}

        {/* 已展示的台词（逐条推进，当前这条高亮） */}
        <div className="talk-lines">
          {lines.map((line, i) => (
            <div key={i} className={`talk-bubble${i === talk.line ? ' now' : ''}`}>
              {line || '……'}
            </div>
          ))}
          {lines.length === 0 && <div className="talk-bubble now">……</div>}
        </div>

        {talk.replay && (
          <div className="hintbox" style={{ marginTop: 4 }}>
            这段已经交付过 —— 只回放台词，不再给东西。
          </div>
        )}

        {talk.stage === 'line' && (
          <div className="row" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
            <button className="btn primary talk-choice" onClick={onNext}>
              继续
            </button>
          </div>
        )}

        {talk.stage === 'choose' && !talk.replay && needsRoll && (
          <div style={{ marginTop: 6 }}>
            <div className="hintbox">
              这一层要看运气（{node?.dice}）—— 点「掷骰」，命中的那一条就是接下来发生的。
            </div>
            {talk.missed && (
              <div className="hintbox warn" style={{ marginTop: 4 }}>
                掷出 {talk.rolled} —— 没有选项命中，再掷一次。
              </div>
            )}
            <div className="row" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
              <button className="btn primary talk-choice" onClick={onRoll}>
                {talk.missed ? '再掷一次' : '掷骰'}
              </button>
            </div>
          </div>
        )}

        {talk.stage === 'choose' && !talk.replay && !needsRoll && (
          <div className="talk-options">
            {options.map((o) => (
              <button key={o.index} className="btn talk-option" onClick={() => onChoose(o.index)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  )
}
