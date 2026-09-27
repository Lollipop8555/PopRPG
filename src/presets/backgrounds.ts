/**
 * 预设背景（§5.0.1 全局区）—— 常驻可选的一段开场散文。
 * 背景始终算内容（project.background 之外，库里也可以存可复用的底色文本）。
 */

import type { BackgroundDef } from '../types'

export const PRESET_BACKGROUNDS: BackgroundDef[] = [
  {
    id: 'bg_default',
    name: '地穴回声',
    icon: '🏕️',
    tags: ['默认'],
    desc: '你是一名误入地穴的冒险者，空气里弥漫着霉味和潮湿的土腥味。',
  },
]
