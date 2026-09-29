/**
 * 组件页（右栏，§5.6）—— 编辑的是**库里的组件定义**，改了库，所有用到它的局一起生效（§4.7）。
 * 想保住原版就先在左栏 `⋯ → 复制成新组件`。
 */

import { ComponentKind } from '../../types'
import type { AnyComponent, NpcDef } from '../../types'
import { isMapPiece } from '../../types'
import { collectKnownTags, findComponent, skillSources, tallyUsage } from '../../lib/refs'
import { summarizeNpc } from '../../lib/dialog'
import { useLibraryStore } from '../../store/library'
import { useProjectStore } from '../../store/project'
import { commit } from '../../store/commit'
import { useUiStore } from '../../store/ui'
import { Badge, Field, TextBox, Toggle } from '../../ui/primitives'
import { randomComponentColor } from '../../lib/color'
import { isPresetId } from '../../presets'
import TagsInput from './controls/TagsInput'
import RoadEditor from './editors/RoadEditor'
import BuildingEditor from './editors/BuildingEditor'
import MonsterEditor from './editors/MonsterEditor'
import ItemEditor from './editors/ItemEditor'
import ClassEditor from './editors/ClassEditor'
import SkillEditor from './editors/SkillEditor'

export default function ComponentPage() {
  const library = useLibraryStore()
  const project = useProjectStore()
  const selectedId = useUiStore((s) => s.selectedKitId)
  const setEnabled = useProjectStore((s) => s.setEnabled)

  const found = selectedId ? findComponent(library, selectedId) : undefined

  if (!found) {
    return (
      <div className="hintbox">
        请在左侧组件库中选择一个组件，此处显示其定义；地图件可直接铺设到画布。
      </div>
    )
  }

  const { kind, def } = found
  const enabled = project.enabledIds.includes(def.id)
  // 传 `project`：NPC 的「被引用」来自建筑实例的 `npcs`（§5.3 / §4.9.3）
  const { referenced } = tallyUsage(library, project.enabledIds, project)
  const placed = project.maps.reduce(
    (sum, map) => sum + map.nodes.filter((n) => n.ref === def.id).length,
    0,
  )
  const sources = kind === 'skill' ? skillSources(library, project.enabledIds, def.id) : []
  const isNpc = kind === 'npc'
  const npcRefs = referenced.get(def.id) ?? 0

  const patch = (part: Partial<AnyComponent>) => {
    commit(() => useLibraryStore.getState().upsert(kind, { ...def, ...part } as AnyComponent))
  }

  return (
    <div>
      {/* ① 来源 + 本局状态（§5.6） */}
      <div className="row" style={{ gap: 4, marginBottom: 6 }}>
        {isPresetId(def.id) ? <Badge tone="preset">预设</Badge> : <Badge tone="custom">自建</Badge>}
        {isNpc ? (
          /* NPC 没有「启用」开关（§5.3）—— 本局算不算内容只看有没有建筑实例点到它 */
          <Badge tone={npcRefs > 0 ? 'on' : 'off'} title="NPC 的入包条件 ＝ 被某个建筑实例的 `npcs` 引用">
            {npcRefs > 0 ? `被引用 ×${npcRefs}` : '未引用（还没有建筑用到它）'}
          </Badge>
        ) : isMapPiece(kind) ? (
          <Badge tone={placed > 0 ? 'on' : 'off'}>{placed > 0 ? `已铺设 ×${placed}` : '未铺设'}</Badge>
        ) : (
          <span onClick={() => commit(() => setEnabled(def.id, !enabled))} style={{ cursor: 'pointer' }}>
            <Badge tone={enabled ? 'on' : 'off'}>{enabled ? '☑ 已启用' : '☐ 未启用（不算内容）'}</Badge>
          </span>
        )}
        {!isNpc && (referenced.get(def.id) ?? 0) > 0 && <Badge>被引用 ×{referenced.get(def.id)}</Badge>}
        {isPresetId(def.id) && (
          <button className="btn small" onClick={() => commit(() => useLibraryStore.getState().resetToPreset(def.id))} title="使用内置预设覆盖当前定义">
            恢复默认
          </button>
        )}
      </div>

      {/* ② 公共字段（七大类一致） */}
      <div className="row" style={{ gap: 6 }}>
        <div style={{ width: 60 }}>
          <Field label="图标">
            <TextBox value={def.icon} onChange={(v) => patch({ icon: v })} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="名称">
            <TextBox value={def.name} onChange={(v) => patch({ name: v })} />
          </Field>
        </div>
      </div>

      <Field label="描述">
        <TextBox value={def.desc ?? ''} rows={2} onChange={(v) => patch({ desc: v })} placeholder="组件说明" />
      </Field>

      <Field label="颜色">
        <div className="row" style={{ gap: 6 }}>
          <input
            className="color-input"
            type="color"
            value={def.color ?? '#cccccc'}
            onChange={(e) => patch({ color: e.target.value })}
          />
          <button className="btn small" onClick={() => patch({ color: randomComponentColor() })} title="随机换一个颜色">
            随机
          </button>
          {def.color && (
            <button className="btn small" onClick={() => patch({ color: undefined })} title="清除，改为按 id 取兜底色">
              清除
            </button>
          )}
        </div>
      </Field>

      <TagsInput
        value={def.tags}
        onChange={(tags) => patch({ tags: tags.length ? tags : undefined })}
        suggestions={collectKnownTags(library)}
        hint="用途：① 池的筛选条件 ② 通行能力 ③ 分组与搜索"
      />

      <div className="sketch-line" style={{ margin: '10px 0' }} />

      {/* ③ 各类自己的字段 */}
      {kind === 'road' && <RoadEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} />}
      {kind === 'building' && <BuildingEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} />}
      {kind === 'monster' && <MonsterEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} />}
      {kind === 'item' && <ItemEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} />}
      {kind === 'class' && <ClassEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} />}
      {kind === 'skill' && <SkillEditor def={def as never} onChange={(d) => patch(d as Partial<AnyComponent>)} sources={sources} />}
      {kind === 'npc' && <NpcDialogs def={def as NpcDef} referencedCount={npcRefs} />}
      {kind === 'background' && (
        <div className="hintbox">背景是全局的，始终算内容 —— 玩法字段都在上面这些公共字段里。</div>
      )}

      {kind !== 'skill' && kind !== 'background' && <div className="faint">{KIND_NOTE[kind]}</div>}
    </div>
  )
}

/**
 * NPC 的对话方案一栏（§5.6 组件页）—— **只读摘要**：方案名 / 节点数 / 最深几层 /
 * 有没有赠予道具 / 有没有掷骰节点；建设（新建 / 改名 / 删方案 / 改树）一律在**NPC 模组**整页里做。
 */
function NpcDialogs({ def, referencedCount }: { def: NpcDef; referencedCount: number }) {
  const plans = summarizeNpc(def)
  const items = useLibraryStore((s) => s.items)
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id

  return (
    <div style={{ opacity: referencedCount > 0 ? 1 : 0.72 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="panel-title hand" style={{ fontSize: 13 }}>
          对话方案
        </span>
        <button
          className="btn small primary"
          onClick={() => useUiStore.getState().setNpcModOpen(true, def.id)}
          title="跳到「NPC 模组」整页，在那里构建对话树"
        >
          编辑对话
        </button>
      </div>

      {plans.length === 0 && (
        <div className="hintbox warn">
          还没有任何对话方案 —— NPC 被踩到时<b>没有话可说</b>。点「编辑对话」建一套（至少一套）。
        </div>
      )}

      {plans.map((p) => (
        <div key={p.plan} className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
          <Badge>{p.plan}</Badge>
          <span className="faint">
            {p.nodes} 节点 / 最深 {p.depth} 层
          </span>
          {p.hasGive && <Badge tone="custom" title={`给出：${p.gives.map(nameOf).join('、')}`}>赠予道具</Badge>}
          {p.hasDice && <Badge tone="preset" title="这套方案里有掷骰层">掷骰</Badge>}
        </div>
      ))}

      <div className="hintbox" style={{ marginTop: 6 }}>
        <div>
          <b>NPC 住在建筑里</b>：去地图上挑一栋建筑，在<b>实例页</b>里选它（任何建筑都能挂，对话发生在
          「进入建筑后、建筑事件前」）。
        </div>
        <div className="faint">多套方案等权：只有一套时必定使用；多套时由建筑实例抽定一套。</div>
        {referencedCount === 0 && (
          <div style={{ color: 'var(--amber)' }}>还没有任何建筑实例用到它 —— 铺多久都不会遇到。</div>
        )}
      </div>
    </div>
  )
}

const KIND_NOTE: Record<ComponentKind, string> = {
  road: '道路是地形件：只回答「走过去要付什么」和「凭什么能过去」，不触发遭遇。',
  building: '建筑为地图件：进入时触发遭遇；抽取算法在规则面板中统一定义，此处仅配置奖励池。',
  monster: '怪物为非地图件：需启用，并由怪物房或伪装宝箱抽取后才会出现。',
  item: '道具为非地图件：启用后才会进入奖励池、背包或商店。',
  class: '职业仅提供初始属性、百分比加成、背包容量与初始物品，**不提供技能**。',
  skill: '技能由维度、目标与附加效果构成；角色已掌握的技能属于存档数据，不在此配置。',
  npc: 'NPC 是非地图件：对话树在「NPC 模组」整页里编辑；入包条件 ＝ 被某个建筑实例的 `npcs` 引用。',
  background: '背景全局生效。',
}

/** 给各编辑器用的「本局状态开关」（非地图件在组件页顶部已给，这里留给实例页复用） */
export function EnableToggle({ id }: { id: string }) {
  const enabled = useProjectStore((s) => s.enabledIds.includes(id))
  return (
    <Toggle
      checked={enabled}
      label={enabled ? '已启用（算内容）' : '未启用（不算内容）'}
      onChange={(v) => commit(() => useProjectStore.getState().setEnabled(id, v))}
    />
  )
}
