/**
 * 校验集合 K1~Kn（§5.7）——「清单」按钮的数据来源。
 *
 * 定位：只检查是否会导致运行中断（引用缺失、路径不可通行、判定必定失败），不评价设计优劣（§1.1）。
 * 除特别说明，全部**不阻塞导出**。
 */

import type {
  AnyComponent,
  BuildingDef,
  ClassDef,
  ComponentKind,
  DialogNode,
  EffectOp,
  EventBlock,
  Gate,
  ItemDef,
  Library,
  MonsterDef,
  NpcDef,
  Project,
  SkillDef,
} from '../types'
import { checkAnalysis } from '../engine/event'
import { resolveItemPool, resolveMonsterPool } from '../engine/pool'
import { makePlayerUnit } from '../engine/units'
import { skillSources, referenceIdsOf, componentsWithTag, npcIdsOf } from '../lib/refs'
import { hitCoverage, listPoints } from '../lib/dialog'
import { SECTIONS } from '../lib/sections'

export type Severity = 'error' | 'warn'

export interface Issue {
  /** K1…Kn：同一类问题聚成一组 */
  key: string
  severity: Severity
  title: string
  detail: string
  mapId?: string
  mapName?: string
  /** 地图上的格子，可直接跳过去 */
  cell?: [number, number]
  componentId?: string
  componentKind?: ComponentKind
  section?: string
  /** 对话树里的位置（`Mod1[2]`），供 NPC 模组面板直接跳过去（§5.6.1） */
  dialogPath?: string
}

export function componentSection(kind: ComponentKind, def?: AnyComponent): string | undefined {
  const itemKind = (def as ItemDef | undefined)?.kind
  const found = SECTIONS.find((s) => s.kind === kind && (kind !== 'item' || s.filterItemKind === (itemKind ?? 'consumable')))
  return found?.id
}

/* ------------------------------------------------------------------ */
/* 逐条 K                                                              */
/* ------------------------------------------------------------------ */

function gateIssues(
  library: Library,
  enabledIds: string[],
  gate: Gate | undefined,
  owner: { id: string; name: string; kind: ComponentKind },
): Issue[] {
  const out: Issue[] = []
  if (!gate) return out
  for (const tag of gate.tags) {
    const carriers = componentsWithTag(library, enabledIds, tag)
    if (carriers.length === 0) {
      out.push({
        key: 'K7',
        severity: 'warn',
        title: `没有已启用组件提供标签「${tag}」`,
        detail: `「${owner.name}」需要标签 ${tag} 才能通行，但目前没有组件提供该标签，该路径当前不可通行（组件尚未准备完毕时可稍后补充；此提示不阻止导出）。`,
        componentId: owner.id,
        componentKind: owner.kind,
        section: componentSection(owner.kind),
      })
    }
  }
  return out
}

function effectDurationIssues(def: AnyComponent, kind: ComponentKind, effects: EffectOp[] | undefined, maxDuration: number): Issue[] {
  const out: Issue[] = []
  for (const eff of effects ?? []) {
    if (eff.op !== 'add_tag') continue
    if (typeof eff.duration !== 'number') {
      out.push({
        key: 'K9',
        severity: 'error',
        title: `状态「${eff.tag}」没有写回合数`,
        detail: '任何状态都必须有 duration（不存在永久状态），补上再保存。',
        componentId: def.id,
        componentKind: kind,
        section: componentSection(kind, def),
      })
    } else if (eff.duration > maxDuration) {
      out.push({
        key: 'K9',
        severity: 'warn',
        title: `状态「${eff.tag}」回合数超过上限`,
        detail: `${eff.duration} > ${maxDuration}，导出 / 结算时会被夹到 ${maxDuration}。`,
        componentId: def.id,
        componentKind: kind,
        section: componentSection(kind, def),
      })
    }
  }
  return out
}

function poolEmptyIssues(library: Library, enabledIds: string[], def: BuildingDef): Issue[] {
  const out: Issue[] = []
  const checks: { label: string; size: number }[] = []
  // `treasure` 建筑的「空奖励池」要**按实例**判：配了 NPC 就是合法内容物（§5.7）→ 交给 K15
  if (def.reward_pool && def.encounter !== 'treasure') {
    checks.push({ label: '奖励池', size: resolveItemPool(library, enabledIds, def.reward_pool).length })
  }
  if (def.monster_pool) checks.push({ label: '怪物池', size: resolveMonsterPool(library, enabledIds, def.monster_pool).length })
  if (def.stock) checks.push({ label: '上架池', size: resolveItemPool(library, enabledIds, def.stock).length })
  for (const check of checks) {
    if (check.size > 0) continue
    out.push({
      key: 'K6',
      severity: 'warn',
      title: `「${def.name}」的${check.label}是空的`,
      detail: '当前条件下筛不出任何东西（可能都还没启用），玩家踩到这里会觉得空空如也。',
      componentId: def.id,
      componentKind: 'building',
      section: componentSection('building', def),
    })
  }
  return out
}

function skillGainIssues(library: Library, enabledIds: string[], skill: SkillDef): Issue[] {
  const sources = skillSources(library, enabledIds, skill.id)
  if (sources.length > 0) return []
  return [
    {
      key: 'K4',
      severity: 'warn',
      title: `技能「${skill.name}」没有地方能学到`,
      detail: '本局中既没有技能书，也不会从事件或商店获得该技能。若需角色学会，请提供对应技能书或配置事件、商店产出。',
      componentId: skill.id,
      componentKind: 'skill',
      section: componentSection('skill', skill),
    },
  ]
}

function skillSelfConflict(skill: SkillDef): Issue[] {
  const out: Issue[] = []
  if (skill.target === 'self' && skill.vs !== 'none' && skill.vs !== 'auto') {
    out.push({
      key: 'K5',
      severity: 'warn',
      title: `技能「${skill.name}」打自己却指定了对手的防御维`,
      detail: 'target: self 的技能不对抗、不落空，写具体的 vs 不会生效。',
      componentId: skill.id,
      componentKind: 'skill',
      section: componentSection('skill', skill),
    })
  }
  if (skill.apply === 'none' && (skill.effects ?? []).length === 0) {
    out.push({
      key: 'K5',
      severity: 'warn',
      title: `技能「${skill.name}」放出来没有任何效果`,
      detail: 'apply: none 且没有 effects —— 既不掉血也不挂状态（什么都没发生）。',
      componentId: skill.id,
      componentKind: 'skill',
      section: componentSection('skill', skill),
    })
  }
  if (skill.target === 'opponent' && skill.vs === 'none' && skill.apply !== 'none') {
    out.push({
      key: 'K5',
      severity: 'warn',
      title: `技能「${skill.name}」不对抗却直接改对方数值`,
      detail: 'vs: none 会跳过判定直接生效 —— 这是必定命中的效果，确认这是你要的设计。',
      componentId: skill.id,
      componentKind: 'skill',
      section: componentSection('skill', skill),
    })
  }
  return out
}

function eventIssues(library: Library, project: Project, def: BuildingDef, event: EventBlock): Issue[] {
  const out: Issue[] = []
  if (event.gate) {
    out.push(...gateIssues(library, project.enabledIds, event.gate, { id: def.id, name: def.name, kind: 'building' }))
  }
  if (!event.check) return out
  const check = event.check
  // 用「开局职业池」里的职业当参照人物：给张三可以给李四，所以看最坏 / 最好两侧
  const classes = library.classes.filter((c) => project.rules.class_pool.includes(c.id) && project.enabledIds.includes(c.id))
  const probes = classes.length > 0 ? classes : library.classes.slice(0, 1)
  if (probes.length === 0) return out

  let always = true
  let never = true
  for (const cls of probes) {
    const unit = makePlayerUnit({ cls })
    const analysis = checkAnalysis(unit, check, project.rules)
    if (analysis.verdict !== 'always') always = false
    if (analysis.verdict !== 'never') never = false
  }

  if (never) {
    out.push({
      key: 'K8',
      severity: 'warn',
      title: `事件「${def.name}」现在是必败`,
      detail: `即使掷出最大点数，判定值仍低于 ${check.target}。建议提升相关属性、更换装备，或下调难度值。`,
      componentId: def.id,
      componentKind: 'building',
      section: componentSection('building', def),
    })
  } else if (always) {
    out.push({
      key: 'K8',
      severity: 'warn',
      title: `事件「${def.name}」现在是必成`,
      detail: `即使掷出最小点数，判定值也不低于 ${check.target}。该判定对当前配置必定成功。`,
      componentId: def.id,
      componentKind: 'building',
      section: componentSection('building', def),
    })
  }
  return out
}

function classIssues(library: Library, enabledIds: string[], cls: ClassDef): Issue[] {
  const out: Issue[] = []
  const items = cls.starting_items ?? []
  for (const id of items) {
    const item = library.items.find((i) => i.id === id)
    if (!item) continue
    if (!enabledIds.includes(id)) {
      out.push({
        key: 'K3',
        severity: 'error',
        title: `职业「${cls.name}」的出生家当没启用`,
        detail: `《${item.name}》没有启用 —— 这局世界里不存在这件东西，玩家开局拿不到。`,
        componentId: cls.id,
        componentKind: 'class',
        section: componentSection('class', cls),
      })
    }
  }
  const capacity = cls.inventory_size ?? 50
  if (capacity > 0 && new Set(items).size > capacity) {
    out.push({
      key: 'K11',
      severity: 'warn',
      title: `职业「${cls.name}」的背包装不下家当`,
      detail: `背包 ${capacity} 格，开局要发 ${new Set(items).size} 种道具（同种叠加只占 1 格）。`,
      componentId: cls.id,
      componentKind: 'class',
      section: componentSection('class', cls),
    })
  }
  return out
}

/**
 * K18 / K19：一棵对话树自己的问题（§4.9.2 / §5.7）——
 * 空对话 · 根层 `result` · `hit` 无所属 → 标黄；`hit` 覆盖不全 / 重叠 → 标黄；
 * `hit` 越界 / 非法 → **标红**。全部**只提示、不拦截**导出。
 */
function dialogIssues(npc: NpcDef): Issue[] {
  const out: Issue[] = []
  const base = {
    componentId: npc.id,
    componentKind: 'npc' as ComponentKind,
    section: componentSection('npc', npc),
  }
  const plans = npc.dialogs && typeof npc.dialogs === 'object' ? Object.entries(npc.dialogs) : []

  for (const [plan, roots] of plans) {
    const where = `「${npc.name}」的对话方案「${plan}」`

    if (!roots || roots.length === 0) {
      out.push({
        key: 'K18',
        severity: 'warn',
        title: `${where}点开就结束了`,
        detail: '这个方案一个根节点都没有，玩家什么都看不到。',
        ...base,
        dialogPath: plan,
      })
      continue
    }

    const walk = (list: DialogNode[], path: string, atRoot: boolean, parentHasDice: boolean) => {
      list.forEach((node, i) => {
        const at = `${path}[${i + 1}]`
        const emptyMessage = !node.message || node.message.length === 0
        const hasItems = !!node.items && node.items.length > 0

        /** 空对话：根节点 `message` 与 `items` 都为空 —— 点开就结束 */
        if (atRoot && emptyMessage && !hasItems) {
          out.push({
            key: 'K18',
            severity: 'warn',
            title: `${where}第 ${i + 1} 个根节点点开就结束了`,
            detail: '根节点的 `message` 与 `items` 都为空，玩家什么都看不到（至少写一句台词）。',
            ...base,
            dialogPath: at,
          })
        }
        /** 根层写了 `result`：它只在作为上层选项时才有意义，导出时剔除 */
        if (atRoot && node.result) {
          out.push({
            key: 'K18',
            severity: 'warn',
            title: `${where}第 ${i + 1} 个根节点写了 result`,
            detail: '根层的 `result` 不展示（它只在作为上层选项时才有意义），导出时会被剔除。',
            ...base,
            dialogPath: at,
          })
        }
        /** `hit` 无所属：这一层没有 `dice`，却没有命中可言 */
        if (!parentHasDice && node.hit) {
          out.push({
            key: 'K18',
            severity: 'warn',
            title: `${where}第 ${i + 1} 个元素带了 hit 却没有骰子`,
            detail: '这一层没有 `dice`（没有掷骰就没有命中），`hit` 会被忽略；导出时自动剔除。',
            ...base,
            dialogPath: at,
          })
        }

        const kids = node.items ?? []
        if (kids.length > 0) {
          const cover = hitCoverage(node.dice, kids)
          if (cover) {
            if (cover.missing.length > 0) {
              out.push({
                key: 'K18',
                severity: 'warn',
                title: `${where}掷到 ${listPoints(cover.missing)} 没有任何选项命中`,
                detail: `${node.dice} 的点数里 ${listPoints(cover.missing)} 没被任何 \`hit\` 覆盖，运行时会要求重掷（只提示、不拦截）。`,
                ...base,
                dialogPath: at,
              })
            }
            if (cover.overlaps.length > 0) {
              out.push({
                key: 'K18',
                severity: 'warn',
                title: `${where}点数 ${listPoints(cover.overlaps)} 被重复命中`,
                detail: '同一层里两条 `hit` 盖到了同一个点数，运行时会取先出现的那个 —— 建议改区间。',
                ...base,
                dialogPath: at,
              })
            }
            for (const bad of cover.outOfRange) {
              out.push({
                key: 'K19',
                severity: 'error',
                title: `${where}第 ${bad.index} 个元素的 hit「${bad.hit}」超出 ${node.dice} 的范围`,
                detail: `改成不超过 ${cover.faces} 的区间（如 1-${cover.faces}）；超出部分永远不会被掷到。`,
                ...base,
                dialogPath: at,
              })
            }
            for (const bad of cover.badHit) {
              out.push({
                key: 'K19',
                severity: 'error',
                title: `${where}第 ${bad.index} 个元素的 hit「${bad.hit}」不是合法区间`,
                detail: '写成单点数（`6`）或升序区间（`1-2`）都行 —— 这条永远命中不了。',
                ...base,
                dialogPath: at,
              })
            }
          }
        }

        walk(kids, at, false, !!node.dice)
      })
    }

    walk(roots, plan, true, false)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 总入口                                                              */
/* ------------------------------------------------------------------ */

export function validateProject(library: Library, project: Project): Issue[] {
  const issues: Issue[] = []
  const enabledIds = project.enabledIds
  const enabled = new Set(enabledIds)
  const exists = new Map<string, { kind: ComponentKind; def: AnyComponent }>()
  for (const item of [
    ...library.roads.map((d) => ['road', d] as const),
    ...library.buildings.map((d) => ['building', d] as const),
    ...library.items.map((d) => ['item', d] as const),
    ...library.monsters.map((d) => ['monster', d] as const),
    ...library.classes.map((d) => ['class', d] as const),
    ...library.skills.map((d) => ['skill', d] as const),
    ...library.npcs.map((d) => ['npc', d] as const),
    ...library.backgrounds.map((d) => ['background', d] as const),
  ]) {
    exists.set(item[1].id, { kind: item[0], def: item[1] })
  }
  /** 这一局里真正会出现的 NPC ＝ 被某个建筑实例的 `npcs` 点到（NPC 没有「启用」开关） */
  const talkingTo = npcIdsOf(project)
  const npcsById = new Map<string, NpcDef>(library.npcs.map((n) => [n.id, n]))

  /** K1 / K2：起终点缺失 —— 图层红点 + 导出前 toast，不阻塞 */
  for (const map of project.maps) {
    if (!map.nodes.some((n) => n.type === 'start')) {
      issues.push({
        key: 'K1',
        severity: 'error',
        title: `「${map.name}」没有起点`,
        detail: '用模式条上的「标记 · 起点」放到画布上（每图各一个）。',
        mapId: map.id,
        mapName: map.name,
      })
    }
    if (!map.nodes.some((n) => n.type === 'end')) {
      issues.push({
        key: 'K2',
        severity: 'error',
        title: `「${map.name}」没有终点`,
        detail: '走到终点就是这张图通关，缺了它这一局走不到头。',
        mapId: map.id,
        mapName: map.name,
      })
    }
  }

  /** K3：引用完整性 —— 悬空引用导出时自动剔除 */
  const reportRef = (ownerKind: ComponentKind, owner: AnyComponent, refId: string, need: 'enabled' | 'exists') => {
    const found = exists.get(refId)
    if (!found) {
      issues.push({
        key: 'K3',
        severity: 'error',
        title: `「${owner.name}」指向了不存在的 ${refId}`,
        detail: '这个引用是悬空的，导出时会被自动剔除。',
        componentId: owner.id,
        componentKind: ownerKind,
        section: componentSection(ownerKind, owner),
      })
    } else if (need === 'enabled' && !enabled.has(refId)) {
      issues.push({
        key: 'K3',
        severity: 'error',
        title: `「${owner.name}」引用了未启用的「${found.def.name}」`,
        detail: '未启用的组件这一局世界里不存在，把它启用起来。',
        componentId: owner.id,
        componentKind: ownerKind,
        section: componentSection(ownerKind, owner),
      })
    }
  }

  for (const list of [
    ['item', library.items] as const,
    ['monster', library.monsters] as const,
    ['class', library.classes] as const,
    ['skill', library.skills] as const,
    ['building', library.buildings] as const,
  ]) {
    const kind = list[0]
    for (const def of list[1] as AnyComponent[]) {
      if (!enabled.has(def.id)) continue
      for (const refId of referenceIdsOf(kind, def)) reportRef(kind, def, refId, 'enabled')
    }
  }

  /** K3 / K18 / K19：NPC —— `give` 的道具必须已启用；对话树自身的问题逐条列（§4.9.2 / §5.7） */
  for (const npc of library.npcs) {
    if (!talkingTo.includes(npc.id)) continue
    for (const refId of referenceIdsOf('npc', npc)) reportRef('npc', npc, refId, 'enabled')
    issues.push(...dialogIssues(npc))
  }

  for (const id of project.rules.class_pool) {
    const found = exists.get(id)
    if (!found || found.kind !== 'class') {
      issues.push({
        key: 'K3',
        severity: 'error',
        title: `开局职业池里有未知的 ${id}`,
        detail: 'class_pool 只能放已启用的职业。',
      })
    } else if (!enabled.has(id)) {
      issues.push({
        key: 'K3',
        severity: 'error',
        title: `开局职业池里的「${found.def.name}」没启用`,
        detail: '未启用的职业不会出现在开局候选里。',
        componentId: id,
        componentKind: 'class',
        section: 'class',
      })
    }
  }

  /** K12：道路节点缺 ref */
  for (const map of project.maps) {
    for (const node of map.nodes) {
      if (node.type === 'road' && !node.ref) {
        issues.push({
          key: 'K12',
          severity: 'error',
          title: `(${node.x}, ${node.y}) 的道路没有指定是哪条路`,
          detail: '不同道路的消耗 / 权限不同，回退成「走一格花一步、没有权限要求」。',
          mapId: map.id,
          mapName: map.name,
          cell: [node.x, node.y],
        })
      }
      /** K13：非建筑节点带了 w / h —— road / start / end 恒为 1×1（§4.9.3 / §8.3 设定 6） */
      if (node.type !== 'building' && ((node.w ?? 1) !== 1 || (node.h ?? 1) !== 1)) {
        issues.push({
          key: 'K13',
          severity: 'error',
          title: `(${node.x}, ${node.y}) 的${{ road: '道路', start: '起点', end: '终点' }[node.type] ?? node.type}不该有大小`,
          detail: '这些件恒为 1×1 —— 大小会被忽略（导入时归一为 1），删掉 w / h 即可。',
          mapId: map.id,
          mapName: map.name,
          cell: [node.x, node.y],
        })
      }
      if ((node.type === 'road' || node.type === 'building') && node.ref && !exists.get(node.ref)) {
        issues.push({
          key: 'K3',
          severity: 'error',
          title: `(${node.x}, ${node.y}) 引用了不存在的组件 ${node.ref}`,
          detail: '这个组件被删掉了 —— 换一个组件，或者把它删掉。',
          mapId: map.id,
          mapName: map.name,
          cell: [node.x, node.y],
          componentId: node.ref,
        })
      }

      /* —— NPC（§4.9.3 / §5.7）：挂在建筑实例上，与 `encounter` 正交 —— */
      if (node.type !== 'building') continue
      const instanceNpcs = (node.npcs ?? []).filter((id) => npcsById.has(id))
      const def = node.ref ? (exists.get(node.ref)?.def as BuildingDef | undefined) : undefined

      /** K3：实例 `npcs` 指向的 NPC 必须在库里存在（**无「启用」要求**） */
      for (const npcId of node.npcs ?? []) {
        if (npcsById.has(npcId)) continue
        issues.push({
          key: 'K3',
          severity: 'error',
          title: `(${node.x}, ${node.y}) 引用了不存在的 NPC ${npcId}`,
          detail: '这位 NPC 被删掉了 —— 换一位，或者把它从实例上摘掉。',
          mapId: map.id,
          mapName: map.name,
          cell: [node.x, node.y],
          componentId: npcId,
        })
      }

      /** K16：实例 `dialog` 的方案名必须在候选 NPC 的 `dialogs` 里（导出**不剔除**，运行时跳过对话） */
      if (node.dialog) {
        const hit = instanceNpcs.some((id) => Boolean(npcsById.get(id)?.dialogs?.[node.dialog!]))
        if (!hit) {
          issues.push({
            key: 'K16',
            severity: 'error',
            title: `(${node.x}, ${node.y}) 的对话方案「${node.dialog}」不存在`,
            detail: instanceNpcs.length > 0
              ? '这些 NPC 都没有这个名字的方案 —— 换一个方案（留空则由骰子抽一套）。导出时不剔除该字段，运行时直接跳过对话、当这个实例没有 NPC。'
              : '这个实例没配 NPC，写下的 `dialog` 没人能接 —— 先挂上 NPC（留空则由骰子抽一套）。',
            mapId: map.id,
            mapName: map.name,
            cell: [node.x, node.y],
          })
        }
      }

      /** K14：说了要对话，却没配人 */
      if (def?.encounter === 'talk' && instanceNpcs.length === 0) {
        issues.push({
          key: 'K14',
          severity: 'warn',
          title: `(${node.x}, ${node.y}) 的「${def.name}」没有对话`,
          detail: '这个建筑的行为是 `talk`（进去就对话），但实例没配 NPC —— 要么挂一位 NPC，要么把行为改回 `empty`。',
          mapId: map.id,
          mapName: map.name,
          cell: [node.x, node.y],
          componentId: def.id,
          componentKind: 'building',
          section: componentSection('building', def),
        })
      }

    }
  }

  /**
   * K15：空宝箱 —— `treasure` 的奖励池筛不出东西，**且所有实例都没挂 NPC** → **建筑页**标黄
   * （配了 NPC 就是合法内容物，不报；§5.7 / §4.8.5⑥）。
   */
  for (const def of library.buildings) {
    if (!enabled.has(def.id) || def.encounter !== 'treasure') continue
    const size = def.reward_pool ? resolveItemPool(library, enabledIds, def.reward_pool).length : 0
    if (size > 0) continue
    const hasNpc = project.maps.some((m) =>
      m.nodes.some((n) => n.type === 'building' && n.ref === def.id && (n.npcs?.length ?? 0) > 0),
    )
    if (hasNpc) continue
    issues.push({
      key: 'K15',
      severity: 'warn',
      title: `「${def.name}」什么都没装`,
      detail: '这个宝箱的奖励池是空的（没配 / 筛出 0 项），实例也没挂 NPC —— 玩家踩上去会觉得空空如也。配个奖励池，或者给它挂一位 NPC（NPC 就是它的内容物）。',
      componentId: def.id,
      componentKind: 'building',
      section: componentSection('building', def),
    })
  }

  /** K17：地图名重复 —— 同名会让建筑实例 key 撞车（导出 / 开局会自动加后缀，§8.3 设定 6） */
  const nameCount = new Map<string, number>()
  for (const map of project.maps) nameCount.set(map.name, (nameCount.get(map.name) ?? 0) + 1)
  for (const map of project.maps) {
    if ((nameCount.get(map.name) ?? 0) < 2) continue
    issues.push({
      key: 'K17',
      severity: 'warn',
      title: `「${map.name}」有两张同名地图`,
      detail: '同名地图会让建筑实例 key 撞车（对话抽取结果 / 进度标记被串用）—— 导出与开局时会自动改成「名字 (2)」，建议直接改名免得存档对不上。',
      mapId: map.id,
      mapName: map.name,
    })
  }

  /** K4 / K5：技能 */
  for (const skill of library.skills) {
    if (!enabled.has(skill.id)) continue
    issues.push(...skillGainIssues(library, enabledIds, skill))
    issues.push(...skillSelfConflict(skill))
    issues.push(...effectDurationIssues(skill, 'skill', skill.effects, project.rules.state.max_duration))
  }
  for (const it of library.items) {
    if (!enabled.has(it.id)) continue
    issues.push(...effectDurationIssues(it, 'item', it.effects, project.rules.state.max_duration))
  }
  for (const m of library.monsters as MonsterDef[]) {
    if (!enabled.has(m.id)) continue
    issues.push(...effectDurationIssues(m, 'monster', m.effects, project.rules.state.max_duration))
  }

  /** K6 / K7 / K8：建筑 */
  for (const b of library.buildings) {
    if (!enabled.has(b.id)) continue
    issues.push(...poolEmptyIssues(library, enabledIds, b))
    issues.push(...gateIssues(library, enabledIds, b.gate, { id: b.id, name: b.name, kind: 'building' }))
    if (b.encounter === 'event' && b.event) issues.push(...eventIssues(library, project, b, b.event))
    if (b.encounter === 'shop' && b.price?.currency) reportRef('building', b, b.price.currency, 'enabled')
    if (b.mimic?.monster) reportRef('building', b, b.mimic.monster, 'enabled')
  }

  /** K10：商店缺货币（这幅图里没有产出它的地方） */
  const currencyIds = new Set(
    library.buildings.filter((b) => b.encounter === 'shop' && b.price?.currency).map((b) => b.price!.currency),
  )
  const producers = new Set<string>()
  for (const b of library.buildings) {
    for (const id of [...(b.reward_pool?.ids ?? []).map((e) => (typeof e === 'string' ? e : e.id)), ...(b.event?.on_success?.grant ?? []).map((g) => g.id)]) {
      producers.add(id)
    }
    if (b.reward_pool?.source === 'filter') for (const item of library.items) producers.add(item.id)
  }
  for (const id of currencyIds) {
    if (producers.has(id)) continue
    const currency = exists.get(id)
    issues.push({
      key: 'K10',
      severity: 'warn',
      title: `货币「${currency?.def.name ?? id}」没有任何产出`,
      detail: '它没出现在任何奖励池 / 事件产出里，玩家买不起东西（把金币放进宝箱屋 / 怪物战利品就行）。',
      componentId: id,
      componentKind: 'item',
      section: 'consumable',
    })
  }

  /** K7：道路权限标签无来源 */
  for (const road of library.roads) {
    issues.push(...gateIssues(library, enabledIds, road.gate, { id: road.id, name: road.name, kind: 'road' }))
  }

  /** K11：背包装不下家当 */
  for (const cls of library.classes) {
    if (!enabled.has(cls.id)) continue
    issues.push(...classIssues(library, enabledIds, cls))
  }

  return issues
}

export interface IssueGroup {
  key: string
  label: string
  issues: Issue[]
}

const KEY_LABEL: Record<string, string> = {
  K1: '起点缺失',
  K2: '终点缺失',
  K3: '引用悬空 / 未启用',
  K4: '技能无法获得',
  K5: '技能自相矛盾',
  K6: '池内无可用条目',
  K7: '权限标签无来源',
  K8: '事件必成 / 必败',
  K9: '状态缺少持续回合数',
  K10: '货币没有产出来源',
  K11: '背包容量不足',
  K12: '道路节点缺引用',
  K13: '非建筑节点带了大小',
  K14: '说了要对话却没配人',
  K15: '空宝箱什么都没装',
  K16: 'dialog 方案名悬空',
  K17: '地图名重复',
  K18: '对话树提示',
  K19: 'hit 越界 / 非法',
}

export function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, Issue[]>()
  for (const issue of issues) {
    const list = groups.get(issue.key) ?? []
    list.push(issue)
    groups.set(issue.key, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
    .map(([key, list]) => ({ key, label: KEY_LABEL[key] ?? key, issues: list }))
}
