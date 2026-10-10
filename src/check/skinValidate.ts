/**
 * 皮肤包的「清单」校验（`docs/design/skin/` 各分节 §校验项）。
 *
 * 与加载期校验（`io/pp.ts` 的 `KP-1`~`KP-10` ＋ `KA-2/3/4`）互补：
 * 加载期只拿 manifest 与包内条目就能判；**本文件补的是「要对照组件库 / 本局工程」才判得出**的那批
 * （`KP-5` 与 `KB` / `KR` / `KS` / `KW` / `KM` / `KIB` / `KPG` 各码）。
 *
 * 三条纪律：
 * - **纯函数**：只读入参（皮肤条目 ＋ 组件库 ＋ 工程），不碰 store、不写文件。
 * - **只提示不阻断**（裁决 15）：全部产出 `severity: 'warn'`，不设体积硬上限。
 * - **注册即真会产出**：只有能判的码才产出，与 `SKIN_ISSUE_CODES` 的登记口径一致；
 *   需解码像素的 `KR-4` / `KR-8` / `KM-2` / `KIB-3` / `KB-4` / `KB-5` 一支，
 *   与规范未定的 `KW-2` / `KW-3` 暂不产出（详见 `types/skin.ts` 的 `SKIN_ISSUE_CODES` 注释）。
 *
 * 「本局」一律取 `project.enabledIds`（启用范围）：未启用的组件既不渲染、也不该被皮肤选中，
 * 故 `KIB-1` / `KR-2` / `KR-6` 用的是**启用集**而非「库里存在」。
 */

import {
  joinSkinPath,
  ROAD_SLOTS,
  type Library,
  type Project,
  type SkinBackgroundLayer,
  type SkinGround,
  type SkinImage,
  type SkinIssue,
  type SkinIssueCode,
  type SkinSlice,
  type SkinSprite,
  type SkinTexture,
} from '../types'
import type { LoadedSkin } from '../io/pp'
import { imageSize, type ImageSize } from '../io/image-size'
import { backgroundLayers, backgroundOf, backgroundUsable } from '../engine/skin/canvas'
import { BUTTON_KINDS, NPC_WILDCARD, SLOT_KINDS, buttonStatesOf } from '../engine/skin/lookup'
import { npcIdsOf } from '../lib/refs'

/** 调用方交给校验器的皮肤上下文：合成皮肤（可能因 `KP-1` 为 `undefined`）＋ 加载期已收的提示 */
export interface SkinContext {
  skin?: LoadedSkin
  /** 加载期提示（`io/pp.ts` 的 `KP-*` / `KA-*`），原样并入结果 */
  issues: SkinIssue[]
}

/** 一处素材引用（归一字符串 / 对象两种写法，并保留 `slice`） */
interface Ref {
  path: string
  where: string
  slice?: SkinSlice
}

/* ------------------------------------------------------------------ */
/* 归一与取值小工具                                                    */
/* ------------------------------------------------------------------ */

/** 去掉前导 `./` 与 `/`，与 `io/zip.ts` 的条目名口径一致 */
function norm(path: string): string {
  return path.replace(/^(?:\.\/|\/)+/, '')
}

/** 单个纹理（字符串或对象）的引用 */
function textureRef(t: SkinTexture | undefined, where: string): Ref[] {
  if (t === undefined) return []
  if (typeof t === 'string') return [{ path: t, where }]
  return [{ path: t.img, where: `${where}.img`, slice: t.slice }]
}

/** 三写法（一张 / 对象 / 四张）的引用；数组视为 `N/E/S/W` 四向 */
function spriteRefs(s: SkinSprite | undefined, where: string): Ref[] {
  if (s === undefined) return []
  if (typeof s === 'string') return [{ path: s, where }]
  if (Array.isArray(s)) return s.flatMap((item, index) => textureRef(item, `${where}[${index}]`))
  return [{ path: s.img, where: `${where}.img`, slice: s.slice }]
}

/** 立绘（字符串或对象，**不收数组**）的引用 */
function portraitRef(p: unknown, where: string): Ref | undefined {
  if (typeof p === 'string') return { path: p, where }
  if (p !== null && typeof p === 'object' && typeof (p as { img?: unknown }).img === 'string') {
    return { path: (p as { img: string }).img, where: `${where}.img` }
  }
  return undefined
}

/** 两个尺寸是否同一宽高比（容差 1%） */
function sameAspect(a: ImageSize, b: ImageSize): boolean {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.01
}

/* ------------------------------------------------------------------ */
/* 主入口                                                              */
/* ------------------------------------------------------------------ */

/**
 * 汇总一份皮肤的全部提示：加载期收下的 `context.issues`，加上「须对照组件库 / 工程」的各节校验。
 *
 * 整包被忽略（`KP-1`，`context.skin` 为 `undefined`）时只回加载期的提示——没有 manifest 可判。
 */
export function skinValidate(library: Library, project: Project, context: SkinContext): SkinIssue[] {
  const out: SkinIssue[] = [...context.issues]
  const skin = context.skin
  if (!skin) return out

  const manifest = skin.manifest
  const entries = skin.entries

  /** 条目是否存在 */
  const has = (path: string): boolean => entries[norm(path)] !== undefined
  /** 读一条素材的像素尺寸（读不到即 `undefined`，依赖尺寸的判定据此跳过） */
  const size = (path: string): ImageSize | undefined => {
    const bytes = entries[norm(path)]
    return bytes ? imageSize(bytes, path) : undefined
  }
  /** 推一条提示 */
  const add = (code: SkinIssueCode, detail: string): void => {
    out.push({ code, detail })
  }

  const enabled = new Set(project.enabledIds)
  const isEnabled = (id: string): boolean => enabled.has(id)

  /** 本局会出现的 NPC 名（`name`，非 id）——`role.npcs` / `portraits.npcs` 的合法键 */
  const npcsById = new Map(library.npcs.map((n) => [n.id, n]))
  const npcNames = new Set<string>()
  for (const id of npcIdsOf(project)) {
    const npc = npcsById.get(id)
    if (npc) npcNames.add(npc.name)
  }

  /* -------- 键合法性（`KP-5` 汇总 ＋ 各节明细共用一份判据） -------- */

  /** 键不在启用集内的项 */
  const badKeys = (record: Record<string, unknown> | undefined, pick: (id: string) => boolean): string[] =>
    Object.keys(record ?? {}).filter((key) => !pick(key))

  const badItems = badKeys(manifest.item as Record<string, unknown> | undefined, isEnabled)
  const badBuildings = badKeys(manifest.building as Record<string, unknown> | undefined, isEnabled)
  const badRoads = badKeys(manifest.road?.tiles as Record<string, unknown> | undefined, () => true).filter(
    (slot) => !(ROAD_SLOTS as readonly string[]).includes(slot),
  )

  const role = manifest.role
  const badClasses = badKeys(role?.classes as Record<string, unknown> | undefined, isEnabled)
  const badMonsters = badKeys(role?.monsters as Record<string, unknown> | undefined, isEnabled)
  const badRoleNpcs = badKeys(role?.npcs as Record<string, unknown> | undefined, (key) =>
    key === NPC_WILDCARD || npcNames.has(key),
  )

  // `KP-5`：无效键的汇总，明细分别在 `KIB-1` / `KS-1` / `KR-2` / `KR-11`
  const summary: string[] = []
  if (badItems.length > 0) summary.push(`item：${badItems.join('、')}`)
  if (badBuildings.length > 0) summary.push(`building：${badBuildings.join('、')}`)
  if (badClasses.length > 0) summary.push(`role.classes：${badClasses.join('、')}`)
  if (badMonsters.length > 0) summary.push(`role.monsters：${badMonsters.join('、')}`)
  if (badRoleNpcs.length > 0) summary.push(`role.npcs：${badRoleNpcs.join('、')}`)
  if (summary.length > 0) add('KP-5', `以下键不在本局启用范围内，已忽略：${summary.join('；')}`)

  /* ================= 画布背景 `background`（`05-canvas.md` §五） ================= */

  const layers = backgroundLayers(manifest.background)
  const usable = (layer: SkinBackgroundLayer): boolean => backgroundUsable(layer) && has(layer.img)

  // KB-1：有图但 cellSize 缺失或 ≤ 0（该项不绘制）
  layers.forEach((layer, i) => {
    if (layer.img && !backgroundUsable(layer)) {
      add('KB-1', `background[${i}] 的 cellSize 缺失或非正数，该层不绘制`)
    }
  })

  // KB-3：startX / startY 落在图片之外
  layers.forEach((layer, i) => {
    if (!layer.img) return
    const s = size(layer.img)
    if (!s) return
    const x = layer.startX ?? 0
    const y = layer.startY ?? 0
    if (x < 0 || x > s.width || y < 0 || y > s.height) {
      add('KB-3', `background[${i}] 的 startX / startY（${x}, ${y}）落在图片（${s.width}×${s.height}）之外`)
    }
  })

  // KB-6 / KB-8：逐图看「采用层」
  project.maps.forEach((map, index) => {
    const pick = backgroundOf(manifest.background, index, usable)
    if (!pick) {
      add('KB-6', `「${map.name}」没有任何可用背景，该图降级为默认配置`)
      return
    }
    if (!pick.layer.color) {
      add('KB-8', `「${map.name}」采用的 background[${pick.index}] 未写 color，图片之外直接露主题色`)
    }
  })

  // KB-7：层数多于地图数（末尾层永不被采用）
  if (layers.length > project.maps.length) {
    const trailing = layers.map((_, i) => i).filter((i) => i >= project.maps.length)
    add('KB-7', `background 有 ${layers.length} 层、地图只有 ${project.maps.length} 张，末尾层 ${trailing.join('、')} 永不被采用`)
  }

  // KB-9：相邻两层的对齐基准不一致
  for (let i = 0; i + 1 < layers.length; i++) {
    const a = layers[i]
    const b = layers[i + 1]
    const mismatch =
      (a.cellSize ?? 0) !== (b.cellSize ?? 0) ||
      (a.startX ?? 0) !== (b.startX ?? 0) ||
      (a.startY ?? 0) !== (b.startY ?? 0)
    if (mismatch) {
      add('KB-9', `background[${i}] 与 [${i + 1}] 的 cellSize / startX / startY 不一致，切图会跳变`)
    }
  }

  /* ================= 角色与立绘 `role`（`02-role.md` §八） ================= */

  // KR-3：分组写成数组
  for (const [name, value] of [
    ['classes', role?.classes],
    ['monsters', role?.monsters],
    ['npcs', role?.npcs],
  ] as const) {
    if (Array.isArray(value)) add('KR-3', `role.${name} 写成数组（形象无朝向，数组无效）`)
  }

  // KR-2：职业 / 怪物键不在启用集内
  if (badClasses.length > 0) add('KR-2', `role.classes 的无效键：${badClasses.join('、')}`)
  if (badMonsters.length > 0) add('KR-2', `role.monsters 的无效键：${badMonsters.join('、')}`)

  // KR-11：NPC 形象键与任何 name 都不重名（配了图也永不会被用到）
  if (badRoleNpcs.length > 0) {
    add('KR-11', `role.npcs 的键 ${badRoleNpcs.join('、')} 与本局 NPC 的 name 都不重名，这些图不会被用到`)
  }

  // KR-1：棋子形象非正方形
  const spriteWhere: Array<[string, SkinSprite | undefined]> = [
    ['role.player', role?.player],
    ...Object.entries(role?.classes ?? {}).map(([k, v]) => [`role.classes.${k}`, v] as [string, SkinSprite]),
    ...Object.entries(role?.monsters ?? {}).map(([k, v]) => [`role.monsters.${k}`, v] as [string, SkinSprite]),
    ...Object.entries(role?.npcs ?? {}).map(([k, v]) => [`role.npcs.${k}`, v] as [string, SkinSprite]),
  ]
  for (const [where, sprite] of spriteWhere) {
    for (const ref of spriteRefs(sprite, where)) {
      const s = size(ref.path)
      if (s && s.width !== s.height) {
        add('KR-1', `${ref.where} 的素材非正方形（${s.width}×${s.height}），会按中心缩放宽高不一致`)
      }
    }
  }

  const portraits = role?.portraits

  // KR-7：立绘写成数组
  for (const [name, record] of [
    ['classes', portraits?.classes],
    ['monsters', portraits?.monsters],
    ['npcs', portraits?.npcs],
  ] as const) {
    for (const [key, value] of Object.entries(record ?? {})) {
      if (Array.isArray(value)) add('KR-7', `role.portraits.${name}.${key} 写成数组（立绘不用数组）`)
    }
  }

  // KR-6：立绘键不在启用集内（`npcs` 按 name，含通配 `"*"`）
  const badPortraitClasses = badKeys(portraits?.classes as Record<string, unknown> | undefined, isEnabled)
  const badPortraitMonsters = badKeys(portraits?.monsters as Record<string, unknown> | undefined, isEnabled)
  const badPortraitNpcs = badKeys(
    portraits?.npcs as Record<string, unknown> | undefined,
    (key) => key === NPC_WILDCARD || npcNames.has(key),
  )
  if (badPortraitClasses.length > 0) add('KR-6', `role.portraits.classes 的无效键：${badPortraitClasses.join('、')}`)
  if (badPortraitMonsters.length > 0) add('KR-6', `role.portraits.monsters 的无效键：${badPortraitMonsters.join('、')}`)
  if (badPortraitNpcs.length > 0) add('KR-6', `role.portraits.npcs 的无效键：${badPortraitNpcs.join('、')}`)

  // KR-5 / KR-9 / KR-10：立绘尺寸与受击图
  const portraitEntries: Array<[string, unknown]> = portraits
    ? [
        ['role.portraits.player', portraits.player],
        ...Object.entries(portraits.classes ?? {}).map(([k, v]) => [`role.portraits.classes.${k}`, v] as [string, unknown]),
        ...Object.entries(portraits.monsters ?? {}).map(([k, v]) => [`role.portraits.monsters.${k}`, v] as [string, unknown]),
        ...Object.entries(portraits.npcs ?? {}).map(([k, v]) => [`role.portraits.npcs.${k}`, v] as [string, unknown]),
      ]
    : []
  const playerPortrait = portraitRef(portraits?.player, 'role.portraits.player')
  for (const [where, value] of portraitEntries) {
    const ref = portraitRef(value, where)
    if (!ref) continue
    const s = size(ref.path)
    if (s && s.width >= s.height) {
      add('KR-5', `${where} 非竖构图（${s.width}×${s.height}，宽 ≥ 高），按 W 缩放后比例会失衡`)
    }
    const hurt = (value as { hurt?: unknown })?.hurt
    if (typeof hurt === 'string') {
      const hs = size(hurt)
      if (s && hs && !sameAspect(s, hs)) {
        add('KR-9', `${where} 的受击图与主图宽高比不一致，受击瞬间会跳变`)
      }
    }
    if (where.startsWith('role.portraits.npcs') && playerPortrait && ref.path === playerPortrait.path) {
      add('KR-10', `${where} 与主人公立绘是同一张图（NPC 立绘缺位的语义是不渲染，不是复用主人公）`)
    }
  }

  /* ================= 道路 `road`（`01-road.md` §八） ================= */

  const road = manifest.road

  // KS-1：tiles 键与 15 槽位名不一致
  const tileKeys = Object.keys(road?.tiles ?? {})
  const missingSlots = (ROAD_SLOTS as readonly string[]).filter((slot) => !tileKeys.includes(slot))
  const extraSlots = badRoads
  if (missingSlots.length > 0 || extraSlots.length > 0) {
    const parts: string[] = []
    if (missingSlots.length > 0) parts.push(`缺失 ${missingSlots.join('、')}`)
    if (extraSlots.length > 0) parts.push(`多余 ${extraSlots.join('、')}`)
    add('KS-1', `road.tiles 键与槽位名不一致：${parts.join('；')}`)
  }

  // KS-7：road 节里出现颜色类字段
  const roadColorKeys = ['color', 'fill', 'stroke'].filter((key) => key in ((road ?? {}) as Record<string, unknown>))
  if (roadColorKeys.length > 0) {
    add('KS-7', `road 节里出现颜色类字段 ${roadColorKeys.join('、')}，道路不设背景色，该字段被忽略`)
  }

  // KS-3：两条样式在规则 ①② 上完全同分（标签集相同 → 任何 R 都同分）
  const styles = road?.styles ?? []
  const seenTags = new Map<string, number>()
  styles.forEach((style, index) => {
    const key = JSON.stringify([...(style.tags ?? [])].slice().sort())
    const first = seenTags.get(key)
    if (first === undefined) {
      seenTags.set(key, index)
      return
    }
    add('KS-3', `road.styles[${first}] 与 [${index}] 标签集相同，规则 ①② 同分，按 ③ 取前者`)
  })

  // 道路素材引用（含各样式集 base 前缀）
  const roadRefs: Ref[] = []
  const bases = styles.map((s) => s.base).filter((b): b is string => typeof b === 'string' && b !== '')
  for (const [slot, sprite] of Object.entries(road?.tiles ?? {})) {
    for (const ref of spriteRefs(sprite, `road.tiles.${slot}`)) {
      if (bases.length === 0) roadRefs.push(ref)
      else for (const base of bases) roadRefs.push({ path: joinSkinPath(base, ref.path), where: ref.where, slice: ref.slice })
    }
  }

  const roadCell = layers.find((l) => typeof l.cellSize === 'number' && l.cellSize > 0)?.cellSize

  for (const ref of roadRefs) {
    const s = size(ref.path)
    // KS-4：非正方形
    if (s && s.width !== s.height) {
      add('KS-4', `${ref.where} 的素材非正方形（${s.width}×${s.height}），该项放弃旋转复用`)
    }
    // KS-5：以 `.9.png` 命名但未提供 slice
    if (/\.9\.png$/i.test(ref.path) && !ref.slice) {
      add('KS-5', `${ref.where} 以 .9.png 命名但未提供 slice，V1 将按普通拉伸处理`)
    }
    // KS-6：尺寸与背景 cellSize 不成整倍数
    if (s && roadCell && (s.width % roadCell !== 0 || s.height % roadCell !== 0)) {
      add('KS-6', `${ref.where} 的尺寸（${s.width}×${s.height}）与 cellSize（${roadCell}）不成整倍数，缩放后会模糊`)
    }
  }

  /* ================= 容器与控件 `window`（`03-window.md` §六） ================= */

  const win = manifest.window

  // KW-1：随视口族（三个容器）无 slice
  for (const kind of ['dialog', 'drawer', 'popover'] as const) {
    for (const ref of textureRef(win?.surfaces?.[kind], `window.surfaces.${kind}`)) {
      if (!ref.slice) add('KW-1', `${ref.where} 是随视口族素材但没有 slice，V1 会整体拉伸变形`)
    }
  }

  // KW-4：固定族（四个格子）非正方形
  for (const kind of SLOT_KINDS) {
    for (const ref of textureRef(win?.slots?.[kind], `window.slots.${kind}`)) {
      const s = size(ref.path)
      if (s && s.width !== s.height) add('KW-4', `${ref.where} 是固定族素材但非正方形（${s.width}×${s.height}），会压缩变形`)
    }
  }

  // KW-7：按钮四态素材尺寸不一致
  for (const kind of BUTTON_KINDS) {
    const states = buttonStatesOf(win, kind)
    if (!states) continue
    const sizes: Array<[string, ImageSize]> = []
    for (const [stateName, texture] of Object.entries(states)) {
      for (const ref of textureRef(texture as SkinTexture, `window.buttons.${kind}.${stateName}`)) {
        const s = size(ref.path)
        if (s) sizes.push([ref.where, s])
      }
    }
    if (sizes.length >= 2 && sizes.some(([, s]) => s.width !== sizes[0][1].width || s.height !== sizes[0][1].height)) {
      add('KW-7', `window.buttons.${kind} 四态素材尺寸不一致，切换时会出现位移 / 缩放跳变`)
    }
  }

  /* ================= 标记与骰子 `misc`（`04-misc.md` §八） ================= */

  const misc = manifest.misc

  // KM-1：node.building 未提供九宫格切片
  for (const ref of textureRef(misc?.nodes?.building, 'misc.nodes.building')) {
    if (!ref.slice) add('KM-1', `${ref.where} 未提供九宫格切片，多格建筑的圆角会随格数拉伸变形`)
  }

  // KM-3：骰面少于 6 张且未声明复用方式
  const faces = misc?.dice?.faces
  if (faces) {
    const faceKeys = (['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const).filter((k) => faces[k] !== undefined)
    if (faceKeys.length < 6) {
      const declaresReuse = (['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const).some((k) => {
        const face = faces[k]
        return face !== undefined && typeof face !== 'string' && (face.rotate !== undefined || face.flip !== undefined)
      })
      if (!declaresReuse) {
        add('KM-3', `骰面只给了 ${faceKeys.length} 张且未声明复用方式，可照 §三 的镜像 / 旋转关系补齐`)
      }
    }
  }

  /* ================= 道具与建筑 `item` / `building`（`06-item-building.md` §四） ================= */

  // KIB-1：键不在启用集内
  if (badItems.length > 0) add('KIB-1', `item 的无效键（不在启用范围内）：${badItems.join('、')}`)
  if (badBuildings.length > 0) add('KIB-1', `building 的无效键（不在启用范围内）：${badBuildings.join('、')}`)

  // KIB-5：用显示名（name）而不是 id 作键
  const nameToId = new Map<string, string>()
  for (const key of [...Object.keys(manifest.item ?? {}), ...Object.keys(manifest.building ?? {})]) {
    const match =
      library.items.find((d) => d.name === key) ?? library.buildings.find((d) => d.name === key)
    if (match && match.id !== key) nameToId.set(key, match.id)
  }
  if (nameToId.size > 0) {
    const list = [...nameToId.entries()].map(([key, id]) => `${key} → ${id}`).join('、')
    add('KIB-5', `以下键用了显示名而不是组件 id，可能因重名或改名失效：${list}`)
  }

  const groundKeys = new Set(['fill', 'stroke', 'img'])
  const checkSkin = (skin: Record<string, unknown> | undefined, where: string, isItem: boolean): void => {
    if (!skin) return
    // KIB-6：`item` 不得出现 `img` / `font` / `fontColor`；`background` 对象含未知键
    if (isItem) {
      const stray = ['img', 'font', 'fontColor'].filter((key) => key in skin)
      if (stray.length > 0) add('KIB-6', `${where} 出现 ${stray.join('、')}，item 不使用这些字段，已忽略`)
    }
    const bg = skin.background
    if (bg !== null && typeof bg === 'object' && !Array.isArray(bg)) {
      const unknown = Object.keys(bg).filter((key) => !groundKeys.has(key))
      if (unknown.length > 0) add('KIB-6', `${where}.background 含未知键：${unknown.join('、')}`)
      // KIB-7：stroke 与 fill 都为 transparent
      const ground = bg as SkinGround
      if (ground.fill === 'transparent' && ground.stroke === 'transparent') {
        add('KIB-7', `${where}.background 的 fill 与 stroke 都为 transparent，衬底不可见`)
      }
    }
  }
  for (const [id, skin] of Object.entries(manifest.item ?? {})) {
    checkSkin(skin as unknown as Record<string, unknown>, `item.${id}`, true)
  }
  for (const [id, skin] of Object.entries(manifest.building ?? {})) {
    checkSkin(skin as unknown as Record<string, unknown>, `building.${id}`, false)
  }

  // KIB-2：建筑 `img` 以 `.9.png` 命名但未提供 slice（建筑只有扁平 `img`，没有 slice 字段）
  for (const [id, skin] of Object.entries(manifest.building ?? {})) {
    const img = (skin as { img?: unknown }).img
    if (typeof img === 'string' && /\.9\.png$/i.test(img)) {
      add('KIB-2', `building.${id}.img 以 .9.png 命名但未提供 slice，V1 按普通拉伸处理`)
    }
  }

  /* ================= 欢迎页与游戏首页 `startup` / `lobby`（`08-pages.md` §四） ================= */

  const startup = manifest.startup as (Record<string, unknown> & { bg?: SkinImage; title?: SkinImage; dice?: SkinImage }) | undefined
  const lobby = manifest.lobby as (Record<string, unknown> & { bg?: SkinImage; card?: SkinImage & { selected?: { img?: string } } }) | undefined

  // KPG-6：旧键 pages
  if ('pages' in (manifest as Record<string, unknown>)) {
    add('KPG-6', 'manifest 含旧键 pages，已拆为 startup / lobby，旧键忽略')
  }

  // KPG-5：startup / lobby 出现越界字段
  const strayPageKeys = ['buttons', 'chips', 'font', 'fontSize', 'fontColor']
  for (const [name, page] of [
    ['startup', startup],
    ['lobby', lobby],
  ] as const) {
    if (!page) continue
    const stray = strayPageKeys.filter((key) => key in page)
    if (stray.length > 0) add('KPG-5', `${name} 出现 ${stray.join('、')}，本节不接管，应写到 window / 主题侧`)
  }

  // KPG-1：bg.fit 取值非法
  for (const [name, page] of [
    ['startup', startup],
    ['lobby', lobby],
  ] as const) {
    const fit = page?.bg?.fit
    if (fit !== undefined && fit !== 'cover' && fit !== 'contain' && fit !== 'tile') {
      add('KPG-1', `${name}.bg.fit 取值非法（${String(fit)}），回退 cover`)
    }
  }

  // KPG-2：card 给了 img 但未给 slice
  if (lobby?.card?.img && !lobby.card.slice) {
    add('KPG-2', 'lobby.card 给了 img 但未给 slice，V1 按普通拉伸处理')
  }

  // KPG-3：title.img 与标题区比例不符（约定 ~6:1）
  if (startup?.title?.img) {
    const s = size(startup.title.img)
    if (s) {
      const ratio = s.width / s.height
      if (ratio < 4 || ratio > 9) {
        add('KPG-3', `startup.title.img 的宽高比 ${ratio.toFixed(1)}:1 偏离约 6:1，会被压缩`)
      }
    }
  }

  // KPG-4：dice.img 给了图但 misc.dice 未给骰面
  if (startup?.dice?.img && !manifest.misc?.dice?.faces) {
    add('KPG-4', 'startup.dice 给了图但 misc.dice 未给骰面，主视觉的骰子内部仍是程序绘制点数')
  }

  return out
}
