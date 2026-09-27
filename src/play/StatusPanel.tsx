/**
 * 状态面板（§7.1 / §4.2.2 / §4.8.10）：血量法力、属性加点、身上的状态。
 * 加点是**随时可加、不可洗点、余点保留** —— 所以这里**没有重置按钮**（这是有意的）。
 */

import type { StatKey } from '../types'
import { STAT_KEYS, STAT_LABEL } from '../types'
import type { Session } from '../types/session'
import { freePoints } from './flow'

export default function StatusPanel({
  session,
  onAllocate,
}: {
  session: Session
  onAllocate: (key: StatKey) => void
}) {
  const { player } = session
  const free = freePoints(session)
  const caps = [...player.tags, ...player.equipped.flatMap((e) => e.tags ?? []), ...player.states.map((s) => s.tag)]

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>
          {player.cls?.icon} {player.cls?.name ?? '无职业'}
        </span>
        <span className="badge">第 {session.round} 回合</span>
      </div>

      <Bar label="hp" value={player.resources.hp} max={player.stats.hp} tone="hp" />
      <Bar label="mp" value={player.resources.mp} max={player.stats.mp} tone="mp" />

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <span className="faint">剩余自由点</span>
        <span className="badge on">{free}</span>
      </div>

      <div style={{ marginTop: 4 }}>
        {STAT_KEYS.map((key) => (
          <div key={key} className="statline">
            <span className="faint">{STAT_LABEL[key]}</span>
            <span>{player.stats[key]}</span>
            {player.buffs[key] !== undefined && player.buffs[key] !== 100 && (
              <span className="faint">×{Math.round((player.buffs[key] ?? 100))}%</span>
            )}
            <button
              className="btn small"
              disabled={free <= 0}
              onClick={() => onAllocate(key)}
              title="每点等价于属性 +1，分配后不可撤销"
            >
              +
            </button>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 4, marginTop: 6 }}>
        {player.states.length === 0 ? (
          <span className="faint">身上没有状态</span>
        ) : (
          player.states.map((st) => (
            <span key={st.tag} className="chip state" title={`来源：${st.source}`}>
              {st.tag} · {st.duration} 回合
            </span>
          ))
        )}
      </div>

      {caps.length > 0 && (
        <div className="row" style={{ gap: 4, marginTop: 4 }}>
          <span className="faint">能力：</span>
          {[...new Set(caps)].map((tag) => (
            <span key={tag} className="chip good">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'hp' | 'mp' }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={`bar ${tone}`} style={{ marginBottom: 4 }}>
      <div className="fill" style={{ width: `${pct * 100}%` }} />
      <div className="label">
        {label} {value} / {max}
      </div>
    </div>
  )
}
