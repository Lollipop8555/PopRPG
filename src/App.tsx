import { useEffect, useState } from 'react';
import { useStore } from './store';
import Toolbar from './components/Toolbar';
import KitPanel from './components/KitPanel';
import MapCanvas from './components/MapCanvas';
import Inspector from './components/Inspector';

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

export default function App() {
  const maps = useStore((s) => s.project.maps);
  const selectedMapId = useStore((s) => s.ui.selectedMapId);
  const selectMap = useStore((s) => s.selectMap);
  const selectedEntityId = useStore((s) => s.ui.selectedEntityId);

  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'kit' | 'inspector' | null>(null);

  // 移动端：选好套件后自动收起面板，方便去地图放置
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
                <span>组件套件</span>
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
