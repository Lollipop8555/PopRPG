/**
 * 「主角得到了什么」的**唯一渲染**（§4.8.5 / §4.8.9 / §4.9.2）。
 *
 * 一份 `GainNote` 有两种密度，**同一份数据、同一处措辞**（`gainLines()`）：
 * - `compact`：浮条里的一行一句（对话赠予 / 商店成交，`HeroNotice` 用）
 * - 缺省：遭遇弹层里那块「获得」（大卡片 ＋ 属性点 ＋ 没拿下的），`EncounterView` 用
 *
 * 于是"得到东西"这件事在**任何场合都是同一张脸** —— 玩家不用在两套说法之间转换。
 */

import type { GainNote } from '../types/session'
import { gainLines } from './gain'

export default function GainNoteView({ note, compact = false }: { note: GainNote; compact?: boolean }) {
  if (compact) {
    return (
      <div className="gain-lines">
        {gainLines(note).map((line, i) => (
          <div key={i} className={`gain-line${line.tone === 'bad' ? ' bad' : ''}`}>
            {line.text}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {note.items.length > 0 && (
        <div className="reward-block">
          <div className="reward-title">获得</div>
          <div className="reward-grid">
            {note.items.map((it, i) => (
              <div key={i} className="reward-card" title={it.name}>
                <span className="reward-ico">{it.icon || '❔'}</span>
                <span className="reward-name">{it.name}</span>
                <span className="reward-count">×{it.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {note.points > 0 && (
        <div className="row" style={{ gap: 4, marginTop: 6 }}>
          <span className="badge on">自由属性点 +{note.points}</span>
        </div>
      )}

      {note.losses.length > 0 && (
        <div className="hintbox warn" style={{ marginTop: 4 }}>
          {note.losses.map((lo, i) => (
            <div key={i}>
              {lo.icon}
              {lo.name} 没拿下：{lo.reason}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
