/**
 * 贴图**取图与落位的通用算法**（`skin.md` §四）：素材三写法归一 → 一张图 ＋ 变换参数。
 *
 * 道路有自己的合成规则（`road.ts`：切片名 → 槽位 → 姿态角），其余各节（`role` / `misc` /
 * `window` / `item` / `building` …）都走这里。取图结果只有「哪张图 ＋ 什么变换」这一种形状，
 * **业务代码据此画图即可，不判断素材类型**（§四「业务代码内禁止判断素材类型」，也不写
 * `if (is9Patch)`——九宫格只落在 `TextureRef.slice` 这一个字段上，**带不带切片决定铺法**）。
 *
 * 本模块是**纯函数**：不生成标记语言、不碰 DOM。SVG 层与 DOM 层各自把 `TexturePlacement`
 * 翻译成自己的写法（`ui/Texture.tsx`），两层共用同一份几何。
 */

import { joinSkinPath, type SkinImage, type SkinPath, type SkinSlice, type SkinSprite, type SkinTexture } from '../../types'

/** 姿态下标：`0`–`3` 对应 `N / E / S / W`（与数组写法的顺序一致） */
export type PoseIndex = 0 | 1 | 2 | 3

/** 取图结果：**这一处该画的那张图** ＋ 需要施加的变换 */
export interface TextureRef {
  /** 相对包根的素材路径（拼过 `base`，可直接交给素材源换地址） */
  src: SkinPath
  /**
   * 顺时针旋转角（度）：单张写法含该元素的姿态角（`index × 90`）与素材自身的纠偏角；
   * 数组写法恒为 `0`——姿态已体现在所选的那张图上。
   */
  rotate: number
  /** 水平镜像：只有图引用对象显式写了 `flip` 才为真 */
  flip: boolean
  /** 数组写法时的下标；其余写法为 `undefined` */
  index?: PoseIndex
  /** 九宫格切片（容器类才有）；**带了即走九宫格、不带即整图拉伸**（`surfaceMode()` 判） */
  slice?: SkinSlice
}

/** 角度归一化到 `[0, 360)`，容忍负数与超过一圈的取值 */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  return ((deg % 360) + 360) % 360
}

/** 单张写法（`SkinTexture`）：字符串 / 图引用对象 → 取图结果 */
export function textureRef(texture: SkinTexture | undefined, base?: SkinPath): TextureRef | undefined {
  if (texture === undefined) return undefined
  if (typeof texture === 'string') return { src: joinSkinPath(base, texture), rotate: 0, flip: false }
  return objectRef(texture, 0, base)
}

/**
 * 三写法（`skin.md` §五）：一张 / 一张 ＋ 纠偏角 / 四张。
 *
 * @param sprite 该元素的素材字段
 * @param index  该元素的姿态；无朝向元素（棋子 / 立绘）不传
 * @param base   目录前缀，只有道路样式集用得上（`styles[].base`）
 *
 * 数组写法按 `index` 取第 `index` 张、**不旋转**；`index` 未给时取第 `0` 张（`N`）。
 * 缺中间项（数组短了）即该向取不到图，返回 `undefined` 让渲染侧回退程序绘制。
 */
export function spriteRef(sprite: SkinSprite | undefined, index?: PoseIndex, base?: SkinPath): TextureRef | undefined {
  if (sprite === undefined) return undefined

  if (Array.isArray(sprite)) {
    const i = (index ?? 0) as PoseIndex
    const file = sprite[i]
    if (file === undefined) return undefined
    return { src: joinSkinPath(base, file), rotate: 0, flip: false, index: i }
  }

  if (typeof sprite === 'string') {
    return { src: joinSkinPath(base, sprite), rotate: poseAngle(index), flip: false }
  }

  return objectRef(sprite, poseAngle(index), base)
}

/** 姿态角：单张图在四向元素上按顺时针 `90° × index` 摆正 */
function poseAngle(index: PoseIndex | undefined): number {
  return index === undefined ? 0 : index * 90
}

/** 图引用对象：纠偏角由素材自己带（`rotate`），与姿态角相加 */
function objectRef(image: SkinImage, turn: number, base?: SkinPath): TextureRef {
  return {
    src: joinSkinPath(base, image.img),
    rotate: normalizeAngle(turn + (image.rotate ?? 0)),
    flip: image.flip === true,
    ...(image.slice ? { slice: image.slice } : {}),
  }
}

/**
 * 盒尺寸：数值按所在层的单位；**`auto` 表示尺寸交给素材自身像素**——画布背景
 * 没有「多大一个盒」可言（`skin/05-canvas.md` §三 只给出缩放倍率与落点），
 * 渲染侧据此不写尺寸属性，由浏览器按图片原始像素画。
 */
export type TextureSize = number | 'auto'

/** 贴图落位的目标盒（调用方按格子 / 面板尺寸算好，单位随所在层） */
export interface TextureBox {
  x: number
  y: number
  w: TextureSize
  h: TextureSize
}

/** 落位结果：盒 ＋ 变换参数（SVG 与 DOM 各自翻译成自己的写法） */
export interface TexturePlacement extends TextureBox {
  /** 顺时针旋转角，已归一化 */
  rotate: number
  flip: boolean
}

/**
 * 落位：把取图结果放进目标盒。V1 一律**拉伸**到盒；旋转与镜像都**绕盒心**做，
 * 故这里只交出角度与镜像两个数，绕心的合成由各层自己完成（SVG 用 `transform`，DOM 用 CSS）。
 *
 * 盒尺寸可以是 `auto`（画布背景）：此时量不出盒心，**这类元素不参与旋转 / 镜像**
 * （背景节本来也没有 `rotate` / `flip`），旋转交由各自渲染层在量不出盒心时忽略。
 */
export function placeTexture(box: TextureBox, ref: TextureRef | undefined): TexturePlacement | undefined {
  if (ref === undefined) return undefined
  return { ...box, rotate: normalizeAngle(ref.rotate), flip: ref.flip }
}

/** 填充方式（§3.3） */
export type TextureMode = 'stretch' | 'nine' | 'tile'

/** 生效的填充方式 */
export type EffectiveMode = 'stretch' | 'nine' | 'tile'

/**
 * 生效的填充方式（§四）：**策略由调用方给、切片由素材给**，两者齐备才成立。
 *
 * - `nine` 要**同时**拿到策略与 `slice`——没给切片参数就无从切起，与「字符串写法」一样回落 `stretch`
 *   （`03-window.md` §六 `KW-1`：随视口族素材非 `.9.png` 时按整图拉伸，`KW-1` 会点名提示，正是这条回落）；
 * - `tile` 不需要切片，独立成立；
 * - 渲染侧只调这一处，各层各自把结果翻译成自己的写法（DOM 用 `border-image`、SVG 内切块拼装）。
 */
export function effectiveMode(mode?: TextureMode, slice?: SkinSlice): EffectiveMode {
  if (mode === 'nine') return slice === undefined ? 'stretch' : 'nine'
  if (mode === 'tile') return 'tile'
  return 'stretch'
}

/**
 * 衬底 / 格子这类**背景铺法**的默认策略：**素材带了 `slice` 就按九宫格**。
 *
 * 依据 `03-window.md` §二：随视口族、随内容族、单向族**都要求九宫格**（非 `.9.png` 会被 `KW-3`
 * 点名提示），固定族则尺寸写死、整图拉伸即可。两族的区别不在「要不要九宫格」，而在**素材有没有
 * 交切片**——交了就切，没交就整图拉伸。故这一处不需要调用方多传参数：调用方接口保持 `(ref, assets, fit)`。
 */
export function surfaceMode(ref: TextureRef | undefined): EffectiveMode {
  if (ref?.slice === undefined) return 'stretch'
  return effectiveMode('nine', ref.slice)
}

/** 源图的内在像素尺寸（九宫格切块要按**图片像素**量四边，`io/image-size.ts` 供数） */
export interface TextureSource {
  width: number
  height: number
}

/**
 * **九宫格的一块**：源区（`s*`，图片像素）→ 落区（`d*`，所在层单位）。
 *
 * 四角**原样**（源区多大、落区就多大）、四边**单向拉伸**、中心**双向拉伸**，
 * 与 DOM 层的 CSS `border-image` 逐块对应（§3.3「两侧实现可以不同，调用方接口必须相同」）。
 */
export interface NineTile {
  /** 源区左上角 Ｘ（图片像素） */
  sx: number
  /** 源区左上角 Ｙ（图片像素） */
  sy: number
  /** 源区宽（图片像素） */
  sw: number
  /** 源区高（图片像素） */
  sh: number
  /** 落区左上角 Ｘ（所在层单位） */
  dx: number
  /** 落区左上角 Ｙ（所在层单位） */
  dy: number
  /** 落区宽（所在层单位） */
  dw: number
  /** 落区高（所在层单位） */
  dh: number
}

/**
 * **一轴的三段**：`[起始, 中段, 末尾]`，三段之和恒为 `total`。
 *
 * 两角之和没超轴长时**中段吃余量**（角原样）；超了就**按比例收角、中段归零**——
 * 盒比四角还小时不至于把中段挤成负数（这正是 SVG 内切块拼装**必须**的夹取，
 * 与 CSS `border-image` 在盒过小时的表现一致）。
 */
function thirds(lead: number, trail: number, total: number): [number, number, number] {
  const a = Math.max(0, lead)
  const b = Math.max(0, trail)
  if (a + b <= total) return [a, total - a - b, b]
  const scale = total / (a + b)
  return [a * scale, 0, b * scale]
}

/**
 * **九宫格切块**（`skin.md` §3.3、`03-window.md` §二）：切片 ＋ 源图尺寸 ＋ 目标盒 → 九块。
 *
 * 十块中的四角落到**切片给定的像素尺寸**（与 DOM 层 `border-image-width` 取切片像素同一口径），
 * 四边与中心吃余量。返回 `undefined` 的情形有两种，都让渲染侧回落整图拉伸：
 * 盒尺寸是 `auto`（量不出盒，画布背景那类）、源图尺寸未知（`sizeOf()` 取不到，格式不支持）。
 *
 * 顺序为**行优先**：左上、上、右上、左、中、右、左下、下、右下——三行各三块。
 */
export function nineSliceTiles(
  box: TextureBox,
  slice: SkinSlice,
  source: TextureSource,
): NineTile[] | undefined {
  if (typeof box.w !== 'number' || typeof box.h !== 'number') return undefined
  if (source.width < 1 || source.height < 1) return undefined

  const [top, right, bottom, left] = slice.map((side) => Math.max(0, side))

  // 源轴：按图片像素切；落轴：四角取同一批像素值（层单位 1:1 对应图片像素），中段吃盒余量
  const [swTop, swMid, swBottom] = thirds(top, bottom, source.height)
  const [swLeft, swMidX, swRight] = thirds(left, right, source.width)
  const [dhTop, dhMid, dhBottom] = thirds(top, bottom, box.h)
  const [dwLeft, dwMidX, dwRight] = thirds(left, right, box.w)

  const sx = [0, swLeft, swLeft + swMidX]
  const sw = [swLeft, swMidX, swRight]
  const sy = [0, swTop, swTop + swMid]
  const sh = [swTop, swMid, swBottom]
  const dx = [box.x, box.x + dwLeft, box.x + dwLeft + dwMidX]
  const dw = [dwLeft, dwMidX, dwRight]
  const dy = [box.y, box.y + dhTop, box.y + dhTop + dhMid]
  const dh = [dhTop, dhMid, dhBottom]

  const tiles: NineTile[] = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      tiles.push({
        sx: sx[col],
        sy: sy[row],
        sw: sw[col],
        sh: sh[row],
        dx: dx[col],
        dy: dy[row],
        dw: dw[col],
        dh: dh[row],
      })
    }
  }
  return tiles
}
