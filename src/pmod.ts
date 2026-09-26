import yaml from 'js-yaml';
import {
  AnyComponent,
  EntityKind,
  GameMap,
  Library,
  MapNode,
  Project,
  Rules,
  StatKey,
  STAT_KEYS,
} from './types';
import { DEFAULT_RULES } from './presets';
import { genIdFor, toRange } from './utils';

// ---- 导出 ----

function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) {
      const val = (v as Record<string, unknown>)[k];
      if (val !== undefined) o[k] = clean(val);
    }
    return o;
  }
  return v;
}

const DUMP_OPTS: yaml.DumpOptions = { lineWidth: 120, noRefs: true };

// 收集"本局用到的组件 id"：启用的非地图件 + 铺设到地图的 road/building 引用
export function collectUsedIds(project: Project, library: Library): string[] {
  const ids = new Set<string>(project.enabledIds);
  for (const m of project.maps) {
    for (const n of m.nodes) {
      if ((n.type === 'road' || n.type === 'building') && n.ref) ids.add(n.ref);
    }
  }
  return [...ids].filter((id) => library[id]);
}

const SECTION_ORDER: { kind: EntityKind; label: string }[] = [
  { kind: 'monster', label: '怪物' },
  { kind: 'item', label: '道具' },
  { kind: 'building', label: '建筑' },
  { kind: 'road', label: '道路' },
  { kind: 'class', label: '职业' },
  { kind: 'skill', label: '技能' },
];

export function exportPmod(library: Library, project: Project): string {
  const used = collectUsedIds(project, library);
  const byKind: Record<EntityKind, AnyComponent[]> = {
    monster: [],
    item: [],
    building: [],
    road: [],
    class: [],
    skill: [],
  };
  for (const id of used) {
    const c = library[id];
    if (c) byKind[c.kind].push(c);
  }

  const out: string[] = [];
  out.push(`# ${project.name}`, '');
  out.push('## 背景');
  out.push((project.background || '').trim() || '（暂无背景）', '');

  out.push('## 设定', '');
  for (const { kind, label } of SECTION_ORDER) {
    if (!byKind[kind].length) continue;
    out.push(`### ${label}`);
    out.push('```yaml');
    out.push(yaml.dump(clean(byKind[kind]), DUMP_OPTS));
    out.push('```', '');
  }

  out.push('## 规则配置');
  out.push('```yaml');
  out.push(yaml.dump(clean(project.rules), DUMP_OPTS));
  out.push('```', '');

  out.push('## 地图');
  for (const m of project.maps) {
    out.push(`### ${m.name}`);
    out.push('```yaml');
    out.push(
      yaml.dump(
        clean({ start: m.start ?? null, end: m.end ?? null, nodes: m.nodes }),
        DUMP_OPTS
      )
    );
    out.push('```', '');
  }
  return out.join('\n');
}

// ---- 导入 ----

interface Block {
  h2: string;
  h3: string | null;
  yamlText: string | null;
  prose: string;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let inYaml = false;
  let yamlBuf = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) {
      if (inYaml) {
        if (cur) cur.yamlText = yamlBuf;
        inYaml = false;
        yamlBuf = '';
      } else {
        inYaml = true;
        yamlBuf = '';
      }
      continue;
    }
    if (inYaml) {
      yamlBuf += line + '\n';
      continue;
    }
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h2) {
      cur = { h2: h2[1].trim(), h3: null, yamlText: null, prose: '' };
      blocks.push(cur);
    } else if (h3) {
      cur = {
        h2: blocks.length ? blocks[blocks.length - 1].h2 : '',
        h3: h3[1].trim(),
        yamlText: null,
        prose: '',
      };
      blocks.push(cur);
    } else if (cur) {
      cur.prose += line + '\n';
    }
  }
  return blocks;
}

function loadYaml<T>(text: string | null | undefined, fallback: T): T {
  if (!text || !text.trim()) return fallback;
  try {
    const v = yaml.load(text);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function blockBy(blocks: Block[], h2: string, h3?: string): Block | undefined {
  return blocks.find((b) => b.h2 === h2 && (h3 === undefined || b.h3 === h3));
}

const SECTION_KIND: Record<string, EntityKind> = {
  怪物: 'monster',
  道具: 'item',
  建筑: 'building',
  道路: 'road',
  职业: 'class',
  技能: 'skill',
};

export interface ImportResult {
  components: AnyComponent[]; // 需要并入库的定义（已 remap 冲突 id）
  project: Project;
  conflicts: { oldId: string; newId: string }[]; // 同名不同内容→新 id
}

export function importPmod(text: string): ImportResult {
  const nameMatch = text.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '未命名';

  const blocks = parseBlocks(text);
  const bg = blockBy(blocks, '背景')?.prose.trim() ?? '';

  // 读取各分区组件定义
  const rawComponents: AnyComponent[] = [];
  for (const [label, kind] of Object.entries(SECTION_KIND)) {
    const list = loadYaml<AnyComponent[]>(blockBy(blocks, '设定', label)?.yamlText, []);
    for (const c of list) {
      rawComponents.push({ ...(c as object), kind } as AnyComponent);
    }
  }

  // 规则配置（缺失/残旧用 DEFAULT_RULES 兜底）
  const rules = loadYaml<Partial<Rules>>(blockBy(blocks, '规则配置')?.yamlText, {});
  const finalRules: Rules = mergeRules(rules);

  // 地图
  const mapBlocks = blocks.filter((b) => b.h2 === '地图' && b.h3);
  const maps: GameMap[] = mapBlocks.map((b) => {
    const data = loadYaml<{
      start?: [number, number] | null;
      end?: [number, number] | null;
      nodes?: MapNode[];
    }>(b.yamlText, {});
    return {
      id: `map_${Math.random().toString(36).slice(2, 10)}`,
      name: b.h3 as string,
      start: data.start ?? undefined,
      end: data.end ?? undefined,
      nodes: (data.nodes ?? []).map((n) => ({
        x: Number(n.x) || 0,
        y: Number(n.y) || 0,
        type: n.type,
        ref: n.ref,
        w: Number(n.w) > 1 ? Number(n.w) : 1,
        h: Number(n.h) > 1 ? Number(n.h) : 1,
      })),
    };
  });

  // 归一化 + 冲突处理：同名不同内容→后者改名并入，引用仍指向保留原件
  const conflicts: { oldId: string; newId: string }[] = [];
  const components: AnyComponent[] = [];
  const existing = new Set<string>(); // 已收入的 id

  for (const raw of rawComponents) {
    const c = normalizeComponent(raw);
    if (existing.has(c.id)) {
      const first = components.find((x) => x.id === c.id)!;
      if (JSON.stringify(first) !== JSON.stringify(c)) {
        const newId = genIdFor(c.kind); // 同名不同内容 → 改名并入，不覆盖原件
        conflicts.push({ oldId: c.id, newId });
        components.push({ ...c, id: newId });
      }
      // 完全相同 → 跳过重复
    } else {
      components.push(c);
      existing.add(c.id);
    }
  }

  const finalMaps = maps; // 引用（节点 ref）保留原名，指向保留原件，无需 remap

  const project: Project = {
    name,
    background: bg,
    enabledIds: [...new Set(rawComponents.map((c) => c.id))],
    rules: finalRules,
    maps: finalMaps.length ? finalMaps : [{ id: `map_${Date.now()}`, name: '地图 1', nodes: [] }],
  };

  return { components, project, conflicts };
}

function mergeRules(r: Partial<Rules>): Rules {
  const d = DEFAULT_RULES;
  if (!r || !r.move || !r.combat) return d;
  return {
    move: { dice: r.move.dice ?? d.move.dice },
    combat: {
      stat_dice: r.combat.stat_dice ?? d.combat.stat_dice,
      pick_dice: r.combat.pick_dice ?? d.combat.pick_dice,
      atk_roll: r.combat.atk_roll ?? d.combat.atk_roll,
      def_roll: r.combat.def_roll ?? d.combat.def_roll,
    },
    treasure: r.treasure ?? d.treasure,
    loot: r.loot ?? d.loot,
    class_pool: r.class_pool ?? d.class_pool,
    state: r.state ?? d.state,
    shop: r.shop ?? d.shop,
    event: r.event ?? d.event,
  };
}

// ---- 容错归一化 ----
function normalizeStats(stats?: Partial<Record<StatKey, [number, number]>>): Record<StatKey, [number, number]> {
  const out = {} as Record<StatKey, [number, number]>;
  for (const k of STAT_KEYS) out[k] = toRange(stats?.[k]);
  return out;
}
function normalizeBaseStats(b?: Partial<Record<StatKey, number>>): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) out[k] = Number(b?.[k]) || 0;
  return out;
}

function normalizeComponent(c: AnyComponent): AnyComponent {
  const id = (c as any).id || genIdFor(c.kind);
  const name = (c as any).name || '组件';
  const icon = (c as any).icon || '❓';
  switch (c.kind) {
    case 'monster':
      return { ...c, id, name, icon, stats: normalizeStats((c as any).stats) };
    case 'class':
      return { ...c, id, name, icon, base_stats: normalizeBaseStats((c as any).base_stats), buffs: (c as any).buffs || {} };
    case 'item':
      return { ...c, id, name, icon, itemKind: (c as any).itemKind === 'equipment' ? 'equipment' : 'consumable' };
    case 'building':
      return { ...c, id, name, icon, encounter: (c as any).encounter || 'empty' };
    default:
      return { ...c, id, name, icon };
  }
}

// ---- 文件读写（纯浏览器，无服务器） ----

export function downloadPmod(library: Library, project: Project): void {
  const text = exportPmod(library, project);
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (project.name || 'poprpg').replace(/[^\w一-龥-]+/g, '_');
  a.href = url;
  a.download = `${safe}.pmod`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readPmodFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(importPmod(String(reader.result)));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
