/**
 * 还缺哪些图清单（`skin/09-creative.md` §2.4）。
 *
 * 三栏并排回答「这份皮肤对这份参照的游戏做到了什么」：
 * - **已给图**：不用管；
 * - **用通用图**：交的是通用素材，点进去能看到它借的是哪一条；
 * - **程序默认画法（还缺的图）**：每条都带**建议交付文件名**，文件名符合命名约定的即会自动绑定。
 */

import { useMemo } from 'react'
import { CheckCheck, FileWarning, Layers } from 'lucide-react'
import { useCreativeStore } from '../store/creative'
import { hitCheck, type SlotHit } from './hits'
import { useCreativeSlots } from './useCreative'

function HitList({
  title,
  hint,
  items,
  onPick,
  empty,
}: {
  title: string
  hint: string
  items: SlotHit[]
  onPick: (path: string) => void
  empty: string
}) {
  return (
    <div className="panel" style={{ flex: '1 1 240px', minWidth: 220 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title" style={{ fontSize: 13 }}>{title}</div>
        <span className="faint">{items.length}</span>
      </div>
      <div className="faint" style={{ marginTop: 2 }}>{hint}</div>
      <div style={{ marginTop: 6 }}>
        {items.length === 0 ? (
          <div className="faint">{empty}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.slot.path}
              className="kit-row"
              style={{ marginTop: 3 }}
              onClick={() => onPick(item.slot.path)}
              title={`${item.slot.path}${item.via ? `（借用 ${item.via}）` : ''}`}
            >
              <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12.5 }}>{item.slot.label}</span>
              {item.via !== undefined && <span className="badge warn">用通用图</span>}
              {item.slot.suggest !== '' && (
                <span className="faint truncate" style={{ maxWidth: 110, fontSize: 11 }} title={item.slot.suggest}>
                  {item.slot.suggest.replace(/^resource\//, '')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function HitCheckPanel() {
  const slots = useCreativeSlots()
  const manifest = useCreativeStore((s) => s.manifest)
  const target = useCreativeStore((s) => s.target)
  const selectSlot = useCreativeStore((s) => s.selectSlot)

  const report = useMemo(() => hitCheck(manifest, slots), [manifest, slots])

  if (!target) {
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="panel-title">还缺哪些图</div>
        <div className="hintbox warn" style={{ marginTop: 6, display: 'flex', gap: 4 }}>
          <FileWarning size={12} />
          <span>先选一份游戏包（.pmod）。拿它跟你的皮肤对照，才知道哪些图是必需的。</span>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">还缺哪些图 · 参照「{target.name}」</div>
        <span className="faint">
          <CheckCheck size={12} /> {report.hits.length} 已命中 · <Layers size={12} /> {report.generic.length} 走通用 ·{' '}
          <FileWarning size={12} /> {report.drawn.length} 程序绘制
        </span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
        <HitList
          title="已命中"
          hint="这一处有专用素材，游戏按它渲染"
          items={report.hits}
          onPick={selectSlot}
          empty="还没有任何位置绑定专用素材"
        />
        <HitList
          title="走通用"
          hint="这一处空着，游戏回退到同类通用素材（点一下可查看是哪张）"
          items={report.generic}
          onPick={selectSlot}
          empty="没有需要回退到通用素材的位置"
        />
        <HitList
          title="程序绘制"
          hint="这一处游戏要用，当前没有素材，按程序默认画法渲染（脚印 / 圆角矩形 / emoji）。按每条给出的文件名补上，即会自动绑定"
          items={report.drawn}
          onPick={selectSlot}
          empty="所有位置都已有图"
        />
      </div>
    </div>
  )
}
