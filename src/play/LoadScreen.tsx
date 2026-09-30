/**
 * 开局入口（B0）：这一局从哪儿来 ——
 * 封面式主页：点开就玩构建页这一局，其余入口收进「其他开始方式」。
 * 组件库的导入 / 导出也放在这里（库是跨项目的资产，§7.3）。
 */

import { useState } from 'react'
import { FileDown, FileUp, Hammer, LibraryBig, Sword } from 'lucide-react'
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
import { useHintStyle } from '../ui/useHintStyle'
import { useRuleStyle } from '../ui/useRuleStyle'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useButtonStyle } from '../ui/useButtonStyle'
import { useStartupArt, useStartupBgStyle, useStartupDiceBody } from '../ui/usePageSkin'
import { useDieFace } from '../ui/useDieSkin'
import { CSS_SIZED_BOX, InlineTexture, SvgTexture } from '../ui/Texture'
import { GameIcon } from '../ui/GameIcon'

/** 洞穴手绘 SVG 的坐标盒（`viewBox`）：主视觉素材也按这个盒落位（`08-pages.md` §2.1） */
const CAVE_BOX = { x: 0, y: 0, w: 120, h: 92 }

/**
 * 主视觉上的装饰骰子（`.die.cover-die`）：本体归 `startup.dice`、骰面复用 `misc.dice`（`KPG-4`）。
 * 两件都没配就照旧画程序数字面——缺省观感不因皮肤改变。
 */
function CoverDie({ pips, className }: { pips: number; className: string }) {
  const body = useStartupDiceBody()
  const face = useDieFace(pips)
  return (
    <span className={`die cover-die ${className}`} style={body}>
      {face ? <InlineTexture {...face} /> : pips}
    </span>
  )
}

export default function LoadScreen({ onLoaded }: { onLoaded: (scenario: Scenario) => void }) {
  const [warnings, setWarnings] = useState<string[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const startSaved = usePlayStore((s) => s.setSession)
  // 更新记录弹窗也是对话框（`skin/03-window.md` §四）：封面本身归 `startup.bg`（`08-pages.md`）
  const surface = useSurfaceStyle('dialog')
  // 按钮按元素角色各取一键（§四）：封面不另立按钮字段，直接复用 `window.buttons`（`08-pages.md` §一）
  const startBtn = useButtonStyle('primary')
  const plainBtn = useButtonStyle('plain')
  const ghostBtn = useButtonStyle('ghost')
  const smallBtn = useButtonStyle('small')
  const closeBtn = useButtonStyle('close')
  // 封面三件：整屏背景 / 标题字形 / 主视觉（`skin/08-pages.md` §2.1）
  const bg = useStartupBgStyle()
  const titleArt = useStartupArt('title', CSS_SIZED_BOX)
  const coverArt = useStartupArt('cover', CAVE_BOX)
  // 分隔线与警告提示条（`skin/03-window.md` §二「单向族 / 随内容族」）：都靠九宫格，素材带 `slice` 才生效
  const rule = useRuleStyle()
  const warnHint = useHintStyle('warn')

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
    <div className="play-shell no-topbar" style={bg}>
      <div className="load-cover">
        <div className="cover-tag">掷骰 · 探窟 · 求生</div>
        {/* 标题图形只换字形、不改文案：文案落在 `alt` 上（`S-14`） */}
        <h1 className="cover-title">
          {titleArt ? <InlineTexture {...titleArt} className="cover-title-art" alt="PopRPG" /> : 'PopRPG'}
        </h1>
        <p className="cover-sub">翻开地穴的每一格，怪潮、宝箱与陷阱都在等你；命运由骰子点数决定。</p>

        <div className="cover-hero">
          {/* 主视觉：配了素材就整块替换洞穴手绘（V1 拉伸进同一个 `viewBox`，`S-1`） */}
          <svg className="cover-cave" viewBox="0 0 120 92" fill="none" aria-hidden="true">
            {coverArt ? (
              <SvgTexture {...coverArt} />
            ) : (
              <>
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
              </>
            )}
          </svg>
          <CoverDie pips={3} className="d1" />
          <CoverDie pips={6} className="d2" />
          <CoverDie pips={5} className="d3" />
        </div>

        <div className="cover-actions">
          <button className="btn primary cover-start" style={startBtn} onClick={fromBuild}>
            <GameIcon name="Sword" size={22} icon={Sword} /> 开始冒险
          </button>
          <button className="btn cover-build" style={plainBtn} onClick={() => navigate('build')}>
            <GameIcon name="Hammer" size={16} icon={Hammer} /> 构建世界
          </button>
        </div>

        <div className="cover-more">
          <button className="btn ghost" style={ghostBtn} onClick={() => setMoreOpen((o) => !o)}>
            {moreOpen ? '收起其他开始方式' : '其他开始方式'}
          </button>
          {moreOpen && (
            <>
              <div className="cover-more-body">
                <button className="btn" style={plainBtn} onClick={fromFile}>
                  <GameIcon name="FileDown" size={14} icon={FileDown} /> 选一份 .pmod
                </button>
                <button className="btn" style={plainBtn} onClick={fromSave}>
                  <GameIcon name="FileUp" size={14} icon={FileUp} /> 载入 .psave 存档
                </button>
              </div>
              <div className="sketch-line" style={{ width: 220, margin: '2px 0', ...rule }} />
              <div className="cover-more-body">
                <button className="btn small" style={smallBtn} onClick={exportLibrary}>
                  <GameIcon name="LibraryBig" size={13} icon={LibraryBig} /> 导出组件库
                </button>
                <button className="btn small" style={smallBtn} onClick={importLibrary}>
                  <GameIcon name="FileDown" size={13} icon={FileDown} /> 导入组件库
                </button>
              </div>
              <div className="cover-lib">组件库可整体导出或导入。</div>
            </>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="hintbox warn" style={{ maxWidth: 460, ...warnHint }}>
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
          <div className="modal changelog" style={surface}>
            <div className="panel-head" style={{ justifyContent: 'space-between' }}>
              <span className="hand" style={{ fontSize: 16 }}>
                更新记录
              </span>
              <button className="btn small" style={closeBtn} onClick={() => setVersionOpen(false)}>
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
