/**
 * 状态池专项校验 `K20`~`K37`（V2.3 §十）—— 一并纳入「清单」按钮的汇总视图。
 *
 * 沿用既有口径：**只提示、不阻塞**保存与导出（惟 `K30` 例外）。
 * 遍历同一遍，顺带产出**引用数**（变量表 / 判定模板表的派生统计，§9.2 / §9.7）。
 */

import { findDependencyCycle } from '../engine/state-pool'
import {
  ENGINE_ITEM_PREFIX,
  POOL_READ_OP_LABEL,
  POOL_WRITE_OP_LABEL,
  engineVarType,
  engineVarWritable,
  forceUsrPrefix,
  isEngineName,
  readOpApplies,
  shortName,
  writeOpApplies,
  type ComponentKind,
  type CondTpl,
  type DialogNode,
  type Gate,
  type Library,
  type NpcDef,
  type PoolCheck,
  type PoolCheckRef,
  type PoolCondItem,
  type PoolEffect,
  type PoolReadOp,
  type PoolType,
  type PoolValue,
  type PoolWriteOp,
  type Project,
} from '../types'
import { componentSection, type Issue } from './validate'

interface Site {
  label: string
  componentId?: string
  componentKind?: ComponentKind
  section?: string
  dialogPath?: string
}

interface PoolUsage {
  vars: Map<string, number>
  templates: Map<string, number>
  /** 引用明细（读 / 写算子各留首例）：供「自动收录」按算子推断类型（§9.4） */
  refs: Map<string, PoolRefInfo>
}

/** 某个键被引用时的算子明细（派生、不落盘） */
export interface PoolRefInfo {
  readCount: number
  writeCount: number
  readOp?: PoolReadOp
  writeOp?: PoolWriteOp
}

function matchesType(value: PoolValue, type: PoolType): boolean {
  return typeof value === type
}

/** 收集全部引用处与专项问题（一趟遍历） */
function collect(library: Library, project: Project): { issues: Issue[]; usage: PoolUsage } {
  const issues: Issue[] = []
  const usage: PoolUsage = { vars: new Map(), templates: new Map(), refs: new Map() }
  const bumpVar = (name: string, op?: PoolReadOp | PoolWriteOp, kind: 'read' | 'write' = 'read'): void => {
    usage.vars.set(name, (usage.vars.get(name) ?? 0) + 1)
    const info = usage.refs.get(name) ?? { readCount: 0, writeCount: 0 }
    if (kind === 'write') {
      info.writeCount += 1
      if (info.writeOp === undefined) info.writeOp = op as PoolWriteOp
    } else {
      info.readCount += 1
      if (info.readOp === undefined) info.readOp = op as PoolReadOp
    }
    usage.refs.set(name, info)
  }
  const bumpTpl = (name: string): void => {
    usage.templates.set(name, (usage.templates.get(name) ?? 0) + 1)
  }

  /* ---- 声明侧：`pool` 变量表（K21 / K24 / K27） ---- */
  const declared = new Map<string, PoolType>()
  for (const v of project.pool) {
    const short = shortName(v.name)
    if (declared.has(v.name)) {
      issues.push({ key: 'K21', severity: 'error', title: `变量「${short}」重复声明`, detail: '同名声明只取先出现的一条，请删掉多余的。', section: 'pool' })
    } else {
      declared.set(v.name, v.type)
    }
    if (!short || short.includes('-')) {
      issues.push({
        key: 'K27',
        severity: 'error',
        title: `变量短名「${short || '（空）'}」含连字符或不合法`,
        detail: '短名请用下划线（如 merchant_price），不要用连字符，也不要留空。',
        section: 'pool',
      })
    }
    if (!matchesType(v.value, v.type)) {
      issues.push({
        key: 'K24',
        severity: 'error',
        title: `变量「${short}」的默认值与类型不符`,
        detail: `声明为 ${v.type}，却写了 ${JSON.stringify(v.value)}；按类型取零值。`,
        section: 'pool',
      })
    }
  }

  /* ---- 声明侧：`conds` 判定模板（K36） ---- */
  const templates = new Map<string, CondTpl>()
  for (const c of project.conds) {
    const name = c.name
    if (declared.has(name)) {
      issues.push({
        key: 'K36',
        severity: 'error',
        title: `判定模板「${shortName(name)}」与变量重名`,
        detail: '判定模板名与变量名共用同一个命名空间，请改名以区分；引用时取先出现的一条。',
        section: 'pool',
      })
    }
    if (!templates.has(name)) templates.set(name, c)
  }

  /* ---- 类型 / 声明解析 ---- */
  const resolve = (name: string): { type?: PoolType; known: boolean; writable: boolean } => {
    if (isEngineName(name)) {
      const t = engineVarType(name)
      return { type: t, known: t !== undefined, writable: engineVarWritable(name) }
    }
    const t = declared.get(name)
    return { type: t, known: t !== undefined, writable: true }
  }

  const itemIds = new Set(library.items.map((i) => i.id))
  /** K32：`engine-item.<道具 id>` 的道具不在组件库 */
  const checkItemId = (name: string, site: Site): void => {
    if (!name.startsWith(ENGINE_ITEM_PREFIX)) return
    const id = name.slice(ENGINE_ITEM_PREFIX.length)
    if (!itemIds.has(id)) {
      issues.push({
        key: 'K32',
        severity: 'warn',
        title: `道具「${id}」不在组件库`,
        detail: `${site.label}引用了 engine-item.${id}，但库中没有这件道具；运行时会按件数正常读写。`,
        ...site,
      })
    }
  }

  const checkItem = (item: PoolCondItem, site: Site): void => {
    const { type, known } = resolve(item.name)
    bumpVar(item.name, item.op, 'read')
    checkItemId(item.name, site)
    if (!known) {
      issues.push({
        key: 'K20',
        severity: 'error',
        title: `「${item.name}」没有声明`,
        detail: `${site.label}引用了这个键，但「## Pool」的 pool 段里没有它（引擎键须落在 §三 总表内）。运行时该条判定不成立。`,
        ...site,
        poolKey: isEngineName(item.name) ? undefined : forceUsrPrefix(item.name),
      })
    } else if (type && !readOpApplies(item.op, type)) {
      issues.push({
        key: 'K26',
        severity: 'error',
        title: `算子「${POOL_READ_OP_LABEL[item.op]}」不适用于 ${type}`,
        detail: `「${item.name}」声明为 ${type}，不能用这个算子比较；运行时不执行（判定不成立）。`,
        ...site,
      })
    }
    if (item.ref !== undefined) {
      bumpVar(item.ref, item.op, 'read')
      const rt = resolve(item.ref)
      if (!rt.known) {
        issues.push({
          key: 'K20',
          severity: 'error',
          title: `「${item.ref}」没有声明`,
          detail: `${site.label}用它作比较的另一侧，但池里没声明。`,
          ...site,
          poolKey: isEngineName(item.ref) ? undefined : forceUsrPrefix(item.ref),
        })
      } else if (rt.type && type && rt.type !== type) {
        issues.push({
          key: 'K37',
          severity: 'error',
          title: `「${item.name}」与「${item.ref}」类型不一致`,
          detail: `两侧分别是 ${type} 与 ${rt.type}，比不了；运行时只认 ref。`,
          ...site,
        })
      }
    }
    if (item.value !== undefined && item.ref !== undefined) {
      issues.push({
        key: 'K37',
        severity: 'error',
        title: `「${item.name}」同时写了 value 与 ref`,
        detail: '两者只能写一个；运行时只认 ref。',
        ...site,
      })
    }
  }

  const checkEffect = (eff: PoolEffect, site: Site): void => {
    const { type, known, writable } = resolve(eff.name)
    bumpVar(eff.name, eff.op, 'write')
    checkItemId(eff.name, site)
    if (!known) {
      issues.push({
        key: 'K20',
        severity: 'error',
        title: `「${eff.name}」没有声明`,
        detail: `${site.label}要写这个键，但池里没有它。运行时该条修改不执行。`,
        ...site,
        poolKey: isEngineName(eff.name) ? undefined : forceUsrPrefix(eff.name),
      })
    } else {
      if (isEngineName(eff.name) && !writable) {
        issues.push({
          key: 'K23',
          severity: 'error',
          title: `「${eff.name}」是只读的引擎变量`,
          detail: '引擎键里只有 hpValue / mpValue / points / stepsLeft 与 engine-item.* 可以写；运行时不执行。',
          ...site,
        })
      }
      if (type && !writeOpApplies(eff.op, type)) {
        issues.push({
          key: 'K26',
          severity: 'error',
          title: `算子「${POOL_WRITE_OP_LABEL[eff.op]}」不适用于 ${type}`,
          detail: `「${eff.name}」声明为 ${type}，不能用这个算子；运行时不执行。`,
          ...site,
        })
      }
    }
    if (eff.op === 'divide' && Number(eff.value) === 0) {
      issues.push({ key: 'K22', severity: 'error', title: `除以零：${eff.name}`, detail: '除数为 0 时该条修改不执行。', ...site })
    }
  }

  const checkBody = (check: PoolCheck | undefined, site: Site): void => {
    if (!check) return
    const items = check.items ?? []
    if (items.length === 0) {
      issues.push({ key: 'K25', severity: 'warn', title: '这条判定没有任何条件', detail: `${site.label}的判定集合是空的，视为成立。`, ...site })
      return
    }
    for (const item of items) checkItem(item, site)
  }

  /** 判定位置：条件体或判定模板名（§4.5） */
  const checkRef = (ref: PoolCheckRef | undefined, site: Site): void => {
    if (ref === undefined || ref === null) return
    if (typeof ref === 'string') {
      bumpTpl(ref)
      if (!templates.has(ref)) {
        issues.push({
          key: 'K35',
          severity: 'error',
          title: `判定模板「${shortName(ref)}」没有声明`,
          detail: `${site.label}引用了这个模板，但「判定模板」页签里没有它。运行时该条件恒不成立。`,
          ...site,
        })
      }
      return
    }
    checkBody(ref, site)
  }

  /* ---- 使用处：回合判定（K28 / K29 / K30） ---- */
  const aliasSet = new Set<string>()
  const aliasSeen = new Set<string>()
  for (const c of project.checks) {
    if (!c.alias) continue
    if (aliasSeen.has(c.alias)) {
      issues.push({
        key: 'K29',
        severity: 'error',
        title: `回合判定别名「${c.alias}」重复`,
        detail: '取先出现的一个作为被依赖目标，请另起一个别名。',
        section: 'pool',
      })
    }
    aliasSeen.add(c.alias)
    aliasSet.add(c.alias)
  }
  project.checks.forEach((c, i) => {
    const site: Site = { label: `回合判定「${c.alias ?? `#${i + 1}`}」`, section: 'pool' }
    for (const dep of c.deps ?? []) {
      if (!aliasSet.has(dep)) {
        issues.push({
          key: 'K28',
          severity: 'error',
          title: `依赖「${dep}」不存在`,
          detail: `${site.label}依赖了这个别名，但没有哪条判定用了它（也可能那条判定没起名）。运行时仅忽略该条依赖，本条照常执行。`,
          ...site,
        })
      }
    }
    checkRef(c.when, site)
    for (const eff of c.pool ?? []) checkEffect(eff, site)
  })
  const cycle = findDependencyCycle(project.checks)
  if (cycle) {
    issues.push({
      key: 'K30',
      severity: 'error',
      title: '回合判定的依赖成环',
      detail: `环路：${cycle.join(' → ')}。请理清先后；手写文件按声明顺序兜底，编辑器里请先解开再保存 / 导出。`,
      section: 'pool',
    })
  }

  /* ---- 使用处：判定模板的条件 ---- */
  project.conds.forEach((c) => {
    checkBody(c.when, { label: `判定模板「${shortName(c.name)}」`, section: 'pool' })
  })

  /* ---- 使用处：NPC 对话树（K25 / K33 / K34） ---- */
  const walkNodes = (nodes: DialogNode[], npc: NpcDef, prefix: string): void => {
    const hasIf = nodes.some((n) => n.if !== undefined)
    if (hasIf && nodes.some((n) => n.hit !== undefined || n.dice !== undefined)) {
      issues.push({
        key: 'K33',
        severity: 'warn',
        title: `「${npc.name}」同一层混用了 if 与 dice / hit`,
        detail: '同一层里 `if` 与骰子二选一；运行时以 `if` 优先。',
        componentId: npc.id,
        componentKind: 'npc',
        section: componentSection('npc', npc),
        dialogPath: prefix,
      })
    }
    const firstPlain = nodes.findIndex((n) => n.if === undefined)
    if (firstPlain >= 0 && nodes.slice(firstPlain + 1).some((n) => n.if !== undefined)) {
      issues.push({
        key: 'K34',
        severity: 'warn',
        title: `「${npc.name}」的条件分支没有放在末尾`,
        detail: 'if-else 链自上而下取第一条成立者，无 `if` 的记录就是 else；它后面的条件永远不会被求值。',
        componentId: npc.id,
        componentKind: 'npc',
        section: componentSection('npc', npc),
        dialogPath: prefix,
      })
    }
    nodes.forEach((n, i) => {
      const path = `${prefix}${prefix ? ' → ' : ''}[${i}]`
      const site: Site = {
        label: `「${npc.name}」的对话`,
        componentId: npc.id,
        componentKind: 'npc',
        section: componentSection('npc', npc),
        dialogPath: path,
      }
      checkRef(n.if, site)
      for (const eff of n.pool ?? []) checkEffect(eff, site)
      if (n.items && n.items.length > 0) walkNodes(n.items, npc, path)
    })
  }
  for (const npc of library.npcs) {
    for (const [mod, nodes] of Object.entries(npc.dialogs ?? {})) {
      if (Array.isArray(nodes)) walkNodes(nodes, npc, mod)
    }
  }

  /* ---- 使用处：门锁（§6.4） ---- */
  const checkGate = (gate: Gate | undefined, site: Site): void => {
    if (gate?.pool !== undefined) checkRef(gate.pool, site)
  }
  for (const road of library.roads) {
    checkGate(road.gate, {
      label: `道路「${road.name}」的门锁`,
      componentId: road.id,
      componentKind: 'road',
      section: componentSection('road', road),
    })
  }
  for (const b of library.buildings) {
    const site: Site = { label: `建筑「${b.name}」的门锁`, componentId: b.id, componentKind: 'building', section: componentSection('building', b) }
    checkGate(b.gate, site)
    // 建筑 `encounter` 前置判定（§6.4 / §8.3③）：与门锁同构，引用同样纳入 K20 / K26 / K35 等
    checkRef(b.encounterPool, { ...site, label: `建筑「${b.name}」的触发判定` })
    checkGate(b.event?.gate, { ...site, label: `建筑「${b.name}」事件的门槛` })
  }

  return { issues, usage }
}

/** `K20`~`K37` 的全部问题（汇总进「清单」） */
export function poolIssues(library: Library, project: Project): Issue[] {
  return collect(library, project).issues
}

/** 引用数统计（变量表 / 判定模板表的派生列，§9.2 / §9.7） */
export function poolUsageCounts(library: Library, project: Project): PoolUsage {
  return collect(library, project).usage
}

/** 引用明细（键 → 读写算子）：供「自动收录」按算子推断类型（§9.4） */
export function poolReferenceInfo(library: Library, project: Project): Map<string, PoolRefInfo> {
  return collect(library, project).usage.refs
}
