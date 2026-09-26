import {
  AnyComponent,
  EntityKind,
  Library,
  Project,
  StatKey,
  STAT_KEYS,
  Stats,
} from './types';

// 七大类 id 前缀（§3.2：自建 id = 类型前缀 + 随机串）
export const KIND_PREFIX: Record<EntityKind, string> = {
  monster: 'm',
  item: 'i',
  building: 'b',
  road: 'r',
  class: 'c',
  skill: 'k',
};

// 生成稳定唯一 id（类型前缀 + 随机串）
export function genId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

// 按组件类别生成 id
export function genIdFor(kind: EntityKind): string {
  return genId(KIND_PREFIX[kind]);
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function zeroStats(): Stats {
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = [0, 0];
    return acc;
  }, {} as Stats);
}

// 6 维数值全 0（运行期 Combatant.stats / 玩家属性）
export function zeroStatValues(): Record<StatKey, number> {
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Record<StatKey, number>);
}

export function zeroMods(): Record<StatKey, number> {
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Record<StatKey, number>);
}

// 把任意数值安全转成 [min,max] 范围（导入容错）
export function toRange(v: unknown): [number, number] {
  if (Array.isArray(v) && v.length === 2) {
    return [Number(v[0]) || 0, Number(v[1]) || 0];
  }
  const n = Number(v) || 0;
  return [n, n];
}

// ───────────────────────── 标签反查（§5.6 双向反查） ─────────────────────────
// 返回带某标签的已启用组件（库里所有自带该标签的组件）
export function componentsWithTag(library: Library, tag: string): AnyComponent[] {
  return Object.values(library).filter((c) => c.tags?.includes(tag));
}

// 返回"引用了该标签做 gate/权限"的组件（道路/建筑）与项目铺设节点
export function gatesUsingTag(
  library: Library,
  project: Project,
  tag: string
): { components: AnyComponent[]; nodeCount: number } {
  const gateHolders = Object.values(library).filter((c) => {
    if (c.kind === 'road' || c.kind === 'building') {
      return c.gate?.tags?.includes(tag);
    }
    return false;
  });
  let nodeCount = 0;
  for (const m of project.maps) {
    for (const n of m.nodes) {
      if (n.type !== 'road' && n.type !== 'building') continue;
      const ref = n.ref ? library[n.ref] : undefined;
      if (ref && (ref.kind === 'road' || ref.kind === 'building') && ref.gate?.tags?.includes(tag)) {
        nodeCount += 1;
      }
    }
  }
  return { components: gateHolders, nodeCount };
}

export interface TagUse {
  type: '权限' | '筛选' | '门槛';
  name: string; // 引用它的组件名
  ref: string; // 组件 id
}
export interface TagInfo {
  tag: string;
  uses: TagUse[]; // 被谁当权限/筛选/门槛用
  owners: { name: string; ref: string; enabled: boolean }[]; // 自带该标签的组件（可提供能力）
}
// 聚合所有标签的反查信息（§5.6 双向反查的总表）
export function collectTagInfo(library: Library, project: Project): TagInfo[] {
  const map = new Map<string, TagInfo>();
  const ensure = (tag: string): TagInfo => {
    let t = map.get(tag);
    if (!t) {
      t = { tag, uses: [], owners: [] };
      map.set(tag, t);
    }
    return t;
  };
  for (const c of Object.values(library)) {
    // 自带标签 → owner
    for (const tag of c.tags || []) {
      ensure(tag).owners.push({ name: c.name, ref: c.id, enabled: project.enabledIds.includes(c.id) });
    }
    // 作为权限/门槛引用
    if ((c.kind === 'road' || c.kind === 'building') && c.gate?.tags?.length) {
      for (const tag of c.gate.tags) ensure(tag).uses.push({ type: '权限', name: c.name, ref: c.id });
    }
    if (c.kind === 'building' && c.event?.gate?.tags?.length) {
      for (const tag of c.event.gate.tags) ensure(tag).uses.push({ type: '门槛', name: c.name, ref: c.id });
    }
    // 作为筛选引用（池）
    const pools = [c.kind === 'building' ? c.reward_pool : undefined, c.kind === 'building' ? c.monster_pool : undefined, c.kind === 'building' ? c.stock : undefined, c.kind === 'monster' ? c.reward_pool : undefined].filter(Boolean) as any[];
    for (const p of pools) {
      if (p?.source === 'filter' && p.filter?.tags?.length) {
        for (const tag of p.filter.tags) ensure(tag).uses.push({ type: '筛选', name: c.name, ref: c.id });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

