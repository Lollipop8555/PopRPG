import { useEffect, useState } from 'react';
import { useStore } from './store';
import Toolbar from './components/Toolbar';
import KitPanel from './components/KitPanel';
import MapCanvas from './components/MapCanvas';
import Inspector from './components/Inspector';

// 极简 hash 路由（纯静态、无需服务端配置；默认 / 游玩、/build 构建）
function useHashRoute(): string {
  const [route, setRoute] = useState(
    typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') || '/' : '/'
  );
  useEffect(() => {
    const on = () => setRoute(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
function navigate(path: string) {
  window.location.hash = path;
}

function PlayPage() {
  const project = useStore((s) => s.project);
  return (
    <div className="app">
      <Toolbar />
      <div className="play-placeholder hand-border">
        <h2>游玩页（Phase B，后续阶段）</h2>
        <p>
          当前项目：<b>{project.name}</b>（{project.maps.length} 张地图）
        </p>
        <p style={{ color: 'var(--ink-soft)' }}>
          构建闭环（Phase A）先行。回到「构建」页完成地图与组件，导出的 .pmod 才能在此开玩。
        </p>
        <button className="hp-btn" style={{ marginTop: 12 }} onClick={() => navigate('/build')}>
          → 进入构建页
        </button>
      </div>
    </div>
  );
}

function useIsMobile() {
  const [m, setM] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 880 : false
  );
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 880);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

function BuildPage() {
  const selectedEntityId = useStore((s) => s.ui.selectedEntityId);
  const selectedMapId = useStore((s) => s.ui.selectedMapId);
  const maps = useStore((s) => s.project.maps);
  const selectMap = useStore((s) => s.selectMap);
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'kit' | 'inspector' | null>(null);

  useEffect(() => {
    if (mobilePanel === 'kit') setMobilePanel(null);
  }, [selectedEntityId]);

  useEffect(() => {
    if (!selectedMapId && maps[0]) selectMap(maps[0].id);
  }, [selectedMapId, maps, selectMap]);

  return (
    <div className="app">
      <Toolbar />
      <div className={`app-body ${isMobile ? 'mobile' : ''}`}>
        {!isMobile && <KitPanel />}
        <div className="map-wrap hand-border">
          <MapCanvas />
        </div>
        {!isMobile && <Inspector />}
      </div>

      {isMobile && (
        <>
          <button
            className="fab fab-left"
            onClick={() => setMobilePanel((p) => (p === 'kit' ? null : 'kit'))}
          >
            📦 组件
          </button>
          <button
            className="fab fab-right"
            onClick={() => setMobilePanel((p) => (p === 'inspector' ? null : 'inspector'))}
          >
            ✎ 编辑
          </button>

          {mobilePanel === 'kit' && (
            <div className="mobile-panel mobile-kit">
              <div className="mobile-panel-head">
                <span>组件库</span>
                <button className="hp-btn" onClick={() => setMobilePanel(null)}>×</button>
              </div>
              <div className="mobile-panel-body">
                <KitPanel />
              </div>
            </div>
          )}

          {mobilePanel === 'inspector' && (
            <div className="mobile-panel mobile-inspector">
              <div className="mobile-panel-head">
                <span>检视 / 编辑</span>
                <button className="hp-btn" onClick={() => setMobilePanel(null)}>×</button>
              </div>
              <div className="mobile-panel-body">
                <Inspector />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const isBuild = route === '/build' || route === '';
  // 顶部全局导航（仅构建页需要编辑器，游玩页是另一套）
  return (
    <div className="route-root">
      <nav className="top-nav">
        <span className="brand">PopRPG</span>
        <button
          className={`nav-link ${!isBuild ? 'on' : ''}`}
          onClick={() => navigate('/')}
        >
          游玩
        </button>
        <button
          className={`nav-link ${isBuild ? 'on' : ''}`}
          onClick={() => navigate('/build')}
        >
          构建
        </button>
      </nav>
      {isBuild ? <BuildPage /> : <PlayPage />}
    </div>
  );
}
