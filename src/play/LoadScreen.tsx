/**
 * 开局入口（B0）：这一局从哪儿来 ——
 * 封面式主页：点开就玩构建页这一局，其余入口收进「其他开始方式」。
 * 组件库的导入 / 导出也放在这里（库是跨项目的资产，§7.3）。
 */

import { useState } from 'react'
import { FileDown, FileUp, Hammer, LibraryBig, Sparkles } from 'lucide-react'
import type { Scenario } from '../types/session'
import { scenarioFromProject, scenarioFromPmod } from './load'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { usePlayStore } from '../store/play'
import { pickTextFile } from '../io/download'
import { downloadLibrary, pickLibraryFile, pickSaveFile } from '../io/psave'
import { navigate } from '../app/router'
import { APP_VERSION, changelog } from '../lib/version'
import Overlay from '../ui/Overlay'

export default function LoadScreen({ onLoaded }: { onLoaded: (scenario: Scenario) => void }) {
  const [warnings, setWarnings] = useState<string[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const startSaved = usePlayStore((s) => s.setSession)

  const fromBuild = () => {
    const library = useLibraryStore.getState()
    const project = useProjectStore.getState()
    if (project.maps.length === 0 || project.maps.every((m) => m.nodes.length === 0)) {
      setWarnings(['构建页这一局还是张白纸 —— 先去构建页铺点东西，再回来开局'])
      return
    }
    setWarnings([])
    onLoaded(scenarioFromProject(library, project))
  }

  const fromFile = async () => {
    const file = await pickTextFile()
    if (!file) return
    const { scenario, warnings: w } = scenarioFromPmod(file.text)
    setWarnings(w)
    if (scenario) onLoaded(scenario)
  }



  const fromSave = async () => {
    const session = await pickSaveFile()
    if (!session) {
      setWarnings(['无法加载该 .psave 存档（可能版本不兼容或文件已损坏）'])
      return
    }
    setWarnings([])
    startSaved(session)
  }

  const exportLibrary = () => downloadLibrary(useLibraryStore.getState())
  const importLibrary = async () => {
    const library = await pickLibraryFile()
    if (!library) return
    const store = useLibraryStore.getState()
    for (const def of [...library.roads]) if (!store.roads.some((c) => c.id === def.id)) store.upsert('road', def)
    for (const def of [...library.buildings]) if (!store.buildings.some((c) => c.id === def.id)) store.upsert('building', def)
    for (const def of [...library.items]) if (!store.items.some((c) => c.id === def.id)) store.upsert('item', def)
    for (const def of [...library.monsters]) if (!store.monsters.some((c) => c.id === def.id)) store.upsert('monster', def)
    for (const def of [...library.classes]) if (!store.classes.some((c) => c.id === def.id)) store.upsert('class', def)
    for (const def of [...library.skills]) if (!store.skills.some((c) => c.id === def.id)) store.upsert('skill', def)
    setWarnings(['组件库已合并到本地，同名条目保持不变'])
  }

  return (
    <div className="play-shell">
      <div className="panel topbar">
        <span className="title hand">PopRPG</span>
        <button className="btn small" onClick={() => navigate('build')}>
          <Hammer size={13} /> 构建页
        </button>
      </div>

      <div className="load-cover">
        <div className="cover-tag">掷骰 · 探窟 · 求生</div>
        <h1 className="cover-title">PopRPG</h1>
        <p className="cover-sub">翻开地穴的每一格，怪潮、宝箱与陷阱都在等你；命运由骰子点数决定。</p>

        <div className="cover-hero">
          <svg className="cover-cave" viewBox="0 0 120 92" fill="none" aria-hidden="true">
            <path
              d="M10 90 L10 44 Q10 8 60 8 Q110 8 110 44 L110 90"
              stroke="var(--line)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M23 90 L23 47 Q23 22 60 22 Q97 22 97 47 L97 90 Z"
              fill="rgba(60,48,34,0.13)"
              stroke="var(--line-soft)"
              strokeWidth="1.6"
            />
            <line x1="30" y1="90" x2="90" y2="90" stroke="var(--line)" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="38" y1="81" x2="82" y2="81" stroke="var(--line-soft)" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="46" y1="72" x2="74" y2="72" stroke="var(--line-soft)" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="die cover-die d1">3</span>
          <span className="die cover-die d2">6</span>
          <span className="die cover-die d3">5</span>
        </div>

        <button className="btn primary cover-start" onClick={fromBuild}>
          开始冒险
        </button>

        <div className="cover-more">
          <button className="btn ghost" onClick={() => setMoreOpen((o) => !o)}>
            {moreOpen ? '收起其他开始方式' : '其他开始方式'}
          </button>
          {moreOpen && (
            <>
              <div className="cover-more-body">
                <button className="btn" onClick={fromBuild}>
                  <Sparkles size={14} /> 用构建页这一局
                </button>
                <button className="btn" onClick={fromFile}>
                  <FileDown size={14} /> 选一份 .pmod
                </button>
                <button className="btn" onClick={fromSave}>
                  <FileUp size={14} /> 载入 .psave 存档
                </button>
              </div>
              <div className="sketch-line" style={{ width: 220, margin: '2px 0' }} />
              <div className="cover-more-body">
                <button className="btn small" onClick={exportLibrary}>
                  <LibraryBig size={13} /> 导出组件库
                </button>
                <button className="btn small" onClick={importLibrary}>
                  <FileDown size={13} /> 导入组件库
                </button>
              </div>
              <div className="cover-lib">组件库可整体导出或导入。</div>
            </>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="hintbox warn" style={{ maxWidth: 460 }}>
            {warnings.map((w) => (
              <div key={w}>· {w}</div>
            ))}
          </div>
        )}

        {/* 底部：版本号（点开看更新记录） */}
        <button className="cover-version" onClick={() => setVersionOpen(true)} title="查看更新记录">
          v{APP_VERSION}
        </button>
      </div>

      {versionOpen && (
        <Overlay onClose={() => setVersionOpen(false)}>
          <div className="modal changelog">
            <div className="panel-head" style={{ justifyContent: 'space-between' }}>
              <span className="hand" style={{ fontSize: 16 }}>
                更新记录
              </span>
              <button className="btn small" onClick={() => setVersionOpen(false)}>
                关闭
              </button>
            </div>

            <div className="changelog-list">
              {changelog.versions.map((v) => (
                <div key={v.version} className="changelog-item">
                  <div className="changelog-ver">
                    <span className="changelog-num">v{v.version}</span>
                    {v.version === changelog.last && <span className="badge on">当前</span>}
                  </div>
                  <ul className="changelog-info">
                    {v.info.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}
