/**
 * 音频取值与校验（`skin/07-audio.md` §二 / §三 / §五）：V1 只解析与校验，不播放。
 *
 * 两条主线：
 * - **解析**：字符串 / 对象两种写法、缺省 `loop`·`volume`、越界音量的截断，一次算清；
 * - **校验**：`KA-2`（事件键越界）与 `KA-3`（音量越界）的判据——同一判据在取值时是「夹回」，
 *   在报清单时是「交出出处」。
 *
 * 与各节一致：**场景 / 事件之间不互相借用**。
 */

import { describe, expect, it } from 'vitest'
import {
  AUDIO_MAX_BYTES,
  BGM_DEFAULT_LOOP,
  BGM_DEFAULT_VOLUME,
  SFX_DEFAULT_VOLUME,
  bgmOf,
  bgmTrackOf,
  clampVolume,
  outOfRangeVolumes,
  sfxOf,
  sfxTrackOf,
  unknownSfxEvents,
} from '../audio'
import type { SkinAudio } from '../../../types'

const audio: SkinAudio = {
  bgm: {
    home: { file: 'audio/bgm/home.ogg' },
    map: { file: 'audio/bgm/map.ogg', volume: 0.3 },
    battle: { file: 'audio/bgm/battle.ogg', loop: false, volume: 0.9 },
  },
  sfx: {
    hit: 'audio/sfx/hit.ogg',
    coin: { file: 'audio/sfx/coin.ogg', volume: 0.6 },
  },
}

describe('BGM 取值（§二 / §三）', () => {
  it('按场景各查自己的场景：配了三个就有三个', () => {
    expect(bgmOf(audio, 'map')?.file).toBe('audio/bgm/map.ogg')
    expect(bgmTrackOf(audio, 'map')).toEqual({
      file: 'audio/bgm/map.ogg',
      loop: BGM_DEFAULT_LOOP,
      volume: 0.3,
    })
  })

  it('缺省值：`loop` 缺省 `true`、`volume` 缺省 `0.5`', () => {
    expect(bgmTrackOf(audio, 'home')).toEqual({
      file: 'audio/bgm/home.ogg',
      loop: true,
      volume: BGM_DEFAULT_VOLUME,
    })
  })

  it('显式写法照用：`loop: false` 与自带音量都保留', () => {
    expect(bgmTrackOf(audio, 'battle')).toEqual({
      file: 'audio/bgm/battle.ogg',
      loop: false,
      volume: 0.9,
    })
  })

  it('未配该场景即取不到：`map` 的曲子不会借给别的场景', () => {
    expect(bgmOf({ bgm: { map: { file: 'audio/bgm/map.ogg' } } }, 'home')).toBeUndefined()
    expect(bgmTrackOf(undefined, 'home')).toBeUndefined()
    expect(bgmTrackOf({}, 'home')).toBeUndefined()
  })
})

describe('音效取值（§二 / §三）', () => {
  it('字符串写法：路径照用、音量用缺省 `0.8`', () => {
    expect(sfxOf(audio, 'hit')).toBe('audio/sfx/hit.ogg')
    expect(sfxTrackOf(audio, 'hit')).toEqual({ file: 'audio/sfx/hit.ogg', volume: SFX_DEFAULT_VOLUME })
  })

  it('对象写法：路径与音量都照用', () => {
    expect(sfxTrackOf(audio, 'coin')).toEqual({ file: 'audio/sfx/coin.ogg', volume: 0.6 })
  })

  it('未配该事件即取不到：`hit` 的音效不会借给别的键', () => {
    expect(sfxOf(audio, 'pickup')).toBeUndefined()
    expect(sfxTrackOf(audio, 'pickup')).toBeUndefined()
    expect(sfxTrackOf(undefined, 'hit')).toBeUndefined()
  })
})

describe('音量规整 `KA-3`（§五）', () => {
  it('0–1 内原样保留，含两端', () => {
    expect(clampVolume(0, SFX_DEFAULT_VOLUME)).toBe(0)
    expect(clampVolume(1, SFX_DEFAULT_VOLUME)).toBe(1)
    expect(clampVolume(0.42, SFX_DEFAULT_VOLUME)).toBe(0.42)
  })

  it('越界截断到边界：不静音、不换算', () => {
    expect(clampVolume(-0.5, SFX_DEFAULT_VOLUME)).toBe(0)
    expect(clampVolume(1.5, SFX_DEFAULT_VOLUME)).toBe(1)
    expect(clampVolume(99, SFX_DEFAULT_VOLUME)).toBe(1)
  })

  it('缺位、非数、`NaN` / `Infinity` 一律用缺省值', () => {
    expect(clampVolume(undefined, BGM_DEFAULT_VOLUME)).toBe(BGM_DEFAULT_VOLUME)
    expect(clampVolume('0.4', BGM_DEFAULT_VOLUME)).toBe(BGM_DEFAULT_VOLUME)
    expect(clampVolume(Number.NaN, BGM_DEFAULT_VOLUME)).toBe(BGM_DEFAULT_VOLUME)
    expect(clampVolume(Number.POSITIVE_INFINITY, BGM_DEFAULT_VOLUME)).toBe(BGM_DEFAULT_VOLUME)
  })

  it('取值时夹回：越界的 `volume` 也拿得到可用值', () => {
    const loud: SkinAudio = { sfx: { hit: { file: 'audio/sfx/hit.ogg', volume: 3 } } }
    expect(sfxTrackOf(loud, 'hit')).toEqual({ file: 'audio/sfx/hit.ogg', volume: 1 })
  })
})

describe('`KA-2` 事件键越界（§五）', () => {
  it('清单内的键不算越界', () => {
    expect(unknownSfxEvents(audio)).toEqual([])
  })

  it('清单外的键原样列出（这些键一律忽略）', () => {
    const odd = { sfx: { hit: 'audio/sfx/hit.ogg', boom: 'audio/sfx/boom.ogg' } } as unknown as SkinAudio
    expect(unknownSfxEvents(odd)).toEqual(['boom'])
  })

  it('没有 audio 或没有 sfx 即无越界', () => {
    expect(unknownSfxEvents(undefined)).toEqual([])
    expect(unknownSfxEvents({})).toEqual([])
  })
})

describe('`KA-3` 音量出处的报告（§五）', () => {
  it('都在 0–1 内即无报告', () => {
    expect(outOfRangeVolumes(audio)).toEqual([])
  })

  it('BGM 与音效的越界都报，出处形如 `audio.bgm.map.volume`', () => {
    const odd = {
      bgm: { map: { file: 'audio/bgm/map.ogg', volume: 2 } },
      sfx: { hit: { file: 'audio/sfx/hit.ogg', volume: -1 } },
    } as SkinAudio
    expect(outOfRangeVolumes(odd)).toEqual(['audio.bgm.map.volume', 'audio.sfx.hit.volume'])
  })

  it('字符串写法的音效没有音量可越界；缺位不算越界', () => {
    expect(outOfRangeVolumes({ sfx: { hit: 'audio/sfx/hit.ogg' } })).toEqual([])
    expect(outOfRangeVolumes({ bgm: { home: { file: 'audio/bgm/home.ogg' } } })).toEqual([])
    expect(outOfRangeVolumes(undefined)).toEqual([])
  })
})

describe('`KA-4` 的体积阈值（§五）', () => {
  it('暂定 2 MB', () => {
    expect(AUDIO_MAX_BYTES).toBe(2 * 1024 * 1024)
  })
})
