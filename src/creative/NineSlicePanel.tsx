/**
 * 九宫格切分工具（`skin/09-creative.md` §2.3；裁决 21）。
 *
 * 四根参考线可以**拖**也可以**填数**，两者写的是同一个 `slice`。
 * 辅助三件：**黑边识别**（`.9.png` 的 1px 标记，只读不写）、**成对校验**（中区被吃穿时当场标红）、
 * **另存九张切片**（裁好下载，命名 `<原名>_9_<块名>.png`）。
 *
 * 两条边界如实写在界面上：**不改渲染规则**（写回的就是 `slice`，V1 渲染照旧），
 * 以及 `fill` —— V1 的 DOM 层恒定带 `fill`（`03-window.md` §二），故此处只作「导出切片是否含中心块」的选项，
 * **不写进 manifest**（不给格式加没有裁决的字段）。
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Download, Scan, Undo2 } from 'lucide-react'
import { downloadBlob } from '../io/download'
import { useCreativeStore } from '../store/creative'
import { loadImageFromBytes } from './preview'
import {
  NO_LINES,
  SLICE_PARTS,
  detectNineBorders,
  nineRegions,
  normalizeLines,
  regionOf,
  sliceFileName,
  validLines,
  type NineLines,
} from './nine'

type Edge = 'top' | 'right' | 'bottom' | 'left'

export interface NineSlicePanelProps {
  /** 这张图的包内路径（也是写回 `slice` 时那个对象里的 `img`） */
  path: string
  /** 当前四线 */
  lines: NineLines
  /** 四线变了就写回（父组件负责写 manifest） */
  onChange: (lines: NineLines) => void
}

const EDGES: Edge[] = ['top', 'right', 'bottom', 'left']

function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

export default function NineSlicePanel({ path, lines, onChange }: NineSlicePanelProps) {
  const assets = useCreativeStore((s) => s.assets)
  const note = useCreativeStore((s) => s.note)

  const bytes = assets[path]
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [withCenter, setWithCenter] = useState(true)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const linesRef = useRef(lines)
  linesRef.current = lines

  const url = useMemo(() => {
    if (bytes === undefined || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
    return URL.createObjectURL(new Blob([bytes as BlobPart]))
  }, [bytes])

  useEffect(() => {
    return () => {
      if (url !== undefined) URL.revokeObjectURL(url)
    }
  }, [url])

  const regions = size.w > 0 && size.h > 0 ? nineRegions(size.w, size.h, lines) : undefined
  const valid = size.w > 0 && size.h > 0 ? validLines(size.w, size.h, lines) : true

  const startDrag = (edge: Edge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const box = boxRef.current
    if (!box || size.w === 0 || size.h === 0) return
    const rect = box.getBoundingClientRect()

    const move = (ev: PointerEvent) => {
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const raw =
        edge === 'left'
          ? (px / rect.width) * size.w
          : edge === 'right'
            ? ((rect.width - px) / rect.width) * size.w
            : edge === 'top'
              ? (py / rect.height) * size.h
              : ((rect.height - py) / rect.height) * size.h
      onChange(normalizeLines({ ...linesRef.current, [edge]: raw }, size.w, size.h))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const setEdge = (edge: Edge, value: number) =>
    onChange(normalizeLines({ ...lines, [edge]: value }, size.w, size.h))

  const detect = async () => {
    if (bytes === undefined || size.w === 0 || size.h === 0) return
    const image = await loadImageFromBytes(bytes)
    if (!image) {
      note('黑边识别需要浏览器能解码这张图')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = size.w
    canvas.height = size.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, size.w, size.h).data
    const found = detectNineBorders(size.w, size.h, (x, y) => {
      const i = (y * size.w + x) * 4
      return [data[i], data[i + 1], data[i + 2], data[i + 3]]
    })
    if (!found) {
      note('这张图最外一圈没有 `.9.png` 的黑边标记')
      return
    }
    onChange(found)
    note(`已按黑边标记摆好参考线：上 ${found.top} · 右 ${found.right} · 下 ${found.bottom} · 左 ${found.left}`)
  }

  const saveSlices = async () => {
    if (bytes === undefined || !regions) return
    const image = await loadImageFromBytes(bytes)
    if (!image) {
      note('另存切片需要浏览器能解码这张图')
      return
    }
    let count = 0
    for (const part of SLICE_PARTS) {
      if (part === 'center' && !withCenter) continue
      const rect = regionOf(regions, part)
      if (!rect || rect.w <= 0 || rect.h <= 0) continue
      const canvas = document.createElement('canvas')
      canvas.width = rect.w
      canvas.height = rect.h
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
      if (!blob) continue
      downloadBlob(sliceFileName(baseName(path), part), new Uint8Array(await blob.arrayBuffer()))
      count += 1
    }
    note(`已另存 ${count} 张切片`)
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title" style={{ fontSize: 13 }}>
          九宫格切分
        </div>
        <span className="faint">{size.w > 0 ? `${size.w} × ${size.h}` : '读图中…'}</span>
      </div>

      <div
        ref={boxRef}
        style={{
          position: 'relative',
          marginTop: 6,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--radius-rough)',
          overflow: 'hidden',
          background: 'var(--paper-card)',
        }}
      >
        {url !== undefined ? (
          <img
            src={url}
            alt="待切分的容器素材"
            style={{ display: 'block', width: '100%', height: 'auto' }}
            onLoad={(e) => {
              const image = e.currentTarget
              setSize({ w: image.naturalWidth, h: image.naturalHeight })
            }}
          />
        ) : (
          <div className="hintbox warn" style={{ margin: 8 }}>
            这个槽位还没有素材字节，读不到图就无法切分
          </div>
        )}

        {url !== undefined &&
          size.w > 0 &&
          EDGES.map((edge) => {
            const vertical = edge === 'left' || edge === 'right'
            const position = edge === 'left' ? lines.left : edge === 'right' ? size.w - lines.right : edge === 'top' ? lines.top : size.h - lines.bottom
            const percent = edge === 'left' || edge === 'right' ? (position / size.w) * 100 : (position / size.h) * 100
            return (
              <div
                key={edge}
                onPointerDown={startDrag(edge)}
                title={`拖动 ${edge} 线`}
                style={{
                  position: 'absolute',
                  ...(vertical
                    ? { left: `${percent}%`, top: 0, bottom: 0, width: 8, marginLeft: -4, cursor: 'ew-resize' }
                    : { top: `${percent}%`, left: 0, right: 0, height: 8, marginTop: -4, cursor: 'ns-resize' }),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    ...(vertical ? { width: 1.5, height: '100%' } : { height: 1.5, width: '100%' }),
                    background: 'var(--accent, #b4553f)',
                    opacity: 0.85,
                  }}
                />
              </div>
            )
          })}
      </div>

      <div className="grid2" style={{ marginTop: 6 }}>
        {EDGES.map((edge) => (
          <label className="field" key={edge} style={{ marginBottom: 0 }}>
            <span className="faint">{edge === 'top' ? '上' : edge === 'right' ? '右' : edge === 'bottom' ? '下' : '左'}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={lines[edge]}
              onChange={(e) => setEdge(edge, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      {!valid && <div className="hintbox error" style={{ marginTop: 6 }}>中区被吃穿了（上 ＋ 下 ≥ 图高，或左 ＋ 右 ≥ 图宽）。仍可导出，但渲染会退化。</div>}

      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => void detect()}>
          <Scan size={12} /> 识别黑边
        </button>
        <button className="btn small" onClick={() => onChange({ ...NO_LINES })}>
          <Undo2 size={12} /> 清零
        </button>
        <button className="btn small" onClick={() => void saveSlices()}>
          <Download size={12} /> 另存九张切片
        </button>
      </div>
      <label className="row" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={withCenter} onChange={(e) => setWithCenter(e.target.checked)} />
        <span className="faint">另存时含中心块（V1 渲染恒定带 `fill`，此项只影响导出的切片文件）</span>
      </label>
    </div>
  )
}
