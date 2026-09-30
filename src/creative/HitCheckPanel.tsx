/**
 * 命中检查清单（`skin/09-creative.md` §2.4）。
 *
 * 三栏并排回答「这份皮肤对这份靶子做到了什么」：
 * - **已命中**：不用管；
 * - **走通用**：交的是通用素材，点进去能看到它借的是哪一条；
 * - **程序绘制（缺图清单）**：每条都带**建议交付文件名**，照名交图即可被自动归属。
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
              title={`${item.slot.path}${item.via ? `（借 ${item.via}）` : ''}`}
            >
              <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12.5 }}>{item.slot.label}</span>
              {item.via !== undefined && <span className="badge warn">通用</span>}
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
        <div className="panel-title">命中检查</div>
        <div className="hintbox warn" style={{ marginTop: 6, display: 'flex', gap: 4 }}>
          <FileWarning size={12} />
          <span>先载入一份靶子 `.pmod`：清单要拿它与地图对照才知道「该有什么图」。</span>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">命中检查 · 靶子 {target.name}</div>
        <span className="faint">
          <CheckCheck size={12} /> {report.hits.length} 已命中 · <Layers size={12} /> {report.generic.length} 走通用 ·{' '}
          <FileWarning size={12} /> {report.drawn.length} 程序绘制
        </span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
        <HitList
          title="已命中"
          hint="这一份靶子需要的图，皮肤直接给到了"
          items={report.hits}
          onPick={selectSlot}
          empty="还没有任何专用素材命中"
        />
        <HitList
          title="走通用"
          hint="没配专用图，靠通用素材顶上（点了看是哪一条）"
          items={report.generic}
          onPick={selectSlot}
          empty="没有依赖通用回退的槽位"
        />
        <HitList
          title="程序绘制（缺图清单）"
          hint="一路回退到脚印 / 圆角矩形 / emoji —— 每条的「建议交付名」照名交图即自动归属"
          items={report.drawn}
          onPick={selectSlot}
          empty="全部覆盖到了"
        />
      </div>
    </div>
  )
}
