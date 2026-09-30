/**
 * 音频的加载期提示 `KA-2` / `KA-3` / `KA-4`（`skin/07-audio.md` §五）。
 *
 * 这三条**不需要解码音频**，只读 manifest 与包内条目，故 V1 起就生效；
 * `KA-1`（音频路径在包内不存在）**刻意不单列**——音频扩展名在通用收集里，
 * 同一条缺失由 `KP-2` 报一次，这里只钉住「不重复报」这个不变量。
 */

import { describe, expect, it } from 'vitest'
import { readSkin } from '../pp'
import { textBytes } from '../zip'
import { minimalPp } from '../../test/skin-fixtures'
import type { SkinIssue } from '../../types'

const codes = (issues: SkinIssue[]): string[] => issues.map((entry) => entry.code)
const detailOf = (issues: SkinIssue[], code: string): string =>
  issues.find((entry) => entry.code === code)?.detail ?? ''

const HIT = 'audio/sfx/hit.ogg'
const MAP = 'audio/bgm/map.ogg'

describe('KA-2 sfx 事件键', () => {
  it('清单内的键不提示', () => {
    const { issues } = readSkin(minimalPp({ audio: { sfx: { hit: HIT } } }, { [HIT]: textBytes('hit') }))
    expect(issues).toEqual([])
  })

  it('清单外的键给出提示、列出键名，整包照常加载', () => {
    const boom = 'audio/sfx/boom.ogg'
    const { skin, issues } = readSkin(
      minimalPp(
        { audio: { sfx: { hit: HIT, boom } } },
        { [HIT]: textBytes('hit'), [boom]: textBytes('boom') },
      ),
    )
    expect(codes(issues)).toEqual(['KA-2'])
    expect(detailOf(issues, 'KA-2')).toContain('boom')
    expect(skin).toBeDefined()
  })

  it('对象写法的合法键同样不算越界', () => {
    const { issues } = readSkin(
      minimalPp({ audio: { sfx: { coin: { file: 'audio/sfx/coin.ogg', volume: 0.6 } } } }, {
        'audio/sfx/coin.ogg': textBytes('coin'),
      }),
    )
    expect(issues).toEqual([])
  })
})

describe('KA-3 音量越界', () => {
  it('都在 0–1 内不提示', () => {
    const { issues } = readSkin(
      minimalPp({ audio: { bgm: { map: { file: MAP, volume: 0.3 } } } }, { [MAP]: textBytes('map') }),
    )
    expect(issues).toEqual([])
  })

  it('BGM 与音效的越界都提示，出处写到 `volume` 那一项', () => {
    const { issues } = readSkin(
      minimalPp(
        {
          audio: {
            bgm: { map: { file: MAP, volume: 2 } },
            sfx: { hit: { file: HIT, volume: -1 } },
          },
        },
        { [MAP]: textBytes('map'), [HIT]: textBytes('hit') },
      ),
    )
    expect(codes(issues)).toEqual(['KA-3'])
    expect(detailOf(issues, 'KA-3')).toContain('audio.bgm.map.volume')
    expect(detailOf(issues, 'KA-3')).toContain('audio.sfx.hit.volume')
  })

  it('两端（0 与 1）不算越界', () => {
    const { issues } = readSkin(
      minimalPp(
        { audio: { bgm: { map: { file: MAP, volume: 1 } }, sfx: { hit: { file: HIT, volume: 0 } } } },
        { [MAP]: textBytes('map'), [HIT]: textBytes('hit') },
      ),
    )
    expect(issues).toEqual([])
  })
})

describe('KA-4 单个音频体积', () => {
  it('刚好 2 MB 不算过大', () => {
    const { issues } = readSkin(
      minimalPp({ audio: { bgm: { map: { file: MAP } } } }, { [MAP]: new Uint8Array(2 * 1024 * 1024) }),
    )
    expect(issues).toEqual([])
  })

  it('超过 2 MB 给出提示并列出该文件', () => {
    const { issues } = readSkin(
      minimalPp(
        { audio: { bgm: { map: { file: MAP } } } },
        { [MAP]: new Uint8Array(2 * 1024 * 1024 + 1) },
      ),
    )
    expect(codes(issues)).toEqual(['KA-4'])
    expect(detailOf(issues, 'KA-4')).toContain(MAP)
  })

  it('只挑音频那几处：同包里的超大图片不报 KA-4', () => {
    const big = 'art/big.png'
    const { issues } = readSkin(
      minimalPp({ startup: { bg: big } }, { [big]: new Uint8Array(3 * 1024 * 1024) }),
    )
    expect(codes(issues)).toEqual([])
  })
})

describe('KA-1 不单列', () => {
  it('音频路径缺失只由 KP-2 报一次，且出处写到该文件', () => {
    const { issues } = readSkin(minimalPp({ audio: { bgm: { map: { file: 'audio/bgm/missing.ogg' } } } }))
    expect(codes(issues)).toEqual(['KP-2'])
    expect(detailOf(issues, 'KP-2')).toContain('audio/bgm/missing.ogg')
  })
})

describe('三条提示可以同时出现，且都不阻断加载', () => {
  it('越界键 ＋ 越界音量 ＋ 超大文件，各自成条', () => {
    const { skin, issues } = readSkin(
      minimalPp(
        { audio: { sfx: { boom: HIT, hit: { file: HIT, volume: 5 } } } },
        { [HIT]: new Uint8Array(3 * 1024 * 1024) },
      ),
    )
    expect(codes(issues)).toEqual(['KA-2', 'KA-3', 'KA-4'])
    expect(skin).toBeDefined()
  })

  it('同一个文件被多处引用，`KA-4` 只报一次', () => {
    const { issues } = readSkin(
      minimalPp(
        { audio: { bgm: { map: { file: MAP } }, sfx: { hit: MAP } } },
        { [MAP]: new Uint8Array(3 * 1024 * 1024) },
      ),
    )
    expect(codes(issues)).toEqual(['KA-4'])
    expect(detailOf(issues, 'KA-4').split(MAP).length - 1).toBe(1)
  })

  it('越界键的音量不另判：键本身已被忽略，整条跟着走', () => {
    const { issues } = readSkin(
      minimalPp({ audio: { sfx: { boom: { file: HIT, volume: 5 } } } }, { [HIT]: textBytes('hit') }),
    )
    expect(codes(issues)).toEqual(['KA-2'])
  })
})
