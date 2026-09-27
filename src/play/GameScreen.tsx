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
import { mapName } from './flow'
import MapView from './MapView'
import StatusPanel, { Bar } from './StatusPanel'
import CombatPanel from './CombatPanel'
import SkillBar from './SkillBar'
import BagPanel from './BagPanel'
import DiceLog from './DiceLog'
import DiceHud from './DiceHud'
import RadarChart from './RadarChart'
import EncounterView from './EncounterView'
import Overlay from '../ui/Overlay'
import { navigate } from '../app/router'

type Drawer = 'status' | 'bag' | 'log' | null

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

  const finished = session.phase === 'won' || session.phase === 'dead'
  const { player } = session
  const canAct = session.phase === 'combat' && session.combatStage === 'player'

  return (
    <div className="play-shell">
      {/* 顶栏：只放这一局的信息，不放操作 */}
      <div className="panel topbar">
        <span className="title hand">{session.scenario.name}</span>
        <span className="badge">{mapName(session)}</span>
        <span className="badge">第 {session.round} 回合</span>
        <span className="badge">还剩 {session.stepsLeft} 步</span>
      </div>

      <div className="play-body">
        {/* 地图 = 主视觉，铺满整个舞台 */}
        <div className="play-stage panel">
          <MapView session={session} onStep={(cell) => { if (!pending) play.step(cell) }} />
          {!finished && (
            <div className="map-hint">
              {pending
                ? '掷骰中…'
                : session.stepsLeft > 0
                  ? `点地图上高亮的一格前进 · 本回合还剩 ${session.stepsLeft} 步`
                  : '本回合步数已用尽 —— 点底栏骰子区的「下一回合」掷新骰'}
            </div>
          )}
        </div>

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
          </div>
        )}

        {/* 交锋：悬浮在底栏上方 */}
        {session.monster && (
          <div className="hud-combat">
            <CombatPanel session={session} onDefend={(will) => play.requestRoll({ kind: 'defend', willDefend: will })} />
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
            {canAct && (
              <button
                className="btn primary"
                disabled={!!pending}
                onClick={() => selected && play.requestRoll({ kind: 'attack', skillId: selected })}
              >
                {selected ? '攻击' : '先选一招'}
              </button>
            )}
          </div>

          <DiceHud
            session={session}
            canRoll={!!session.awaitingRound && !finished && !pending}
            spinning={!!pending}
            onRoll={() => play.requestRoll({ kind: 'nextRound' })}
          />

          {/* 底栏最右：菜单入口（点击弹出独立对话框） */}
          <div className="hud-menu">
            <button className="btn small" title="菜单" onClick={() => setMenuOpen(true)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      {session.encounter && <EncounterView session={session} onBuy={(i) => play.buy(i)} onClose={() => play.close()} />}

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
