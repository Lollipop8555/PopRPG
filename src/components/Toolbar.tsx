import { useRef } from 'react';
import { useStore, Tool } from '../store';
import { downloadPmod, readPmodFile } from '../pmod';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: '选择/放置' },
  { id: 'erase', label: '擦除' },
];

export default function Toolbar() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const setProjectName = useStore((s) => s.setProjectName);
  const setTool = useStore((s) => s.setTool);
  const deselectAll = useStore((s) => s.deselectAll);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const selectMap = useStore((s) => s.selectMap);
  const addMap = useStore((s) => s.addMap);
  const removeMap = useStore((s) => s.removeMap);
  const renameMap = useStore((s) => s.renameMap);
  const loadProject = useStore((s) => s.loadProject);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar hand-border" style={{ margin: '8px 8px 0' }}>
      <input
        className="title"
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
        title="游戏名（导出 .pmod 的一级标题）"
      />
      <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>工具：</span>
      {TOOLS.map((t) => {
        // 铺路属于"放置"的子模式：此时把「选择/放置」显示为激活，点它即退出铺路
        const active = ui.tool === t.id || (t.id === 'select' && ui.tool === 'line');
        const icon = t.id === 'erase' ? (active ? '🗑️' : '🧹') : '';
        // 选择/放置 = 通用"停止/取消"；擦除 = 可切换（再点退出）
        const onClick =
          t.id === 'select'
            ? () => deselectAll()
            : () => (active ? deselectAll() : setTool('erase'));
        return (
          <button
            key={t.id}
            className={`hp-btn ${active ? 'active' : ''}`}
            onClick={onClick}
            title={
              t.id === 'erase'
                ? '进入/退出擦除模式：点或拖过地图格子清除节点'
                : '停止放置/编辑，回到纯选择'
            }
          >
            {icon ? icon + ' ' : ''}
            {t.label}
          </button>
        );
      })}
      <button
        className="hp-btn"
        onClick={() => undo()}
        disabled={!canUndo}
        title="撤销（Ctrl/Cmd+Z）"
        style={{ opacity: canUndo ? 1 : 0.4, padding: '4px 8px' }}
      >
        ↶ 撤销
      </button>
      <button
        className="hp-btn"
        onClick={() => redo()}
        disabled={!canRedo}
        title="重做（Ctrl/Cmd+Shift+Z 或 Ctrl+Y）"
        style={{ opacity: canRedo ? 1 : 0.4, padding: '4px 8px' }}
      >
        ↷ 重做
      </button>
      <span style={{ flex: 1 }} />
      {project.maps.map((m) => (
        <span
          key={m.id}
          className="kit-item"
          style={{
            border:
              m.id === ui.selectedMapId
                ? '2px solid var(--accent)'
                : '1.5px dashed var(--line)',
          }}
        >
          <button
            className="hp-btn"
            style={{ padding: '2px 6px' }}
            onClick={() => selectMap(m.id)}
          >
            {m.name}
          </button>
          {project.maps.length > 1 && (
            <button
              className="hp-btn"
              style={{ padding: '0 6px' }}
              onClick={() => removeMap(m.id)}
              title="删除地图"
            >
              ×
            </button>
          )}
          <span
            style={{ cursor: 'text', fontSize: 11, color: 'var(--ink-soft)' }}
            onDoubleClick={() => {
              const n = prompt('地图名', m.name);
              if (n) renameMap(m.id, n);
            }}
            title="双击重命名"
          >
            ✎
          </span>
        </span>
      ))}
      <button className="hp-btn" onClick={addMap}>
        + 地图
      </button>
      <button className="hp-btn" onClick={() => downloadPmod(project)}>
        导出 .pmod
      </button>
      <button className="hp-btn" onClick={() => fileRef.current?.click()}>
        导入 .pmod
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pmod,.md,.markdown,text/markdown"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const p = await readPmodFile(f);
            loadProject(p);
          } catch (err) {
            alert('导入失败：' + (err as Error).message);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
