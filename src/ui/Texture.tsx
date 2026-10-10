/**
 * **贴图渲染器**（`skin.md` §四）：素材画到屏上的唯一落点。
 *
 * - **单一入口**：`textureProps()` 把「取图 → 落位 → 换地址」收成一份 props；调用方拿到
 *   `undefined` 就画程序图形（素材缺失、包没启用、环境不支持地址），**不判断素材类型**
 * - **三层同接口**：同一份 `TextureProps`，SVG 层用 `SvgTexture`（`<image>`），
 *   DOM 层用 `DomTexture`（`<img>`，绝对定位，要求父元素 `position: relative`），
 *   行内层用 `InlineTexture`（`<img>`，跟文字同排，尺寸交给 CSS）
 * - **位图不套手绘滤镜**（S-6）：素材节点一律不带 `filter`，手绘滤镜只加在程序绘制的图形上；
 *   素材自身也**不参与点击命中**（`pointerEvents: none`），命中判定仍归所在层的业务元素
 * - **三种铺法**：`stretch`（整图拉伸，固定族与旧素材）/ `nine`（九宫格，素材带 `slice` 即生效）/
 *   `tile`（原尺寸平铺）。DOM 层的九宫格走 `border-image`，与 SVG 层的切块拼装**语义一致**
 *   （§3.3「两侧实现可以不同，调用方接口必须相同」）
 */

import type { CSSProperties } from 'react'
import type { GroundPaint } from '../engine/skin'
import type { ButtonState } from '../engine/skin/lookup'
import { BUTTON_STATES } from '../engine/skin/lookup'
import type { SkinFit, SkinSlice, SkinTexture } from '../types'
import {
  effectiveMode,
  nineSliceTiles,
  placeTexture,
  surfaceMode,
  textureRef,
  type NineTile,
  type TextureBox,
  type TextureMode,
  type TexturePlacement,
  type TextureRef,
  type TextureSize,
  type TextureSource,
} from '../engine/skin/texture'
import type { SkinAssets } from '../io/skin-assets'

/**
 * **CSS 尺寸盒**（行内层专用）：尺寸不来自游戏坐标，而由所在处 CSS 决定——
 * 形象格是 `.inline-texture` 的 `1em`（跟字号走），立绘是 `.portrait-*` 的 `vmin` 档（跟窗口走）。
 * 给个 1×1 名义盒只为让落位函数拿到形状；`rotate` / `flip` 照旧生效（绕心，与盒大小无关）。
 */
export const CSS_SIZED_BOX: TextureBox = { x: 0, y: 0, w: 1, h: 1 }

/** 两层共用的调用接口 */
export interface TextureProps extends TexturePlacement {
  /** 已建好的可用地址（`textureProps()` 从素材源取好） */
  src: string
  /** 生效的填充方式（`textureProps()` 已按「策略 ＋ 切片」判定，见 `effectiveMode()`） */
  mode?: TextureMode
  /** 九宫格切片；`mode === 'nine'` 时由 `SvgTexture` 切块拼装用 */
  slice?: SkinSlice
  /** 源图内在像素尺寸；`mode === 'nine'` 时切块拼装用（DOM 层 `border-image` 不需要） */
  source?: TextureSource
  /** 0–1，缺省 1 */
  opacity?: number
  /** 额外类名（两层都透传） */
  className?: string
  /** 说明文字；给了即视为内容图，不给按装饰图对无障碍隐藏 */
  alt?: string
}

/**
 * 单一入口：把取图结果落到盒里，并换成可用地址。
 *
 * 返回 `undefined` 的三种情形都走同一条退路（调用方改画程序图形）：
 * 该节点未被皮肤接管、包里缺这张图、环境给不出地址。
 */
export function textureProps(
  ref: TextureRef | undefined,
  assets: SkinAssets,
  box: TextureBox,
  extra: Pick<TextureProps, 'mode' | 'opacity' | 'className' | 'alt'> = {},
): TextureProps | undefined {
  const placement = placeTexture(box, ref)
  if (placement === undefined || ref === undefined) return undefined

  const src = assets.urlOf(ref.src)
  if (src === undefined) return undefined

  // 铺法在这里定死：调用方给了就照给（如画布背景的 `stretch`），没给按背景铺法默认——
  // **素材带了 `slice` 即九宫格**（`surfaceMode()`，承 `node.building` `KM-1` 的「必须九宫格」）。
  const mode = extra.mode ?? surfaceMode(ref)

  // 九宫格只在**SVG 层**再补两块料：切片与源图像素尺寸（DOM 层走 `border-image`，不吃这两个字段）。
  // 量不出源图尺寸（素材源不支持量尺寸 / 格式不识别 / 条目缺失）就不带 `slice`，`SvgTexture` 回落整图拉伸。
  if (effectiveMode(mode, ref.slice) === 'nine' && ref.slice !== undefined) {
    const source = assets.sizeOf?.(ref.src)
    if (source !== undefined) return { ...placement, src, ...extra, mode, slice: ref.slice, source }
  }

  return { ...placement, src, ...extra, mode }
}

/**
 * 衬底铺法（`skin/03-window.md` §五、`skin/04-misc.md` §三）：
 * - `stretch`：**铺满整盒**——随视口族容器的衬底（尺寸由窗口决定，量不出「多大一个盒」）；
 * - `contain`：**等比缩放进盒内**、绝不拉伸——骰子本体（三档尺寸共用一张，`04-misc.md` §三）。
 */
export type SurfaceFit = 'stretch' | 'contain'

/**
 * **衬底 / 本体**：与上三层共用「取图结果 → 可用地址」，差别在落法——
 * 不摆到坐标、不量盒，而是把图**铺在所在元素的背景**上（铺法由 `fit` 定）。
 *
 * 尺寸交给 CSS：随视口族容器（对话框 / 抽屉 / 气泡，`03-window.md` §二）与骰子盒
 * （`.die` 三档尺寸，`04-misc.md` §三）都是「盒由 CSS 定」，底纹也不需要 `rotate` / `flip`，
 * 故这里只取 `src`；圆角、描边、阴影仍归元素自己的 CSS——素材铺在 `background-color` 之上、
 * 被圆角剪裁，正是 `03-window.md` §五「素材只提供纸面底纹」的落法。
 *
 * 返回 `undefined`（未配该键、包里缺这张图）即调用方不传 `style`，CSS 纸面照旧。
 * **素材带了 `slice` 就走九宫格**（见 `surfaceMode()`），否则整图拉伸；`contain` 那一档不受影响。
 */
export function surfaceStyle(
  ref: TextureRef | undefined,
  assets: SkinAssets,
  fit: SurfaceFit = 'stretch',
): CSSProperties | undefined {
  if (ref === undefined) return undefined
  const src = assets.urlOf(ref.src)
  if (src === undefined) return undefined

  if (fit === 'stretch' && surfaceMode(ref) === 'nine' && ref.slice !== undefined) {
    return nineStyle(src, ref.slice)
  }

  // 只写 image / size / repeat：**不动 `background-color`**——底纹可以带透明，
  // 纸面底色得留着（衔接处不露白）
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: fit === 'contain' ? 'contain' : '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  }
}

/**
 * **按钮四态 → CSS 自定义属性**（`skin/03-window.md` §4.1）：与 `theme.css` 里
 * `.btn:hover` / `.btn:active` / `.btn:disabled` 三条规则**逐字对应**，改名要两处一起改。
 *
 * 为什么要走变量：`normal` 那份是**行内**样式（与容器 / 格子同一条落法），而行内写不出伪类；
 * 于是其余三态只能由样式表按状态取用，行内只负责**把每态那张图带进来**。
 */
const BUTTON_VARS: Record<ButtonState, { bg: string; bi: string }> = {
  normal: { bg: '--sk-normal-bg', bi: '--sk-normal-bi' },
  hover: { bg: '--sk-hover-bg', bi: '--sk-hover-bi' },
  active: { bg: '--sk-active-bg', bi: '--sk-active-bi' },
  disabled: { bg: '--sk-disabled-bg', bi: '--sk-disabled-bi' },
}

/**
 * **按钮落图**（`skin/03-window.md` §4.1 / §八「按钮」）：`normal` 与容器同档（行内属性），
 * 另外三态写成 CSS 变量，交给 `theme.css` 的伪类规则按状态取用。
 *
 * - **缺 `normal`、或包里缺 `normal` 那张图**：整块 `undefined`，调用方不传 `style`
 *   （`normal` 是唯一必填项，§4.1）——此时三态写了也一并作废；
 * - **某态没写、或该态的图不在包里**：**不写**那对变量，`theme.css` 的
 *   `var(--sk-hover-*, var(--sk-normal-*))` 自然回落到 `normal`（§4.1「回落 `normal` ＋ CSS 表现」）；
 * - **配了该态就按该态自己的铺法**（带 `slice` 走九宫格 / 否则整图拉伸），与 `normal` 无关。
 */
export function buttonStyle(
  states: Partial<Record<ButtonState, SkinTexture>> | undefined,
  assets: SkinAssets,
): CSSProperties | undefined {
  const style = surfaceStyle(textureRef(states?.normal), assets)
  if (style === undefined) return undefined

  const out: Record<string, string | number> = { ...style }
  for (const state of BUTTON_STATES) {
    const ref = textureRef(states?.[state])
    const src = ref === undefined ? undefined : assets.urlOf(ref.src)
    if (ref === undefined || src === undefined) continue
    const { bg, bi } = stateVars(ref, src)
    out[BUTTON_VARS[state].bg] = bg
    out[BUTTON_VARS[state].bi] = bi
  }
  return out as CSSProperties
}

/**
 * **一态 → 一对变量值**：`bg` 给 `background-image`（整图拉伸那档用它，九宫格那档给 `none`），
 * `bi` 给 `border-image`（九宫格那档直接写成简写——变量里只能放一条声明值）。
 */
function stateVars(ref: TextureRef, src: string): { bg: string; bi: string } {
  if (surfaceMode(ref) === 'nine' && ref.slice !== undefined) {
    return { bg: 'none', bi: nineShorthand(src, ref.slice) }
  }
  return { bg: `url("${src}")`, bi: 'none' }
}

/** **九宫格 → CSS `border-image`**（`skin.md` §3.3、`03-window.md` §二）。
 *
 * `slice` 是**图片像素**的 `[上, 右, 下, 左]`，与 `border-image-slice` 的语义逐字对应：
 * 四角原样、四边单向拉伸、中心双向拉伸；末尾的 `fill` 让**中心区也画出来**（纸面底纹正在中心）。
 *
 * 与元素自身 CSS 的分工（`S-4`：素材只提供底纹、边框仍由 CSS 绘制）：
 * - **不写 `border-width` / `border-style`**——盒尺寸与边框都归元素自己的 CSS，这里只换「边框怎么画」；
 *   `border-image-width` 按切片给像素值，图区因此从边框盒边**往里铺**，四边压进内边距也不动布局；
 * - **不写 `background-color`**——九宫格的 `fill` 只画中心区的**图**，纸面底色照旧由 CSS 兜着。
 */
function nineStyle(src: string, slice: SkinSlice): CSSProperties {
  const { edges, widths } = sliceSides(slice)
  return {
    borderImageSource: `url("${src}")`,
    borderImageSlice: `${edges} fill`,
    borderImageWidth: widths,
    borderImageRepeat: 'stretch',
  }
}

/**
 * 同一份九宫格切片 → **`border-image` 简写**（按钮三态走变量，而变量里只能放一条声明值）。
 *
 * 与 `nineStyle()` 的四条长写**同义**：源 ＋ 切片（带 `fill`）`/` 边框宽 ＋ 拉伸。
 */
function nineShorthand(src: string, slice: SkinSlice): string {
  const { edges, widths } = sliceSides(slice)
  return `url("${src}") ${edges} fill / ${widths} stretch`
}

/** `slice` 的两个串：无单位的四边值（配 `fill`）与带 `px` 的四边值——长写与简写共用这一份 */
function sliceSides(slice: SkinSlice): { edges: string; widths: string } {
  const sides = slice.map(num)
  return { edges: sides.join(' '), widths: sides.map((side) => `${side}px`).join(' ') }
}

/**
 * **衬底三件套 → CSS**（`skin/06-item-building.md` §二）：填充色 ＋ 描边色 ＋ 背景图，
 * 物品格子（`.bag-cell`）与其它「衬底 ＋ 内容」的固定尺寸格子共用这一处算法。
 *
 * - `fill` 落到 `background-color`，同时是背景图透明区的**兜底色**（§2.3）
 * - `stroke` 落到 `border-color`；**未给即不绘制描边**（裁决 18）——写成 `transparent`
 *   而不是去掉边框，只为不改变盒尺寸（取舍 `S-24` 明确只改观感、不改布局）
 * - `img` 铺成背景图，铺法与容器衬底同一档（V1 一律拉伸，[`../skin.md`](../skin.md) §3.3）
 *
 * 返回 `undefined`（整节未接管）即调用方不传 `style`，CSS 纸面照旧。
 */
export function groundStyle(
  paint: GroundPaint | undefined,
  assets: SkinAssets,
  fit: SurfaceFit = 'stretch',
): CSSProperties | undefined {
  if (paint === undefined) return undefined

  const style: CSSProperties = { borderColor: paint.stroke ?? 'transparent' }
  if (paint.fill !== undefined) style.backgroundColor = paint.fill

  const src = paint.img === undefined ? undefined : assets.urlOf(paint.img)
  if (src !== undefined) {
    style.backgroundImage = `url("${src}")`
    style.backgroundSize = fit === 'contain' ? 'contain' : '100% 100%'
    style.backgroundRepeat = 'no-repeat'
    style.backgroundPosition = 'center'
  }
  return style
}

/**
 * **整屏封面背景**（`skin/08-pages.md` §2.1 / §2.2）：`startup.bg` / `lobby.bg` 铺满所在那一屏。
 *
 * 与衬底同一条底线：**只写 image 与铺法、不动 `background-color`**——`contain` 留出的边由主题底色
 * 兜着（§2.1 `fit` 列），返回 `undefined`（未配该键 / 包里缺这张图）即调用方不传 `style`。
 *
 * `fit` 三档各是一种铺法：`cover`（缺省，裁切铺满）/ `contain`（整张可见）/ `tile`（原尺寸平铺）。
 */
export function pageBgStyle(
  ref: TextureRef | undefined,
  assets: SkinAssets,
  fit: SkinFit = 'cover',
): CSSProperties | undefined {
  if (ref === undefined) return undefined
  const src = assets.urlOf(ref.src)
  if (src === undefined) return undefined

  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: fit === 'tile' ? 'auto' : fit,
    backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: 'center',
  }
}

/** 千分位取整：贴图坐标不必带浮点尾巴，免得每次渲染都换属性值 */
function num(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** 盒尺寸是不是「交给素材自身像素」 */
function isAuto(size: TextureSize): size is 'auto' {
  return size === 'auto'
}

/** SVG 的绕心变换；无旋转也无镜像时不写 `transform` */
function svgTransform({ x, y, w, h, rotate, flip }: TexturePlacement): string | undefined {
  const ops: string[] = []
  if (flip) ops.push('scale(-1 1)')
  if (rotate) ops.push(`rotate(${num(rotate)})`)
  if (ops.length === 0) return undefined
  // `auto` 盒量不出盒心（画布背景）：该类元素不旋转、不镜像
  if (isAuto(w) || isAuto(h)) return undefined

  const cx = num(x + w / 2)
  const cy = num(y + h / 2)
  return `translate(${cx} ${cy}) ${ops.join(' ')} translate(${-cx} ${-cy})`
}

/** 九宫格的四角下标（行优先序：左上 / 右上 / 左下 / 右下）——四角原样，无拉伸可言 */
const NINE_CORNERS = new Set([0, 2, 6, 8])

/**
 * **九宫格切块拼装**（`skin.md` §3.3）：把九块各用一个嵌套 `<svg>` 框出源区、拉伸落进目标区。
 *
 * 每块都是「源区 `viewBox` ＋ `preserveAspectRatio="none"`」——坐标单位即图片像素，
 * 因而四边能**单向拉伸**、中心能**双向拉伸**，与 DOM 层 `border-image` 的 `stretch` 同义。
 * 源图大于块区时由嵌套 `<svg>` 自带的裁剪吃掉溢出，不必额外写 `clipPath`。
 *
 * 位图不套手绘滤镜、不吃点击（S-6），故整组只带 `pointerEvents: none`。
 */
function nineSvg(
  src: string,
  tiles: NineTile[],
  source: TextureSource,
  transform: string | undefined,
  opacity: number | undefined,
  className: string | undefined,
  alt: string | undefined,
): JSX.Element {
  return (
    <g
      transform={transform}
      opacity={opacity}
      className={className}
      style={{ pointerEvents: 'none' }}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
    >
      {tiles.map((tile, index) => (
        <svg
          key={index}
          x={num(tile.dx)}
          y={num(tile.dy)}
          width={num(tile.dw)}
          height={num(tile.dh)}
          viewBox={`${num(tile.sx)} ${num(tile.sy)} ${num(tile.sw)} ${num(tile.sh)}`}
          // 四角 sw===dw 且 sh===dh，取不取 `none` 都一样；四边 / 中心必须 `none` 才拉得开
          preserveAspectRatio={NINE_CORNERS.has(index) ? 'xMidYMid meet' : 'none'}
        >
          <image href={src} x={0} y={0} width={source.width} height={source.height} preserveAspectRatio="none" />
        </svg>
      ))}
    </g>
  )
}

/**
 * SVG 层：画在既有 `<svg>` 里（地图 / 画布 / 棋子）。
 *
 * **九宫格**（`mode === 'nine'` 且切片与源图尺寸齐备）走**切块拼装**——CSS `border-image`
 * 在 SVG 里没有对应写法，故手动切九块（见 `nineSvg()`）；量不出源图尺寸或盒是 `auto` 时回落整图拉伸。
 */
export function SvgTexture({ src, x, y, w, h, rotate, flip, mode, slice, source, opacity, className, alt }: TextureProps) {
  const placement: TexturePlacement = { x, y, w, h, rotate: rotate ?? 0, flip: flip === true }
  const transform = svgTransform(placement)

  if (mode === 'nine' && slice !== undefined && source !== undefined) {
    const tiles = nineSliceTiles({ x, y, w, h }, slice, source)
    return tiles === undefined ? null : nineSvg(src, tiles, source, transform, opacity, className, alt)
  }

  return (
    <image
      href={src}
      x={x}
      y={y}
      // `auto` 不写尺寸属性：SVG2 按素材原始像素出图（画布背景的唯一写法，`05-canvas.md` §三）
      width={isAuto(w) ? undefined : w}
      height={isAuto(h) ? undefined : h}
      preserveAspectRatio={effectiveMode(mode, slice) === 'stretch' ? 'none' : 'xMidYMid meet'}
      transform={transform}
      opacity={opacity}
      className={className}
      style={{ pointerEvents: 'none' }}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
    />
  )
}

/** DOM 层的尺寸写法：数值走 px，`auto` 交给素材自身像素 */
function sizeCss(size: TextureSize): string {
  return isAuto(size) ? 'auto' : `${num(size)}px`
}

/** DOM 层的绕心变换（`rotate` / `flip` 都绕元素中心；层内两处 DOM 元素共用这一份） */
function cssTransform({ rotate, flip }: Pick<TexturePlacement, 'rotate' | 'flip'>): string | undefined {
  const transforms: string[] = []
  if (rotate) transforms.push(`rotate(${num(rotate)}deg)`)
  if (flip) transforms.push('scaleX(-1)')
  return transforms.length ? transforms.join(' ') : undefined
}

/** DOM 层：画在面板 / 弹窗里（父元素需 `position: relative`） */
export function DomTexture({ src, x, y, w, h, rotate, flip, opacity, className, alt }: TextureProps) {
  const transform = cssTransform({ rotate: rotate ?? 0, flip: flip === true })

  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={className}
      draggable={false}
      style={{
        position: 'absolute',
        left: `${num(x)}px`,
        top: `${num(y)}px`,
        width: sizeCss(w),
        height: sizeCss(h),
        transform,
        transformOrigin: 'center',
        opacity,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}

/**
 * 行内层：**跟文字同排**的形象格（职业 / 怪物 / NPC 形象，`skin/02-role.md` §三）。
 *
 * 与另两层共用一份 `TextureProps`，差别只在「盒从哪来」：本层**不摆到绝对坐标**，
 * 尺寸由**所在处 CSS** 决定（`.inline-texture` 是 `1em` 方框，跟着字号走、与它换掉的 emoji 同高）；
 * `rotate` / `flip` 照旧生效（`02-role.md` §二：立绘用 `flip` 表达左右）。
 * 非正方形素材靠 `object-fit: contain` 等比内缩，**绝不拉伸**（`KR-1` 只提示、不改行为）。
 */
export function InlineTexture({ src, rotate, flip, opacity, className, alt, style }: TextureProps & { style?: CSSProperties }) {
  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={className ? `inline-texture ${className}` : 'inline-texture'}
      draggable={false}
      style={{ transform: cssTransform({ rotate: rotate ?? 0, flip: flip === true }), opacity, ...style }}
    />
  )
}
