/**
 * 游玩主界面（HUD）：地图铺满整个舞台 ——
 * 顶栏只放这一局的信息；**所有操作都在底部面板**：左=职业与血 / 蓝 + 四维雷达，
 * 中=技能格，右=常驻骰子区，最右=状态 / 背包 / 流水 / 存档 / 退出。
 */

import { useEffect, useState } from 'react'
import { Flag, Menu } from 'lucide-react'
import type { Session } from '../types/session'
import { ABILITY_KEYS, STAT_LABEL } from '../types'
import { usePlayStore } from '../store/play'
import { downloadSave } from '../io/psave'
import { canMoveAnywhere, mapName } from './flow'
import { currentNodeInfo, gateSummary } from './kit'
import MapView from './MapView'
import StatusPanel, { Bar } from './StatusPanel'
import BattleDialog from './BattleDialog'
import SkillBar from './SkillBar'
import BagPanel from './BagPanel'
import DiceLog from './DiceLog'
import EquipPanel from './EquipPanel'
import DiceHud from './DiceHud'
import RadarChart from './RadarChart'
import EncounterView from './EncounterView'
import TalkDialog from './TalkDialog'
import HeroNotice from './HeroNotice'
import Overlay from '../ui/Overlay'
import { navigate } from '../app/router'

type Drawer = 'status' | 'bag' | 'log' | 'equip' | null

export default function GameScreen({ session }: { session: Session }) {
  const play = usePlayStore()
  const pending = usePlayStore((s) => s.pendingAction)
  const [selected, setSelected] = useState<string | undefined>(session.player.skills[0]?.id)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // 技能栏被环境改动过（学了新招 / 被 forget 夺走）时，选中项跟着修正
  useEffect(() => {
    if (selected && !session.player.skills.some((s) => s.id === selected)) {
      setSelected(session.player.skills[0]?.id)
    }
  }, [session.player.skills, selected])

  // 掷骰：发起后让面板上的骰子转一会儿，转完自动结算、定格出新点数
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => play.commitRoll(), 750)
    return () => clearTimeout(t)
  }, [pending, play])

  // 对话掷骰（§4.9.2）：骰面停住、命中的那一条高亮一拍之后，自动进那一条接着说；
  // **未命中的点数不在此列** —— 停在原地等玩家再掷
  const talkHit = session.talk?.hit
  useEffect(() => {
    if (talkHit === undefined) return
    const t = setTimeout(() => play.talkHit(), 1100)
    return () => clearTimeout(t)
  }, [talkHit, play])

  const finished = session.phase === 'won' || session.phase === 'dead'
  const { player } = session
  const env = currentNodeInfo(session)
  const gate = env.gate

  return (
    <div className="play-shell game">
      {/* 顶栏：只放这一局的信息，不放操作 */}
      <div className="panel topbar">
        <span className="title hand">{session.scenario.name}</span>
        <span className="badge">{mapName(session)}</span>
        <span className="badge">第 {session.round} 回合</span>
        <span className="badge">还剩 {session.stepsLeft} 步</span>
      </div>

      <div className="play-body">
        {/* 地图 = 主视觉，铺满整屏（无边距、无边框） */}
        <div className="play-stage panel">
          <MapView
            session={session}
            onStep={(cell) => {
              if (!pending && !session.awaitingEncounter) play.step(cell)
            }}
          />
        </div>

        {/* 交锋：进入即弹出独立对话框，以文字呈现整场战斗 */}
        {session.monster && <BattleDialog session={session} />}

        {/* 对话：进入建筑的第一步（§4.8.12），弹层关掉才接着跑建筑事件 */}
        {session.talk && (
          <TalkDialog
            session={session}
            onNext={() => play.talkNext()}
            onChoose={(i) => play.talkChoose(i)}
            onRoll={() => play.talkRoll()}
            onMenu={(a) => play.talkMenu(a)}
          />
        )}

        {/* 底部悬浮栈：抽屉 / 环境提示 / 操作栏，都叠在地图上方（沉浸感） */}
        <div className="hud-bottom">
          {drawer && (
            <div className="hud-drawer">
              {drawer === 'status' && (
                <StatusPanel session={session} onAllocate={(key) => play.allocate(key)} onClose={() => setDrawer(null)} />
              )}
              {drawer === 'bag' && (
                <BagPanel
                  session={session}
                  onUse={(id) => play.use(id)}
                  onEquip={(id) => play.equip(id)}
                  onUnequip={(id) => play.unequip(id)}
                  onClose={() => setDrawer(null)}
                />
              )}
              {drawer === 'log' && <DiceLog session={session} onClose={() => setDrawer(null)} />}
              {drawer === 'equip' && (
                <EquipPanel
                  session={session}
                  onEquip={(id) => play.equip(id)}
                  onUnequip={(id) => play.unequip(id)}
                  onClose={() => setDrawer(null)}
                />
              )}
            </div>
          )}

          {!finished && (
            <div className="map-hint">
              <div className="env-row">
                <span className="env-pos">📍 {session.pos[0]},{session.pos[1]}</span>
                <span className="env-node">
                  {env.icon ? `${env.icon} ` : ''}
                  {env.name}
                </span>
                {gate && (
                  <span className="badge warn" title={gateSummary(gate)}>
                    🔒 {gateSummary(gate)}
                  </span>
                )}
                <span className="env-states">
                  {player.states.length === 0 ? (
                    <span className="faint">无状态</span>
                  ) : (
                    player.states.map((st) => (
                      <span key={st.tag} className="chip state" title={`来源：${st.source}`}>
                        {st.tag}·{st.duration}
                      </span>
                    ))
                  )}
                </span>
              </div>
              <div className="env-move faint">
                {pending
                  ? '掷骰中…'
                  : session.awaitingEncounter
                    ? '踩到遭遇 —— 点底栏骰子区的「掷骰」自己掷骰结算'
                    : session.stepsLeft > 0 && canMoveAnywhere(session)
                      ? `点地图上高亮的一格前进 · 本回合还剩 ${session.stepsLeft} 步`
                      : session.stepsLeft > 0
                        ? `还剩 ${session.stepsLeft} 步，但不足以走进任何一格 —— 点「下一回合」掷新骰`
                        : '本回合步数已用尽 —— 点底栏骰子区的「下一回合」掷新骰'}
              </div>
            </div>
          )}

          {/* 底栏：资源 + 雷达 / 技能格 / 骰子区 / 菜单，操作全在这一条上 */}
          <div className="hud-bar panel">
            <div className="hud-vitals">
              <div className="hud-face">
                {player.cls?.icon} {player.cls?.name ?? '无职业'}
              </div>
              <Bar label="hp" value={player.resources.hp} max={player.stats.hp} tone="hp" />
              <Bar label="mp" value={player.resources.mp} max={player.stats.mp} tone="mp" />
            </div>

            <div className="hud-radar">
              <RadarChart
                values={ABILITY_KEYS.map((k) => player.stats[k])}
                labels={ABILITY_KEYS.map((k) => STAT_LABEL[k])}
                size={64}
              />
            </div>

            <div className="hud-center">
              <SkillBar session={session} selected={selected} onSelect={setSelected} />
            </div>

            <DiceHud
              session={session}
              canRoll={!!(session.awaitingRound || session.awaitingEncounter) && !finished && !pending && !session.talk}
              spinning={!!pending}
              onRoll={() =>
                play.requestRoll(session.awaitingEncounter ? { kind: 'encounter' } : { kind: 'nextRound' })
              }
            />

            {/* 底栏最右：菜单入口（点击弹出独立对话框） */}
            <div className="hud-menu">
              <button className="btn small" title="菜单" onClick={() => setMenuOpen(true)}>
                <Menu size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {session.encounter && <EncounterView session={session} onBuy={(i) => play.buy(i)} onClose={() => play.close()} />}

      {/* 「主角得到了什么」浮条：对话赠予 / 商店成交这些**没有揭晓弹层**的场合，
          提示只有这一个落点 —— 压在一切弹层之上（z-index 70），选完就看得见。
          `key` 用队列长度：新一条进队 / 队头出队都换个元素，弹出的动画才会重放 */}
      {!finished && (
        <HeroNotice key={session.notices?.length ?? 0} session={session} onDismiss={() => play.dismissNotice()} />
      )}

      {/* 菜单对话框：独立浮层，不挤压底栏 */}
      {menuOpen && (
        <Overlay onClose={() => setMenuOpen(false)} align="bottom">
          <div className="modal sheet">
            <div className="panel-head" style={{ justifyContent: 'space-between' }}>
              <span className="hand">菜单</span>
              <button className="btn small" onClick={() => setMenuOpen(false)}>
                关闭
              </button>
            </div>
            <div className="sheet-actions">
              <button className="btn" onClick={() => { setDrawer('status'); setMenuOpen(false) }}>
                状态
              </button>
              <button className="btn" onClick={() => { setDrawer('bag'); setMenuOpen(false) }}>
                背包
              </button>
              <button className="btn" onClick={() => { setDrawer('log'); setMenuOpen(false) }}>
                流水
              </button>
              <button className="btn" onClick={() => { setDrawer('equip'); setMenuOpen(false) }}>
                装备
              </button>
              <button className="btn" onClick={() => { downloadSave(session); setMenuOpen(false) }}>
                存档
              </button>
              <button className="btn" onClick={() => play.quit()}>
                退出
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {finished && (
        <Overlay>
          <div className="modal">
            <div className="panel-head">
              <Flag size={16} /> <span className="hand">{session.phase === 'won' ? '走到终点 —— 这一局完成了' : '这一局到此为止'}</span>
            </div>
            <p className="muted">
              {session.phase === 'won'
                ? '抵达终点即完成本局。'
                : '生命值在回合开始判定时归零。' }
            </p>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => play.startWith(session.scenario, session.player.cls?.id ?? '')}
              >
                重新开始（同一场景）
              </button>
              <button className="btn" onClick={() => navigate('build')}>
                去构建页改一改
              </button>
              <button className="btn" onClick={() => play.quit()}>
                回到入口
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}
