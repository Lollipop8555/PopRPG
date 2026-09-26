import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

const MIN_SCALE = 8;
const MAX_SCALE = 80;
const DEFAULT_SCALE = 32;
const BOUND = 10000;

const TOOLS: { id: 'select' | 'place' | 'line' | 'box' | 'erase' | 'mark'; label: string; key: string }[] = [
  { id: 'select', label: '选择', key: 'V' },
  { id: 'place', label: '放置', key: 'B' },
  { id: 'line', label: '连线', key: 'L' },
  { id: 'box', label: '框选', key: 'M' },
  { id: 'erase', label: '擦除', key: 'E' },
  { id: 'mark', label: '标记', key: 'S' },
];

// 正交折线：从 a 到 b 的路（同行/同列=直线；对角=拐一次角）
function orthoPath(a: [number, number], b: [number, number]): [number, number][] {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const cells: [number, number][] = [];
  const push = (x: number, y: number) => {
    const last = cells[cells.length - 1];
    if (!last || last[0] !== x || last[1] !== y) cells.push([x, y]);
  };
  const stepX = x0 <= x1 ? 1 : -1;
  const stepY = y0 <= y1 ? 1 : -1;
  for (let x = x0; ; x += stepX) {
    push(x, y0);
    if (x === x1) break;
  }
  for (let y = y0 + stepY; ; y += stepY) {
    push(x1, y);
    if (y === y1) break;
  }
  return cells;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se';
interface DragState {
  mode: 'move' | 'resize';
  handle?: Handle;
  key: string;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  startSX: number;
  startSY: number;
  curX: number;
  curY: number;
  curW: number;
  curH: number;
  moved: boolean;
}
function covers(n: { x: number; y: number; w?: number; h?: number }, x: number, y: number) {
  const w = n.w ?? 1;
  const h = n.h ?? 1;
  return x >= n.x && x <= n.x + w - 1 && y >= n.y && y <= n.y + h - 1;
}

export default function MapCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [tx, setTx] = useState(400);
  const [ty, setTy] = useState(300);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [ctrlPos, setCtrlPos] = useState<{ x: number; y: number } | null>(null);
  const [lineStart, setLineStart] = useState<[number, number] | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const ctrlDrag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const moved = useRef(false);

  const project = useStore((s) => s.project);
  const library = useStore((s) => s.library);
  const ui = useStore((s) => s.ui);
  const placeNode = useStore((s) => s.placeNode);
  const eraseNode = useStore((s) => s.eraseNode);
  const eraseNodes = useStore((s) => s.eraseNodes);
  const selectNode = useStore((s) => s.selectNode);
  const selectEntity = useStore((s) => s.selectEntity);
  const setTool = useStore((s) => s.setTool);
  const setMarkTarget = useStore((s) => s.setMarkTarget);
  const setRightTab = useStore((s) => s.setRightTab);
  const updateNode = useStore((s) => s.updateNode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const deselectAll = useStore((s) => s.deselectAll);
  const moveNode = useStore((s) => s.moveNode);
  const duplicateNode = useStore((s) => s.duplicateNode);
  const drawRoad = useStore((s) => s.drawRoad);

  const map = project.maps.find((m) => m.id === ui.selectedMapId) || project.maps[0];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    setTx(el.clientWidth / 2);
    setTy(el.clientHeight / 2);
    return () => ro.disconnect();
  }, []);

  // 键盘快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const st = useStore.getState();
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && (e.key === 'd' || e.key === 'D') && st.ui.selectedNode) {
        e.preventDefault();
        const [x, y] = st.ui.selectedNode.split(',').map(Number);
        duplicateNode(x, y);
        return;
      }
      if ((e.key === 'v' || e.key === 'V')) return setTool('select');
      if ((e.key === 'b' || e.key === 'B')) return setTool('place');
      if ((e.key === 'l' || e.key === 'L')) return setTool('line');
      if ((e.key === 'm' || e.key === 'M')) return setTool('box');
      if ((e.key === 'e' || e.key === 'E')) return setTool('erase');
      if ((e.key === 's' || e.key === 'S')) return setTool('mark');
      if (e.key.startsWith('Arrow') && st.ui.selectedNode) {
        e.preventDefault();
        const [x, y] = st.ui.selectedNode.split(',').map(Number);
        const d: [number, number] =
          e.key === 'ArrowUp' ? [0, -1] : e.key === 'ArrowDown' ? [0, 1] : e.key === 'ArrowLeft' ? [-1, 0] : [1, 0];
        const at = moveNode([x, y], [x + d[0], y + d[1]]);
        selectNode(`${at[0]},${at[1]}`);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.ui.selectedNode) {
          e.preventDefault();
          const [x, y] = st.ui.selectedNode.split(',').map(Number);
          eraseNode(x, y);
          selectNode(null);
        }
      } else if (e.key === 'Escape') {
        if (st.ui.selectedNode || st.ui.selectedEntityId || st.ui.tool !== 'select') {
          e.preventDefault();
          deselectAll();
          setLineStart(null);
          setBox(null);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eraseNode, selectNode, deselectAll, undo, redo, moveNode, duplicateNode, setTool]);

  useEffect(() => {
    if (ui.tool !== 'line') setLineStart(null);
    if (ui.tool !== 'box') setBox(null);
  }, [ui.tool]);

  function localPoint(e: { clientX: number; clientY: number }) {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }
  function cellFromPoint(sx: number, sy: number): [number, number] {
    return [Math.floor((sx - tx) / scale), Math.floor((sy - ty) / scale)];
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    moved.current = false;
    const { sx, sy } = localPoint(e);
    if (ui.tool === 'box') {
      const [x, y] = cellFromPoint(sx, sy);
      setBox({ x0: x, y0: y, x1: x, y1: y });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    pan.current = { x: e.clientX, y: e.clientY, tx, ty };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const { sx, sy } = localPoint(e);
    if (drag) {
      const dxC = Math.round((sx - drag.startSX) / scale);
      const dyC = Math.round((sy - drag.startSY) / scale);
      if (dxC !== 0 || dyC !== 0) drag.moved = true;
      if (drag.mode === 'move') {
        setDrag({ ...drag, curX: drag.origX + dxC, curY: drag.origY + dyC });
      } else {
        const px = Math.floor((sx - tx) / scale);
        const py = Math.floor((sy - ty) / scale);
        const fx = drag.handle === 'sw' || drag.handle === 'nw' ? drag.origX + drag.origW - 1 : drag.origX;
        const fy = drag.handle === 'ne' || drag.handle === 'nw' ? drag.origY + drag.origH - 1 : drag.origY;
        const newX = Math.min(fx, px);
        const newY = Math.min(fy, py);
        setDrag({
          ...drag,
          curX: newX,
          curY: newY,
          curW: Math.max(1, Math.max(fx, px) - newX + 1),
          curH: Math.max(1, Math.max(fy, py) - newY + 1),
        });
      }
      return;
    }
    if (box) {
      const [x, y] = cellFromPoint(sx, sy);
      setBox({ ...box, x1: x, y1: y });
      return;
    }
    if (pan.current) {
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setTx(pan.current.tx + dx);
      setTy(pan.current.ty + dy);
      return;
    }
    const [hx, hy] = cellFromPoint(sx, sy);
    setHover((h) => (h && h[0] === hx && h[1] === hy ? h : [hx, hy]));
  }

  function onPointerUp() {
    if (drag) {
      if (drag.mode === 'move' && drag.moved) {
        const at = moveNode([drag.origX, drag.origY], [drag.curX, drag.curY]);
        selectNode(`${at[0]},${at[1]}`);
      } else if (drag.mode === 'resize') {
        updateNode(drag.origX, drag.origY, { x: drag.curX, y: drag.curY, w: drag.curW, h: drag.curH });
        selectNode(`${drag.curX},${drag.curY}`);
      }
      setDrag(null);
    }
    if (box) {
      const x0 = Math.min(box.x0, box.x1);
      const x1 = Math.max(box.x0, box.x1);
      const y0 = Math.min(box.y0, box.y1);
      const y1 = Math.max(box.y0, box.y1);
      const cells: [number, number][] = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push([x, y]);
      if (cells.length) eraseNodes(cells);
      setBox(null);
    }
    pan.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { sx: cx, sy: cy } = localPoint(e);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomBy(factor, cx, cy);
  }
  function zoomBy(factor: number, cx?: number, cy?: number) {
    const px = cx ?? size.w / 2;
    const py = cy ?? size.h / 2;
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
    const k = ns / scale;
    setTx(px - (px - tx) * k);
    setTy(py - (py - ty) * k);
    setScale(ns);
  }
  function recenter() {
    setTx(size.w / 2);
    setTy(size.h / 2);
  }
  function resetView() {
    setScale(DEFAULT_SCALE);
    recenter();
  }

  function ctrlLocalPoint(e: { clientX: number; clientY: number }) {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onCtrlDown(e: React.PointerEvent) {
    e.stopPropagation();
    const lp = ctrlLocalPoint(e);
    const base = ctrlPos ?? { x: size.w - 50, y: size.h - 192 };
    ctrlDrag.current = { ox: base.x, oy: base.y, px: lp.x, py: lp.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onCtrlMove(e: React.PointerEvent) {
    if (!ctrlDrag.current) return;
    e.stopPropagation();
    const lp = ctrlLocalPoint(e);
    const nx = Math.max(0, Math.min(size.w - 44, ctrlDrag.current.ox + (lp.x - ctrlDrag.current.px)));
    const ny = Math.max(0, Math.min(size.h - 192, ctrlDrag.current.oy + (lp.y - ctrlDrag.current.py)));
    setCtrlPos({ x: nx, y: ny });
  }
  function onCtrlUp(e: React.PointerEvent) {
    e.stopPropagation();
    ctrlDrag.current = null;
  }

  function onClick(e: React.MouseEvent) {
    if (moved.current) {
      moved.current = false;
      return;
    }
    const { sx, sy } = localPoint(e);
    const [x, y] = cellFromPoint(sx, sy);

    if (ui.tool === 'mark') {
      placeNode(x, y);
      if (ui.markTarget === 'start') setMarkTarget('end');
      selectNode(`${x},${y}`);
      setRightTab('instance');
      return;
    }
    if (ui.tool === 'erase') return eraseNode(x, y);
    if (ui.tool === 'line') {
      if (!lineStart) setLineStart([x, y]);
      else {
        drawRoad(orthoPath(lineStart, [x, y]));
        setLineStart(null);
      }
      return;
    }
    // 选中已有节点
    const hit = map?.nodes.find((n) => covers(n, x, y));
    if (hit) {
      selectEntity(null);
      selectNode(`${hit.x},${hit.y}`);
      setRightTab('instance');
      return;
    }
    // 空白格 + 选中了可放置组件 → 放置
    const ent = ui.selectedEntityId ? library[ui.selectedEntityId] : undefined;
    if (ent && (ent.kind === 'road' || ent.kind === 'building')) {
      placeNode(x, y);
      selectNode(`${x},${y}`);
      setRightTab('instance');
      return;
    }
    selectNode(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const [id, kind] = data.split(':');
    if (kind !== 'road' && kind !== 'building') return;
    const { sx, sy } = localPoint(e);
    const [x, y] = cellFromPoint(sx, sy);
    selectEntity(id);
    if (ui.tool !== 'place') setTool('place');
    setRightTab('instance');
    placeNode(x, y);
  }

  const selNode = (() => {
    if (!ui.selectedNode) return undefined;
    const [ax, ay] = ui.selectedNode.split(',').map(Number);
    return map?.nodes.find((n) => n.x === ax && n.y === ay);
  })();

  const minX = Math.max(-BOUND, Math.floor(-tx / scale) - 1);
  const maxX = Math.min(BOUND, Math.ceil((size.w - tx) / scale) + 1);
  const minY = Math.max(-BOUND, Math.floor(-ty / scale) - 1);
  const maxY = Math.min(BOUND, Math.ceil((size.h - ty) / scale) + 1);
  const vLines: number[] = [];
  for (let x = minX; x <= maxX; x++) vLines.push(x);
  const hLines: number[] = [];
  for (let y = minY; y <= maxY; y++) hLines.push(y);

  function startMove(n: { x: number; y: number; w?: number; h?: number }, e: React.PointerEvent) {
    if (ui.tool !== 'select') return;
    e.stopPropagation();
    const w = n.w ?? 1;
    const h = n.h ?? 1;
    const { sx, sy } = localPoint(e);
    selectNode(`${n.x},${n.y}`);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({
      mode: 'move', key: `${n.x},${n.y}`, origX: n.x, origY: n.y, origW: w, origH: h,
      startSX: sx, startSY: sy, curX: n.x, curY: n.y, curW: w, curH: h, moved: false,
    });
  }
  function startResize(handle: Handle, e: React.PointerEvent) {
    e.stopPropagation();
    const n = selNode;
    if (!n) return;
    const w = n.w ?? 1;
    const h = n.h ?? 1;
    const { sx, sy } = localPoint(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({
      mode: 'resize', key: `${n.x},${n.y}`, handle, origX: n.x, origY: n.y, origW: w, origH: h,
      startSX: sx, startSY: sy, curX: n.x, curY: n.y, curW: w, curH: h, moved: false,
    });
  }
  function eff(n: { x: number; y: number; w?: number; h?: number }) {
    if (drag && drag.key === `${n.x},${n.y}`) return { x: drag.curX, y: drag.curY, w: drag.curW, h: drag.curH };
    return { x: n.x, y: n.y, w: n.w ?? 1, h: n.h ?? 1 };
  }

  function renderNode(n: { x: number; y: number; type: string; ref?: string; w?: number; h?: number }, key: string) {
    const e = eff(n);
    const sx = tx + e.x * scale;
    const sy = ty + e.y * scale;
    const cx = sx + (e.w * scale) / 2;
    const cy = sy + (e.h * scale) / 2;
    if (n.type === 'road') {
      return (
        <g key={key} style={{ cursor: ui.tool === 'select' ? 'move' : 'crosshair' }} onPointerDown={(ev) => startMove(n, ev)}>
          <circle cx={cx} cy={cy} r={scale * 0.4} fill="rgba(47,111,94,0.45)" stroke="var(--accent-2)" strokeWidth={2} />
        </g>
      );
    }
    if (n.type === 'building') {
      const b = n.ref ? library[n.ref] : undefined;
      const icon = b?.icon || '🏠';
      const fw = e.w * scale;
      const fh = e.h * scale;
      const inset = scale * 0.08;
      return (
        <g key={key} style={{ cursor: ui.tool === 'select' ? 'move' : 'crosshair' }} onPointerDown={(ev) => startMove(n, ev)}>
          <rect x={sx + inset} y={sy + inset} width={fw - inset * 2} height={fh - inset * 2} rx={scale * 0.22} ry={scale * 0.22} fill="rgba(255,253,246,0.92)" stroke="var(--accent)" strokeWidth={2} />
          <text x={cx} y={cy} fontSize={Math.min(scale * 0.6, fh * 0.4, fw * 0.4)} textAnchor="middle" dominantBaseline="central">{icon}</text>
        </g>
      );
    }
    if (n.type === 'start') {
      const poleX = sx + scale * 0.3;
      const topY = sy + scale * 0.16;
      const botY = sy + scale * 0.84;
      return (
        <g key={key} style={{ cursor: ui.tool === 'select' ? 'move' : 'crosshair' }} onPointerDown={(ev) => startMove(n, ev)}>
          <rect x={sx} y={sy} width={scale} height={scale} fill="rgba(168,68,42,0.12)" />
          <line x1={poleX} y1={botY} x2={poleX} y2={topY} stroke="var(--ink)" strokeWidth={Math.max(2, scale * 0.06)} strokeLinecap="round" />
          <path d={`M ${poleX} ${topY} L ${sx + scale * 0.82} ${topY + scale * 0.18} L ${poleX} ${topY + scale * 0.36} Z`} fill="var(--accent)" stroke="var(--ink)" strokeWidth={Math.max(1, scale * 0.03)} strokeLinejoin="round" />
        </g>
      );
    }
    const r = scale * 0.26;
    const o = r * 1.14;
    const strokeA = `M ${cx - o} ${cy - o * 0.9} Q ${cx - r * 0.18} ${cy + r * 0.28} ${cx + o} ${cy + o}`;
    const strokeB = `M ${cx + o} ${cy - o} Q ${cx + r * 0.22} ${cy - r * 0.12} ${cx - o} ${cy + o * 0.88}`;
    const outline = Math.max(3.5, scale * 0.17);
    const core = Math.max(1.8, scale * 0.095);
    return (
      <g key={key} style={{ cursor: ui.tool === 'select' ? 'move' : 'crosshair' }} onPointerDown={(ev) => startMove(n, ev)}>
        <rect x={sx} y={sy} width={scale} height={scale} fill="rgba(47,111,94,0.12)" />
        <g transform={`rotate(-7 ${cx} ${cy})`} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={strokeA} stroke="var(--ink)" strokeWidth={outline} />
          <path d={strokeB} stroke="var(--ink)" strokeWidth={outline} />
          <path d={strokeA} stroke="var(--accent)" strokeWidth={core} />
          <path d={strokeB} stroke="var(--accent)" strokeWidth={core} />
          <g opacity={0.35} transform={`translate(${scale * 0.02} ${-scale * 0.02})`}>
            <path d={strokeA} stroke="var(--accent)" strokeWidth={Math.max(1, scale * 0.04)} />
            <path d={strokeB} stroke="var(--accent)" strokeWidth={Math.max(1, scale * 0.04)} />
          </g>
        </g>
      </g>
    );
  }

  function renderHandles() {
    if (!selNode || selNode.type !== 'building') return null;
    const e = eff(selNode);
    const sx = tx + e.x * scale;
    const sy = ty + e.y * scale;
    const fw = e.w * scale;
    const fh = e.h * scale;
    const corners: { h: Handle; x: number; y: number }[] = [
      { h: 'nw', x: sx, y: sy },
      { h: 'ne', x: sx + fw, y: sy },
      { h: 'sw', x: sx, y: sy + fh },
      { h: 'se', x: sx + fw, y: sy + fh },
    ];
    const r = Math.max(5, Math.min(9, scale * 0.22));
    return (
      <g>
        {corners.map((c) => (
          <rect key={c.h} x={c.x - r} y={c.y - r} width={r * 2} height={r * 2} fill="var(--paper)" stroke="var(--accent)" strokeWidth={2} style={{ cursor: 'nwse-resize' }} onPointerDown={(ev) => startResize(c.h, ev)} />
        ))}
      </g>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="map-wrap"
      style={{ width: '100%', height: '100%' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* 模式条（画布左上，唯一入口） */}
      <div className="mode-bar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`mode-btn ${ui.tool === t.id ? 'on' : ''}`}
            title={`${t.label}（快捷键 ${t.key}）`}
            onClick={() => setTool(t.id)}
          >
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
        {ui.tool === 'mark' && (
          <span className="mark-toggle">
            <button className={ui.markTarget === 'start' ? 'on' : ''} onClick={() => setMarkTarget('start')}>起点</button>
            <button className={ui.markTarget === 'end' ? 'on' : ''} onClick={() => setMarkTarget('end')}>终点</button>
          </span>
        )}
      </div>

      <svg width={size.w} height={size.h} style={{ display: 'block', cursor: 'crosshair' }}>
        <g>
          {vLines.map((x) => {
            const sx = tx + x * scale;
            const strong = x % 10 === 0;
            return <line key={`v${x}`} x1={sx} y1={ty + minY * scale} x2={sx} y2={ty + maxY * scale} stroke={strong ? 'var(--line-strong)' : 'var(--line)'} strokeWidth={strong ? 2 : 1} opacity={strong ? 0.9 : 0.5} />;
          })}
          {hLines.map((y) => {
            const sy = ty + y * scale;
            const strong = y % 10 === 0;
            return <line key={`h${y}`} x1={tx + minX * scale} y1={sy} x2={tx + maxX * scale} y2={sy} stroke={strong ? 'var(--line-strong)' : 'var(--line)'} strokeWidth={strong ? 2 : 1} opacity={strong ? 0.9 : 0.5} />;
          })}

          {(map?.nodes || []).map((n) => renderNode(n, `${n.x},${n.y}`))}

          {ui.tool === 'line' && lineStart && (
            <g pointerEvents="none">
              {orthoPath(lineStart, hover ?? lineStart).map(([px, py]) => (
                <rect key={`line-${px},${py}`} x={tx + px * scale} y={ty + py * scale} width={scale} height={scale} fill="rgba(47,111,94,0.4)" stroke="var(--accent-2)" strokeWidth={2} />
              ))}
              <circle cx={tx + lineStart[0] * scale + scale / 2} cy={ty + lineStart[1] * scale + scale / 2} r={scale * 0.18} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
            </g>
          )}

          {box && (
            <rect
              x={Math.min(box.x0, box.x1) * scale + tx}
              y={Math.min(box.y0, box.y1) * scale + ty}
              width={(Math.abs(box.x1 - box.x0) + 1) * scale}
              height={(Math.abs(box.y1 - box.y0) + 1) * scale}
              fill="rgba(168,68,42,0.15)"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="5 3"
              pointerEvents="none"
            />
          )}

          {hover && !drag && !box && (() => {
            const hit = map?.nodes.find((n) => covers(n, hover[0], hover[1]));
            let bx = tx + hover[0] * scale;
            let by = ty + hover[1] * scale;
            let bw = scale;
            let bh = scale;
            if (hit) { bw = (hit.w ?? 1) * scale; bh = (hit.h ?? 1) * scale; bx = tx + hit.x * scale; by = ty + hit.y * scale; }
            const ccx = bx + bw / 2;
            const ccy = by + bh / 2;
            let fill = 'rgba(168,68,42,0.10)';
            let stroke = 'var(--accent)';
            let glyph: string | null = null;
            let gIcon = '';
            if (hit) {
              if (ui.tool === 'erase') { fill = 'rgba(168,68,42,0.20)'; stroke = '#a8442a'; glyph = 'x'; }
              else { fill = 'rgba(168,68,42,0.06)'; stroke = 'var(--accent)'; }
            } else if (ui.tool === 'erase') { fill = 'rgba(168,68,42,0.20)'; stroke = '#a8442a'; glyph = 'x'; }
            else if (ui.tool === 'mark') { glyph = ui.markTarget === 'start' ? 'flag' : 'xmark'; }
            else if (ui.tool === 'line') { glyph = null; }
            else {
              const ent = ui.selectedEntityId ? library[ui.selectedEntityId] : undefined;
              if (ent && (ent.kind === 'road' || ent.kind === 'building')) {
                if (ent.kind === 'building') { glyph = 'emoji'; gIcon = ent.icon; } else glyph = 'dot';
              }
            }
            return (
              <g pointerEvents="none">
                <rect x={bx} y={by} width={bw} height={bh} rx={hit ? scale * 0.16 : 0} fill={fill} stroke={stroke} strokeWidth={hit ? 2.5 : 1.5} strokeDasharray="4 3" />
                {glyph === 'x' && (
                  <text x={ccx} y={ccy} fontSize={scale * 0.62} textAnchor="middle" dominantBaseline="central" fill="#a8442a" fontWeight="bold" stroke="#fff" strokeWidth={scale * 0.06} paintOrder="stroke">✕</text>
                )}
                {glyph === 'xmark' && (
                  <text x={ccx} y={ccy} fontSize={scale * 0.62} textAnchor="middle" dominantBaseline="central" fill="#2f6f5e" fontWeight="bold">✕</text>
                )}
                {glyph === 'flag' && (
                  <text x={ccx} y={ccy} fontSize={scale * 0.6} textAnchor="middle" dominantBaseline="central">⛳</text>
                )}
                {glyph === 'emoji' && (
                  <text x={ccx} y={ccy} fontSize={scale * 0.6} textAnchor="middle" dominantBaseline="central" opacity={0.55}>{gIcon}</text>
                )}
                {glyph === 'dot' && (
                  <circle cx={ccx} cy={ccy} r={scale * 0.32} fill="rgba(47,111,94,0.5)" stroke={stroke} strokeWidth={2} />
                )}
              </g>
            );
          })()}

          {selNode && (() => {
            const e = eff(selNode);
            return (
              <rect x={tx + e.x * scale - 2} y={ty + e.y * scale - 2} width={e.w * scale + 4} height={e.h * scale + 4} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="7 4" pointerEvents="none" />
            );
          })()}

          {renderHandles()}

          <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); recenter(); }}>
            <circle cx={tx} cy={ty} r={7} fill="var(--accent)" opacity={0.85} />
            <circle cx={tx} cy={ty} r={2.5} fill="#fffdf6" />
            <text x={tx + 11} y={ty - 9} fontSize={11} fill="var(--ink)" style={{ userSelect: 'none' }}>中心[0,0]</text>
          </g>
        </g>
      </svg>

      <div className="map-controls" style={ctrlPos ? { left: ctrlPos.x, top: ctrlPos.y, right: 'auto', bottom: 'auto' } : undefined} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="mc-grip" title="拖动移动此控件" onPointerDown={onCtrlDown} onPointerMove={onCtrlMove} onPointerUp={onCtrlUp}>⠿</div>
        <button className="mc-btn" title="放大" onClick={() => zoomBy(1.2)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="16" y1="16" x2="21" y2="21" /></svg>
        </button>
        <button className="mc-btn" title="缩小" onClick={() => zoomBy(1 / 1.2)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="16" y1="16" x2="21" y2="21" /></svg>
        </button>
        <button className="mc-btn" title="重置视图" onClick={resetView}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5" /></svg>
        </button>
        <button className="mc-btn" title="回到中心[0,0]" onClick={recenter}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><line x1="12" y1="1" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="1" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="23" y2="12" /></svg>
        </button>
      </div>

      <div className="map-hint">
        模式：{TOOLS.find((t) => t.id === ui.tool)?.label} ｜ {scale.toFixed(0)}px/格 ｜ 点左侧组件→「放置」点格子；拖拽=平移；框选=批量删；选中可拖移/拖角缩放(建筑)/方向键微调/Ctrl+D 复制 ｜ Delete删 ｜ Ctrl+Z 撤销 ｜ Esc 取消
      </div>
    </div>
  );
}
