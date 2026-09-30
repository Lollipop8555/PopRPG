/**
 * 创意模式右栏这一处怎么填：**一个图片位置怎么填**（`skin/09-creative.md` §2.2 / §2.3）。
 *
 * 按图片位置类型分派编辑器，形状**严格照类型定义**，不做超集：
 * - 图引用对象只出现各节真正允许的修饰（`slice` 归容器、`fit` 归封面、`rotate` 归可旋元素）；
 * - 「三写法」只给真正允许数组的图片位置（`road.tiles.*` / `role.player` / `misc.marks.*`）——
 *   `role.classes` / `monsters` / `npcs` 明确不接受数组，故这里不给四向。
 */

import { useState } from 'react'
import { Download, Link2, Music, Palette, Pencil, SlidersHorizontal, Type, Unlink } from 'lucide-react'
import type { SkinFit, SkinImage } from '../types'
import { pickBinaryFile } from '../io/download'
import { assetPathFor, useCreativeStore } from '../store/creative'
import { KIND_LABEL, readSlot, variationPath, type SlotKind } from './slots'
import { linesOfSlice, sliceOf, type NineLines } from './nine'
import ImageEditor from './ImageEditor'
import NineSlicePanel from './NineSlicePanel'
import Overlay from '../ui/Overlay'
import SlotLocation from './SlotLocation'
import { useCreativeSlots, useSelectedSlot } from './useCreative'
import { useBytesUrl } from './useBytesUrl'

/** 各类型的取文件口径 */
const ACCEPT: Record<SlotKind, string> = {
  image: 'image/*',
  texture: 'image/*',
  sprite: 'image/*',
  portrait: 'image/*',
  ground: 'image/*',
  button: 'image/*',
  audio: 'audio/*',
  color: '',
  font: '.ttf,.otf,.woff,.woff2',
}

const FIT_OPTIONS: SkinFit[] = ['cover', 'contain', 'tile']

/** 拉伸方式的中文名（界面上不出现英文选项） */
const FIT_LABEL: Record<SkinFit, string> = {
  cover: '铺满并裁掉多余（图不会变形）',
  contain: '完整放入（可能留白边）',
  tile: '平铺重复',
}

/** 按钮四种状态的中文名 */
const STATE_LABEL: Record<'normal' | 'hover' | 'active' | 'disabled', string> = {
  normal: '普通',
  hover: '悬停',
  active: '按下',
  disabled: '禁用',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 取任意写法下的「主图路径」 */
function asPath(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (isRecord(value) && typeof value['img'] === 'string') return value['img']
  return undefined
}

/** 取图引用对象形态 */
function asObject(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

/**
 * 绑定后**同一屏**给一眼「缩略图 ＋ 原始尺寸」（`09-creative.md` §2.2）。
 *
 * 目标尺寸 / 是否成整倍数**暂不显示**：设计侧还没有各图片位置的**目标尺寸表**（文档里只有尺寸行，
 * 没有机器可读数据），凭空造一张表等于替设计做决定，故这里如实留白。
 */
function AssetThumb({ path, bytes }: { path: string; bytes?: Uint8Array }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const url = useBytesUrl(bytes)

  return (
    <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'flex-start' }}>
      <div
        style={{
          flex: '0 0 72px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-rough)',
          overflow: 'hidden',
          background: 'var(--paper-card)',
        }}
      >
        {url !== undefined && (
          <img
            src={url}
            alt={path}
            style={{ display: 'block', width: '100%', height: 'auto' }}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        )}
      </div>
      <div className="faint" style={{ flex: '1 1 auto', fontSize: 11.5 }}>
        <div className="truncate" title={path}>
          {path}
        </div>
        <div>原始尺寸 {size.w > 0 ? `${size.w} × ${size.h}` : '读图中…'}</div>
        <div>尺寸不用换算：游戏里会按它需要的大小自动缩放</div>
      </div>
    </div>
  )
}

/** 取四向数组（不足四项补 `undefined`） */
function asQuad(value: unknown): (string | undefined)[] {
  if (!Array.isArray(value)) return [undefined, undefined, undefined, undefined]
  return [0, 1, 2, 3].map((index) => (typeof value[index] === 'string' ? (value[index] as string) : undefined))
}

/** 该图片位置是否允许「四张」写法 */
function allowsQuad(path: string): boolean {
  return /^road\.tiles\./.test(path) || path === 'role.player' || /^misc\.marks\./.test(path)
}

/** 一行绑定：路径 ＋ 选文件 ＋ 解绑 */
function BindRow({
  label,
  path,
  accept,
  missing,
  onBind,
  onClear,
  onDraw,
}: {
  label: string
  path?: string
  accept: string
  missing: boolean
  onBind: (name: string, bytes: Uint8Array) => void
  onClear: () => void
  /** 直接在创意模式里画这张图（给了才出按钮） */
  onDraw?: () => void
}) {
  const pick = async () => {
    const file = await pickBinaryFile(accept)
    if (file) onBind(file.name, file.bytes)
  }
  return (
    <div className="row" style={{ marginTop: 4 }}>
      <span className="faint" style={{ flex: '0 0 46px' }}>
        {label}
      </span>
      <span className="truncate" style={{ flex: '1 1 auto', fontSize: 12 }} title={path}>
        {path ?? '（空）'}
      </span>
      {missing && <span className="badge err">图片丢失</span>}
      {onDraw !== undefined && !accept.startsWith('audio') && !accept.startsWith('.ttf') && (
        <button className="btn small" onClick={onDraw} title="在这里直接画 / 改这张图">
          <Pencil size={12} /> {path !== undefined ? '改图' : '画一张'}
        </button>
      )}
      <button className="btn small" onClick={() => void pick()}>
        <Link2 size={12} /> 选图
      </button>
      <button className="btn small" onClick={onClear} disabled={path === undefined} title="清空这一处的图">
        <Unlink size={12} />
      </button>
    </div>
  )
}

/** 图引用对象的修饰位（只出真正有意义的几项） */
function ImageModifiers({
  value,
  allow,
  onChange,
}: {
  value: Record<string, unknown>
  allow: { rotate?: boolean; flip?: boolean; fit?: boolean; slice?: boolean; hurt?: boolean }
  onChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <>
      {allow.rotate && (
        <label className="field" style={{ marginTop: 4, marginBottom: 0 }}>
          <span className="faint">额外旋转角度（只是把图转个方向，跟路面朝向无关）</span>
          <input
            className="input"
            type="number"
            step={90}
            value={typeof value['rotate'] === 'number' ? value['rotate'] : 0}
            onChange={(e) => onChange({ rotate: Number(e.target.value) })}
          />
        </label>
      )}
      {allow.flip && (
        <label className="row" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={value['flip'] === true} onChange={(e) => onChange({ flip: e.target.checked })} />
          <span className="faint">左右翻转</span>
        </label>
      )}
      {allow.fit && (
        <label className="field" style={{ marginTop: 4, marginBottom: 0 }}>
          <span className="faint">拉伸方式</span>
          <select
            className="select"
            value={typeof value['fit'] === 'string' ? value['fit'] : 'cover'}
            onChange={(e) => onChange({ fit: e.target.value })}
          >
            {FIT_OPTIONS.map((fit) => (
              <option key={fit} value={fit}>
                {FIT_LABEL[fit]}
              </option>
            ))}
          </select>
        </label>
      )}
      {allow.slice && (
        <div className="faint" style={{ marginTop: 4 }}>
          九宫格拉伸：{Array.isArray(value['slice']) ? (value['slice'] as number[]).join(' / ') : '还没设（整张图直接拉伸）'}
        </div>
      )}
    </>
  )
}

export default function CreativeInspector() {
  const slots = useCreativeSlots()
  const slot = useSelectedSlot(slots)
  const manifest = useCreativeStore((s) => s.manifest)
  const assets = useCreativeStore((s) => s.assets)
  const setSlotValue = useCreativeStore((s) => s.setSlotValue)
  const clearSlotValue = useCreativeStore((s) => s.clearSlotValue)
  const bindAsset = useCreativeStore((s) => s.bindAsset)
  const putAsset = useCreativeStore((s) => s.putAsset)
  const [nineOpen, setNineOpen] = useState(false)
  /** 画图窗口：改哪一个包内路径、显示什么名字、画完把路径写回哪一处 */
  const [draw, setDraw] = useState<{ path: string; title: string; bind: (path: string) => void } | null>(null)

  if (!slot) {
    return (
      <div className="scroll" style={{ padding: 14 }}>
        <div className="panel-title">这一处怎么填</div>
        <div className="muted" style={{ marginTop: 6 }}>
          从左栏选一个图片位置：这里说明它该填什么、能怎么填，并画出它在游戏界面里的位置。
        </div>
      </div>
    )
  }

  const value = readSlot(manifest, slot.path)
  const object = asObject(value)
  const path = asPath(value)
  const missing = path !== undefined && assets[path] === undefined
  const write = (next: unknown) => setSlotValue(slot.path, next)
  const bind = (name: string, bytes: Uint8Array) => bindAsset(slot, name, bytes)

  /** 九宫格：作用在当前主图上（写成带 `slice` 的图引用对象） */
  const nineLines = linesOfSlice(
    Array.isArray(object?.['slice']) ? (object['slice'] as [number, number, number, number]) : undefined,
  )

  const applyNine = (next: NineLines) => {
    if (path === undefined) return
    write({ ...(object ?? {}), img: path, slice: sliceOf(next) } as SkinImage)
  }

  const switchToSingle = () => {
    if (path !== undefined) write(path)
  }
  const switchToObject = () => {
    if (path !== undefined) write({ img: path } as SkinImage)
  }

  const quad = asQuad(value)
  const isQuad = Array.isArray(value)

  /** 这一处还没给图时，先按建议文件名定一个包内路径（画完就写进这一处） */
  const blankPath = () => assetPathFor(slot, 'drawn.png')

  /** 打开画图窗口 */
  const openDraw = (target: string, label: string, bind: (path: string) => void) =>
    setDraw({ path: target, title: label, bind })

  const closeDraw = () => setDraw(null)

  return (
    <div className="scroll inspector" style={{ padding: 14 }}>
      <div className="faint" style={{ marginBottom: 2 }}>
        这一处怎么填
      </div>
      <div className="panel-title">{slot.label}</div>
      <div className="faint" style={{ marginTop: 2 }}>
        {slot.path}
      </div>
      <div className="faint" style={{ marginTop: 2 }}>
        本图片位置可填：{KIND_LABEL[slot.kind]}
      </div>
      {slot.suggest !== '' && (
        <div className="faint" style={{ marginTop: 2 }}>
          命名约定：{slot.suggest}
        </div>
      )}

      <SlotLocation slot={slot} />

      {path !== undefined &&
        assets[path] !== undefined &&
        slot.kind !== 'audio' &&
        slot.kind !== 'font' &&
        slot.kind !== 'color' && <AssetThumb path={path} bytes={assets[path]} />}

      <div className="hline" style={{ margin: '8px 0' }} />

      {/* 音频 */}
      {slot.kind === 'audio' && (
        <>
          <div className="row">
            <Music size={13} />
            <span className="faint">{slot.path.startsWith('audio.bgm') ? '背景乐：可设循环与音量' : '音效：可设音量'}</span>
          </div>
          <BindRow
            label="文件"
            path={path}
            accept={ACCEPT.audio}
            missing={missing}
            onBind={bind}
            onClear={() => clearSlotValue(slot.path)}
          />
          <label className="field" style={{ marginTop: 6, marginBottom: 0 }}>
            <span className="faint">音量（0–1；不填的话背景乐 0.5、音效 0.8）</span>
            <input
              className="input"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={typeof object?.['volume'] === 'number' ? (object['volume'] as number) : ''}
              onChange={(e) => {
                const raw = e.target.value
                const next: Record<string, unknown> = { ...(object ?? {}), file: path ?? '' }
                if (raw === '') delete next['volume']
                else next['volume'] = Number(raw)
                write(next)
              }}
            />
          </label>
          {slot.path.startsWith('audio.bgm') && (
            <label className="row" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={object?.['loop'] !== false}
                onChange={(e) => write({ ...(object ?? {}), file: path ?? '', loop: e.target.checked })}
              />
              <span className="faint">循环播放（默认开）</span>
            </label>
          )}
        </>
      )}

      {/* 颜色 */}
      {slot.kind === 'color' && (
        <>
          <div className="row">
            <Palette size={13} />
            <span className="faint">{slot.path.startsWith('theme.') ? '界面观感变量（管布局的那几个不能改）' : '字色'}</span>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <input
              type="color"
              value={typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
              onChange={(e) => write(e.target.value)}
            />
            <input
              className="input"
              style={{ flex: '1 1 auto' }}
              value={typeof value === 'string' ? value : ''}
              placeholder="#000000 或 var(--ink)"
              onChange={(e) => write(e.target.value)}
            />
            <button className="btn small" onClick={() => clearSlotValue(slot.path)} disabled={value === undefined}>
              <Unlink size={12} />
            </button>
          </div>
        </>
      )}

      {/* 字体 */}
      {slot.kind === 'font' && (
        <>
          <div className="row">
            <Type size={13} />
            <span className="faint">字体文件路径，或系统自带字体名</span>
          </div>
          <BindRow
            label="字体"
            path={path}
            accept={ACCEPT.font}
            missing={missing}
            onBind={bind}
            onClear={() => clearSlotValue(slot.path)}
          />
          <input
            className="input"
            style={{ marginTop: 4 }}
            value={typeof value === 'string' ? value : ''}
            placeholder="serif / 或 resource/font/hand.ttf"
            onChange={(e) => write(e.target.value)}
          />
        </>
      )}

      {/* 底板三元组 */}
      {slot.kind === 'ground' && (
        <>
          <div className="row">
            <span className="faint">底板：可直接写一个颜色；也可用「填充色 ＋ 描边色 ＋ 背景图」三样组合</span>
          </div>
          <BindRow
            label="背景图"
            path={path}
            accept={ACCEPT.ground}
            missing={missing}
            onBind={bind}
            onDraw={() =>
              openDraw(
                (typeof object?.['img'] === 'string' ? (object['img'] as string) : '') || blankPath(),
                `${slot.label} · 背景图`,
                (target) => {
                  const next: Record<string, unknown> =
                    typeof value === 'string' && value.trim() !== '' ? { fill: value } : { ...(object ?? {}) }
                  next['img'] = target
                  write(next)
                },
              )
            }
            onClear={() => {
              const next: Record<string, unknown> = { ...(object ?? {}) }
              delete next['img']
              if (path !== undefined && typeof value === 'string') clearSlotValue(slot.path)
              else write(next)
            }}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <span className="faint" style={{ flex: '0 0 46px' }}>
              填充
            </span>
            <input
              className="input"
              value={typeof object?.['fill'] === 'string' ? (object['fill'] as string) : ''}
              placeholder="#f6f1e4"
              onChange={(e) => write({ ...(object ?? {}), fill: e.target.value })}
            />
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="faint" style={{ flex: '0 0 46px' }}>
              描边
            </span>
            <input
              className="input"
              value={typeof object?.['stroke'] === 'string' ? (object['stroke'] as string) : ''}
              placeholder="未给即不画描边"
              onChange={(e) => write({ ...(object ?? {}), stroke: e.target.value })}
            />
          </div>
        </>
      )}

      {/* 按钮四态 */}
      {slot.kind === 'button' && (
        <>
          <div className="row">
            <SlidersHorizontal size={13} />
            <span className="faint">四态；normal（普通）必填；没填的状态直接用 normal 那张</span>
          </div>
          {(['normal', 'hover', 'active', 'disabled'] as const).map((state) => {
            const statePath = asPath(object?.[state])
            return (
              <BindRow
                key={state}
                label={STATE_LABEL[state]}
                path={statePath}
                accept={ACCEPT.button}
                missing={statePath !== undefined && assets[statePath] === undefined}
                onDraw={() =>
                  openDraw(statePath ?? variationPath(slot.suggest, 'drawn.png', state), `${slot.label} · ${STATE_LABEL[state]}`, (target) =>
                    write({ ...(object ?? {}), [state]: target }),
                  )
                }
                onBind={(name, bytes) => {
                  const target = variationPath(slot.suggest, name, state)
                  putAsset(target, bytes)
                  write({ ...(object ?? {}), [state]: target })
                }}
                onClear={() => {
                  const next: Record<string, unknown> = { ...(object ?? {}) }
                  delete next[state]
                  if (Object.keys(next).length === 0) clearSlotValue(slot.path)
                  else write(next)
                }}
              />
            )
          })}
        </>
      )}

      {/* 其余：图 / 纹理 / 精灵 / 大图 */}
      {(slot.kind === 'image' || slot.kind === 'texture' || slot.kind === 'sprite' || slot.kind === 'portrait') && (
        <>
          <BindRow
            label="图"
            path={path}
            accept={ACCEPT[slot.kind]}
            missing={missing}
            onDraw={() =>
              openDraw(path ?? blankPath(), slot.label, (target) => {
                if (isRecord(value)) write({ ...value, img: target })
                else write(target)
              })
            }
            onBind={(name, bytes) => {
              bind(name, bytes)
            }}
            onClear={() => clearSlotValue(slot.path)}
          />

          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={switchToSingle} disabled={path === undefined || typeof value === 'string'}>
              就用一张图
            </button>
            <button
              className="btn small"
              onClick={switchToObject}
              disabled={path === undefined || isRecord(value)}
              title="需要额外旋转 / 左右翻转 / 九宫格切片时用对象写法"
            >
              加旋转、翻转等设置
            </button>
            {allowsQuad(slot.path) && (
              <button
                className="btn small"
                onClick={() => write([path ?? '', '', '', ''])}
                disabled={path === undefined || isQuad}
                title="按 北/东/南/西 顺序给四张，中间不能空着"
              >
                四个方向各一张
              </button>
            )}
          </div>

          {allowsQuad(slot.path) && isQuad && (
            <div style={{ marginTop: 4 }}>
              <div className="faint">四个方向：北 N、东 E、南 S、西 W</div>
              {(['N', 'E', 'S', 'W'] as const).map((label, index) => {
                const item = quad[index]
                return (
                  <BindRow
                    key={label}
                    label={label}
                    path={item}
                    accept={ACCEPT.sprite}
                    missing={item !== undefined && assets[item] === undefined}
                    onDraw={() =>
                      openDraw(item ?? variationPath(slot.suggest, 'drawn.png', label.toLowerCase()), `${slot.label} · ${label} 向`, (target) => {
                        const next = [...quad]
                        next[index] = target
                        write(next)
                      })
                    }
                    onBind={(name, bytes) => {
                      const target = variationPath(slot.suggest, name, label.toLowerCase())
                      putAsset(target, bytes)
                      const next = [...quad]
                      next[index] = target
                      write(next)
                    }}
                    onClear={() => {
                      const next = [...quad]
                      next[index] = ''
                      write(next)
                    }}
                  />
                )
              })}
            </div>
          )}

          {object !== undefined && (
            <ImageModifiers
              value={object}
              allow={{
                rotate: slot.kind === 'image' || slot.kind === 'sprite',
                flip: slot.kind === 'portrait' || slot.kind === 'image' || slot.kind === 'sprite',
                fit: slot.kind === 'image' && /^startup\.|^background\.|^lobby\.bg$/.test(slot.path),
                slice: slot.kind === 'image' || slot.kind === 'texture',
              }}
              onChange={(patch) => write({ ...object, ...patch })}
            />
          )}

          {(slot.kind === 'image' || slot.kind === 'texture') && (
            <>
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => setNineOpen((v) => !v)} disabled={path === undefined}>
                <SlidersHorizontal size={12} /> 九宫格切分
              </button>
              {nineOpen && path !== undefined && <NineSlicePanel path={path} lines={nineLines} onChange={applyNine} />}
            </>
          )}
        </>
      )}

      <div className="hline" style={{ margin: '10px 0 8px' }} />
      <div className="row">
        <button className="btn small" onClick={() => clearSlotValue(slot.path)} disabled={value === undefined}>
          <Unlink size={12} /> 清空这一处的图
        </button>
        <span className="faint">
          <Download size={11} /> 导出时会列出未被使用的图，且不会打进包
        </span>
      </div>
      <div className="faint" style={{ marginTop: 6 }}>
        每一行右侧的「画一张 / 改图」可直接在右栏作画：画完写回同一包内路径，预览页与左栏缩略图随之更新。
      </div>

      {draw !== null && (
        <Overlay zIndex={70} onClose={closeDraw}>
          <ImageEditor
            path={draw.path}
            title={draw.title}
            bytes={assets[draw.path]}
            onApply={(bytes) => {
              putAsset(draw.path, bytes)
              draw.bind(draw.path)
            }}
            onClose={closeDraw}
          />
        </Overlay>
      )}
    </div>
  )
}
