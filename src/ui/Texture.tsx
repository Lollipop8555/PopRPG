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
 * - V1 只有拉伸；`nine` / `tile` 由 `effectiveMode` 回落（D6 落地）
 */

import type { CSSProperties } from 'react'
import {
  effectiveMode,
  placeTexture,
  type TextureBox,
  type TextureMode,
  type TexturePlacement,
  type TextureRef,
  type TextureSize,
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
  /** 填充方式；V1 只认 `stretch` */
  mode?: TextureMode
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

  return { ...placement, src, ...extra }
}

/**
 * **容器衬底**（`skin/03-window.md`）：与上三层同吃「取图结果 → 可用地址」，差别在落法——
 * 不摆到坐标、不量盒，而是把图**铺满所在容器的整个背景**（`background-size: 100% 100%`）。
 *
 * 只服务**尺寸由窗口决定**的随视口族容器（对话框 / 抽屉 / 气泡，§二）：它们量不出「多大一个盒」，
 * 底纹也不需要 `rotate` / `flip`，故这里只取 `src`；圆角、描边、阴影仍归容器自己的 CSS——
 * 素材铺在 `background-color` 之上、被圆角剪裁，正是 §五「素材只提供纸面底纹」的落法。
 *
 * 返回 `undefined`（未配该键、包里缺这张图）即调用方不传 `style`，CSS 纸面照旧。
 * V1 一律拉伸；D6 落地九宫格时，这里改出 `border-image` 即可，调用方接口不变。
 */
export function surfaceStyle(
  ref: TextureRef | undefined,
  assets: SkinAssets,
): CSSProperties | undefined {
  if (ref === undefined) return undefined
  const src = assets.urlOf(ref.src)
  if (src === undefined) return undefined

  // 只写 image / size / repeat：**不动 `background-color`**——底纹可以带透明，
  // 纸面底色得留着（衔接处不露白）
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
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

/** SVG 层：画在既有 `<svg>` 里（地图 / 画布 / 棋子） */
export function SvgTexture({ src, x, y, w, h, rotate, flip, mode, opacity, className, alt }: TextureProps) {
  const placement: TexturePlacement = { x, y, w, h, rotate: rotate ?? 0, flip: flip === true }
  return (
    <image
      href={src}
      x={x}
      y={y}
      // `auto` 不写尺寸属性：SVG2 按素材原始像素出图（画布背景的唯一写法，`05-canvas.md` §三）
      width={isAuto(w) ? undefined : w}
      height={isAuto(h) ? undefined : h}
      preserveAspectRatio={effectiveMode(mode) === 'stretch' ? 'none' : 'xMidYMid meet'}
      transform={svgTransform(placement)}
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
 * 与另两层同吃一份 `TextureProps`，差别只在「盒从哪来」：本层**不摆到绝对坐标**，
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
