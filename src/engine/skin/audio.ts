/**
 * 音频的取值与校验（`skin/07-audio.md` §二 / §三 / §五）：**纯函数，V1 不播放**。
 *
 * V1 只做两件事——
 * 1. **解析**：把 manifest 的 `audio` 收成明确的一档取值（场景键 → 曲目、事件键 → 音源），
 *    把「字符串写法」「对象写法」「缺省值」「越界音量」这些分支一次算清，播放侧不再自己判形状；
 * 2. **校验**：算出 §五 里**不需要解码素材**的那几条（`KA-2` 事件键越界、`KA-3` 音量越界），
 *    连同包级检查一起变成加载期提示（`SkinIssue`）。
 *
 * 不在这里的：`KA-1`（路径不存在）由包级 `KP-2` 判、`KA-4`（文件体积）在 `io/pp.ts` 里判
 * （要读包内条目长度）；**播放**（`AudioContext`、音量偏好）已随 **V2.2** 落地（见
 * `docs/design/skin/07-audio.md` §8.2），`loop` 时长检查 `KA-5` **仍未接**。
 *
 * 与各节一致的规矩：**场景 / 事件之间不互相借用**——配了 `battle` 不会让 `map` 有曲子。
 */

import {
  BGM_SCENES,
  SFX_EVENTS,
  type BgmScene,
  type SfxEvent,
  type SkinAudio,
  type SkinBgm,
  type SkinPath,
  type SkinSfxObject,
} from '../../types'

/** BGM 缺省音量（§二） */
export const BGM_DEFAULT_VOLUME = 0.5
/** BGM 缺省是否循环（§二） */
export const BGM_DEFAULT_LOOP = true
/** 音效缺省音量（§二） */
export const SFX_DEFAULT_VOLUME = 0.8

/** 单个音频文件的体积提示阈值（`KA-4`，§五 暂定 2 MB） */
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024

/** 一条解析好的 BGM */
export interface BgmTrack {
  file: SkinPath
  loop: boolean
  volume: number
}

/** 一条解析好的音效 */
export interface SfxTrack {
  file: SkinPath
  volume: number
}

/**
 * 音量规整（`KA-3`）：**超出 0–1 一律截断**到边界，缺位或不是有限数则用缺省值。
 *
 * 「截断并提示」是 §五 写明的处理——不静音、不换算，只是夹回可用区间。
 */
export function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** 取某个场景的 BGM；未配该场景即 `undefined`（不跨场景借用） */
export function bgmOf(audio: SkinAudio | undefined, scene: BgmScene): SkinBgm | undefined {
  return audio?.bgm?.[scene]
}

/** 取某个事件的音效原值（字符串或对象）；未配该事件即 `undefined`（不跨事件借用） */
export function sfxOf(
  audio: SkinAudio | undefined,
  event: SfxEvent,
): string | SkinSfxObject | undefined {
  return audio?.sfx?.[event]
}

/** 某个场景的完整取值：路径 ＋ `loop`（缺省 `true`）＋ `volume`（缺省 `0.5`、越界截断） */
export function bgmTrackOf(audio: SkinAudio | undefined, scene: BgmScene): BgmTrack | undefined {
  const bgm = bgmOf(audio, scene)
  if (bgm === undefined) return undefined
  return {
    file: bgm.file,
    loop: bgm.loop ?? BGM_DEFAULT_LOOP,
    volume: clampVolume(bgm.volume, BGM_DEFAULT_VOLUME),
  }
}

/** 某个事件的完整取值：路径 ＋ `volume`（缺省 `0.8`、越界截断） */
export function sfxTrackOf(audio: SkinAudio | undefined, event: SfxEvent): SfxTrack | undefined {
  const sfx = sfxOf(audio, event)
  if (sfx === undefined) return undefined
  if (typeof sfx === 'string') return { file: sfx, volume: SFX_DEFAULT_VOLUME }
  return { file: sfx.file, volume: clampVolume(sfx.volume, SFX_DEFAULT_VOLUME) }
}

/**
 * `KA-2`：`sfx` 里**不在 §三 事件清单内**的键，原样列出（这些键一律忽略）。
 *
 * 参数收的是 `unknown`——它判的正是「JSON 里写了个清单外的名字」，类型层挡不住这种情况。
 */
export function unknownSfxEvents(audio: SkinAudio | undefined): string[] {
  const sfx = (audio?.sfx ?? {}) as Record<string, unknown>
  const known = SFX_EVENTS as readonly string[]
  return Object.keys(sfx).filter((key) => !known.includes(key))
}

/**
 * `KA-3`：`volume` 超出 0–1（或不是有限数）的项，出处形如 `audio.bgm.map.volume`。
 *
 * 与 `clampVolume()` 是同一判据的两种用法：取值时夹回区间，报清单时把出处交出来。
 */
export function outOfRangeVolumes(audio: SkinAudio | undefined): string[] {
  const out: string[] = []
  const bad = (value: unknown) => typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > 1)

  for (const scene of BGM_SCENES) {
    if (bad(audio?.bgm?.[scene]?.volume)) out.push(`audio.bgm.${scene}.volume`)
  }
  for (const event of SFX_EVENTS) {
    const sfx = (audio?.sfx ?? {})[event]
    if (sfx !== undefined && typeof sfx === 'object' && bad(sfx.volume)) out.push(`audio.sfx.${event}.volume`)
  }
  return out
}
