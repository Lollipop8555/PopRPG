import { useRef, useState } from 'react';
import { useStore } from '../store';
import { AnyComponent } from '../types';
import { downloadPmod, readPmodFile } from '../pmod';
import { runChecklist } from '../validate';
import TagBackref from './TagBackref';

export default function Toolbar() {
  const project = useStore((s) => s.project);
  const library = useStore((s) => s.library);
  const ui = useStore((s) => s.ui);
  const setProjectName = useStore((s) => s.setProjectName);
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
  const loadLibrary = useStore((s) => s.loadLibrary);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const issues = showChecklist ? runChecklist(library, project) : [];
  const errors = issues.filter((i) => i.level === 'error').length;
  const warns = issues.filter((i) => i.level === 'warn').length;

  return (
    <div className="toolbar hand-border" style={{ margin: '8px 8px 0', position: 'relative' }}>
      <input
        className="title"
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
        title="游戏名（导出 .pmod 的一级标题）"
      />

      <button
        className={`hp-btn ${showChecklist ? 'active' : ''}`}
        onClick={() => setShowChecklist((v) => !v)}
        title="一键跑全部校验（K1~Kn）"
      >
        清单
        {(errors > 0 || warns > 0) && (
          <span style={{ marginLeft: 4, color: errors ? 'var(--accent)' : 'var(--accent-2)' }}>
            {errors ? `${errors}错` : ''}
            {warns ? `${warns}警` : ''}
          </span>
        )}
      </button>

      <button
        className={`hp-btn ${showTags ? 'active' : ''}`}
        onClick={() => setShowTags((v) => !v)}
        title="标签双向反查（谁用、谁提供）"
      >
        标签
      </button>

      <button
        className="hp-btn"
        onClick={() => undo()}
        disabled={!canUndo}
        title="撤销（Ctrl/Cmd+Z）"
        style={{ opacity: canUndo ? 1 : 0.4, padding: '4px 8px' }}
      >
        ↶
      </button>
      <button
        className="hp-btn"
        onClick={() => redo()}
        disabled={!canRedo}
        title="重做（Ctrl/Cmd+Shift+Z）"
        style={{ opacity: canRedo ? 1 : 0.4, padding: '4px 8px' }}
      >
        ↷
      </button>

      <span style={{ flex: 1 }} />

      {project.maps.map((m) => (
        <span
          key={m.id}
          className="kit-item"
          style={{
            border:
              m.id === ui.selectedMapId ? '2px solid var(--accent)' : '1.5px dashed var(--line)',
          }}
        >
          <button className="hp-btn" style={{ padding: '2px 6px' }} onClick={() => selectMap(m.id)}>
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

      <button
        className="hp-btn"
        onClick={() => downloadPmod(library, project)}
        title="导出 .pmod（自包含）"
      >
        导出
      </button>
      <button className="hp-btn" onClick={() => fileRef.current?.click()}>
        导入
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
            const res = await readPmodFile(f);
            const imported: Record<string, AnyComponent> = Object.fromEntries(res.components.map((c) => [c.id, c]));
            const merged = { ...useStore.getState().library, ...imported };
            loadLibrary(merged);
            loadProject(res.project);
            if (res.conflicts.length)
              alert(`已导入；其中 ${res.conflicts.length} 个同名不同内容组件已改名并入。`);
          } catch (err) {
            alert('导入失败：' + (err as Error).message);
          }
          e.target.value = '';
        }}
      />

      {showChecklist && (
        <div className="checklist-panel hand-border">
          <div className="checklist-head">
            <b>清单 · 健康度</b>
            <button className="hp-btn" style={{ padding: '0 8px' }} onClick={() => setShowChecklist(false)}>
              ×
            </button>
          </div>
          {issues.length === 0 && <div className="checklist-ok">✓ 全部通过，没有发现问题。</div>}
          {issues.map((i, idx) => (
            <div key={idx} className={`checklist-row ${i.level}`}>
              <span className="ck-code">{i.code}</span>
              <span>{i.msg}</span>
            </div>
          ))}
          {errors > 0 && (
            <div className="checklist-note">⚠ 存在阻断级错误，导出仍可进行但游玩可能异常。</div>
          )}
        </div>
      )}

      {showTags && <TagBackref onClose={() => setShowTags(false)} />}
    </div>
  );
}
