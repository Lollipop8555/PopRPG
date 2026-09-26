import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AnyComponent,
  EntityKind,
  GameMap,
  Library,
  MapNode,
  Project,
  Rules,
} from './types';
import {
  createDefaultLibrary,
  createDefaultProject,
  resetToPreset,
} from './presets';
import { genIdFor, deepClone } from './utils';

export type Tool = 'select' | 'place' | 'line' | 'box' | 'erase' | 'mark';

interface UIState {
  selectedEntityId: string | null; // 放置模式选中的组件（来自库）
  selectedMapId: string;
  selectedNode: string | null; // "x,y"
  tool: Tool;
  markTarget: 'start' | 'end'; // 标记模式放起点还是终点
  rightTab: 'template' | 'instance' | 'rules'; // 右侧面板：模板(定义) / 实例(画布上的节点) / 规则
}

interface HistorySnap {
  library: Library;
  project: Project;
}

export interface StoreState {
  library: Library;
  project: Project;
  ui: UIState;
  past: HistorySnap[];
  future: HistorySnap[];

  ensureLibrary: () => void;
  // 库操作（预设+自建同权）
  addComponent: (kind: EntityKind) => string; // 返回新 id
  updateComponent: (id: string, patch: Partial<AnyComponent>) => void;
  removeComponent: (id: string) => void;
  duplicateComponent: (id: string) => string | null;
  resetComponent: (id: string) => void; // 仅预设：恢复默认
  toggleEnabled: (id: string) => void;
  usageCount: (id: string) => number; // 铺设 + 被引用计数

  // 项目级
  setProjectName: (n: string) => void;
  setBackground: (t: string) => void;
  setRules: (patch: Partial<Rules>) => void;

  // UI
  selectEntity: (id: string | null) => void;
  setTool: (t: Tool) => void;
  setMarkTarget: (t: 'start' | 'end') => void;
  selectNode: (key: string | null) => void;
  deselectAll: () => void;
  setRightTab: (t: 'template' | 'instance' | 'rules') => void;

  // 地图 / 节点
  selectMap: (id: string) => void;
  addMap: () => void;
  removeMap: (id: string) => void;
  renameMap: (id: string, name: string) => void;
  placeNode: (x: number, y: number) => void;
  eraseNode: (x: number, y: number) => void;
  eraseNodes: (cells: [number, number][]) => void; // 框选批量删除（一步撤销）
  updateNode: (x: number, y: number, patch: Partial<MapNode>) => void;
  moveNode: (from: [number, number], to: [number, number]) => [number, number];
  drawRoad: (cells: [number, number][]) => void;
  duplicateNode: (x: number, y: number) => void;

  // 导入 / 历史
  loadProject: (p: Project) => void;
  loadLibrary: (lib: Library) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 100;
function withHistory(s: StoreState, library: Library, project: Project) {
  return {
    past: [...s.past, { library: s.library, project: s.project }].slice(-HISTORY_LIMIT),
    future: [] as HistorySnap[],
    library,
    project,
  };
}

function resolveMapId(s: StoreState): string {
  if (s.project.maps.some((m) => m.id === s.ui.selectedMapId)) return s.ui.selectedMapId;
  return s.project.maps[0]?.id ?? '';
}

export function findComponent(lib: Library, id: string): AnyComponent | undefined {
  return lib[id];
}

// 节点占用范围（建筑可占多格）
function nodeRect(n: MapNode) {
  const w = n.w ?? 1;
  const h = n.h ?? 1;
  return { x0: n.x, y0: n.y, x1: n.x + w - 1, y1: n.y + h - 1 };
}
function covers(n: MapNode, x: number, y: number): boolean {
  const r = nodeRect(n);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}
function rectsOverlap(a: MapNode, b: MapNode): boolean {
  const A = nodeRect(a);
  const B = nodeRect(b);
  return A.x0 <= B.x1 && A.x1 >= B.x0 && A.y0 <= B.y1 && A.y1 >= B.y0;
}

// 统计某组件被"铺设 + 被引用"的次数（删除确认用）
function countUsage(lib: Library, project: Project, id: string): number {
  let n = 0;
  // 1) 地图节点引用（road/building 的 ref）
  for (const m of project.maps) {
    for (const node of m.nodes) {
      if ((node.type === 'road' || node.type === 'building') && node.ref === id) n += 1;
    }
  }
  // 2) 组件间引用
  for (const c of Object.values(lib)) {
    if (c.id === id) continue;
    if (c.kind === 'monster') {
      if (c.attack_weights && id in c.attack_weights) n += 1;
      if (c.reward_pool && poolRefsId(c.reward_pool, id)) n += 1;
    } else if (c.kind === 'building') {
      if (c.reward_pool && poolRefsId(c.reward_pool, id)) n += 1;
      if (c.monster_pool && poolRefsId(c.monster_pool, id)) n += 1;
      if (c.stock && poolRefsId(c.stock, id)) n += 1;
      if (c.mimic) {
        if (c.mimic.monster === id) n += 1;
        if (c.mimic.reward_pool && poolRefsId(c.mimic.reward_pool, id)) n += 1;
      }
      if (c.event) {
        const o = [c.event.on_success, c.event.on_fail];
        for (const out of o) {
          if (out.grant && out.grant.some((g) => grantId(g) === id)) n += 1;
        }
      }
    } else if (c.kind === 'item') {
      if (c.effects?.some((e) => (e.op === 'learn_skill' || e.op === 'forget_skill') && e.skill === id)) n += 1;
    } else if (c.kind === 'class') {
      if (c.starting_items?.includes(id)) n += 1;
    }
  }
  // 3) 规则 class_pool
  if (project.rules.class_pool.includes(id)) n += 1;
  return n;
}
function poolRefsId(
  pool: { source: 'ids' | 'filter'; ids?: (string | { id: string; weight: number })[] },
  id: string
): boolean {
  return !!pool.ids?.some((e) => (typeof e === 'string' ? e === id : e.id === id));
}
function grantId(g: string | { id: string; count?: number }): string {
  return typeof g === 'string' ? g : g.id;
}

const DEFAULT_PROJECT = createDefaultProject();
const DEFAULT_LIBRARY = createDefaultLibrary();

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      library: DEFAULT_LIBRARY,
      project: DEFAULT_PROJECT,
      past: [],
      future: [],
      ui: {
        selectedEntityId: 'chest_room',
        selectedMapId: DEFAULT_PROJECT.maps[0]?.id ?? '',
        selectedNode: null,
        tool: 'select',
        markTarget: 'start',
        rightTab: 'template',
      },

      ensureLibrary: () =>
        set((s) => {
          const ids = Object.keys(s.library);
          if (ids.length > 0) return s;
          return { library: createDefaultLibrary() };
        }),

      addComponent: (kind) => {
        const id = genIdFor(kind);
        const base: AnyComponent = makeBlank(kind, id);
        set((s) => withHistory(s, { ...s.library, [id]: base }, s.project));
        return id;
      },

      updateComponent: (id, patch) =>
        set((s) => {
          const cur = s.library[id];
          if (!cur) return s;
          const next = { ...cur, ...patch, id, kind: cur.kind } as AnyComponent;
          return withHistory(s, { ...s.library, [id]: next }, s.project);
        }),

      removeComponent: (id) =>
        set((s) => {
          const lib = { ...s.library };
          delete lib[id];
          // 同步：项目启用集合移除；地图节点引用该组件的去除
          const enabledIds = s.project.enabledIds.filter((e) => e !== id);
          const maps = s.project.maps.map((m) => ({
            ...m,
            nodes: m.nodes.filter(
              (n) => !((n.type === 'road' || n.type === 'building') && n.ref === id)
            ),
          }));
          const project = { ...s.project, enabledIds, maps };
          return {
            ...withHistory(s, lib, project),
            ui: {
              ...s.ui,
              selectedEntityId: s.ui.selectedEntityId === id ? null : s.ui.selectedEntityId,
            },
          };
        }),

      duplicateComponent: (id) => {
        const src = get().library[id];
        if (!src) return null;
        const copy = deepClone(src);
        const newId = genIdFor(src.kind);
        copy.id = newId;
        copy.name = `${src.name} 副本`;
        set((s) => withHistory(s, { ...s.library, [newId]: copy }, s.project));
        return newId;
      },

      resetComponent: (id) => {
        const def = resetToPreset(id);
        if (!def) return;
        set((s) => withHistory(s, { ...s.library, [id]: def }, s.project));
      },

      toggleEnabled: (id) =>
        set((s) => {
          const has = s.project.enabledIds.includes(id);
          const enabledIds = has
            ? s.project.enabledIds.filter((e) => e !== id)
            : [...s.project.enabledIds, id];
          return withHistory(s, s.library, { ...s.project, enabledIds });
        }),

      usageCount: (id) => countUsage(get().library, get().project, id),

      setProjectName: (n) => set((s) => ({ project: { ...s.project, name: n } })),
      setBackground: (t) => set((s) => ({ project: { ...s.project, background: t } })),
      setRules: (patch) =>
        set((s) => withHistory(s, s.library, { ...s.project, rules: { ...s.project.rules, ...patch } })),

      selectEntity: (id) => set((s) => ({ ui: { ...s.ui, selectedEntityId: id } })),
      setTool: (t) => set((s) => ({ ui: { ...s.ui, tool: t } })),
      setMarkTarget: (t) => set((s) => ({ ui: { ...s.ui, markTarget: t } })),
      selectNode: (key) => set((s) => ({ ui: { ...s.ui, selectedNode: key } })),

      deselectAll: () =>
        set((s) => ({
          ui: { ...s.ui, selectedEntityId: null, selectedNode: null, tool: 'select' },
        })),

      setRightTab: (t) => set((s) => ({ ui: { ...s.ui, rightTab: t } })),

      selectMap: (id) =>
        set((s) => ({ ui: { ...s.ui, selectedMapId: id, selectedNode: null } })),

      addMap: () =>
        set((s) => {
          const m: GameMap = {
            id: genIdFor('road').replace('r_', 'map_'),
            name: `地图 ${s.project.maps.length + 1}`,
            nodes: [],
          };
          return {
            ...withHistory(s, s.library, { ...s.project, maps: [...s.project.maps, m] }),
            ui: { ...s.ui, selectedMapId: m.id, selectedNode: null },
          };
        }),

      removeMap: (id) =>
        set((s) => {
          if (s.project.maps.length <= 1) return s;
          const maps = s.project.maps.filter((m) => m.id !== id);
          const selectedMapId = s.ui.selectedMapId === id ? maps[0].id : s.ui.selectedMapId;
          return {
            ...withHistory(s, s.library, { ...s.project, maps }),
            ui: { ...s.ui, selectedMapId, selectedNode: null },
          };
        }),

      renameMap: (id, name) =>
        set((s) =>
          withHistory(
            s,
            s.library,
            {
              ...s.project,
              maps: s.project.maps.map((m) => (m.id === id ? { ...m, name } : m)),
            }
          )
        ),

      placeNode: (x, y) =>
        set((s) => {
          const { project, ui } = s;
          const mid = resolveMapId(s);
          const maps = project.maps.map((m) => {
            if (m.id !== mid) return m;
            if (ui.tool === 'mark') {
              const type = ui.markTarget;
              const nodes = m.nodes.filter((n) => n.type !== type);
              const node: MapNode = { x, y, type } as MapNode;
              const patch: Partial<GameMap> = { nodes: [...nodes, node] };
              if (type === 'start') patch.start = [x, y];
              if (type === 'end') patch.end = [x, y];
              return { ...m, ...patch };
            }
            if (ui.tool !== 'place') return m;
            const sel = ui.selectedEntityId;
            if (!sel) return m;
            const ent = s.library[sel];
            if (!ent) return m;
            let node: MapNode | null = null;
            if (ent.kind === 'road') node = { x, y, type: 'road', ref: ent.id };
            else if (ent.kind === 'building')
              node = { x, y, type: 'building', ref: ent.id };
            if (!node) return m;
            const nodes = m.nodes.filter((n) => !rectsOverlap(n, node!));
            return { ...m, nodes: [...nodes, node] };
          });
          return withHistory(s, s.library, { ...s.project, maps });
        }),

      eraseNode: (x, y) =>
        set((s) => {
          const mid = resolveMapId(s);
          const target = s.project.maps.find((m) => m.id === mid);
          if (!target || !target.nodes.some((n) => covers(n, x, y))) return s;
          const maps = s.project.maps.map((m) => {
            if (m.id !== mid) return m;
            const removed = new Set(m.nodes.filter((n) => covers(n, x, y)));
            if (!removed.size) return m;
            const nodes = m.nodes.filter((n) => !removed.has(n));
            let start = m.start;
            let end = m.end;
            if (start && !nodes.some((n) => n.type === 'start')) start = undefined;
            if (end && !nodes.some((n) => n.type === 'end')) end = undefined;
            return { ...m, nodes, start, end };
          });
          return withHistory(s, s.library, { ...s.project, maps });
        }),

      eraseNodes: (cells) =>
        set((s) => {
          const mid = resolveMapId(s);
          const set = new Set(cells.map(([x, y]) => `${x},${y}`));
          const maps = s.project.maps.map((m) => {
            if (m.id !== mid) return m;
            const removed = m.nodes.filter((n) => {
              // 覆盖该节点占地任一格即删除
              for (let dx = 0; dx < (n.w ?? 1); dx++)
                for (let dy = 0; dy < (n.h ?? 1); dy++)
                  if (set.has(`${n.x + dx},${n.y + dy}`)) return true;
              return false;
            });
            if (!removed.length) return m;
            const kept = m.nodes.filter((n) => !removed.includes(n));
            let start = m.start;
            let end = m.end;
            if (start && !kept.some((n) => n.type === 'start')) start = undefined;
            if (end && !kept.some((n) => n.type === 'end')) end = undefined;
            return { ...m, nodes: kept, start, end };
          });
          return withHistory(s, s.library, { ...s.project, maps });
        }),

      updateNode: (x, y, patch) =>
        set((s) =>
          withHistory(
            s,
            s.library,
            {
              ...s.project,
              maps: s.project.maps.map((m) => {
                if (m.id !== resolveMapId(s)) return m;
                return {
                  ...m,
                  nodes: m.nodes.map((n) => (n.x === x && n.y === y ? { ...n, ...patch } : n)),
                };
              }),
            }
          )
        ),

      moveNode: (from, to) => {
        const s = get();
        const mid = resolveMapId(s);
        const m = s.project.maps.find((mm) => mm.id === mid);
        if (!m) return from;
        if (from[0] === to[0] && from[1] === to[1]) return from;
        const node = m.nodes.find((n) => n.x === from[0] && n.y === from[1]);
        if (!node) return from;
        const w = node.w ?? 1;
        const h = node.h ?? 1;
        const blocked = m.nodes.some((n) => {
          if (n === node) return false;
          const nx1 = n.x + (n.w ?? 1) - 1;
          const ny1 = n.y + (n.h ?? 1) - 1;
          return to[0] <= nx1 && to[0] + w - 1 >= n.x && to[1] <= ny1 && to[1] + h - 1 >= n.y;
        });
        if (blocked) return from;
        const nodes = m.nodes.map((n) => (n === node ? { ...n, x: to[0], y: to[1] } : n));
        const patch: Partial<GameMap> = { nodes };
        if (m.start && m.start[0] === from[0] && m.start[1] === from[1])
          patch.start = [to[0], to[1]];
        if (m.end && m.end[0] === from[0] && m.end[1] === from[1]) patch.end = [to[0], to[1]];
        const maps = s.project.maps.map((mm) => (mm.id === mid ? { ...mm, ...patch } : mm));
        set(withHistory(s, s.library, { ...s.project, maps }));
        return to;
      },

      drawRoad: (cells) =>
        set((s) => {
          const sel = s.ui.selectedEntityId;
          const roadRef = sel && s.library[sel]?.kind === 'road' ? sel : undefined;
          const maps = s.project.maps.map((m) => {
            if (m.id !== resolveMapId(s)) return m;
            const want = new Set(cells.map(([cx, cy]) => `${cx},${cy}`));
            const kept = m.nodes.filter(
              (n) => !(n.type === 'road' && want.has(`${n.x},${n.y}`))
            );
            const existing = new Set(
              kept.filter((n) => n.type === 'road').map((n) => `${n.x},${n.y}`)
            );
            const blockers = kept.filter((n) => n.type !== 'road');
            const added: MapNode[] = cells
              .filter(
                ([cx, cy]) =>
                  !existing.has(`${cx},${cy}`) &&
                  !blockers.some((n) => covers(n, cx, cy))
              )
              .map(
                ([cx, cy]) =>
                  ({ x: cx, y: cy, type: 'road', ref: roadRef } as MapNode)
              );
            return { ...m, nodes: [...kept, ...added] };
          });
          return withHistory(s, s.library, { ...s.project, maps });
        }),

      duplicateNode: (x, y) =>
        set((s) => {
          const mid = resolveMapId(s);
          const m = s.project.maps.find((mm) => mm.id === mid);
          if (!m) return s;
          const node = m.nodes.find((n) => n.x === x && n.y === y);
          if (!node || node.type === 'start' || node.type === 'end') return s;
          const w = node.w ?? 1;
          const h = node.h ?? 1;
          const overlaps = (cx: number, cy: number) =>
            m.nodes.some((n) => {
              const nx1 = n.x + (n.w ?? 1) - 1;
              const ny1 = n.y + (n.h ?? 1) - 1;
              return cx <= nx1 && cx + w - 1 >= n.x && cy <= ny1 && cy + h - 1 >= n.y;
            });
          let nx = x + w;
          let ny = y;
          let guard = 0;
          while (overlaps(nx, ny) && guard++ < 500) nx += 1;
          if (overlaps(nx, ny)) return s;
          const copy: MapNode = { ...node, x: nx, y: ny };
          const maps = s.project.maps.map((mm) =>
            mm.id === mid ? { ...mm, nodes: [...mm.nodes, copy] } : mm
          );
          return {
            ...withHistory(s, s.library, { ...s.project, maps }),
            ui: { ...s.ui, selectedNode: `${nx},${ny}` },
          };
        }),

      loadProject: (p) =>
        set(() => ({
          project: p,
          past: [],
          future: [],
          ui: {
            selectedEntityId: null,
            selectedMapId: p.maps[0]?.id ?? '',
            selectedNode: null,
            tool: 'select',
            markTarget: 'start',
            rightTab: 'template',
          },
        })),

      loadLibrary: (lib) =>
        set((s) => ({ library: lib, past: [], future: [] })),

      undo: () =>
        set((s) => {
          if (!s.past.length) return s;
          const prev = s.past[s.past.length - 1];
          return {
            library: prev.library,
            project: prev.project,
            past: s.past.slice(0, -1),
            future: [{ library: s.library, project: s.project }, ...s.future].slice(0, HISTORY_LIMIT),
            ui: { ...s.ui, selectedNode: null },
          };
        }),

      redo: () =>
        set((s) => {
          if (!s.future.length) return s;
          const next = s.future[0];
          return {
            library: next.library,
            project: next.project,
            past: [...s.past, { library: s.library, project: s.project }].slice(-HISTORY_LIMIT),
            future: s.future.slice(1),
            ui: { ...s.ui, selectedNode: null },
          };
        }),
    }),
    {
      name: 'poprpg',
      partialize: (s) => ({
        library: s.library,
        project: s.project,
        selectedMapId: s.ui.selectedMapId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<{
          library: Library;
          project: Project;
          selectedMapId: string;
        }>;
        return {
          ...current,
          library: p.library ?? current.library,
          project: p.project ?? current.project,
          ui: {
            ...current.ui,
            selectedMapId: p.selectedMapId ?? current.ui.selectedMapId,
          },
        };
      },
    }
  )
);

// 新建空白组件（按类别给最小可用默认）
function makeBlank(kind: EntityKind, id: string): AnyComponent {
  const base = { id, name: '新组件', icon: '❓' };
  switch (kind) {
    case 'road':
      return { ...base, kind: 'road' };
    case 'building':
      return { ...base, kind: 'building', encounter: 'empty' };
    case 'item':
      return { ...base, kind: 'item', itemKind: 'equipment', slots: ['weapon'], modifiers: {} };
    case 'monster':
      return {
        ...base,
        kind: 'monster',
        stats: { hp: [1, 1], mp: [0, 0], patk: [1, 1], matk: [0, 0], pdef: [0, 0], mdef: [0, 0] },
      };
    case 'class':
      return {
        ...base,
        kind: 'class',
        base_stats: { hp: 1, mp: 0, patk: 1, matk: 0, pdef: 0, mdef: 0 },
        free_points: 0,
        buffs: {},
      };
    case 'skill':
      return {
        ...base,
        kind: 'skill',
        dim: 'patk',
        target: 'opponent',
        vs: 'auto',
        bonus: 0,
        apply: 'hp',
        cost: {},
      };
  }
}
