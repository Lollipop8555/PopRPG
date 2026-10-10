# PopRPG 设计文档 — skin 分节：音频 `audio`

> **上层索引**：[`../skin.md`](../skin.md)　**包结构**：[`00-package.md`](00-package.md)　**屏与页**：[`08-pages.md`](08-pages.md)
> **设计依据**：原始需求 §设定.游戏文件清单 中「pp 覆盖……**音乐**……」一句（**原始需求未给任何细则**，本节按「描述文件 ＋ 素材」的统一规则补全）
> **状态**：字段与事件清单**定稿为预留参数**（2026-09-29 裁决 16）；**解析与校验**已于 **2026-09-30 · D3 第十一屏** 落地（§8.1）；**播放**（`AudioContext` 播放器 ＋ BGM 三场景淡入淡出 ＋ 8 个 SFX 触发点 ＋ 音量／静音偏好）已于 **2026-10-10 · V2.2** 落地（§8.2）；`bgm.<场景>.fade`（按曲目覆盖淡入淡出时长）随后补落（§8.2）；`KA-5`（BGM 显式 `loop: false`）于 **2026-10-10** 简化后接入（**只看循环开关、不看时长**）。含 2 处待确认

## 一、范围

`audio` 覆盖**背景音乐**与**操作音效**两类，全部为包内素材，遵循 §一 的逐节点降级。

**排期（裁决 16 ＋ V2.2）**：本节字段与事件键**在 V1 即定稿并预留**；V1 只做**解析与校验**——识别 `audio` 键、校验路径与取值、在清单中给出提示，**不加载、不解码、不播放**任何音频。**播放**（BGM 切换、音效触发、资源释放、音量／静音偏好）已于 **2026-10-10 · V2.2** 落地（§8.2），本节字段自 V1 起未再变动。

**本节不接管**：音量与静音的用户偏好属于**用户配置**（设置项），优先级高于皮肤给出的默认音量（[`00-package.md`](00-package.md) §4.2）。

## 二、字段

```json
"audio": {
  "bgm": {
    "home":   { "file": "resource/audio/home.mp3",   "loop": true, "volume": 0.5 },
    "map":    { "file": "resource/audio/map.mp3",    "loop": true, "volume": 0.5 },
    "battle": { "file": "resource/audio/battle.mp3", "loop": true, "volume": 0.6, "fade": 300 }
  },
  "sfx": {
    "dice_roll": "resource/audio/dice_roll.ogg",
    "dice_land": "resource/audio/dice_land.ogg",
    "hit":       "resource/audio/hit.ogg",
    "pickup":    "resource/audio/pickup.ogg",
    "coin":      "resource/audio/coin.ogg",
    "open":      "resource/audio/open.ogg",
    "close":     "resource/audio/close.ogg",
    "error":     "resource/audio/error.ogg"
  }
}
```

| 字段 | 类型 | 含义 | 缺省 |
|---|---|---|---|
| `bgm.<场景>.file` | 字符串 | 背景音乐文件，路径**相对包根**（[`00-package.md`](00-package.md) §2.2） | 无声（该场景静音） |
| `bgm.<场景>.loop` | 布尔 | 是否循环 | `true` |
| `bgm.<场景>.volume` | 0–1 | 该曲默认音量（可被用户偏好覆盖） | `0.5` |
| `bgm.<场景>.fade` | 毫秒 | 换场景时该曲的淡入 / 淡出时长（§2.1）；缺位、非有限或为负一律回落缺省 | `600`（`0` 表示立即切换） |
| `sfx.<事件>` | 字符串 | 音效文件；也可写对象 `{ "file": ..., "volume": ... }` | 静默 |
| `sfx.<事件>.volume` | 0–1 | 该音效默认音量 | `0.8` |

### 2.1 BGM 场景键（与现有屏一一对应）

| 场景键 | 对应界面 | 现状入口 |
|---|---|---|
| `home` | 首页／出身选择页 | `LoadScreen` / `StartScreen`（[`08-pages.md`](08-pages.md)） |
| `map` | 地图探索（游玩态主界面） | `GameScreen.tsx` |
| `battle` | 战斗／遭遇 | `BattleDialog.tsx` / `EncounterView.tsx` |

- 场景切换时的默认行为：**淡出旧曲 → 淡入新曲**（缺省各 600ms）；同一场景重复进入不重启曲目。**已落地（V2.2，§8.2）**：缺省时长 `BGM_FADE_MS = 600`；可按曲目用 `bgm.<场景>.fade` 覆盖（缺位、非有限或为负一律回落缺省，`0` 表示立即切换、不做淡入淡出）。

## 三、事件钩子（音效触发点）

按现有交互补全，键名即**唯一契约**（改名视为不兼容变更）：

| 事件键 | 触发时机 | 现状对应 |
|---|---|---|
| `dice_roll` | 掷骰开始（掷骰动画期间） | `DiceHud.tsx` / `flow.ts` 的掷骰流程 |
| `dice_land` | 骰子落定 | 同上 |
| `hit` | 战斗造成伤害 | `BattleDialog.tsx` |
| `pickup` | 获得道具／奖励 | `reward.ts` |
| `coin` | 买／卖成交 | `EncounterView.tsx`（货币即普通道具，`engine/item.ts`） |
| `open` / `close` | 面板、对话框、抽屉开合 | `Overlay.tsx` 及各 `*Panel` |
| `error` | 操作被拒（背包已满、点数不够等） | `check/validate.ts` 的非阻断提示通道 |

- 同一帧内的多次相同事件**合并为一次播放**，避免叠音。

## 四、播放约束（纯静态环境）

| 约束 | 说明 |
|---|---|
| **V1 不播放（V2.2 起已播放）** | V1 只解析本节的字段并校验；播放已随 **V2.2** 落地（§8.2），下列各项为其实现约束 |
| **不自动播放** | 浏览器禁止无用户手势的播放：BGM 在**首次用户交互后**才启动（首次点击／按键解锁音频上下文） |
| 包内自包含 | 素材必须来自包内条目，路径以 `manifest.json` 所写为准，不请求外部地址（[`../08-deploy.md`](../08-deploy.md)） |
| 格式 | 推荐 `mp3`（兼容面最广）＋ `ogg`（体积）；同一素材可**顺序**声明多个文件由引擎择一 |
| 资源释放 | 切出首页／结束一局时释放已解码音频，避免长时间占用内存 |
| 不做频谱可视化 | 音频不参与任何渲染，本节与视觉分节无耦合 |

## 五、校验项（构建页／Creative 模式「清单」，提示不阻断导出）

> V1 起即生效：这些检查只读 manifest 与包内条目，**不需要解码音频**。**已接**（2026-09-30）：`KA-2` / `KA-3` / `KA-4` 编入 `SkinIssueCode` 并在加载期提示（§八）；**`KA-5` 于 2026-10-10 简化后接入**（只判 `loop: false`，**不看时长**）。

| 编号 | 检查 | 提示 | 状态 |
|---|---|---|---|
| KA-1 | 音频路径在包内不存在 | 该条静音，其余正常 | **不单列**——由包级 `KP-2` 的通用收集（按扩展名认音频）判，单列会让同一条缺失在清单里出现两遍 |
| KA-2 | `sfx` 的事件键不在 §三 清单内 | 无效键，忽略 | 已接 |
| KA-3 | `volume` 超出 0–1 | 截断并提示 | 已接 |
| KA-4 | 单个音频文件体积过大（阈值待定，暂提示 > 2 MB） | 首次播放会有明显延迟 | 已接（同一个文件只报一次） |
| KA-5 | 声明了 BGM 但**显式写了 `loop: false`** | 该曲不循环，播完即停 | **已接**（2026-10-10 简化：**只看循环开关，不看时长**——开放式引擎只提示「不会循环」，是否故意如此由作者决定） |

## 六、取舍登记

| 编号 | 取舍 | 后果 |
|---|---|---|
| S-20 | 音频**只做 BGM ＋ 事件音效**，不做环境循环音、不做随机变体 | 长时游玩听感重复 |
| S-21 | 音量偏好归用户设置，皮肤只能给默认值 | 皮肤无法强制音量 |
| S-22 | 事件钩子清单固定（§三），不支持自定义事件 | 皮肤不能为新玩法补音效，需先扩清单 |
| S-25 | **V1 只解析预留、不播放**（裁决 16） | V1 的皮肤即带音频也不会响；音频相关验收整体推后到 **V2.2**（已于 2026-10-10 落地） |

## 七、待确认

1. **BGM 是否需要「按地图」而不仅是「按场景」**：当前 `map` 是单一场景键，多地图共用一曲（背景采用**按下标一一对应**的逐图写法（[`05-canvas.md`](05-canvas.md) §二），音频若要逐图区分则需另设 `map.<地图id>` 键）。播放已随 **V2.2** 落地，本项**仍未裁决**（原 `Q26`，见 [`../skin.md`](../skin.md) §八）。
2. **是否需要全局音乐开关的持久化**：属用户配置，是否需要随 `.pgame` 携带「推荐初始音量」？

## 八、实现落点

### 8.1 解析与校验（2026-09-30 · D3 第十一屏）

> V1 只接**解析与校验**这一半：`audio` 没有任何渲染落点、不进任何屏（`S-25`）——不建 `AudioContext`、不请求 / 解码素材、不碰 `loop` 的运行时语义（`loop` 只作字段读出）。

- **取值（纯函数）** [`../../../src/engine/skin/audio.ts`](../../../src/engine/skin/audio.ts)：`bgmOf()` / `sfxOf()` 给原值，`bgmTrackOf()` / `sfxTrackOf()` 把「字符串写法 / 对象写法 / 缺省 / 越界」一次算清，收成 `BgmTrack`（`{ file, loop, volume, fade }`）/ `SfxTrack`（`{ file, volume }`）；`clampVolume()` 把越界音量夹回 0–1（不静音、不换算）、`fadeOf()` 把淡入淡出时长规整（缺位 / 非有限 / 为负一律回落缺省）；缺省常量 `BGM_DEFAULT_VOLUME = 0.5` / `BGM_DEFAULT_LOOP = true` / `BGM_DEFAULT_FADE_MS = 600` / `SFX_DEFAULT_VOLUME = 0.8`。场景 / 事件**各查自己的键、不跨键借用**（配了 `battle` 不会让 `map` 有曲）。
- **校验（纯函数）** 同上：`unknownSfxEvents()` 列出 §三 清单外的 `sfx` 事件键（`KA-2`，忽略这些键）；`outOfRangeVolumes()` 列出 `volume` 越界项的出处（`KA-3`，形如 `audio.bgm.map.volume` / `audio.sfx.hit.volume`）。
- **校验（读条目）** [`../../../src/io/pp.ts`](../../../src/io/pp.ts) 的 `checkAudio()`：`KA-4`（单文件体积）要读包内条目长度，故落在 IO 层；**路径先去重**，同一个文件被多处引用只报一次；阈值 `AUDIO_MAX_BYTES = 2 MB`。
- **提示码** `SkinIssueCode` 新增 `KA-2` / `KA-3` / `KA-4`，与包级 `KP-*` 同一码空间；**没有 `KA-1`**（如上表，归 `KP-2`）；`KA-5` 于 2026-10-10 简化后接入（见 §8.2「`KA-5` 简化」）。
- **已知边界**：`outOfRangeVolumes()` 只遍历 §三 的已知事件键——写在**清单外**的键上带越界音量**不另判**（那个键整体已被 `KA-2` 忽略）。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **51 个文件 / 592 项**全绿（新增 2 个用例文件 / 31 项：[`../../../src/engine/skin/__tests__/audio.test.ts`](../../../src/engine/skin/__tests__/audio.test.ts) 18 项纯函数、[`../../../src/io/__tests__/pp-audio.test.ts`](../../../src/io/__tests__/pp-audio.test.ts) 13 项加载期）。

### 8.2 音频播放（2026-10-10 · V2.2）

> 播放已落地：**首次用户手势后**建 `AudioContext`，BGM 按场景切换（缺省 600ms 淡出淡入，可按曲目 `fade` 覆盖），**8 个 SFX 触发点**接线，音量／静音写入 `localStorage`。渲染侧仍**无落点**（`S-25` 的「不进任何屏」不变）——音频只经浏览器发声，不参与任何绘制。

- **运行期（IO 层）** [`../../../src/io/audio-runtime.ts`](../../../src/io/audio-runtime.ts)：`createAudioRuntime(deps?)` 把浏览器能力（`createContext` / `decode` / `setTimer`）作**可注入依赖**以利 jsdom 单测（与 `createSkinAssets({ createUrl })` 同法）。惰性建 `AudioContext` ＋ 主 `Gain`；`decodeAudioData` 结果按文件缓存（`buffers` / `inflight` 去重）；`setScene()` 走 `applyBgm()`——**同场景已在放只更新音量**、否则**淡出旧曲 → 淡入新曲**（`BGM_FADE_MS = 600`，`token` 递增挡异步竞态）；`sfx()` 经 `setTimer(fn, 0)` **合帧**（同一帧多次同事件只发一次，`burst` 集合）；`setLevel()` 管主音量与静音；`reload()` 保留上下文、清缓存后重放（换肤用）；`release()` 停源 / 清缓存 / 关上下文。
- **偏好与巴士（store）** [`../../../src/store/audio.ts`](../../../src/store/audio.ts)：`useAudioStore` 经 `persist` 只落 `{ master, muted }` 到 `localStorage`（键 `AUDIO_STORAGE_KEY = 'poprpg_audio'`，由本模块导出供单测引用），`onRehydrateStorage` 回灌运行期；`setMaster()` 夹回 0–1（`NaN` → 1）；`resolveBgm()` / `resolveSfx()` 从 `useSkinStore` 取当前皮肤，经 `bgmTrackOf` / `sfxTrackOf` 解析并**带上包内解出的字节**（`skinBytesOf`）交给运行期；`unlock()` / `setScene()` / `sfx()` / `reload()` / `release()` 透传运行期。
- **驱动（hook）** [`../../../src/audio/driver.ts`](../../../src/audio/driver.ts)：`sceneOfSession(session, pendingRoll)` 是**纯函数**——无对局回 `home`，有非空 `monster` / `encounter` / `talk` / 掷骰在途回 `battle`，否则 `map`；`useAudioDriver()` 按路由（非 `play` 场景交 `undefined`）与局势定场景并 `setScene`、监听窗口一次性 `pointerdown` / `keydown` / `touchstart` **解锁**、皮肤变更时 `reload()`（首帧跳过）、卸载 `release()`。
- **触发点接线（hooks）** [`../../../src/audio/hooks.ts`](../../../src/audio/hooks.ts)：`useDiceSfx`（`dice_roll` 掷骰上升沿 / `dice_land` 落数递增）、`useBattleSfx`（主角或同只怪物 `hp` 下降 → `hit`）、`useModalSfx`（开合 → `open` / `close`，卸载兜底 `close`）、`useNoticeSfx`（告示头变化 → `pickup`）、`useCoinSfx`（商店遭遇内道具计数增加 → `coin`）、`useErrorSfx`（新日志行 `tone === 'bad'` → `error`）；各 hook 只调 `useAudioStore.getState().sfx(...)`。
- **素材地址** [`../../../src/io/skin-assets.ts`](../../../src/io/skin-assets.ts)：`mimeOf()` 补音频扩展名（`mp3` → `audio/mpeg`、`ogg` → `audio/ogg` 等），使音频条目能取到可用地址与字节。
- **设置 UI** [`../../../src/play/GameScreen.tsx`](../../../src/play/GameScreen.tsx)：菜单内静音开关（🔊 / 🔇）＋ 总音量滑杆（`0`–`1`，步进 `0.05`，静音时禁用），读写 `useAudioStore` 的 `master` / `muted`。
- **`bgm.<场景>.fade` 覆盖（已落）**：`BgmTrack` 增 `fade` 字段，[`../../../src/engine/skin/audio.ts`](../../../src/engine/skin/audio.ts) 的 `fadeOf()` 把「缺位 / 非有限 / 为负」一律回落 `BGM_DEFAULT_FADE_MS = 600`（`0` 合法，表示立即切换）；经 [`../../../src/store/audio.ts`](../../../src/store/audio.ts) 的 `resolveBgm()` 透传，运行期 [`../../../src/io/audio-runtime.ts`](../../../src/io/audio-runtime.ts) 的 `applyBgm()` 按 `AudioTrack.fade ?? BGM_FADE_MS` 做淡出 / 淡入（`AudioTrack` 相应增可选 `fade`）。
- **`KA-5` 简化（2026-10-10）**：`nonLoopingBgm()`（[`../../../src/engine/skin/audio.ts`](../../../src/engine/skin/audio.ts)）只列出**显式 `loop: false`** 的场景键（缺省与显式 `loop: true` 都算循环、不报），由 [`../../../src/io/pp.ts`](../../../src/io/pp.ts) 的 `checkAudio()` 合成加载期提示。原先设想「不循环**且**曲目过短（< 3s）」须解码量时长、成本高于收益，**已废**——开放式引擎只提示「这首不会循环」，长短不管。
- **验收**：`npx tsc --noEmit` 无错；`npx vitest run` **73 个文件 / 884 项**全绿（本轮新增 [`../../../src/io/__tests__/audio-runtime.test.ts`](../../../src/io/__tests__/audio-runtime.test.ts)、[`../../../src/audio/__tests__/driver.test.ts`](../../../src/audio/__tests__/driver.test.ts)、[`../../../src/audio/__tests__/hooks.test.ts`](../../../src/audio/__tests__/hooks.test.ts)、[`../../../src/store/__tests__/audio.test.ts`](../../../src/store/__tests__/audio.test.ts)，并修正 `skin-assets` 音频 mime 与窗口按钮计数两处既有用例）。`fade` 补落后 `npx vitest run` 为 **75 个文件 / 938 项**；`KA-5` 简化后为 **75 个文件 / 947 项**全绿。
