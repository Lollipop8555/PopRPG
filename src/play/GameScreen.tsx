/**
 * 游玩主界面：地图 + 状态 / 交锋 / 技能 / 背包 + 流水。
 * 顶栏只放「这一局」的事：局名、地图、回合与步数、下一回合、存档、退出。
 */

import { useEffect, useState } from 'react'
import { Flag, LogOut, Save, StepForward } from 'lucide-react'
import type { Session } from '../types/session'
import { usePlayStore } from '../store/play'
import { downloadSave } from '../io/psave'
import { mapName } from './flow'
import MapView from './MapView'
import StatusPanel from './StatusPanel'
import CombatPanel from './CombatPanel'
import SkillBar from './SkillBar'
import BagPanel from './BagPanel'
import DiceLog from './DiceLog'
import EncounterView from './EncounterView'
import Overlay from '../ui/Overlay'
import { navigate } from '../app/router'

export default function GameScreen({ session }: { session: Session }) {
  const play = usePlayStore()
  const [selected, setSelected] = useState<string | undefined>(session.player.skills[0]?.id)

  // 技能栏被环境改动过（学了新招 / 被 forget 夺走）时，选中项跟着修正
  useEffect(() => {
    if (selected && !session.player.skills.some((s) => s.id === selected)) {
      setSelected(session.player.skills[0]?.id)
    }
  }, [session.player.skills, selected])

  const finished = session.phase === 'won' || session.phase === 'dead'

  return (
    <div className="play-shell">
      <div className="panel topbar">
        <span className="title hand">{session.scenario.name}</span>
        <span className="badge">{mapName(session)}</span>
        <span className="badge">第 {session.round} 回合</span>
        <span className="badge">还剩 {session.stepsLeft} 步</span>

        <button
          className="btn small primary"
          disabled={!session.awaitingRound || finished}
          onClick={() => play.nextRound()}
          title="步数全部用尽 / 完成一次交锋 = 一个回合"
        >
          <StepForward size={13} /> 下一回合
        </button>
        <button className="btn small" onClick={() => downloadSave(session)} title="导出 .psave 进度">
          <Save size={13} /> 存档
        </button>
        <button className="btn small" onClick={() => play.quit()}>
          <LogOut size={13} /> 退出
        </button>
      </div>

      <div className="play-body">
        <div className="play-main">
          <div className="panel" style={{ padding: 4 }}>
            <MapView session={session} onStep={(cell) => play.step(cell)} />
          </div>
          <DiceLog session={session} />
        </div>

        <div className="play-side">
          <StatusPanel session={session} onAllocate={(key) => play.allocate(key)} />
          {session.monster && <CombatPanel session={session} onDefend={(will) => play.defend(will)} />}
          <SkillBar
            session={session}
            selected={selected}
            onSelect={setSelected}
            onAttack={() => selected && play.attack(selected)}
          />
          <BagPanel
            session={session}
            onUse={(id) => play.use(id)}
            onEquip={(id) => play.equip(id)}
            onUnequip={(id) => play.unequip(id)}
          />
        </div>
      </div>

      {session.encounter && <EncounterView session={session} onBuy={(i) => play.buy(i)} onClose={() => play.close()} />}

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
