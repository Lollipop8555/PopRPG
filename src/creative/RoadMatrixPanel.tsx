/**
 * 道路 flag 矩阵（`skin/09-creative.md` §2.4）。
 *
 * 256 个邻接组合（8 位）按 **16 × 16** 铺开：行 ＝ 高 4 位、列 ＝ 低 4 位。
 * 每格显示它命中的**槽位**与**姿态**（旋转），空格即缺图位置，**点一下就跳到那个槽位**去绑素材。
 *
 * 两种看法：
 * - **按 flag**：一格一个组合，用于逐格核对；
 * - **按姿态**：把组合按「槽位 ＋ 旋转」归并，用于确认**旋转复用**没串位
 *   （`skin/01-road.md` §四：同一张图靠旋转覆盖同槽位的多个组合）。
 */

import { useMemo } from 'react'
import { useCreativeStore } from '../store/creative'
import { flagMatrix, flagMatrixRows, poseGroups } from './hits'
import { ROAD_SLOT_LABEL } from './slots'

function cellTone(used: boolean, filled: boolean): string {
  if (used && filled) return 'var(--green, #6a8f6a)'
  if (used) return 'var(--red, #b4553f)'
  if (filled) return 'var(--paper-deep)'
  return 'transparent'
}

export default function RoadMatrixPanel() {
  const manifest = useCreativeStore((s) => s.manifest)
  const target = useCreativeStore((s) => s.target)
  const roadView = useCreativeStore((s) => s.roadView)
  const setRoadView = useCreativeStore((s) => s.setRoadView)
  const selectSlot = useCreativeStore((s) => s.selectSlot)

  const cells = useMemo(() => flagMatrix(manifest, target), [manifest, target])
  const rows = useMemo(() => flagMatrixRows(cells), [cells])
  const groups = useMemo(() => poseGroups(target), [target])

  const usedCount = cells.filter((cell) => cell.used).length
  const filledUsed = cells.filter((cell) => cell.used && cell.filled).length

  return (
    <div className="scroll" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">道路 flag 矩阵</div>
        <div className="row">
          <button className={`btn small${roadView === 'flag' ? ' primary' : ''}`} onClick={() => setRoadView('flag')}>
            按 flag
          </button>
          <button className={`btn small${roadView === 'pose' ? ' primary' : ''}`} onClick={() => setRoadView('pose')}>
            按姿态
          </button>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 4 }}>
        {target
          ? `靶子用到 ${usedCount} 个组合，其中 ${filledUsed} 个已绑定素材`
          : '尚未载入靶子：全部 256 个组合都按「未用到」显示'}
      </div>

      {roadView === 'flag' ? (
        <div style={{ marginTop: 8, overflowX: 'auto' }}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="row" style={{ gap: 2, marginBottom: 2, flexWrap: 'nowrap' }}>
              {row.map((cell) => (
                <button
                  key={cell.flag}
                  onClick={() => selectSlot(`road.tiles.${cell.slot}`)}
                  title={`flag ${cell.flag} ＝ ${ROAD_SLOT_LABEL[cell.slot]} · 旋转 ${cell.rotate}°${
                    cell.used ? '（靶子用到）' : ''
                  }${cell.filled ? ' · 已绑定' : ' · 缺图'}`}
                  style={{
                    width: 20,
                    height: 20,
                    flex: '0 0 20px',
                    padding: 0,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: `1px solid ${cell.used ? 'var(--ink)' : 'var(--line-soft, var(--line))'}`,
                    background: cellTone(cell.used, cell.filled),
                  }}
                />
              ))}
              <span className="faint" style={{ marginLeft: 6, fontSize: 11 }}>
                {rowIndex * 16}–{rowIndex * 16 + 15}
              </span>
            </div>
          ))}
          <div className="faint" style={{ marginTop: 6 }}>
            行 ＝ 高 4 位、列 ＝ 低 4 位；绿＝已绑定，红＝靶子用到但缺图，深底＝用到之外的多余绑定
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {groups.map((group) => (
            <div
              key={`${group.slot}@${group.rotate}`}
              className="kit-row"
              style={{ marginTop: 3 }}
              onClick={() => selectSlot(`road.tiles.${group.slot}`)}
              title={`覆盖 ${group.flags.length} 个组合`}
            >
              <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12.5 }}>
                {ROAD_SLOT_LABEL[group.slot]} · 旋转 {group.rotate}°
              </span>
              <span className="faint">{group.flags.length} 个组合</span>
            </div>
          ))}
          <div className="faint" style={{ marginTop: 6 }}>
            一个槽位被多个旋转共用时，只要交一张基准姿态的图，运行期自行旋转
          </div>
        </div>
      )}
    </div>
  )
}
