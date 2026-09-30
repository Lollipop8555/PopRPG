/**
 * 交锋对话框（§4.8.3，决策 3 / 12）：进入交锋即弹出独立对话框，以文字形式呈现整场战斗 ——
 * 怪物状态、战况文字流水（含所有电脑掷骰公示）、玩家资源、攻防操作都在框内。
 * 这是文字游戏，没有立绘；「战斗画面」就是这段可滚动的文字交锋记录。
 * 单人游戏无倒计时，引擎等玩家点；对话框不靠点空白关闭，必须把这一场打完。
 *
 * 流水按「回合」分组（决策 6：一次交锋 = 一个回合，每次交锋都打「—— 第 N 回合开始 ——」标记），
 * 每回合一条分隔标题，避免攻击 / 反击 / 掷骰混成一条乱流。
 */

import { useEffect, useRef, useState } from 'react'
import type { LogLine, Session } from '../types/session'
import { canUseSkill, costText } from '../engine/skill'
import { usePlayStore } from '../store/play'
import { useSkinStore } from '../store/skin'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useDieBodyStyle } from '../ui/useDieSkin'
import { useButtonStyle } from '../ui/useButtonStyle'
import { portraitOf, roleSprite } from '../engine/skin'
import Overlay from '../ui/Overlay'
import { RoleGlyph } from '../ui/RoleGlyph'
import { Portrait, portraitHurtTile, portraitTile } from '../ui/Portrait'
import { useHitPulse } from '../ui/useHitPulse'
import { DieFace } from './DiceLog'
import { Bar } from './StatusPanel'

/**
 * 把日志按「—— 第 N 回合开始 ——」切成一组组。
 * 标题用本场交锋的相对计数（交锋第 1 回合…），不显示全局回合数 ——
 * 全局回合数在踩怪前已含移动回合，直接拿来当交锋标题会让人误以为战斗早就开打。
 */
function groupByRound(log: LogLine[]): { tag?: string; lines: LogLine[] }[] {
  const groups: { tag?: string; lines: LogLine[] }[] = []
  let cur: { tag?: string; lines: LogLine[] } = { lines: [] }
  let k = 0
  for (const line of log) {
    const m = /^—— 第 (\d+) 回合开始 ——$/.exec(line.text)
    if (m) {
      if (cur.lines.length > 0) groups.push(cur)
      k += 1
      cur = { tag: `交锋 第 ${k} 回合`, lines: [] }
    } else {
      cur.lines.push(line)
    }
  }
  if (cur.lines.length > 0) groups.push(cur)
  return groups
}

/** 战斗流水只取「最近一次遭遇」起，避免把更早的探索日志也卷进来 */
function battleSlice(log: LogLine[]): LogLine[] {
  let start = -1
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].text.startsWith('遭遇')) {
      start = i
      break
    }
  }
  return start >= 0 ? log.slice(start) : log
}

export default function BattleDialog({ session }: { session: Session }) {
  const play = usePlayStore()
  const pending = usePlayStore((s) => s.pendingAction)
  const [selected, setSelected] = useState<string | undefined>(session.player.skills[0]?.id)
  const [spin, setSpin] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  const assets = useSkinStore((s) => s.assets)
  const role = useSkinStore((s) => s.skin?.manifest.role)
  // 对话框纸面底纹（`skin/03-window.md` §四）：未配 `surfaces.dialog` 即不传 `style`，CSS 纸面照旧
  const surface = useSurfaceStyle('dialog')
  // 骰子本体（`skin/04-misc.md` §三）：战中那两枚（定格 30 / 掷骰中 38）同吃一张
  const dieBody = useDieBodyStyle()
  // 按钮（`skin/03-window.md` §四）：操作区的主行动（攻击 / 防御 / 继续交锋）走 `primary`，
  // 「不防御」是这一场里的危险动作，走 `danger`
  const primaryBtn = useButtonStyle('primary')
  const dangerBtn = useButtonStyle('danger')

  const monster = session.monster
  if (!monster) return null

  const battleLog = battleSlice(session.log)
  const groups = groupByRound(battleLog)
  const lastRoll = session.rolls[session.rolls.length - 1]

  // 技能栏被环境改动（学了新招 / 被 forget 夺走）时，选中项跟着修正
  useEffect(() => {
    if (selected && !session.player.skills.some((s) => s.id === selected)) {
      setSelected(session.player.skills[0]?.id)
    }
  }, [session.player.skills, selected])

  // 掷骰期间点数快速滚动，营造「正在掷」的手感（底栏骰盘被对话框盖住，这里给出等价反馈）
  useEffect(() => {
    if (!pending) {
      setSpin(null)
      return
    }
    const t = setInterval(() => setSpin(1 + Math.floor(Math.random() * 6)), 70)
    return () => clearInterval(t)
  }, [pending])

  // 新回合 / 新日志就滚动到底
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [battleLog.length, groups.length])

  const player = session.player
  const foeHpPct = monster.stats.hp > 0 ? Math.max(0, monster.resources.hp / monster.stats.hp) : 0
  const canAct = session.combatStage === 'player'

  // VS 区立绘（`skin/02-role.md` §4.1 落点 2）：主角在左、怪物在右；怪物侧**不跨怪物借用**，
  // 任一方画得出来即渲染整个 VS 区，缺的一侧留空（`undefined` 即该侧为空）
  const heroOf = portraitOf(role, 'player')
  const foeOf = portraitOf(role, 'monster', monster.id)
  const heroPortrait = portraitTile(heroOf, assets)
  const foePortrait = portraitTile(foeOf, assets)

  // 受击（§4.4）：两侧各管各的，谁掉血谁抖——怪物那一侧以 `monster.id` 为主体，
  // 换了怪物只挪基准、不算是挨打（`useHitPulse()`）
  const heroHit = useHitPulse(player.resources.hp)
  const foeHit = useHitPulse(monster.resources.hp, monster.id)

  return (
    <Overlay>
      <div className="modal battle" style={surface}>
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="hand" style={{ fontSize: 16 }}>
            <RoleGlyph sprite={roleSprite(role, 'monster', monster.id)} assets={assets} icon={monster.icon} />{' '}
            {monster.name}
          </span>
          <span className="badge err">交锋中</span>
        </div>

        {/* 立绘 VS 区（`skin/02-role.md` §4.1 落点 2）：任一方有立绘即整块渲染 */}
        {(heroPortrait || foePortrait) && (
          <div className="vs-area">
            <div className="vs-side">
              <Portrait
                tile={heroPortrait}
                hurt={portraitHurtTile(heroOf, assets)}
                hit={heroHit}
                size="vs"
              />
            </div>
            <span className="vs-text hand">VS</span>
            <div className="vs-side">
              <Portrait
                tile={foePortrait}
                hurt={portraitHurtTile(foeOf, assets)}
                hit={foeHit}
                size="vs"
              />
            </div>
          </div>
        )}

        {/* 怪物状态 */}
        <div className="battle-foe">
          <div className="bar hp">
            <div className="fill" style={{ width: `${foeHpPct * 100}%` }} />
            <div className="label">
              hp {monster.resources.hp} / {monster.stats.hp}
            </div>
          </div>
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            <span className="badge">物攻 {monster.stats.patk}</span>
            <span className="badge">魔攻 {monster.stats.matk}</span>
            <span className="badge">物防 {monster.stats.pdef}</span>
            <span className="badge">魔防 {monster.stats.mdef}</span>
            <span className="badge">mp {monster.resources.mp}</span>
          </div>
          {monster.states.length > 0 && (
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              {monster.states.map((st) => (
                <span key={st.tag} className="chip state">
                  {st.tag} · {st.duration}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 战况文字流水（按回合分组，所有电脑掷骰均在框内公示） */}
        <div className="battle-log" ref={logRef}>
          {groups.map((g, gi) => (
            <div className="battle-round" key={gi}>
              {g.tag && <div className="battle-round-head">{g.tag}</div>}
              {g.lines.map((line, i) => (
                <div key={i} className={`logline ${line.tone ?? 'info'}`}>
                  {line.text}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 最近掷骰公示（骰面 + 文字） */}
        {lastRoll && (
          <div className="battle-dice">
            <span
              className="die rolled"
              style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...dieBody }}
            >
              <DieFace pips={lastRoll.pips} />
            </span>
            <span className="faint">
              最近掷骰：{lastRoll.label} {lastRoll.dice} = {lastRoll.pips}
            </span>
          </div>
        )}

        {/* 玩家资源 + 当前状态 */}
        <div className="battle-self">
          <div className="battle-vitals">
            <Bar label="hp" value={player.resources.hp} max={player.stats.hp} tone="hp" />
            <Bar label="mp" value={player.resources.mp} max={player.stats.mp} tone="mp" />
          </div>
          {player.states.length > 0 && (
            <div className="row" style={{ gap: 4 }}>
              {player.states.map((st) => (
                <span key={st.tag} className="chip state" title={`来源：${st.source}`}>
                  {st.tag} · {st.duration}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 操作区 */}
        <div className="battle-actions">
          {pending ? (
            <div className="battle-rolling">
              <span
                key="spinning"
                className="die spinning"
                style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...dieBody }}
              >
                {spin !== null ? <DieFace pips={spin} /> : '🎲'}
              </span>
              <span>掷骰中…</span>
            </div>
          ) : canAct ? (
            <>
              <div className="skill-slots">
                {player.skills.map((skill) => {
                  const usable = canUseSkill(player, skill)
                  return (
                    <button
                      key={skill.id}
                      className={`skill-slot ${selected === skill.id ? 'selected' : ''}`}
                      disabled={!usable}
                      onClick={() => setSelected(skill.id)}
                      title={`${skill.name}　成本：${costText(skill.cost)}`}
                    >
                      <span className="skill-ico">{skill.icon ?? '✦'}</span>
                      <span className="skill-name">{skill.name}</span>
                    </button>
                  )
                })}
              </div>
              <button
                className="btn primary"
                style={primaryBtn}
                disabled={!selected}
                onClick={() => selected && play.requestRoll({ kind: 'attack', skillId: selected })}
              >
                {selected ? '攻击' : '先选一招'}
              </button>
            </>
          ) : session.combatStage === 'defend' ? (
            <>
              <div className="hand" style={{ fontSize: 13 }}>
                进入反击阶段，请选择是否防御
              </div>
              <button
                className="btn primary"
                style={primaryBtn}
                onClick={() => play.requestRoll({ kind: 'defend', willDefend: true })}
              >
                防御（掷防骰）
              </button>
              <button
                className="btn danger"
                style={dangerBtn}
                onClick={() => play.requestRoll({ kind: 'defend', willDefend: false })}
              >
                不防御
              </button>
            </>
 ) : (
            <>
              <div className="faint">本回合交锋已结束</div>
              <button className="btn primary" style={primaryBtn} onClick={() => play.nextRound()}>
                下一回合（继续交锋）
              </button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  )
}
