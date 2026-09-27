/**
 * 开局入口（B0）：这一局从哪儿来 ——
 * ① 构建页当前这一局 ② 选一份 `.pmod` ③ 示例局 ④ 接着上次的 `.psave`。
 * 组件库的导入 / 导出也放在这里（库是跨项目的资产，§7.3）。
 */

import { useState } from 'react'
import { FileDown, FileUp, Hammer, LibraryBig, ScrollText, Sparkles } from 'lucide-react'
import type { Scenario } from '../types/session'
import { scenarioFromProject, scenarioFromPmod } from './load'
import { sampleProject } from '../lib/sample'
import { presetLibrary } from '../presets'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { usePlayStore } from '../store/play'
import { pickTextFile } from '../io/download'
import { downloadLibrary, pickLibraryFile, pickSaveFile } from '../io/psave'
import { navigate } from '../app/router'

export default function LoadScreen({ onLoaded }: { onLoaded: (scenario: Scenario) => void }) {
  const [warnings, setWarnings] = useState<string[]>([])
  const startSaved = usePlayStore((s) => s.setSession)

  const fromBuild = () => {
    const library = useLibraryStore.getState()
    const project = useProjectStore.getState()
    if (project.maps.length === 0 || project.maps.every((m) => m.nodes.length === 0)) {
      setWarnings(['构建页这一局还是张白纸 —— 先去铺点东西，或者先用示例局'])
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

  const fromSample = () => {
    setWarnings([])
    onLoaded(scenarioFromProject(presetLibrary(), sampleProject()))
  }

  const fromSave = async () => {
    const session = await pickSaveFile()
    if (!session) {
      setWarnings(['无法解析该 .psave 文件'])
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

      <div className="play-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <div className="panel scroll">
          <div className="panel-head">
            <ScrollText size={16} /> <span>开一局</span>
          </div>

          <p className="muted">
            加载场景文件（<b>.pmod</b>），选择职业后开始游戏。
          </p>

          <div className="row" style={{ margin: '10px 0', gap: 6 }}>
            <button className="btn primary" onClick={fromBuild}>
              <Sparkles size={14} /> 用构建页这一局
            </button>
            <button className="btn" onClick={fromFile}>
              <FileDown size={14} /> 选一份 .pmod
            </button>
            <button className="btn" onClick={fromSample}>
              示例局（哥布林地穴）
            </button>
            <button className="btn" onClick={fromSave}>
              <FileUp size={14} /> 载入 .psave 存档
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="hintbox warn">
              {warnings.map((w) => (
                <div key={w}>· {w}</div>
              ))}
            </div>
          )}

          <div className="sketch-line" style={{ margin: '10px 0' }} />

          <div className="panel-title hand" style={{ fontSize: 13, marginBottom: 6 }}>
            组件库（跨项目的资产）
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small" onClick={exportLibrary}>
              <LibraryBig size={13} /> 导出组件库
            </button>
            <button className="btn small" onClick={importLibrary}>
              <FileDown size={13} /> 导入组件库
            </button>
          </div>
          <div className="faint" style={{ marginTop: 6 }}>
            组件库为跨场景的独立资产，可整体导出或导入。
          </div>
        </div>
      </div>
    </div>
  )
}
