# PopRPG 设计文档 — 模块：00a-formats（基本设计：三件套与容器）

> **上位索引**：[`../DESIGN.md`](../DESIGN.md)「基本设计：三件套（`.pmod` / `.pp` / `.pgame`）」
> **设计依据**：原始需求「主题模式」；本节把 [`skin/00-package.md`](skin/00-package.md) §一–§七中属**整体设计**的部分上提为总纲
> **相关**：[`01-pmod.md`](01-pmod.md)（`.pmod` 内部格式）、[`skin.md`](skin.md)（素材皮肤总纲）、[`skin/00-package.md`](skin/00-package.md)（皮肤包视角的完整说明）、[`08-deploy.md`](08-deploy.md)（纯静态约束）
> **状态**：新增（皮肤包自身的具体定义仍保留在 `skin/00-package.md`，见 §八 分工）；2026-09-29 裁决 14–22 已同步（zip 取库 / 皮肤库与单套解压 / `pack.json` 容器 / 路径以描述文件为准 / `format`）

## 一、三件套

| 文件 | 后缀 / 形态 | 承载 | 现状 |
|---|---|---|---|
| 游戏模组 | `.pmod`，**单文件 Markdown**（散文正文 ＋ YAML 围栏） | 地图、组件、规则、玩法——**不含任何 UI 定义** | 已实现（`src/io/pmod.ts`，`PMOD_VERSION = 1`） |
| 皮肤模组 | `.pp`，**zip 容器** | 纯渲染：路径 / 建筑 / 背景 / 音频 / 面板 / 提示框 / 角色等 | 新增 |
| 整体分发 | `.pgame`，**zip 容器** | `pack.json`（容器描述） ＋ `.pmod` ＋ 皮肤（`skin/`），作为整体分发与加载 | 新增 |

- 后缀 `.pp` 取自 pop pack。
- **三者相互独立**：`.pmod` 与 `.pp` 都能单独导出、单独加载；`.pgame` 只是前两者的容器。
- **`.pmod` 格式不因本模块改动**：`.pgame` 内直接以条目形式存放 `.pmod` 原文本（见 §2.2）。
- **皮肤不是必需依赖**：没有 `.pp` 时游戏照常渲染，缺位节点回退程序绘制（[`skin.md`](skin.md) §一）。

## 二、容器布局

### 2.1 `.pp`

```text
<name>.pp（zip）
├── manifest.json          描述文件（必须在包根）
├── preview.png            可选：皮肤预览图（须在包根）
└── 素材…                  目录名、层级、文件名一律自由
    ├── background/  bg.jpg      ← 以下为推荐目录约定（非强制）
    ├── road/        straight.png …
    ├── role/        hero.png …
    ├── item/ · building/ · window/ · font/ · audio/
    └── bld/blacksmith.9.png
```

- `manifest.json` **必须在包根**，是唯一的入口描述文件；顶层键见 [`skin/00-package.md`](skin/00-package.md) §三。
- **强制结构只有两项**（裁决 22）：`manifest.json` 与可选 `preview.png`。素材的**目录名 / 层级 / 文件名一律自由**，图中 `resource/` ＋ 按分节命名的子目录只是推荐约定，加载器不得依赖。
- **素材位置以描述文件为准**（裁决 19 / 22）：manifest 各字段写上**相对包根**的完整路径（如 `"img": "resource/road/straight.png"`），加载器按路径逐条取包内条目，**不推断、不假设任何目录约定**；草案的 `resource` 键**已废除**，读到即忽略并提示 `KP-10`（[`skin/00-package.md`](skin/00-package.md) §2.2）。

### 2.2 `.pgame`

```text
<name>.pgame（zip）
├── pack.json             容器描述：{ format, kind, name, pmod, skin, entry }
├── game.pmod             `.pmod` 原文本，条目形式存放
└── skin/                 皮肤（就是一份 `.pp` 的内容）
    ├── manifest.json
    └── …                 素材：目录名与层级自由（以 `manifest.json` 为准）
```

- `pack.json` **必须在包根**，是 `.pgame` 唯一的入口描述文件；键表见 [`skin/00-package.md`](skin/00-package.md) §2.3。缺 `pack.json` 时按约定文件名回退探测（`game.pmod` ＋ `skin/manifest.json`）并提示 `KP-7`。
- `.pgame` 只声明「内含哪些文件」，不给自身增设计算语义；容器版本与 `pmod` / `manifest` 的版本号**不合并计**（§五）。
- 皮肤部分的校验沿用 `.pp` 的规则；`.pgame` 缺少皮肤子目录时按「无皮肤」处理。

### 2.3 路径约束（三件套共用）

**素材位置一律由描述文件指定**（`.pp` / `.pgame` 的 `manifest.json`、`.pgame` 的 `pack.json`），**包内目录结构不构成任何约束**（裁决 22）：加载器按描述文件中写明的路径逐条取条目，不推断前缀、不假设目录约定。

禁止绝对路径、禁止 `..`、禁止 `http(s)://` 等外部地址（校验项 `KP-4`）——与 [`08-deploy.md`](08-deploy.md) §9 的纯静态约束一致：**产物必须离线可用**。

## 三、加载入口

| 入口 | 行为 |
|---|---|
| 加载 `.pmod` | 只加载游戏本身（现有行为，不变） |
| 加载 `.pgame` | 同时加载 `.pmod` 与 `.pp`，作为整体启用 |
| **首页手动选择皮肤** | 为当前这一局指定皮肤；不改变文件加载结果。该交互本身由**程序绘制**，否则会形成「必须先选皮肤才能显示出选皮肤的界面」的循环（[`skin/08-pages.md`](skin/08-pages.md) §三） |
| **build 模式加载 `.pp`** | **仅用于预览**：地图视图按素材渲染，用于验证「素材与地图是否对得上」；不改变导出的 `.pmod`（[`skin/09-creative.md`](skin/09-creative.md) §一） |
| **Creative 模式打开 `.pp`** | 新建／编辑／导出 `.pp`；可加载 `.pmod` 作为**靶子**做命中检查（[`skin/09-creative.md`](skin/09-creative.md) §二） |

- 现有 `pickTextFile`（`src/io/download.ts`）**只读文本**；`.pp` / `.pgame` 是 zip 二进制，需新增 zip 读写能力——**已裁决 14：引入 `fflate`**（见 [`07-decisions.md`](07-decisions.md) §8.2）。
- **用户皮肤库**：导入过的 `.pp` 入库，游戏自带皮肤不入库；运行时只保留**当前生效皮肤**的解压结果，切换即释放（裁决 15 / 19，[`skin/00-package.md`](skin/00-package.md) §4.4）。
- 后两条入口只影响**渲染与编辑**：皮肤编辑器自身的 UI 不接管素材（自举循环，[`skin/09-creative.md`](skin/09-creative.md) §一）。

## 四、三层优先级

```text
游戏配置（当前 .pp / .pgame 携带）＞ 用户配置（用户本地设置的全局 pp）＞ 缺省配置（程序绘制）
```

- 「用户配置」的确义（裁决 5）：**用户在本机设置的全局 pp**——它随设备走、不随这一局走；一局里指定了 pp 时，本局 pp 覆盖它，而未被覆盖的节点仍从全局 pp 取。
- 降级粒度是**单个素材节点**，不是整节：某槽位在游戏皮肤中缺图，则取用户皮肤的同名节点，再缺则回退程序绘制形态（道路脚印 / 圆角矩形 / emoji）。
- 因此「同一屏内一部分是素材、一部分是程序绘制」是正常状态，不得视为缺陷。

## 五、版本与迁移

- `manifest.json` 的 `format` 为整数，缺省视为 `1`（原 `version` 键改名 `format`，裁决 19）。
- 读到**高于**当前实现的版本时：照常渲染可识别字段，并在控制台给出一次警告（与 `.pmod` 的处理一致，`src/io/pmod.ts` 的 `PMOD_VERSION` 检查）。
- `.pgame` 的 `pack.json.format` 为**容器**版本，只声明「内含哪些文件」，不与 `pmod` / `manifest` 的版本号合并计。

## 六、校验项（总表，均为提示不阻断导出）

| 编号 | 检查 | 提示内容 |
|---|---|---|
| KP-1 | `manifest.json` 不在包根 / 无法解析 | 该 `.pp` 整体被忽略，全部降级为用户配置 |
| KP-2 | 素材路径在包内不存在 | 列出全部无效路径；该项逐节点降级 |
| KP-3 | `format` 高于实现版本 | 提示可能读不出新增字段 |
| KP-4 | 路径含绝对路径 / `..` / 外部地址 | 违反纯静态约束，禁止 |
| KP-5 | `item` / `building` / `road` / `role` 等节的键不在本局启用的组件 id 内 | 无效键，忽略并提示（明细见各节 `KIB` / `KS` / `KR` 等） |
| KP-6 | 包根无 `preview.png`，或其无法解码 | 皮肤列表回退为文件名显示 |
| KP-7 | `.pgame` 缺少 `pack.json` | 按约定文件名（`game.pmod` ＋ `skin/manifest.json`）回退加载 |
| KP-8 | `extends` 路径不存在或形成环 | 忽略继承，只按本包渲染 |
| KP-9 | `theme` 含未知 token 名，或试图覆盖布局 token | 忽略该键，其余主题照常注入 |
| KP-10 | `manifest.json` 含已废除的 `resource` 键 | 忽略该键，路径一律以各字段自身为准（裁决 22） |

## 七、待确认

1. **`.pmod` 是否也要支持并入 `.pp`**（即反向：皮肤包内挂一个默认游戏）？当前不允许。
2. **`pack.json.entry` 的取值语义**：指向 `.pmod` 内的场景 id、还是某个页标识？当前留空即走默认开局流程（[`skin/00-package.md`](skin/00-package.md) §2.3）。
3. **是否允许按皮肤名继承**本地已安装的另一套皮肤（跨包 `extends`）？当前只允许包内继承。
4. **音频相关**：BGM 是否需要「按地图」（原 `Q26`）与全局音乐开关的持久化，随音频在 V1.1 落地时一并裁决。

> **已裁决项不再在此列**：zip 能力、体积上限、`.psave` 是否记录皮肤名、用户全局 pp 的存放形态、`.pgame` 内部布局与包内目录自由，均已在 2026-09-29 裁决（14–22）定稿，汇总见 [`07-decisions.md`](07-decisions.md) §8.2 与 [`skin.md`](skin.md) §八。本节与 [`skin/00-package.md`](skin/00-package.md) §七（皮肤包视角）**同源**：任一处变动，必须同步另一处。

## 八、与其它模块的分工

| 内容 | 规范出处 |
|---|---|
| 三件套分工 / 容器布局 / 加载入口 / 三层优先级 / 版本与迁移 | **本文件**（整体设计） |
| `.pmod` 内部格式与导出 | [`01-pmod.md`](01-pmod.md) |
| 皮肤 `manifest.json` 顶层键与各节字段 | [`skin.md`](skin.md) 与 `skin/` 各分节 |
| 皮肤包视角的完整说明（含校验项明细与皮肤包专属待确认） | [`skin/00-package.md`](skin/00-package.md) |
| 纯静态 / base 路径 / 依赖边界 | [`08-deploy.md`](08-deploy.md) §9 |

- 本文件与 [`skin/00-package.md`](skin/00-package.md) 存在**刻意重叠**：本文件是整体设计视角的总纲，后者保留皮肤包视角的完整说明（裁决 11）。**两处必须一致，改一处须同步另一处**；若出现不一致，以本文件为准。
