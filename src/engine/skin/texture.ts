/**
 * 贴图**取图与落位的通用算法**（`skin.md` §四）：素材三写法归一 → 一张图 ＋ 变换参数。
 *
 * 道路有自己的合成规则（`road.ts`：切片名 → 槽位 → 姿态角），其余各节（`role` / `misc` /
 * `window` / `item` / `building` …）都走这里。取图结果只有「哪张图 ＋ 什么变换」这一种形状，
 * **业务代码据此画图即可，不判断素材类型**（§四「业务代码内禁止判断素材类型」，也不写
 * `if (is9Patch)`——九宫格只落在 `TextureRef.slice` 这一个字段上，V1 渲染侧按拉伸处理）。
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
  /** 九宫格切片（容器类才有）；**V1 不解析**，渲染侧按拉伸处理，是 D6 的参数位 */
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

/** 填充方式；V1 只实现 `stretch`，其余两项是参数位（D6） */
export type TextureMode = 'stretch' | 'nine' | 'tile'

/**
 * 生效的填充方式（§四）：`nine` / `tile` 未解析前一律按 `stretch` 处理。
 * 渲染侧只调这一处，D6 落地九宫格 / 平铺时也只有这里要改。
 */
export function effectiveMode(_mode?: TextureMode): 'stretch' {
  return 'stretch'
}
