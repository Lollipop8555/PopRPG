/**
 * 运行期音频 store（`skin/07-audio.md` §二 / §三 / §四）：**界面侧碰声音的唯一口径**。
 *
 * 与图像侧的 `store/skin.ts` 同构：这一层只做三件事，别的一概不做——
 * 1. 把**用户偏好**（总音量 / 静音，属用户配置，§二「本节不接管」）落 `localStorage`（key `poprpg_audio`）；
 * 2. 从**当前生效皮肤**（`useSkinStore` 的 `skin`）解析出 BGM / 音效的曲目与字节，交给运行期；
 * 3. 把「当前场景」「换肤重载」「释放」编排到 `io/audio-runtime.ts`。
 *
 * 出声的全部逻辑在 `audio-runtime.ts`；**未启用皮肤时一切静音**——解析拿不到曲目，播放请求自然落空。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BgmScene, SfxEvent } from '../types'
import { bgmTrackOf, sfxTrackOf } from '../engine/skin/audio'
import { skinBytesOf } from '../io/pp'
import { createAudioRuntime, type AudioRuntime, type AudioTrack } from '../io/audio-runtime'
import { useSkinStore } from './skin'
import { pickStorage } from './storage'

/** 偏好落盘的 `localStorage` 键（用户配置，跨工程存活） */
export const AUDIO_STORAGE_KEY = 'poprpg_audio'

/** 全局单例运行期（应用侧唯一） */
const runtime: AudioRuntime = createAudioRuntime()

/** 从当前生效皮肤解析一条 BGM；未启用皮肤或缺该场景即 `undefined`（静音） */
function resolveBgm(scene: BgmScene): AudioTrack | undefined {
  const skin = useSkinStore.getState().skin
  if (!skin) return undefined
  const track = bgmTrackOf(skin.manifest.audio, scene)
  if (!track) return undefined
  return {
    file: track.file,
    volume: track.volume,
    loop: track.loop,
    fade: track.fade,
    bytes: skinBytesOf(skin, track.file),
  }
}

/** 从当前生效皮肤解析一条音效；未启用皮肤或缺该事件即 `undefined`（无操作） */
function resolveSfx(event: SfxEvent): AudioTrack | undefined {
  const skin = useSkinStore.getState().skin
  if (!skin) return undefined
  const track = sfxTrackOf(skin.manifest.audio, event)
  if (!track) return undefined
  return { file: track.file, volume: track.volume, bytes: skinBytesOf(skin, track.file) }
}

export interface AudioStore {
  /** 总音量 0–1（用户偏好；越界由 `setMaster` 夹回） */
  master: number
  /** 是否静音（用户偏好） */
  muted: boolean
  /** 当前 BGM 场景（未进入游玩态时为 `undefined`） */
  scene?: BgmScene
  /** 首次用户交互时解锁音频上下文（幂等） */
  unlock(): void
  /** 切 BGM 场景；同一场景重复调用不重启曲目 */
  setScene(scene: BgmScene | undefined): void
  /** 触发一次音效（同一拍内相同事件合并） */
  sfx(event: SfxEvent): void
  setMaster(value: number): void
  setMuted(value: boolean): void
  /** 换了一套皮肤：重载运行期并按当前场景重取曲目 */
  reload(): void
  /** 释放音频（切出游玩态 / 结束一局） */
  release(): void
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set, get) => ({
      master: 1,
      muted: false,

      unlock() {
        runtime.setLevel(get().master, get().muted)
        runtime.unlock()
      },

      setScene(scene) {
        const prev = get().scene
        if (prev === scene) return
        set({ scene })
        if (scene === undefined) runtime.playBgm('home', undefined)
        else runtime.playBgm(scene, resolveBgm(scene))
      },

      sfx(event) {
        runtime.playSfx(resolveSfx(event))
      },

      setMaster(value) {
        const master = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
        set({ master })
        runtime.setLevel(master, get().muted)
      },

      setMuted(value) {
        set({ muted: value })
        runtime.setLevel(get().master, value)
      },

      reload() {
        runtime.reload()
        const scene = get().scene
        if (scene !== undefined) runtime.playBgm(scene, resolveBgm(scene))
      },

      release() {
        runtime.release()
      },
    }),
    {
      name: AUDIO_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => pickStorage()),
      partialize: (s) => ({ master: s.master, muted: s.muted }),
      // 水合后把偏好推给运行期（上下文通常还没建，`setLevel` 只是记下，解锁时再套用）
      onRehydrateStorage: () => (state) => {
        if (state) runtime.setLevel(state.master, state.muted)
      },
    },
  ),
)
