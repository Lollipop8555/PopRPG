import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { AnyComponent, EntityKind } from '../types';
import { isPreset } from '../presets';
import { ENTITY_SECTIONS } from '../types';

type Filter = 'all' | 'used';

export default function KitPanel() {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const selectEntity = useStore((s) => s.selectEntity);
  const setTool = useStore((s) => s.setTool);
  const setRightTab = useStore((s) => s.setRightTab);
  const addComponent = useStore((s) => s.addComponent);
  const removeComponent = useStore((s) => s.removeComponent);
  const toggleEnabled = useStore((s) => s.toggleEnabled);
  const duplicateComponent = useStore((s) => s.duplicateComponent);
  const resetComponent = useStore((s) => s.resetComponent);
  const usageCount = useStore((s) => s.usageCount);

  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  // 铺设计数（地图节点引用）
  const placedCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const map of project.maps)
      for (const n of map.nodes)
        if ((n.type === 'road' || n.type === 'building') && n.ref) m[n.ref] = (m[n.ref] || 0) + 1;
    return m;
  }, [project.maps]);

  const usedIds = useMemo(() => {
    const s = new Set<string>(project.enabledIds);
    for (const map of project.maps)
      for (const n of map.nodes)
        if ((n.type === 'road' || n.type === 'building') && n.ref) s.add(n.ref);
    return s;
  }, [project.enabledIds, project.maps]);

  const list = useMemo(() => Object.values(library), [library]);
  const byKind = (kind: EntityKind) => list.filter((c) => c.kind === kind);

  const pick = (c: AnyComponent) => {
    selectEntity(c.id);
    const placeable = c.kind === 'road' || c.kind === 'building';
    if (placeable) setTool('place');
    setRightTab('template');
  };

  return (
    <div className="panel hand-border" style={{ margin: '0 0 8px 8px' }}>
      <h3>组件库</h3>

      <div className="range-row" style={{ gap: 6, marginBottom: 8 }}>
        <button className={`hp-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          全部
        </button>
        <button className={`hp-btn ${filter === 'used' ? 'active' : ''}`} onClick={() => setFilter('used')}>
          本局已用
        </button>
        <input
          className="search"
          placeholder="搜索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 60 }}
        />
      </div>

      {/* 背景设定（画布叙事，不入组件库） */}
      <div
        className={`kit-item ${ui.selectedEntityId === '__bg__' ? 'selected' : ''}`}
        onClick={() => {
          if (ui.selectedEntityId === '__bg__') selectEntity(null);
          else {
            selectEntity('__bg__');
            setRightTab('template');
          }
        }}
      >
        <span className="emoji">📜</span>
        <span>背景设定</span>
      </div>

      {ENTITY_SECTIONS.map((sec) => {
        let items = byKind(sec.kind);
        if (filter === 'used') items = items.filter((c) => usedIds.has(c.id));
        if (q.trim()) {
          const t = q.trim().toLowerCase();
          items = items.filter(
            (c) => c.name.toLowerCase().includes(t) || c.id.toLowerCase().includes(t) || (c.tags || []).some((tag) => tag.toLowerCase().includes(t))
          );
        }
        return (
          <div key={sec.kind}>
            <h4>
              {sec.label}{' '}
              <button
                className="hp-btn"
                style={{ padding: '0 6px', float: 'right' }}
                onClick={() => addComponent(sec.kind)}
                title="新建一个该类别组件"
              >
                + 新建
              </button>
            </h4>
            {items.length === 0 && <p className="muted">（空）</p>}
            {items.map((c) => {
              const placeable = c.kind === 'road' || c.kind === 'building';
              const enabled = project.enabledIds.includes(c.id);
              const placed = placedCount[c.id] || 0;
              const refs = Math.max(0, usageCount(c.id) - placed);
              const preset = isPreset(c.id);
              const sel = ui.selectedEntityId === c.id;
              return (
                <div
                  key={c.id}
                  className={`kit-item ${sel ? 'selected' : ''}`}
                  onClick={() => pick(c)}
                  title={placeable ? '点击选中并进入放置；再点一次取消' : '点击编辑；再点一次取消'}
                >
                  <span className="emoji">{c.icon}</span>
                  <span className="kit-name">{c.name}</span>
                  <span className={`badge ${preset ? 'preset' : 'user'}`}>{preset ? '预设' : '自建'}</span>
                  {!placeable && (
                    <span className={`badge ${enabled ? 'on' : 'off'}`}>{enabled ? '启用' : '未启用'}</span>
                  )}
                  {placed > 0 && <span className="badge soft">铺{placed}</span>}
                  {refs > 0 && <span className="badge soft">引{refs}</span>}
                  <span className="kit-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="hp-btn mini"
                      title={enabled ? '停用' : '启用'}
                      onClick={() => toggleEnabled(c.id)}
                    >
                      {enabled ? '停用' : '启用'}
                    </button>
                    <button
                      className="hp-btn mini"
                      title="复制成新组件"
                      onClick={() => {
                        const nid = duplicateComponent(c.id);
                        if (nid) selectEntity(nid);
                      }}
                    >
                      复制
                    </button>
                    {preset && (
                      <button className="hp-btn mini" title="恢复默认" onClick={() => resetComponent(c.id)}>
                        恢复
                      </button>
                    )}
                    <button
                      className="hp-btn mini danger"
                      title="删除"
                      onClick={() => {
                        const used = usageCount(c.id);
                        if (used > 0 && !confirm(`「${c.name}」被 ${used} 处使用，删除将一并清理引用，确定？`)) return;
                        removeComponent(c.id);
                      }}
                    >
                      删除
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <p className="muted" style={{ marginTop: 12 }}>
        选中「道路/建筑」后进入放置模式，点地图即可连续放置（铺路/铺建筑）。起点/终点请用顶部模式条的「标记」模式放置（每图各一个）。非地图件（道具/怪物/职业/技能）只在此编辑与启用，不拖到地图。
      </p>
    </div>
  );
}
