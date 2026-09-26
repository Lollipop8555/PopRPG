import yaml from 'js-yaml';
import {
  Project,
  Monster,
  Item,
  Building,
  Road,
  ClassDef,
  GameMap,
  MapNode,
  Entity,
  DiceConfig,
} from './types';
import { genId, toRange } from './utils';

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

export function exportPmod(p: Project): string {
  const out: string[] = [];
  out.push(`# ${p.name}`, '');
  out.push('## 背景');
  out.push((p.background || '').trim() || '（暂无背景）', '');

  out.push('## 设定', '');
  out.push('### 怪物');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.monsters), DUMP_OPTS));
  out.push('```', '');

  out.push('### 道具');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.items), DUMP_OPTS));
  out.push('```', '');

  out.push('### 建筑');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.buildings), DUMP_OPTS));
  out.push('```', '');

  out.push('### 道路');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.roads), DUMP_OPTS));
  out.push('```', '');

  out.push('### 职业');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.classes), DUMP_OPTS));
  out.push('```', '');

  out.push('## 骰子配置');
  out.push('```yaml');
  out.push(yaml.dump(clean(p.diceConfig), DUMP_OPTS));
  out.push('```', '');

  out.push('## 地图');
  for (const m of p.maps) {
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

export function importPmod(text: string): Project {
  const nameMatch = text.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '未命名';

  const blocks = parseBlocks(text);
  const bg = blockBy(blocks, '背景')?.prose.trim() ?? '';

  const monsters = loadYaml<Monster[]>(
    blockBy(blocks, '设定', '怪物')?.yamlText,
    []
  );
  const items = loadYaml<Item[]>(blockBy(blocks, '设定', '道具')?.yamlText, []);
  const buildings = loadYaml<Building[]>(
    blockBy(blocks, '设定', '建筑')?.yamlText,
    []
  );
  const roads = loadYaml<Road[]>(blockBy(blocks, '设定', '道路')?.yamlText, []);
  const classes = loadYaml<ClassDef[]>(
    blockBy(blocks, '设定', '职业')?.yamlText,
    []
  );
  const diceRaw = loadYaml<Partial<DiceConfig>>(
    blockBy(blocks, '骰子配置')?.yamlText,
    {}
  );
  const diceConfig: DiceConfig = {
    dice: diceRaw.dice ?? ['1D6'],
    class_pool: diceRaw.class_pool ?? [],
  };

  const mapBlocks = blocks.filter((b) => b.h2 === '地图' && b.h3);
  const maps: GameMap[] = mapBlocks.map((b) => {
    const data = loadYaml<{
      start?: [number, number] | null;
      end?: [number, number] | null;
      nodes?: MapNode[];
    }>(b.yamlText, {});
    return {
      id: genId('map'),
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

  return {
    name,
    background: bg,
    monsters: monsters.map(normalizeMonster),
    items: items.map(normalizeItem),
    buildings: buildings.map(normalizeBuilding),
    roads,
    classes: classes.map(normalizeClass),
    diceConfig,
    maps: maps.length ? maps : [{ id: genId('map'), name: '地图 1', nodes: [] }],
  };
}

// ---- 容错归一化 ----

function normalizeMonster(m: Monster): Monster {
  return {
    id: m.id || genId('m'),
    name: m.name || '怪物',
    icon: m.icon || '👾',
    kind: 'monster',
    dice: m.dice || '1D6',
    desc: m.desc,
    stats: {
      hp: toRange(m.stats?.hp),
      patk: toRange(m.stats?.patk),
      matk: toRange(m.stats?.matk),
      pdef: toRange(m.stats?.pdef),
      mdef: toRange(m.stats?.mdef),
    },
  };
}

function normalizeClass(c: ClassDef): ClassDef {
  return {
    id: c.id || genId('c'),
    name: c.name || '职业',
    icon: c.icon || '🧝',
    kind: 'class',
    desc: c.desc,
    buffs: c.buffs || {},
    stats: {
      hp: toRange(c.stats?.hp),
      patk: toRange(c.stats?.patk),
      matk: toRange(c.stats?.matk),
      pdef: toRange(c.stats?.pdef),
      mdef: toRange(c.stats?.mdef),
    },
  };
}

function normalizeItem(it: Item): Item {
  return {
    id: it.id || genId('i'),
    name: it.name || '道具',
    icon: it.icon || '🎁',
    kind: 'item',
    itemKind: it.itemKind === 'equipment' ? 'equipment' : 'consumable',
    desc: it.desc,
    slots: it.slots,
    modifiers: it.modifiers,
    usable: it.usable,
    effects: it.effects,
  };
}

function normalizeBuilding(b: Building): Building {
  return {
    id: b.id || genId('b'),
    name: b.name || '建筑',
    icon: b.icon || '🏠',
    kind: 'building',
    encounter: b.encounter || 'empty',
    dice: b.dice || '1D6',
    desc: b.desc,
    reward_pool: b.reward_pool,
    monster_ref: b.monster_ref,
    mimic: b.mimic,
  };
}

// ---- 文件读写（纯浏览器，无服务器） ----

export function downloadPmod(p: Project): void {
  const text = exportPmod(p);
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (p.name || 'poprpg').replace(/[^\w一-龥-]+/g, '_');
  a.href = url;
  a.download = `${safe}.pmod`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readPmodFile(file: File): Promise<Project> {
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
