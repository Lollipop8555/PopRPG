/**
 * 创意模式右栏检视器：**一个槽位怎么填**（`skin/09-creative.md` §2.2 / §2.3）。
 *
 * 按槽位类型分派编辑器，形状**严格照类型定义**，不做超集：
 * - 图引用对象只出现各节真正允许的修饰（`slice` 归容器、`fit` 归封面、`rotate` 归可旋元素）；
 * - 「三写法」只给真正允许数组的槽位（`road.tiles.*` / `role.player` / `misc.marks.*`）——
 *   `role.classes` / `monsters` / `npcs` 明确不接受数组，故这里不给四向。
 */

import { useEffect, useMemo, useState } from 'react'
import { Download, Link2, Music, Palette, SlidersHorizontal, Type, Unlink } from 'lucide-react'
import type { SkinFit, SkinImage } from '../types'
import { pickBinaryFile } from '../io/download'
import { useCreativeStore } from '../store/creative'
import { readSlot, variationPath, type SlotKind } from './slots'
import { linesOfSlice, sliceOf, type NineLines } from './nine'
import NineSlicePanel from './NineSlicePanel'
import { useCreativeSlots, useSelectedSlot } from './useCreative'

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
 * 目标尺寸 / 是否成整倍数**暂不显示**：设计侧还没有各槽位的**目标尺寸表**（文档里只有尺寸行，
 * 没有机器可读数据），凭空造一张表等于替设计做决定，故这里如实留白。
 */
function AssetThumb({ path, bytes }: { path: string; bytes?: Uint8Array }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const url = useMemo(() => {
    if (bytes === undefined || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
    return URL.createObjectURL(new Blob([bytes as BlobPart]))
  }, [bytes])

  useEffect(() => {
    return () => {
      if (url !== undefined) URL.revokeObjectURL(url)
    }
  }, [url])

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
        <div>目标尺寸 / 整倍数：待设计侧「目标尺寸表」（`09-creative.md` §2.2）</div>
      </div>
    </div>
  )
}

/** 取四向数组（不足四项补 `undefined`） */
function asQuad(value: unknown): (string | undefined)[] {
  if (!Array.isArray(value)) return [undefined, undefined, undefined, undefined]
  return [0, 1, 2, 3].map((index) => (typeof value[index] === 'string' ? (value[index] as string) : undefined))
}

/** 该槽位是否允许「四张」写法 */
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
}: {
  label: string
  path?: string
  accept: string
  missing: boolean
  onBind: (name: string, bytes: Uint8Array) => void
  onClear: () => void
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
      {missing && <span className="badge err">缺字节</span>}
      <button className="btn small" onClick={() => void pick()}>
        <Link2 size={12} /> 选图
      </button>
      <button className="btn small" onClick={onClear} disabled={path === undefined} title="清掉这一处">
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
          <span className="faint">纠偏角（硬性角度，不表达朝向）</span>
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
          <span className="faint">显式左右镜像</span>
        </label>
      )}
      {allow.fit && (
        <label className="field" style={{ marginTop: 4, marginBottom: 0 }}>
          <span className="faint">填充方式</span>
          <select
            className="select"
            value={typeof value['fit'] === 'string' ? value['fit'] : 'cover'}
            onChange={(e) => onChange({ fit: e.target.value })}
          >
            {FIT_OPTIONS.map((fit) => (
              <option key={fit} value={fit}>
                {fit}
              </option>
            ))}
          </select>
        </label>
      )}
      {allow.slice && (
        <div className="faint" style={{ marginTop: 4 }}>
          九宫格切片：{Array.isArray(value['slice']) ? (value['slice'] as number[]).join(' / ') : '未设（按普通拉伸）'}
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

  if (!slot) {
    return (
      <div className="scroll" style={{ padding: 14 }}>
        <div className="panel-title">检视器</div>
        <div className="muted" style={{ marginTop: 6 }}>
          从左栏选一个槽位：这里给出它与它允许的写法。
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

  return (
    <div className="scroll inspector" style={{ padding: 14 }}>
      <div className="panel-title">{slot.label}</div>
      <div className="faint" style={{ marginTop: 2 }}>
        {slot.path} · {slot.kind}
      </div>
      {slot.suggest !== '' && (
        <div className="faint" style={{ marginTop: 2 }}>
          建议交付名：{slot.suggest}
        </div>
      )}

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
            <span className="faint">音量（0–1，缺省背景乐 0.5、音效 0.8）</span>
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
              <span className="faint">循环（缺省开）</span>
            </label>
          )}
        </>
      )}

      {/* 颜色 */}
      {slot.kind === 'color' && (
        <>
          <div className="row">
            <Palette size={13} />
            <span className="faint">{slot.path.startsWith('theme.') ? '主题观感 token（布局 token 不可覆盖）' : '字色'}</span>
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
            <span className="faint">包内字体路径或浏览器内置字体名</span>
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

      {/* 衬底三元组 */}
      {slot.kind === 'ground' && (
        <>
          <div className="row">
            <span className="faint">衬底：颜色简写，或「填充 ＋ 描边 ＋ 背景图」三元组</span>
          </div>
          <BindRow
            label="背景图"
            path={path}
            accept={ACCEPT.ground}
            missing={missing}
            onBind={bind}
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
            <span className="faint">四态；`normal` 必填，其余缺哪态就沿用 `normal`</span>
          </div>
          {(['normal', 'hover', 'active', 'disabled'] as const).map((state) => {
            const statePath = asPath(object?.[state])
            return (
              <BindRow
                key={state}
                label={state}
                path={statePath}
                accept={ACCEPT.button}
                missing={statePath !== undefined && assets[statePath] === undefined}
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

      {/* 其余：图 / 纹理 / 精灵 / 立绘 */}
      {(slot.kind === 'image' || slot.kind === 'texture' || slot.kind === 'sprite' || slot.kind === 'portrait') && (
        <>
          <BindRow
            label="素材"
            path={path}
            accept={ACCEPT[slot.kind]}
            missing={missing}
            onBind={(name, bytes) => {
              bind(name, bytes)
            }}
            onClear={() => clearSlotValue(slot.path)}
          />

          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={switchToSingle} disabled={path === undefined || typeof value === 'string'}>
              单张写法
            </button>
            <button
              className="btn small"
              onClick={switchToObject}
              disabled={path === undefined || isRecord(value)}
              title="需要纠偏角 / 镜像 / 九宫格切片时用对象写法"
            >
              带修饰写法
            </button>
            {allowsQuad(slot.path) && (
              <button
                className="btn small"
                onClick={() => write([path ?? '', '', '', ''])}
                disabled={path === undefined || isQuad}
                title="四张按 N / E / S / W，不得省略中间项"
              >
                四张写法
              </button>
            )}
          </div>

          {allowsQuad(slot.path) && isQuad && (
            <div style={{ marginTop: 4 }}>
              <div className="faint">四向：N / E / S / W</div>
              {(['N', 'E', 'S', 'W'] as const).map((label, index) => {
                const item = quad[index]
                return (
                  <BindRow
                    key={label}
                    label={label}
                    path={item}
                    accept={ACCEPT.sprite}
                    missing={item !== undefined && assets[item] === undefined}
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
          <Unlink size={12} /> 清空这个槽位
        </button>
        <span className="faint">
          <Download size={11} /> 导出时未引用的素材会被提示，不打进包
        </span>
      </div>
    </div>
  )
}
