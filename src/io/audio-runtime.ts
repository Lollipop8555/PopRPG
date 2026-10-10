/**
 * 音频运行期（`skin/07-audio.md` §四）：**唯一出声的地方**。
 *
 * V2.2 起 `audio` 不再只是「解析与校验」——这里是播放侧内核，负责：
 * 1. **惰性建上下文**：纯静态环境禁止无手势播放，`unlock()` 在**首次用户交互后**才建 `AudioContext`
 *    并 `resume`（§四「不自动播放」）；未解锁前一切播放请求只记成「想要什么」，解锁即接上。
 * 2. **BGM 场景切换**：同一场景重复进入**不重启**曲目；换场景**淡出旧曲 → 淡入新曲**（时长取该曲 `fade`，缺省 `BGM_FADE_MS`）。
 * 3. **音效**：一次性播放，播完自动断连；**同一帧内多次相同事件合并为一次**（防叠音）。
 * 4. **音量与静音**：总音量走一个 `master` 节点；每条的默认音量（皮肤给的）走各自的 `GainNode`，
 *    于是改总音量不影响各条比例。
 *
 * 设计口径（与 `skin-assets.ts` 同）：**取不到字节即该条静音**，不报错、不阻断——
 * 上游（store）从包里解析出字节后传进来，本模块**不碰皮肤包**。
 * 一切浏览器能力（`AudioContext` / `decodeAudioData` / 定时器）均可注入，故可在 jsdom 里用假上下文验证。
 */

import type { BgmScene } from '../types'
import { mimeOf } from './skin-assets'

/** BGM 换场景时的**缺省**淡入 / 淡出时长（§2.1 默认 600ms；皮肤可按曲目覆盖，见 `AudioTrack.fade`） */
export const BGM_FADE_MS = 600

/**
 * 交给运行期播放的一条音轨。`bytes` 缺省（缺素材 / 未启用皮肤）即该条静音。
 * `volume` 已是**解析后**的取值（缺省与越界都在 `engine/skin/audio.ts` 里算清）。
 */
export interface AudioTrack {
  file: string
  volume: number
  /** 仅 BGM 有意义；缺省按循环处理 */
  loop?: boolean
  /** 仅 BGM 有意义：换场景时该曲的淡入 / 淡出时长（毫秒），缺省 `BGM_FADE_MS`；`0` 表示立即切换 */
  fade?: number
  bytes?: Uint8Array
}

export interface AudioRuntimeDeps {
  /** 建音频上下文；缺省走浏览器 `AudioContext`（含 `webkit` 回退）。返回 `undefined` 即环境不支持 */
  createContext?: () => AudioContext | undefined
  /** 解码一段字节；缺省走 `ctx.decodeAudioData`。失败返回 `undefined`（该条静音），不抛出 */
  decode?: (ctx: AudioContext, bytes: Uint8Array, mime: string) => Promise<AudioBuffer | undefined>
  /** 定时器（淡出清理 / 音效合并窗口）；缺省 `setTimeout`，注入便于测试 */
  setTimer?: (fn: () => void, ms: number) => number
}

export interface AudioRuntime {
  /** 首次用户交互时调用：建上下文并 `resume`，随后接上「想要的 BGM」；幂等 */
  unlock(): void
  /** 上下文是否已就绪（可出声） */
  ready(): boolean
  /** 当前正在播放的 BGM 场景；没在播返回 `undefined`（测试 / 调试用） */
  playingBgm(): BgmScene | undefined
  /** 切 BGM 场景；`track` 缺省表示该场景静音（淡出旧曲）。同场景同曲不重启 */
  playBgm(scene: BgmScene, track: AudioTrack | undefined): void
  /** 触发一次音效；`track` 缺省或取不到字节即无操作 */
  playSfx(track: AudioTrack | undefined): void
  /** 设置总音量（0–1，越界夹回）与静音 */
  setLevel(master: number, muted: boolean): void
  /** 换了一套皮肤：停掉当前 BGM、清空解码缓存，并按「想要的」重取（**不关上下文**，保留解锁态） */
  reload(): void
  /** 彻底释放：停播、清缓存、关上下文 */
  release(): void
}

function defaultCreateContext(): AudioContext | undefined {
  const g = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (!Ctor) return undefined
  try {
    return new Ctor()
  } catch {
    return undefined
  }
}

async function defaultDecode(ctx: AudioContext, bytes: Uint8Array): Promise<AudioBuffer | undefined> {
  // 复制一份，避免 `decodeAudioData` 解走调用方仍在别的线程引用的缓冲区
  return await ctx.decodeAudioData(new Uint8Array(bytes).buffer as ArrayBuffer)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export function createAudioRuntime(deps: AudioRuntimeDeps = {}): AudioRuntime {
  const createContext = deps.createContext ?? defaultCreateContext
  const decode = deps.decode ?? ((ctx, bytes) => defaultDecode(ctx, bytes))
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number)

  let ctx: AudioContext | undefined
  let master: GainNode | undefined
  let level = 1
  let muted = false

  /** 当前在播的 BGM（`undefined` 即没在播） */
  let current: { source: AudioBufferSourceNode; gain: GainNode } | undefined
  let playingScene: BgmScene | undefined
  /** 「想要的」BGM：解锁前 / 解码未完成时先记下，就绪即接上 */
  let desired: { scene: BgmScene; track: AudioTrack } | undefined
  /** 换场次的令牌：异步解码回来时若已过期就丢弃，避免快速切换时的乱序 */
  let token = 0

  /** 解码缓存：`undefined` 值表示「试过且失败」，避免重复解码同一条 */
  const buffers = new Map<string, AudioBuffer | undefined>()
  const inflight = new Map<string, Promise<AudioBuffer | undefined>>()

  /** 音效合并窗口：同一批（同一拍）里相同的文件只播一次 */
  const burst = new Set<string>()
  let bursting = false

  function applyMaster(): void {
    if (master) master.gain.value = muted ? 0 : level
  }

  /** 解码（带缓存与在途去重）；无上下文或失败都返回 `undefined` */
  async function decodeOf(track: AudioTrack): Promise<AudioBuffer | undefined> {
    if (!ctx || !track.bytes) return undefined
    if (buffers.has(track.file)) return buffers.get(track.file)
    const running = inflight.get(track.file)
    if (running) return running
    const promise = decode(ctx, track.bytes, mimeOf(track.file))
      .then((buffer) => {
        buffers.set(track.file, buffer)
        inflight.delete(track.file)
        return buffer
      })
      .catch(() => {
        buffers.set(track.file, undefined)
        inflight.delete(track.file)
        return undefined
      })
    inflight.set(track.file, promise)
    return promise
  }

  /** 淡出并停掉当前 BGM；`ms` 内线性降到 0 后停源断连 */
  function fadeOutCurrent(ms: number): void {
    const c = current
    current = undefined
    if (!c || !ctx) return
    const sec = ms / 1000
    try {
      const now = ctx.currentTime
      c.gain.gain.cancelScheduledValues(now)
      c.gain.gain.setValueAtTime(c.gain.gain.value, now)
      c.gain.gain.linearRampToValueAtTime(0, now + sec)
    } catch {
      /* 上下文可能已关；直接停 */
    }
    setTimer(() => {
      try {
        c.source.stop()
      } catch {
        /* 已停 */
      }
      try {
        c.source.disconnect()
        c.gain.disconnect()
      } catch {
        /* 已断 */
      }
    }, ms)
  }

  /** 按 `desired` 把 BGM 落到实际播放；异步（解码）后校验令牌 */
  async function applyBgm(myToken: number): Promise<void> {
    if (!ctx || !master) return
    const want = desired
    if (!want) {
      if (current) fadeOutCurrent(BGM_FADE_MS)
      playingScene = undefined
      return
    }
    // 同场景已在播：只更新该条音量（换曲由 `reload()` 走强制重启）
    if (current && playingScene === want.scene) {
      try {
        current.gain.gain.value = want.track.volume
      } catch {
        /* 忽略 */
      }
      return
    }
    const fade = want.track.fade ?? BGM_FADE_MS
    const buffer = await decodeOf(want.track)
    if (myToken !== token || !ctx || !master) return
    if (!buffer) return
    if (current) fadeOutCurrent(fade)
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(master)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = want.track.loop ?? true
    source.connect(gain)
    source.start()
    try {
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(want.track.volume, now + fade / 1000)
    } catch {
      gain.gain.value = want.track.volume
    }
    current = { source, gain }
    playingScene = want.scene
  }

  /** 同一拍内相同文件只放一次 */
  function inBurst(file: string): boolean {
    if (burst.has(file)) return true
    burst.add(file)
    if (!bursting) {
      bursting = true
      setTimer(() => {
        burst.clear()
        bursting = false
      }, 0)
    }
    return false
  }

  return {
    unlock() {
      if (!ctx) {
        ctx = createContext()
        if (!ctx) return
        master = ctx.createGain()
        master.connect(ctx.destination)
        applyMaster()
      }
      try {
        void ctx.resume()
      } catch {
        /* 某些宿主无 resume */
      }
      void applyBgm(++token)
    },

    ready: () => ctx !== undefined,

    playingBgm: () => playingScene,

    playBgm(scene, track) {
      if (!track || !track.bytes) {
        desired = undefined
      } else {
        desired = { scene, track }
      }
      void applyBgm(++token)
    },

    playSfx(track) {
      if (!ctx || !master || !track || !track.bytes) return
      if (inBurst(track.file)) return
      void decodeOf(track).then((buffer) => {
        if (!ctx || !master || !buffer) return
        const gain = ctx.createGain()
        gain.gain.value = track.volume
        gain.connect(master)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(gain)
        source.onended = () => {
          try {
            source.disconnect()
            gain.disconnect()
          } catch {
            /* 已断 */
          }
        }
        source.start()
      })
    },

    setLevel(next, nextMuted) {
      level = clamp01(next)
      muted = nextMuted
      applyMaster()
    },

    reload() {
      token++
      if (current) fadeOutCurrent(0)
      playingScene = undefined
      buffers.clear()
      inflight.clear()
      burst.clear()
      bursting = false
      void applyBgm(++token)
    },

    release() {
      token++
      if (current) {
        const c = current
        current = undefined
        try {
          c.source.stop()
          c.source.disconnect()
          c.gain.disconnect()
        } catch {
          /* 已停 */
        }
      }
      playingScene = undefined
      desired = undefined
      buffers.clear()
      inflight.clear()
      burst.clear()
      bursting = false
      const closing = ctx
      ctx = undefined
      master = undefined
      try {
        void closing?.close()
      } catch {
        /* 忽略 */
      }
    },
  }
}
