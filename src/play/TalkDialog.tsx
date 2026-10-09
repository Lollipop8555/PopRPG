/**
 * 对话弹层（§4.9.2 / §4.8.12）。
 *
 * 一个弹层吃两种状态（**没有 `menu`**：V2.3 §十一 裁决 54 / 61 —— 重入不再弹选择框，一律按对话树求值）：
 * - `line`：**逐条展示台词**，点「继续」推进（台词是**聊天记录**：一路说过的都留在上面，只往后追加）
 * - `choose`：台词播完 —— 本层没 `dice` 就列**选项按钮**（文本取子记录的 `result`）；
 *   **有 `dice`（掷骰层）就先把这层所有答复一次摆出来**，每条前面标出它的**命中区间**，
 *   配一枚骰子：**点骰子才掷** → 骰面停住 → 高亮命中的那一条 → 自动进那一条接着说
 *
 * **掷骰层不许只说"看运气"**：玩家不是来听旁白的。选项清单、命中区间、骰面、命中的是哪一条，
 * 四件事都得上屏 —— 玩家看完才知道自己落在哪，而不是被一句提示词带着盲掷。
 *
 * **这里没有「VS」**：这是文字游戏，对话框里不谈立绘、更不做双方对比（对战对话框同理）。
 * 一个弹层只有三样东西——**标题栏（谁在说）＋ 聊天记录 ＋ 选项**；原先顶部那条「你 VS 他」的立绘对比区
 * （两侧名条 ＋ 中间「VS」）是**对战的语汇**，已整块删除。
 *
 * **聊天记录不挑人**：既然是记录，**双方的话都得留在上面** —— NPC 的台词靠左，
 * 玩家挑的那一条（`result` 原文，掷骰命中的也算自己挑的）靠右，一路累积、选完不清空
 * （`talkView().log` 由 `talk.path` 反推，所以退出再进入记录照样在）。
 *
 * **标题栏只写 NPC 那一行**（`icon` ＋ 名字）：`talk.dialog` 是**作者侧的方案名**（`Mod1` / `Mod2`…），属于编辑器内部标识，
 * 游玩态**一律不显示**——玩家看的是"跟谁说话"，不是"这套对话在库里叫什么"。玩家的名字同理：跟 NPC 说话的人是自己，
 * 「骑士」出现在这里只会像在报幕。`icon` 这一格是 `role.npcs` 素材的落点（V2.1 皮肤接进来后替换 emoji）。
 */

import { useEffect, useRef, useState } from 'react'
import type { Session } from '../types/session'
import { talkView } from './talk'
import { roleSprite } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useDieBodyStyle } from '../ui/useDieSkin'
import { useButtonStyle } from '../ui/useButtonStyle'
import { DieFace } from './DiceLog'
import Overlay from '../ui/Overlay'
import { RoleGlyph } from '../ui/RoleGlyph'

/** 骰子转多久才停（比底栏那枚略短：这里是玩家自己点的，手感要脆） */
const SPIN_MS = 520

export default function TalkDialog({
  session,
  onNext,
  onChoose,
  onRoll,
}: {
  session: Session
  onNext: () => void
  onChoose: (index: number) => void
  /** 点骰子 → 掷（掷出与高亮都在 store 里，进那一条由 `GameScreen` 卡一拍后调 `talkHit`） */
  onRoll: () => void
}) {
  const [rolling, setRolling] = useState(false)
  const [spinPips, setSpinPips] = useState<number | null>(null)
  /** 台词区：记录越攒越长，新的一句得自己滚进视野（不然追加了也看不见） */
  const linesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = linesRef.current
    if (el) el.scrollTop = el.scrollHeight
  })

  // 转骰：点子快速滚动，转完定格（真正的掷点在 `onRoll`，它一按下就已经掷了 —— 转只是为了看得见）
  useEffect(() => {
    if (!rolling) {
      setSpinPips(null)
      return
    }
    const spin = setInterval(() => setSpinPips(1 + Math.floor(Math.random() * 6)), 70)
    const stop = setTimeout(() => setRolling(false), SPIN_MS)
    return () => {
      clearInterval(spin)
      clearTimeout(stop)
    }
  }, [rolling])

  const assets = useSkinStore((s) => s.assets)
  const role = useSkinStore((s) => s.skin?.manifest.role)
  // 对话框纸面底纹（`skin/03-window.md` §四）
  const surface = useSurfaceStyle('dialog')
  // 骰子本体（`skin/04-misc.md` §三）：对话里那枚骰子与底栏那枚共用一张
  const dieBody = useDieBodyStyle()
  // 按钮（`skin/03-window.md` §四）：带方向的主项（继续对话 / 继续）走 `primary`，其余走 `plain`
  const primaryBtn = useButtonStyle('primary')
  const plainBtn = useButtonStyle('plain')

  const view = talkView(session)
  if (!view) return null

  const { talk, node, log, needsRoll, options } = view
  const npc = session.scenario.library.npcs.find((n) => n.id === talk.npc)
  // "正在说的那一句" ＝ 记录里最后一条 NPC 台词（下面跟着的玩家答复已经答完了）
  const nowIdx = log.reduce((acc, e, i) => (e.who === 'npc' ? i : acc), -1)
  // 转动期间先不揭晓：骰面还在滚，玩家该看的是滚，不是答案
  const hit = rolling ? undefined : talk.hit
  const dieText = rolling
    ? '掷骰中…'
    : talk.rolled === undefined
      ? `掷 ${node?.dice}`
      : `${node?.dice} = ${talk.rolled}`

  return (
    <Overlay>
      <div className="modal talk-modal" style={surface}>
        <div className="panel-head">
          <span className="hand" style={{ fontSize: 16 }}>
            {/* 键是 NPC 的 `name`（V2.4 裁决 66，`role.npcs` 支持通配 `"*"`），取不到即回退该 NPC `icon` emoji */}
            <RoleGlyph sprite={roleSprite(role, 'npc', npc?.name)} assets={assets} icon={npc?.icon} />{' '}
            {npc?.name ?? talk.npc}
          </span>
        </div>

        {/* 聊天记录：**双方的对话与选择都留着**（`view.log` 只往后追加）。
            NPC 的台词靠左、玩家挑的那一条靠右（谁说的靠位置与墨色分，不靠名条 —— 这里不报幕） */}
        <div className="talk-lines" ref={linesRef}>
          {log.map((e, i) => (
            <div
              key={i}
              className={`talk-bubble${e.who === 'me' ? ' mine' : ''}${i === nowIdx ? ' now' : ''}`}
            >
              {e.who === 'npc' ? e.text || '……' : e.text}
            </div>
          ))}
          {log.length === 0 && <div className="talk-bubble now">……</div>}
        </div>

        {talk.stage === 'line' && (
          <div className="row" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
            <button className="btn primary talk-choice" style={primaryBtn} onClick={onNext}>
              继续
            </button>
          </div>
        )}

        {talk.stage === 'choose' && needsRoll && (
          <div className="talk-roll">
            {/* 本层全部答复**共用一只框**（行与行之间是分割线，不是各自描边 —— 各自描边读起来像几条台词）：
                左格是**命中区间**，右侧是答复本身 */}
            <div className="talk-optbox">
              <div className="talk-rows">
                {options.map((o) => (
                  <div
                    key={o.index}
                    className={`talk-row${hit === o.index ? ' hit' : ''}${hit !== undefined && hit !== o.index ? ' dim' : ''}`}
                  >
                    <span className="talk-hit">{o.hitLabel}</span>
                    <span className="talk-row-text">{o.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 骰子：**点它才掷**。掷完骰面停住、命中的那一条亮起，一拍之后自动接着说 */}
            <div className="talk-roll-bar">
              <button
                className="talk-die"
                title={talk.rolled === undefined ? `掷 ${node?.dice}` : `再掷 ${node?.dice}`}
                disabled={rolling || hit !== undefined}
                onClick={() => {
                  setRolling(true)
                  onRoll()
                }}
              >
                <span
                  key={rolling ? 'spinning' : `pips-${talk.rolled ?? 0}`}
                  className={`die ${rolling ? 'spinning' : 'rolled'}`}
                  style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', ...dieBody }}
                >
                  {rolling ? (spinPips ? <DieFace pips={spinPips} /> : '🎲') : talk.rolled ? <DieFace pips={talk.rolled} /> : '🎲'}
                </span>
                <span className="hand">{dieText}</span>
                {!rolling && talk.missed && <span className="badge err">未命中 · 再掷</span>}
              </button>
            </div>
          </div>
        )}

        {talk.stage === 'choose' && !needsRoll && (
          <div className="talk-options">
            {options.map((o) => (
              <button key={o.index} className="btn talk-option" style={plainBtn} onClick={() => onChoose(o.index)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  )
}
