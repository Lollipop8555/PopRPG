/**
 * 画图窗口：在创意模式里**直接改图片本身**（`skin/09-creative.md` §2.2 的补充）。
 *
 * - **改得动**：像素工具（画笔 / 橡皮 / 油漆桶 / 吸管）＋ 形状工具（直线 / 矩形 / 椭圆），
 *   外加撤销 / 重做、放大看像素格、改画布大小、清空重画；
 * - **看得清**：放大后画布上每一格就是图上一个像素，网格线落在像素边界上；旁边还有「原尺寸」与
 *   「缩到很小」两档对照，避免仅在放大状态下尚可、缩回后才发现失真；
 * - **所见即所得**：勾上「每改一笔就更新」，松手即写回工程 —— 预览页、左栏缩略图、
 *   游戏内真正用到它的地方随之更新（改的仍是同一包内路径，不产生第二份图）。
 *
 * 画布只负责显示；真正被改的是 `paint.ts` 里那份字节，所以画笔逻辑能单测。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Circle,
  Eraser,
  Grid3x3,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Save,
  Slash,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { useCreativeStore } from '../store/creative'
import { loadImageFromBytes } from './preview'
import {
  cloneBuffer,
  createBuffer,
  drawEllipse,
  drawRect,
  floodFill,
  hexToRgba,
  normalizeArea,
  pixelAt,
  plotLine,
  resizeBuffer,
  rgbaToHex,
  stamp,
  type PixelBuffer,
} from './paint'

type Tool = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse'

/** 工具分两组：一组改像素，一组拖形状 */
const TOOL_GROUPS: Array<{ title: string; hint: string; tools: Tool[] }> = [
  { title: '像素工具', hint: '一个格子就是一个像素', tools: ['brush', 'eraser', 'fill', 'eyedropper'] },
  { title: '形状工具', hint: '拖出形状，松手才落到图上', tools: ['line', 'rect', 'ellipse'] },
]

const TOOL_LABEL: Record<Tool, string> = {
  brush: '画笔',
  eraser: '橡皮',
  fill: '油漆桶',
  eyedropper: '吸管',
  line: '直线',
  rect: '矩形',
  ellipse: '椭圆',
}

const TOOL_TIP: Record<Tool, string> = {
  brush: '按住拖动：走过的格子都涂上当前颜色',
  eraser: '按住拖动：走过的格子擦成透明',
  fill: '点一下：跟这一格同色、连在一起的一整片都变色',
  eyedropper: '点一下：把这一格的颜色取来当当前颜色',
  line: '拖一条直线，松手落到图上',
  rect: '拖出一个方框；勾「实心」就是实心块',
  ellipse: '拖出一个椭圆；勾「实心」就是实心块',
}

const TOOL_ICON: Record<Tool, LucideIcon> = {
  brush: Pencil,
  eraser: Eraser,
  fill: PaintBucket,
  eyedropper: Pipette,
  line: Slash,
  rect: Square,
  ellipse: Circle,
}

/** 放大档位（1 倍就是原尺寸） */
const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24]

/** 撤销 / 重做最多记这么多步 */
const HISTORY_LIMIT = 40

/** 没给图时先给一张多大的空白 */
const BLANK_SIZE = 64

/** 透明底纹（棋盘格）：空白处一眼看出不是白，是「没像素」 */
const CHECKER: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d9d2c4 25%, transparent 25%), linear-gradient(-45deg, #d9d2c4 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, #d9d2c4 75%), linear-gradient(-45deg, transparent 75%, #d9d2c4 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
}

export interface ImageEditorProps {
  /** 正在改的这张图在包内的路径 */
  path: string
  /** 给用户看的名字（图片位置名，或按钮的某个状态） */
  title: string
  /** 起点：这张图现在的字节；没给就从空白开始 */
  bytes?: Uint8Array
  /** 空白起点的尺寸，没给按 64 × 64 */
  defaultSize?: { w: number; h: number }
  /** 每次落回工程（画一笔后自动调，或点「保存并关闭」时调） */
  onApply: (bytes: Uint8Array) => void
  onClose: () => void
}

/** 把位图画进一个画布（顺带把画布尺寸对齐位图） */
function blitTo(canvas: HTMLCanvasElement, buffer: PixelBuffer): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  if (canvas.width !== buffer.width) canvas.width = buffer.width
  if (canvas.height !== buffer.height) canvas.height = buffer.height

  let image: ImageData
  try {
    image = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height)
  } catch {
    image = ctx.createImageData(buffer.width, buffer.height)
    image.data.set(buffer.data)
  }
  ctx.putImageData(image, 0, 0)
}

/** 位图 → PNG 字节 */
async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array | undefined> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  if (blob === null) return undefined
  return new Uint8Array(await blob.arrayBuffer())
}

export default function ImageEditor({ path, title, bytes, defaultSize, onApply, onClose }: ImageEditorProps) {
  const note = useCreativeStore((s) => s.note)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const sameSizeRef = useRef<HTMLCanvasElement | null>(null)
  const smallRef = useRef<HTMLCanvasElement | null>(null)

  const bufferRef = useRef<PixelBuffer | null>(null)
  const historyRef = useRef<PixelBuffer[]>([])
  const indexRef = useRef(-1)
  const dragRef = useRef<{ tool: Tool; x0: number; y0: number; x: number; y: number } | null>(null)
  const liveRef = useRef(true)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoomIndex, setZoomIndex] = useState(6)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#8a4b2f')
  const [alpha, setAlpha] = useState(255)
  const [brushSize, setBrushSize] = useState(1)
  const [filled, setFilled] = useState(false)
  const [grid, setGrid] = useState(true)
  const [live, setLive] = useState(true)
  const [steps, setSteps] = useState({ undo: false, redo: false })
  const [unsupported, setUnsupported] = useState(false)
  const [draft, setDraft] = useState({ w: BLANK_SIZE, h: BLANK_SIZE })
  const [rev, setRev] = useState(0)

  const zoom = ZOOMS[zoomIndex]
  liveRef.current = live

  /** 位图 → 主画布 ＋ 两档对照 */
  const paintAll = useCallback(() => {
    const buffer = bufferRef.current
    const canvas = canvasRef.current
    if (buffer === null || canvas === null) return
    blitTo(canvas, buffer)

    const same = sameSizeRef.current
    if (same !== null) {
      if (same.width !== buffer.width) same.width = buffer.width
      if (same.height !== buffer.height) same.height = buffer.height
      const ctx = same.getContext('2d')
      if (ctx !== null) ctx.drawImage(canvas, 0, 0)
    }

    const small = smallRef.current
    if (small !== null) {
      const ctx = small.getContext('2d')
      if (ctx !== null) {
        ctx.clearRect(0, 0, small.width, small.height)
        ctx.imageSmoothingEnabled = false
        const scale = Math.min(small.width / buffer.width, small.height / buffer.height, 1)
        const w = Math.max(1, Math.round(buffer.width * scale))
        const h = Math.max(1, Math.round(buffer.height * scale))
        ctx.drawImage(canvas, 0, 0, buffer.width, buffer.height, 0, 0, w, h)
      }
    }
  }, [])

  /** 叠层：像素网格 ＋ 形状工具的实时预览 */
  const paintOverlay = useCallback(() => {
    const overlay = overlayRef.current
    const buffer = bufferRef.current
    if (overlay === null || buffer === null) return
    const width = buffer.width * zoom
    const height = buffer.height * zoom
    if (overlay.width !== width) overlay.width = width
    if (overlay.height !== height) overlay.height = height
    const ctx = overlay.getContext('2d')
    if (ctx === null) return
    ctx.clearRect(0, 0, width, height)

    if (grid && zoom >= 4) {
      ctx.strokeStyle = 'rgba(60, 48, 34, 0.28)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 1; x < buffer.width; x++) {
        ctx.moveTo(x * zoom + 0.5, 0)
        ctx.lineTo(x * zoom + 0.5, height)
      }
      for (let y = 1; y < buffer.height; y++) {
        ctx.moveTo(0, y * zoom + 0.5)
        ctx.lineTo(width, y * zoom + 0.5)
      }
      ctx.stroke()
    }

    const drag = dragRef.current
    if (drag === null || tool === 'brush' || tool === 'eraser') return
    const area = normalizeArea(drag.x0, drag.y0, drag.x, drag.y)
    ctx.strokeStyle = 'rgba(180, 85, 63, 0.95)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    if (tool === 'line') {
      ctx.beginPath()
      ctx.moveTo((drag.x0 + 0.5) * zoom, (drag.y0 + 0.5) * zoom)
      ctx.lineTo((drag.x + 0.5) * zoom, (drag.y + 0.5) * zoom)
      ctx.stroke()
      return
    }
    if (tool === 'rect') {
      ctx.strokeRect(area.x0 * zoom + 1, area.y0 * zoom + 1, (area.x1 - area.x0 + 1) * zoom - 2, (area.y1 - area.y0 + 1) * zoom - 2)
      return
    }
    ctx.beginPath()
    ctx.ellipse(
      ((area.x0 + area.x1 + 1) / 2) * zoom,
      ((area.y0 + area.y1 + 1) / 2) * zoom,
      Math.max(1, ((area.x1 - area.x0 + 1) / 2) * zoom - 1),
      Math.max(1, ((area.y1 - area.y0 + 1) / 2) * zoom - 1),
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }, [grid, zoom, tool])

  /** 把当前位图导出成 PNG 交给父组件（写回工程） */
  const pushOut = useCallback(async () => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const png = await canvasToPng(canvas)
    if (png === undefined) {
      note('这张图没能存成 PNG：先点「保存并关闭」，或换一个浏览器再试')
      return
    }
    onApply(png)
  }, [note, onApply])

  /** 改完一步：记进历史 ＋ 重画 ＋（按开关）立刻写回工程 */
  const commit = useCallback(() => {
    const buffer = bufferRef.current
    if (buffer === null) return
    const list = historyRef.current.slice(0, indexRef.current + 1)
    list.push(cloneBuffer(buffer))
    while (list.length > HISTORY_LIMIT) list.shift()
    historyRef.current = list
    indexRef.current = list.length - 1
    setSteps({ undo: list.length > 1, redo: false })
    setRev((value) => value + 1)
    paintAll()
    paintOverlay()
    if (liveRef.current) void pushOut()
  }, [paintAll, paintOverlay, pushOut])

  /** 退回第 `index` 步的存档 */
  const restore = useCallback(
    (index: number) => {
      const snapshot = historyRef.current[index]
      if (snapshot === undefined) return
      indexRef.current = index
      bufferRef.current = cloneBuffer(snapshot)
      setSteps({ undo: index > 0, redo: index < historyRef.current.length - 1 })
      setSize({ w: snapshot.width, h: snapshot.height })
      setRev((value) => value + 1)
      paintAll()
      paintOverlay()
      if (liveRef.current) void pushOut()
    },
    [paintAll, paintOverlay, pushOut],
  )

  const undo = useCallback(() => restore(indexRef.current - 1), [restore])
  const redo = useCallback(() => restore(indexRef.current + 1), [restore])

  /** 开窗：把现有图读进来；读不到就从空白开始 */
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null || canvas.getContext('2d') === null) {
      setUnsupported(true)
      return
    }
    let cancelled = false
    const boot = async () => {
      let buffer = createBuffer(defaultSize?.w ?? BLANK_SIZE, defaultSize?.h ?? BLANK_SIZE)
      if (bytes !== undefined) {
        const image = await loadImageFromBytes(bytes)
        if (image !== undefined && image.naturalWidth > 0) {
          const loaded = createBuffer(image.naturalWidth, image.naturalHeight)
          const scratch = document.createElement('canvas')
          scratch.width = loaded.width
          scratch.height = loaded.height
          const ctx = scratch.getContext('2d')
          if (ctx !== null) {
            ctx.drawImage(image, 0, 0)
            loaded.data.set(ctx.getImageData(0, 0, loaded.width, loaded.height).data)
            buffer = loaded
          }
        }
      }
      if (cancelled) return
      bufferRef.current = buffer
      historyRef.current = [cloneBuffer(buffer)]
      indexRef.current = 0
      setSize({ w: buffer.width, h: buffer.height })
      setDraft({ w: buffer.width, h: buffer.height })
      setRev((value) => value + 1)
      paintAll()
    }
    void boot()
    return () => {
      cancelled = true
    }
    // 只在开窗时读一次；之后所有改动都在这一份位图上做
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 尺寸 / 放大 / 网格变化时重画
  useEffect(() => {
    paintAll()
    paintOverlay()
  }, [rev, zoom, grid, size.w, size.h, paintAll, paintOverlay])

  // Ctrl/⌘ + Z 撤销，加 Shift 重做
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /** 屏幕坐标 → 图上第几个像素 */
  const toPixel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas === null) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = rect.width === 0 ? 1 : canvas.width / rect.width
    const sy = rect.height === 0 ? 1 : canvas.height / rect.height
    return { x: Math.floor((event.clientX - rect.left) * sx), y: Math.floor((event.clientY - rect.top) * sy) }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const buffer = bufferRef.current
    if (buffer === null || unsupported) return
    const point = toPixel(event)

    if (tool === 'eyedropper') {
      const picked = pixelAt(buffer, point.x, point.y)
      setColor(rgbaToHex(picked))
      setAlpha(picked[3])
      return
    }
    if (tool === 'fill') {
      if (floodFill(buffer, point.x, point.y, hexToRgba(color, alpha)) > 0) commit()
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { tool, x0: point.x, y0: point.y, x: point.x, y: point.y }
    if (tool === 'brush' || tool === 'eraser') {
      stamp(buffer, point.x, point.y, brushSize, hexToRgba(color, alpha), tool === 'eraser')
      paintAll()
      return
    }
    paintOverlay()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const buffer = bufferRef.current
    if (drag === null || buffer === null) return
    const point = toPixel(event)

    if (drag.tool === 'brush' || drag.tool === 'eraser') {
      plotLine(buffer, drag.x, drag.y, point.x, point.y, hexToRgba(color, alpha), brushSize, drag.tool === 'eraser')
      drag.x = point.x
      drag.y = point.y
      paintAll()
      return
    }
    drag.x = point.x
    drag.y = point.y
    paintOverlay()
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    const buffer = bufferRef.current
    dragRef.current = null
    if (drag === null || buffer === null) return

    if (drag.tool === 'brush' || drag.tool === 'eraser') {
      commit()
      return
    }
    const area = normalizeArea(drag.x0, drag.y0, drag.x, drag.y)
    const ink = hexToRgba(color, alpha)
    if (drag.tool === 'line') plotLine(buffer, drag.x0, drag.y0, drag.x, drag.y, ink, brushSize)
    else if (drag.tool === 'rect') drawRect(buffer, area, ink, brushSize, filled)
    else drawEllipse(buffer, area, ink, brushSize, filled)
    commit()
  }

  const changeSize = () => {
    const buffer = bufferRef.current
    if (buffer === null) return
    const w = Math.max(1, Math.min(2048, Math.round(draft.w)))
    const h = Math.max(1, Math.min(2048, Math.round(draft.h)))
    if (w === buffer.width && h === buffer.height) return
    bufferRef.current = resizeBuffer(buffer, w, h)
    setSize({ w, h })
    setDraft({ w, h })
    commit()
  }

  const clearAll = () => {
    const buffer = bufferRef.current
    if (buffer === null) return
    bufferRef.current = createBuffer(buffer.width, buffer.height)
    commit()
  }

  /** 保存并关窗：先落一份最终结果，再关闭 */
  const finish = async () => {
    await pushOut()
    onClose()
  }

  return (
    <div className="modal wide" onClick={(event) => event.stopPropagation()} style={{ width: 'min(1020px, 100%)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="panel-title">画图 · {title}</div>
        <button className="btn small" onClick={onClose} title="关掉画图窗口">
          <X size={12} />
        </button>
      </div>
      <div className="faint" style={{ marginTop: 2 }}>
        改的就是这张图（包内路径 {path}）。放大后画布上每一格就是图上的一个像素，网格线落在像素边界上。
      </div>

      {unsupported && (
        <div className="hintbox warn" style={{ marginTop: 8 }}>
          这个环境画不了图（画布只在浏览器里可用）。换浏览器打开创意模式，或用别的软件改好这张图后拖进左栏。
        </div>
      )}
      <div className="row" style={{ marginTop: 8, alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 206px' }}>
            {TOOL_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{group.title}</div>
                <div className="faint" style={{ fontSize: 11 }}>
                  {group.hint}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  {group.tools.map((key) => {
                    const Icon = TOOL_ICON[key]
                    return (
                      <button
                        key={key}
                        className={`btn small${tool === key ? ' primary' : ''}`}
                        onClick={() => setTool(key)}
                        aria-pressed={tool === key}
                        title={TOOL_TIP[key]}
                      >
                        <Icon size={12} /> {TOOL_LABEL[key]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="row" style={{ marginTop: 4 }}>
              <span className="faint" style={{ flex: '0 0 34px' }}>
                颜色
              </span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <input className="input" style={{ flex: '1 1 auto', minWidth: 70 }} value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <label className="field" style={{ marginTop: 4, marginBottom: 0 }}>
              <span className="faint">不透明 {Math.round((alpha / 255) * 100)}%</span>
              <input type="range" min={0} max={255} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
            </label>
            <label className="field" style={{ marginTop: 4, marginBottom: 0 }}>
              <span className="faint">笔尖粗细 {brushSize} 像素</span>
              <input type="range" min={1} max={16} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            </label>
            <label className="row" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={filled}
                disabled={tool !== 'rect' && tool !== 'ellipse'}
                onChange={(e) => setFilled(e.target.checked)}
              />
              <span className="faint">矩形 / 椭圆画成实心（不勾只画边）</span>
            </label>

            <div className="hline" style={{ margin: '8px 0' }} />

            <div className="faint">画布大小（改小会切掉右边和下边的像素）</div>
            <div className="row" style={{ marginTop: 4 }}>
              <input
                className="input"
                type="number"
                style={{ width: 58 }}
                value={draft.w}
                onChange={(e) => setDraft((prev) => ({ ...prev, w: Number(e.target.value) }))}
              />
              <span className="faint">×</span>
              <input
                className="input"
                type="number"
                style={{ width: 58 }}
                value={draft.h}
                onChange={(e) => setDraft((prev) => ({ ...prev, h: Number(e.target.value) }))}
              />
              <button className="btn small" onClick={changeSize}>
                改大小
              </button>
            </div>

            <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
              <button className="btn small" onClick={undo} disabled={!steps.undo}>
                <Undo2 size={12} /> 撤销
              </button>
              <button className="btn small" onClick={redo} disabled={!steps.redo}>
                <Redo2 size={12} /> 重做
              </button>
              <button className="btn small" onClick={clearAll} title="整张清成透明，重画">
                <Trash2 size={12} /> 清空
              </button>
            </div>
            <div className="faint" style={{ marginTop: 2, fontSize: 11 }}>
              快捷键：Ctrl / ⌘ ＋ Z 撤销，加 Shift 是重做
            </div>
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 240 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="faint">
                {size.w} × {size.h} 像素 · 放大 {zoom} 倍
              </span>
              <div className="row">
                <button
                  className="btn small"
                  onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  disabled={zoomIndex === 0}
                  title="缩小"
                >
                  <ZoomOut size={12} />
                </button>
                <button
                  className="btn small"
                  onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
                  disabled={zoomIndex === ZOOMS.length - 1}
                  title="放大"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
            </div>

            <div
              className="scroll"
              style={{
                ...CHECKER,
                marginTop: 4,
                maxHeight: '44vh',
                overflow: 'auto',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--radius-rough)',
                padding: 6,
              }}
            >
              <div style={{ position: 'relative', width: size.w * zoom, height: size.h * zoom }}>
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    display: 'block',
                    width: size.w * zoom,
                    height: size.h * zoom,
                    imageRendering: 'pixelated',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                />
                <canvas
                  ref={overlayRef}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: size.w * zoom,
                    height: size.h * zoom,
                    pointerEvents: 'none',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <button className={`btn small${grid ? ' primary' : ''}`} onClick={() => setGrid((v) => !v)} title="显示 / 隐藏像素网格">
                <Grid3x3 size={12} /> 像素网格
              </button>
              <button className="btn small" onClick={() => setZoomIndex(0)} title="按原尺寸看">
                <Minus size={12} /> 原尺寸
              </button>
              <button className="btn small" onClick={() => setZoomIndex(ZOOMS.length - 1)} title="放到最大，方便一格一格修">
                <Plus size={12} /> 放到最大
              </button>
            </div>
            <div className="faint" style={{ marginTop: 2, fontSize: 11 }}>
              {TOOL_TIP[tool]}
            </div>
          </div>

          <div style={{ flex: '0 0 140px' }}>
            <div className="faint">原尺寸（不放大）</div>
            <div
              style={{
                ...CHECKER,
                marginTop: 2,
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-rough)',
                padding: 4,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <canvas ref={sameSizeRef} style={{ imageRendering: 'pixelated', maxWidth: '100%' }} />
            </div>
            <div className="faint" style={{ marginTop: 6 }}>
              缩到 32 像素看
            </div>
            <div
              style={{
                ...CHECKER,
                marginTop: 2,
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-rough)',
                padding: 4,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <canvas ref={smallRef} width={32} height={32} style={{ imageRendering: 'pixelated', width: 32, height: 32 }} />
            </div>
            <div className="faint" style={{ marginTop: 6, fontSize: 11 }}>
              游戏内会按所需尺寸自动缩放；这里缩小显示，便于提前发现缩放后模糊的笔触。
            </div>
        </div>
      </div>

      <div className="hline" style={{ margin: '10px 0 8px' }} />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <label className="row">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          <span className="faint">每改一笔即写回工程：预览页与左栏缩略图随之更新</span>
        </label>
        <div className="row">
          <button className="btn small" onClick={onClose}>
            取消
          </button>
          <button className="btn small primary" onClick={() => void finish()} disabled={unsupported}>
            <Save size={12} /> 保存并关闭
          </button>
        </div>
      </div>
    </div>
  )
}
