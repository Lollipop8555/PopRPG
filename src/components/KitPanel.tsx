import { useStore, Tool } from '../store';
import { EntityKind } from '../types';
import { genId, zeroStats } from '../utils';

const SECTIONS: { kind: EntityKind; label: string }[] = [
  { kind: 'monster', label: '怪物' },
  { kind: 'item', label: '道具' },
  { kind: 'building', label: '建筑' },
  { kind: 'road', label: '道路' },
  { kind: 'class', label: '职业' },
];

// 标记类特殊组件：每图仅一个起点/一个终点，作为套件里的可放置项
const MARKERS: { tool: Tool; label: string; icon: string }[] = [
  { tool: 'start', label: '起点', icon: '⛳' },
  { tool: 'end', label: '终点', icon: '🏁' },
];

function newEntity(kind: EntityKind): any {
  const id = genId(kind[0]);
  switch (kind) {
    case 'monster':
      return { id, name: '新怪物', icon: '👾', kind: 'monster', stats: zeroStats(), dice: '1D6' };
    case 'class':
      return { id, name: '新职业', icon: '🧝', kind: 'class', stats: zeroStats(), buffs: {} };
    case 'item':
      return { id, name: '新道具', icon: '🎁', kind: 'item', itemKind: 'consumable', effects: [] };
    case 'building':
      return { id, name: '新建筑', icon: '🏠', kind: 'building', encounter: 'empty', dice: '1D6' };
    case 'road':
      return { id, name: '新道路', icon: '🛤️', kind: 'road' };
  }
}

export default function KitPanel() {
  const project = useStore((s) => s.project);
  const selectedEntityId = useStore((s) => s.ui.selectedEntityId);
  const tool = useStore((s) => s.ui.tool);
  const selectEntity = useStore((s) => s.selectEntity);
  const selectNode = useStore((s) => s.selectNode);
  const setTool = useStore((s) => s.setTool);
  const setRightTab = useStore((s) => s.setRightTab);
  const addEntity = useStore((s) => s.addEntity);

  const onPick = (e: { id: string; kind: string }) => {
    selectEntity(e.id);
    // 选可放置的类型时，自动回到放置工具，便于直接往地图上放
    if (e.kind === 'road' || e.kind === 'building') setTool('select');
    setRightTab('template'); // 切到"模板"标签页编辑定义
  };

  const lists: Record<EntityKind, any[]> = {
    monster: project.monsters,
    item: project.items,
    building: project.buildings,
    road: project.roads,
    class: project.classes,
  };

  return (
    <div className="panel hand-border" style={{ margin: '0 0 8px 8px' }}>
      <h3>组件套件</h3>
      {(() => {
        const placing = [...project.roads, ...project.buildings].find(
          (e) => e.id === selectedEntityId
        );
        if (!placing) return null;
        return (
          <div
            className="place-bar"
            style={{
              border: '2px solid var(--accent)',
              background: 'rgba(168,68,42,0.12)',
              borderRadius: 8,
              padding: '6px 8px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ flex: 1, fontSize: 12 }}>
              放置中：<b>{placing.name}</b> ｜ 点地图放置
            </span>
            <button
              className="hp-btn"
              style={{ padding: '2px 8px' }}
              onClick={() => selectEntity(null)}
            >
              结束
            </button>
          </div>
        );
      })()}
      <div
        className="kit-item"
        onClick={() => {
          if (selectedEntityId === '__bg__') {
            selectEntity(null); // 再点一次取消选中
            return;
          }
          selectEntity('__bg__');
          setRightTab('template');
        }}
        style={{
          border:
            selectedEntityId === '__bg__'
              ? '2px solid var(--accent)'
              : '1.5px dashed var(--line)',
        }}
      >
        <span className="emoji">📜</span>
        <span>背景设定</span>
      </div>

      {SECTIONS.map((sec) => (
        <div key={sec.kind}>
          <h4>
            {sec.label}{' '}
            <button
              className="hp-btn"
              style={{ padding: '0 6px', float: 'right' }}
              onClick={() => addEntity(newEntity(sec.kind))}
            >
              + 新建
            </button>
          </h4>
          {lists[sec.kind].map((e) => {
            const placeable = e.kind === 'road' || e.kind === 'building';
            return (
              <div
                key={e.id}
                className={`kit-item ${selectedEntityId === e.id ? 'selected' : ''}`}
                draggable={placeable}
                onDragStart={(ev) => {
                  ev.dataTransfer.setData('text/plain', `${e.id}:${e.kind}`);
                  ev.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  if (selectedEntityId === e.id) {
                    selectEntity(null); // 再点一次取消选中
                    return;
                  }
                  onPick(e);
                }}
                title={placeable ? '点击选中编辑；再点一次取消；拖拽到地图放置' : '点击编辑；再点一次取消'}
              >
                <span className="emoji">{e.icon}</span>
                <span>{e.name}</span>
              </div>
            );
          })}
        </div>
      ))}

      <div>
        <h4>标记</h4>
        {MARKERS.map((m) => (
          <div
            key={m.tool}
            className={`kit-item ${tool === m.tool ? 'selected' : ''}`}
            onClick={() => {
              if (tool === m.tool) {
                setTool('select'); // 再点一次取消放置模式
                return;
              }
              selectNode(null);
              selectEntity(null);
              setTool(m.tool);
            }}
            title="点此进入放置模式，再点地图格子放置；每图仅一个；再点一次取消"
          >
            <span className="emoji">{m.icon}</span>
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--ink-soft)', fontSize: 12, marginTop: 12 }}>
        选中「建筑/道路」后点地图格子即可放置（点哪放哪，连续点连续放）；拖拽地图=平移。起点/终点用左侧「标记」组件放置（每图各一个）。道路要成线铺：选道路后到右侧点「铺设（画线）」，再点起点→点终点。顶部「擦除」单击清除节点，Ctrl+Z 撤销。取消选中：再点一次该组件、点"结束"按钮，或按 Esc。
      </p>
    </div>
  );
}
