/**
 * 界面态 store（不入 localStorage，每次会话全新）：
 * 操作模式 / 选中 / 相机 / 弹层。真正的**数据**都在 library、project 两个 store 里。
 *
 * 所有画图相关状态这里是唯一入口：§5.4 G3「入口唯一」。
 */

import { create } from 'zustand'

export type CanvasMode = 'select' | 'place' | 'link' | 'boxselect' | 'erase' | 'mark'

/**
 * 右栏只有两页：**组件**（库里的定义）与**实例**（地图上那一格）。
 * 「规则」是整局共用的，不进右栏 —— 入口在顶栏，点开是一整页（§5.6）。
 */
export type InspectorTab = 'component' | 'instance'

export interface Toast {
  text: string
  tone: 'info' | 'warn' | 'error'
}

export interface UiStore {
  currentMapId?: string
  /** §5.4 六个模式，入口只在画布左上的模式条 */
  mode: CanvasMode
  /** 组件库里选中的那条（地图件 → 可放置 / 连线） */
  selectedKitId?: string
  /** 画布上选中的节点 key（`x,y`） */
  selectedNodeKey?: string
  /** 框选（模式 4）选中的节点 key 集合 */
  selection: string[]
  inspectorTab: InspectorTab
  kitFilter: 'all' | 'used'
  kitSearch: string
  collapsedSections: Record<string, boolean>
  /** 连线模式的第一步锚点 */
  linkAnchor?: [number, number]
  /** 标记模式当前放的是起点还是终点 */
  markTarget: 'start' | 'end'
  camera: { x: number; y: number; zoom: number }
  checklistOpen: boolean
  /** 规则面板（整局共用，顶栏入口） */
  rulesOpen: boolean
  /**
   * 「NPC 模组」面板（§5.6）—— 与「规则」并列的**第二个整页入口**，
   * 不进右栏、不占画布模式条（G7）。
   */
  npcModOpen: boolean
  /** 打开模组面板时要选中的那条 NPC（没给就选列表里第一条） */
  npcModTargetId?: string
  toast?: Toast

  setCurrentMap: (id?: string) => void
  setMode: (mode: CanvasMode, opts?: { markTarget?: 'start' | 'end' }) => void
  resetMode: () => void
  setSelectedKit: (id?: string) => void
  selectNode: (key?: string) => void
  setSelection: (keys: string[]) => void
  clearSelection: () => void
  setInspectorTab: (tab: InspectorTab) => void
  setKitFilter: (filter: 'all' | 'used') => void
  setKitSearch: (text: string) => void
  toggleSection: (id: string) => void
  setLinkAnchor: (pos?: [number, number]) => void
  setCamera: (x: number, y: number, zoom: number) => void
  panCamera: (dx: number, dy: number) => void
  setChecklistOpen: (open: boolean) => void
  setRulesOpen: (open: boolean) => void
  setNpcModOpen: (open: boolean, npcId?: string) => void
  notify: (text: string, tone?: Toast['tone']) => void
  dismissToast: () => void
}

export const MODE_LABEL: Record<CanvasMode, string> = {
  select: '选择',
  place: '放置',
  link: '连线',
  boxselect: '框选',
  erase: '擦除',
  mark: '标记',
}

export const MODE_SHORTCUT: Record<CanvasMode, string> = {
  select: 'V',
  place: 'B',
  link: 'L',
  boxselect: 'M',
  erase: 'E',
  mark: 'S / F',
}

export const useUiStore = create<UiStore>((set, get) => ({
  mode: 'select',
  selection: [],
  inspectorTab: 'component',
  kitFilter: 'all',
  kitSearch: '',
  collapsedSections: {},
  markTarget: 'start',
  camera: { x: 0, y: 0, zoom: 40 },
  checklistOpen: false,
  rulesOpen: false,
  npcModOpen: false,

  setCurrentMap: (id) => set({ currentMapId: id }),

  /** Esc 之外的模式切换：清掉上一个模式的中间态（G2） */
  setMode: (mode, opts) =>
    set((s) => ({
      mode,
      markTarget: opts?.markTarget ?? s.markTarget,
      linkAnchor: undefined,
      selection: mode === 'boxselect' ? s.selection : mode === 'select' ? s.selection : [],
      selectedNodeKey: mode === 'select' ? s.selectedNodeKey : undefined,
    })),

  /** Esc：回到「选择」并清掉所有中间态（G2） */
  resetMode: () => set({ mode: 'select', linkAnchor: undefined, selectedNodeKey: undefined, selection: [] }),

  setSelectedKit: (id) => set({ selectedKitId: id }),

  selectNode: (key) => set({ selectedNodeKey: key, inspectorTab: 'instance' }),

  setSelection: (keys) => set({ selection: keys }),

  clearSelection: () => set({ selection: [], selectedNodeKey: undefined }),

  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  setKitFilter: (filter) => set({ kitFilter: filter }),

  setKitSearch: (text) => set({ kitSearch: text }),

  toggleSection: (id) =>
    set((s) => ({ collapsedSections: { ...s.collapsedSections, [id]: !s.collapsedSections[id] } })),

  setLinkAnchor: (pos) => set({ linkAnchor: pos }),

  setCamera: (x, y, zoom) => set({ camera: { x, y, zoom } }),

  panCamera: (dx, dy) => {
    const c = get().camera
    set({ camera: { ...c, x: c.x + dx, y: c.y + dy } })
  },

  setChecklistOpen: (open) => set({ checklistOpen: open }),

  setRulesOpen: (open) => set({ rulesOpen: open }),

  setNpcModOpen: (open, npcId) => set({ npcModOpen: open, npcModTargetId: open ? npcId : undefined }),

  notify: (text, tone = 'info') => set({ toast: { text, tone } }),

  dismissToast: () => set({ toast: undefined }),
}))
