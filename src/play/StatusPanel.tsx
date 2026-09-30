/**
 * 状态面板（§7.1 / §4.2.2 / §4.8.10）：血量法力、属性加点、身上的状态。
 * 加点是**随时可加、不可洗点、余点保留** —— 所以这里**没有重置按钮**（这是有意的）。
 */

import { X } from 'lucide-react'
import type { StatKey } from '../types'
import { ABILITY_KEYS, STAT_KEYS, STAT_LABEL } from '../types'
import type { Session } from '../types/session'
import { freePoints } from './flow'
import RadarChart from './RadarChart'
import { portraitOf, roleSprite } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { RoleGlyph } from '../ui/RoleGlyph'
import { Portrait, portraitTile } from '../ui/Portrait'

export default function StatusPanel({
  session,
  onAllocate,
  onClose,
}: {
  session: Session
  onAllocate: (key: StatKey) => void
  onClose?: () => void
}) {
  const { player } = session
  const free = freePoints(session)
  const caps = [...player.tags, ...player.equipped.flatMap((e) => e.tags ?? []), ...player.states.map((s) => s.tag)]
  // 职业形象（`skin/02-role.md` §三）：有素材出图，缺位就是原来的 `icon` emoji
  const assets = useSkinStore((s) => s.assets)
  const role = useSkinStore((s) => s.skin?.manifest.role)
  // 落到面板头的立绘与底栏同源同图（§4.1 落点 4）：取不到即整块不渲染、留 emoji ＋ 名称
  const headPortrait = portraitTile(portraitOf(role, 'player'), assets)

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        {/* 与底栏同源同图：立绘在则替代 emoji ＋ 职业名（§4.1 落点 4） */}
        {headPortrait ? (
          <Portrait tile={headPortrait} size="hud" />
        ) : (
          <span>
            <RoleGlyph sprite={roleSprite(role, 'class', player.cls?.id)} assets={assets} icon={player.cls?.icon} />{' '}
            {player.cls?.name ?? '无职业'}
          </span>
        )}
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="badge">第 {session.round} 回合</span>
          {onClose && (
            <button className="btn small" title="关闭" onClick={onClose} style={{ padding: '0 6px' }}>
              <X size={14} />
            </button>
          )}
        </span>
      </div>

      <Bar label="hp" value={player.resources.hp} max={player.stats.hp} tone="hp" />
      <Bar label="mp" value={player.resources.mp} max={player.stats.mp} tone="mp" />

      {/* 四维能力雷达（物攻 / 魔攻 / 物防 / 魔防） */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
        <RadarChart
          values={ABILITY_KEYS.map((k) => player.stats[k])}
          labels={ABILITY_KEYS.map((k) => STAT_LABEL[k])}
          size={132}
        />
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <span className="faint">剩余自由点</span>
        <span className="badge on">{free}</span>
      </div>

      <div className="stat-grid">
        {STAT_KEYS.map((key) => (
          <div key={key} className="statline">
            <span className="faint">{STAT_LABEL[key]}</span>
            <span>{player.stats[key]}</span>
            <span className="faint">
              {player.buffs[key] !== undefined && player.buffs[key] !== 100
                ? `×${Math.round(player.buffs[key] ?? 100)}%`
                : ''}
            </span>
            <button
              className="btn small"
              disabled={free <= 0}
              onClick={() => onAllocate(key)}
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

export function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'hp' | 'mp' }) {
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
