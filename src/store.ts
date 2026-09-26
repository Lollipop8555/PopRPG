import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project,
  Entity,
  GameMap,
  MapNode,
  Item,
  Building,
  Monster,
  ClassDef,
  Road,
} from './types';
import { createDefaultProject } from './presets';
import { genId } from './utils';

export type Tool = 'select' | 'start' | 'end' | 'erase' | 'line';

interface UIState {
  selectedEntityId: string | null;
  selectedMapId: string;
  selectedNode: string | null; // "x,y"
  tool: Tool;
  rightTab: 'template' | 'instance'; // 右侧面板：模板(定义) / 实例(画布上的节点)
}

export interface StoreState {
  project: Project;
  ui: UIState;
  past: Project[]; // 撤销历史
  future: Project[]; // 重做历史

  setProjectName: (n: string) => void;
  setBackground: (t: string) => void;

  selectEntity: (id: string | null) => void; // 选中左侧套件条目（用于放置/编辑）
  setTool: (t: Tool) => void;
  selectNode: (key: string | null) => void;
  deselectAll: () => void; // 取消所有选中（Esc）
  setRightTab: (t: 'template' | 'instance') => void;

  selectMap: (id: string) => void;
  addMap: () => void;
  removeMap: (id: string) => void;
  renameMap: (id: string, name: string) => void;

  setStart: (x: number, y: number) => void;
  setEnd: (x: number, y: number) => void;
  placeNode: (x: number, y: number) => void;
  eraseNode: (x: number, y: number) => void;
  updateNode: (x: number, y: number, patch: Partial<MapNode>) => void;
  moveNode: (from: [number, number], to: [number, number]) => [number, number]; // 返回实际落点（被挡则返回原位）
  drawRoad: (cells: [number, number][]) => void; // 一次性铺一条路（铺路模式：点起点→点终点，整体算一步）
  duplicateNode: (x: number, y: number) => void; // 复制节点到旁边空位

  addEntity: (e: Entity) => void;
  updateEntity: (id: string, patch: any) => void;
  removeEntity: (id: string) => void;
  duplicateEntity: (id: string) => void; // 复制组件模板

  loadProject: (p: Project) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 100;
function withHistory(s: StoreState, project: Project) {
  return {
    past: [...s.past, s.project].slice(-HISTORY_LIMIT),
    future: [] as Project[],
    project,
  };
}

// 当前活动地图：selectedMapId 失效（如刷新后为空）时回退到第一张
function resolveMapId(s: StoreState): string {
  if (s.project.maps.some((m) => m.id === s.ui.selectedMapId)) return s.ui.selectedMapId;
  return s.project.maps[0]?.id ?? '';
}

export function findEntity(p: Project, id: string): Entity | undefined {
  return (
    p.monsters.find((e) => e.id === id) ||
    p.items.find((e) => e.id === id) ||
    p.buildings.find((e) => e.id === id) ||
    p.roads.find((e) => e.id === id) ||
    p.classes.find((e) => e.id === id)
  );
}

// 节点占用范围（建筑可占多格，w/h 默认 1）
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

function replaceEntity(p: Project, id: string, patch: any): Project {
  const merge = <T extends Entity>(arr: T[], kind: Entity['kind']): T[] =>
    arr.map((e) => (e.id === id ? ({ ...e, ...patch, kind } as T) : e));
  return {
    ...p,
    monsters: merge<Monster>(p.monsters, 'monster'),
    items: merge<Item>(p.items, 'item'),
    buildings: merge<Building>(p.buildings, 'building'),
    roads: merge<Road>(p.roads, 'road'),
    classes: merge<ClassDef>(p.classes, 'class'),
  };
}

function removeEntityFrom(p: Project, id: string): Project {
  const np: Project = {
    ...p,
    monsters: p.monsters.filter((e) => e.id !== id),
    items: p.items.filter((e) => e.id !== id),
    buildings: p.buildings.filter((e) => e.id !== id),
    roads: p.roads.filter((e) => e.id !== id),
    classes: p.classes.filter((e) => e.id !== id),
  };
  // 清理引用了已删除建筑的地图节点
  np.maps = np.maps.map((m) => ({
    ...m,
    nodes: m.nodes.filter((n) => !(n.type === 'building' && n.ref === id)),
  }));
  return np;
}

const DEFAULT_PROJECT = createDefaultProject();

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      project: DEFAULT_PROJECT,
      past: [],
      future: [],
      ui: {
        selectedEntityId: 'chest_room',
        selectedMapId: DEFAULT_PROJECT.maps[0]?.id ?? '',
        selectedNode: null,
        tool: 'select',
        rightTab: 'template',
      },

      setProjectName: (n) =>
        set((s) => ({ project: { ...s.project, name: n } })),

      setBackground: (t) =>
        set((s) => ({ project: { ...s.project, background: t } })),

      selectEntity: (id) =>
        set((s) => ({ ui: { ...s.ui, selectedEntityId: id } })),

      setTool: (t) => set((s) => ({ ui: { ...s.ui, tool: t } })),

      selectNode: (key) => set((s) => ({ ui: { ...s.ui, selectedNode: key } })),

      deselectAll: () =>
        set((s) => ({
          ui: {
            ...s.ui,
            selectedEntityId: null,
            selectedNode: null,
            tool: 'select', // 退出擦除/标记等所有放置模式
          },
        })),

      setRightTab: (t) => set((s) => ({ ui: { ...s.ui, rightTab: t } })),

      selectMap: (id) =>
        set((s) => ({ ui: { ...s.ui, selectedMapId: id, selectedNode: null } })),

      addMap: () =>
        set((s) => {
          const m: GameMap = {
            id: genId('map'),
            name: `地图 ${s.project.maps.length + 1}`,
            nodes: [],
          };
          return {
            ...withHistory(s, { ...s.project, maps: [...s.project.maps, m] }),
            ui: { ...s.ui, selectedMapId: m.id, selectedNode: null },
          };
        }),

      removeMap: (id) =>
        set((s) => {
          if (s.project.maps.length <= 1) return s;
          const maps = s.project.maps.filter((m) => m.id !== id);
          const selectedMapId =
            s.ui.selectedMapId === id ? maps[0].id : s.ui.selectedMapId;
          return {
            ...withHistory(s, { ...s.project, maps }),
            ui: { ...s.ui, selectedMapId, selectedNode: null },
          };
        }),

      renameMap: (id, name) =>
        set((s) =>
          withHistory(s, {
            ...s.project,
            maps: s.project.maps.map((m) => (m.id === id ? { ...m, name } : m)),
          })
        ),

      setStart: (x, y) =>
        set((s) => {
          const maps = s.project.maps.map((m) => {
            if (m.id !== resolveMapId(s)) return m;
            const nodes = m.nodes.filter((n) => n.type !== 'start');
            return {
              ...m,
              start: [x, y] as [number, number],
              nodes: [...nodes, { x, y, type: 'start' } as MapNode],
            };
          });
          return withHistory(s, { ...s.project, maps });
        }),

      setEnd: (x, y) =>
        set((s) => {
          const maps = s.project.maps.map((m) => {
            if (m.id !== resolveMapId(s)) return m;
            const nodes = m.nodes.filter((n) => n.type !== 'end');
            return {
              ...m,
              end: [x, y] as [number, number],
              nodes: [...nodes, { x, y, type: 'end' } as MapNode],
            };
          });
          return withHistory(s, { ...s.project, maps });
        }),

      placeNode: (x, y) =>
        set((s) => {
          const { project, ui } = s;
          const mid = resolveMapId(s);
          const maps = project.maps.map((m) => {
            if (m.id !== mid) return m;
            if (ui.tool === 'start') {
              const nodes = m.nodes.filter((n) => n.type !== 'start');
              return {
                ...m,
                start: [x, y] as [number, number],
                nodes: [...nodes, { x, y, type: 'start' } as MapNode],
              };
            }
            if (ui.tool === 'end') {
              const nodes = m.nodes.filter((n) => n.type !== 'end');
              return {
                ...m,
                end: [x, y] as [number, number],
                nodes: [...nodes, { x, y, type: 'end' } as MapNode],
              };
            }
            const sel = ui.selectedEntityId;
            if (!sel) return m;
            const ent = findEntity(project, sel);
            if (!ent) return m;
            let node: MapNode | null = null;
            if (ent.kind === 'road') node = { x, y, type: 'road' };
            else if (ent.kind === 'building')
              node = { x, y, type: 'building', ref: ent.id };
            if (!node) return m;
            // 移除与新建节点（含多格建筑）重叠的旧节点
            const nodes = m.nodes.filter((n) => !rectsOverlap(n, node!));
            return { ...m, nodes: [...nodes, node] };
          });
          return withHistory(s, { ...s.project, maps });
        }),

      eraseNode: (x, y) =>
        set((s) => {
          const mid = resolveMapId(s);
          const target = s.project.maps.find((m) => m.id === mid);
          if (!target || !target.nodes.some((n) => covers(n, x, y))) return s; // 空格无节点 → 不动
          const maps = s.project.maps.map((m) => {
            if (m.id !== mid) return m;
            // 清掉该格覆盖到的所有节点（含历史遗留的重叠节点，一次点干净）
            const removed = new Set(m.nodes.filter((n) => covers(n, x, y)));
            if (!removed.size) return m;
            const nodes = m.nodes.filter((n) => !removed.has(n));
            let start = m.start;
            let end = m.end;
            if (start && !nodes.some((n) => n.type === 'start')) start = undefined;
            if (end && !nodes.some((n) => n.type === 'end')) end = undefined;
            return { ...m, nodes, start, end };
          });
          return withHistory(s, { ...s.project, maps });
        }),

      updateNode: (x, y, patch) =>
        set((s) =>
          withHistory(s, {
            ...s.project,
            maps: s.project.maps.map((m) => {
              if (m.id !== resolveMapId(s)) return m;
              return {
                ...m,
                nodes: m.nodes.map((n) =>
                  n.x === x && n.y === y ? { ...n, ...patch } : n
                ),
              };
            }),
          })
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
        // 目标若与其它节点重叠（且非自身）→ 不移动，保持"一格一节点"，避免叠成深色/相互覆盖
        const blocked = m.nodes.some((n) => {
          if (n === node) return false;
          const nx1 = n.x + (n.w ?? 1) - 1;
          const ny1 = n.y + (n.h ?? 1) - 1;
          return (
            to[0] <= nx1 &&
            to[0] + w - 1 >= n.x &&
            to[1] <= ny1 &&
            to[1] + h - 1 >= n.y
          );
        });
        if (blocked) return from;
        const nodes = m.nodes.map((n) =>
          n === node ? { ...n, x: to[0], y: to[1] } : n
        );
        const patch: Partial<GameMap> = { nodes };
        if (m.start && m.start[0] === from[0] && m.start[1] === from[1])
          patch.start = [to[0], to[1]] as [number, number];
        if (m.end && m.end[0] === from[0] && m.end[1] === from[1])
          patch.end = [to[0], to[1]] as [number, number];
        const maps = s.project.maps.map((mm) =>
          mm.id === mid ? { ...mm, ...patch } : mm
        );
        set(withHistory(s, { ...s.project, maps }));
        return to;
      },

      drawRoad: (cells) =>
        set((s) => {
          const maps = s.project.maps.map((m) => {
            if (m.id !== resolveMapId(s)) return m;
            const want = new Set(cells.map(([cx, cy]) => `${cx},${cy}`));
            // 清掉这些格子上原有的道路（避免重叠冗余），再补上新道路
            const kept = m.nodes.filter(
              (n) => !(n.type === 'road' && want.has(`${n.x},${n.y}`))
            );
            const existing = new Set(
              kept.filter((n) => n.type === 'road').map((n) => `${n.x},${n.y}`)
            );
            // 已存在道路或已被建筑/标记占用的格子，跳过（不覆盖、不删除它们）
            const blockers = kept.filter((n) => n.type !== 'road');
            const added: MapNode[] = cells
              .filter(
                ([cx, cy]) =>
                  !existing.has(`${cx},${cy}`) &&
                  !blockers.some((n) => covers(n, cx, cy))
              )
              .map(([cx, cy]) => ({ x: cx, y: cy, type: 'road' } as MapNode));
            return { ...m, nodes: [...kept, ...added] };
          });
          return withHistory(s, { ...s.project, maps });
        }),

      duplicateNode: (x, y) =>
        set((s) => {
          const mid = resolveMapId(s);
          const m = s.project.maps.find((mm) => mm.id === mid);
          if (!m) return s;
          const node = m.nodes.find((n) => n.x === x && n.y === y);
          if (!node || node.type === 'start' || node.type === 'end') return s; // 起终点唯一，不复制
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
            ...withHistory(s, { ...s.project, maps }),
            ui: { ...s.ui, selectedNode: `${nx},${ny}` },
          };
        }),

      addEntity: (e) =>
        set((s) => {
          const p = s.project;
          const np: Project = { ...p };
          if (e.kind === 'monster') np.monsters = [...p.monsters, e];
          else if (e.kind === 'item') np.items = [...p.items, e];
          else if (e.kind === 'building') np.buildings = [...p.buildings, e];
          else if (e.kind === 'road') np.roads = [...p.roads, e];
          else if (e.kind === 'class') np.classes = [...p.classes, e];
          return {
            ...withHistory(s, np),
            ui: { ...s.ui, selectedEntityId: e.id },
          };
        }),

      updateEntity: (id, patch) =>
        set((s) => ({
          project: replaceEntity(s.project, id, patch),
        })),

      removeEntity: (id) =>
        set((s) => ({
          ...withHistory(s, removeEntityFrom(s.project, id)),
          ui: {
            ...s.ui,
            selectedEntityId:
              s.ui.selectedEntityId === id ? null : s.ui.selectedEntityId,
          },
        })),

      duplicateEntity: (id) =>
        set((s) => {
          const src = findEntity(s.project, id);
          if (!src) return s;
          const copy = {
            ...(JSON.parse(JSON.stringify(src)) as Entity),
            id: genId(src.kind[0]),
            name: `${src.name} 副本`,
          };
          const p = s.project;
          const np: Project = { ...p };
          if (copy.kind === 'monster') np.monsters = [...p.monsters, copy];
          else if (copy.kind === 'item') np.items = [...p.items, copy];
          else if (copy.kind === 'building') np.buildings = [...p.buildings, copy];
          else if (copy.kind === 'road') np.roads = [...p.roads, copy];
          else if (copy.kind === 'class') np.classes = [...p.classes, copy];
          return {
            ...withHistory(s, np),
            ui: { ...s.ui, selectedEntityId: copy.id },
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
            rightTab: 'template',
          },
        })),

      undo: () =>
        set((s) => {
          if (!s.past.length) return s;
          const prev = s.past[s.past.length - 1];
          return {
            project: prev,
            past: s.past.slice(0, -1),
            future: [s.project, ...s.future].slice(0, HISTORY_LIMIT),
            ui: { ...s.ui, selectedNode: null },
          };
        }),

      redo: () =>
        set((s) => {
          if (!s.future.length) return s;
          const next = s.future[0];
          return {
            project: next,
            past: [...s.past, s.project].slice(-HISTORY_LIMIT),
            future: s.future.slice(1),
            ui: { ...s.ui, selectedNode: null },
          };
        }),
    }),
    {
      name: 'poprpg_project',
      partialize: (s) => ({
        project: s.project,
        selectedMapId: s.ui.selectedMapId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<{
          project: Project;
          selectedMapId: string;
        }>;
        return {
          ...current,
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
