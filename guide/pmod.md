# `.pmod` 格式手册

> **上层索引**：[`../Guide.md`](../Guide.md)（总入口、修改流程、共同铁律）
> **同族接口**：[`ai.md`](ai.md)（AI 导读与流程）、[`rules.yaml`](rules.yaml)（本手册的机读镜像）
>
> **本手册自包含**：`.pmod` 的**全部**结构标题、八类组件字段、取值域、缺省、降级行为与校验项都在本文件内，**不需要**再翻任何其它文档。
>
> **健全性标准**：仅依据本手册即可写出 / 改动一份合法 `.pmod`，并预知其校验项与降级行为。

## 一、用途与边界

- `.pmod` 是**单文件 Markdown**，`一个 .pmod = 一局游戏的全部内容`：地图、组件、规则、玩法、全局状态池。
- **不含任何 UI 定义**：观感（图 / 音 / 面板 / 字体）全部归 `.pp`（见 [`pp.md`](pp.md)）；文件里出现素材路径即错。
- **自包含**：本局用到的组件定义随文件一起带走；导入时并入本地组件库。
- **纯文本可版本化**：散文段直接渲染，结构化数据一律进 ` ```yaml ` 围栏。

## 二、文件骨架

### 2.1 文件头与编码（必写）

```markdown
<!-- charset: utf-8 -->
<!-- poprpg-version: 1 -->
```

- 文件**必须以 UTF-8 BOM（字节 `EF BB BF`）开头**，正文首行写 `<!-- charset: utf-8 -->`。浏览器 / 编辑器有时按 GBK 猜编码，中文一旦乱码整段即废。
- 版本注释读到**高于**实现版本时照常解析并在控制台警告一次。

### 2.2 标题层级与内容归属

| 层级 | 写法 | 内容 | 语言 |
|---|---|---|---|
| `#` | `# <游戏名>` | 游戏名 | 可中文 |
| `##` | `Background` / `Components` / `Rules` / `Maps` / `Pool` | 模块 | **必须英文** |
| `###` | 八类组件分组名，或**每张地图的名字** | 分组 / 地图 | 分组**必须英文**；**地图名是内容，用中文** |

- **结构标题一律英文**：中文标题乱码后匹配不上，组件会被**静默丢弃**。导入时**先按英文匹配、未命中再降级匹配中文旧写法**（`## 设定` / `### 技能` …），保证向后兼容。
- 缺某分组即视为该组为空；缺 `## Pool` 即视为无状态池声明、无回合判定。

### 2.3 散文与数据

- **散文段**（`## Background`）= 普通 Markdown 正文，游玩时直接渲染。
- **结构化数据** = ` ```yaml ` 围栏块，一套数据一块。
- **`## Components` 段 = 组件快照**：只装**这一局真正用到**的组件（见 §六）。

## 三、容器骨架总表

```
.pmod
├─ # <游戏名>
├─ ## Background           散文，直接渲染
├─ ## Pool                 状态池声明（作者空间 usr-）
│   ├─ pool:  [ { key, type, value, desc? } ]            变量
│   ├─ conds: [ { key, desc?, when } ]                   判定模板（命名条件 CondTpl）
│   └─ checks:[ { alias?, deps?, when, pool } ]          回合判定 RoundCheck
├─ ## Components           八类组件（各一个 ### 分组）
│   ├─ ### Monsters        [ { id, name, icon, stats, attack_weights, tags?, reward_pool?, atk_roll?, desc? } ]
│   ├─ ### Items           [ { id, name, icon, kind, slots?/usable?, modifiers?, effects?, tags?, desc? } ]
│   ├─ ### Buildings       [ { id, name, icon, encounter, reward_pool?/monster_pool?/mimic?/event?/stock?/price?, restock?, desc? } ]
│   ├─ ### Roads           [ { id, name, icon, cost?, gate? } ]
│   ├─ ### Classes         [ { id, name, icon, base_stats, free_points, buffs, inventory_size?, starting_items?, desc? } ]
│   ├─ ### Skills          [ { id, name, icon, dim, target, vs, bonus, apply, cost?, effects? } ]
│   ├─ ### NPCs            [ { id, name, icon, tags?, desc?, dialogs } ]
│   └─ ### Backgrounds     [ { id, name, icon, desc } ]
├─ ## Rules               前置配置（共 14 项，见 §4.3）
└─ ## Maps                每张地图一个 ###
    └─ ### <地图名>       { start, end, nodes: [ { x, y, type, ref?, w?, h?, npcs?, dialog? } ] }
```

## 四、模块详解

### 4.1 `## Background`

普通 Markdown 正文，多段纯文本，游玩时直接展示。无结构、无字段。

### 4.2 `## Components`

八类组件共用约束：每类一个 `###` 分组，组内为 **YAML 数组**，每项至少 `id` / `name` / `icon`；`tags` 为字符串数组（供筛选与通行能力匹配）；`desc` 可省。`id` 取法与来源判定见 §五。

#### 4.2.1 `Monsters`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `stats` | 是 | `{ hp, mp, patk, matk, pdef, mdef }`，**每项为区间数组** `[min, max]`，登场按 `combat.stat_dice` **一次摇定** |
| `attack_weights` | 是 | `{ <技能 id>: <权重> }`，按 `combat.pick_dice` 掷骰挑技能 |
| `tags` | 否 | 如 `[精英]` |
| `reward_pool` | 否 | 战利品池，结构见 §4.2.9 |
| `atk_roll` | 否 | 覆盖前置配置里的攻方骰，形状同 `Rules.combat.atk_roll` |
| `desc` | 否 | 说明 |

#### 4.2.2 `Items`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `kind` | 是 | `equipment`（装备）或 `consumable`（消耗品） |
| `slots` | `equipment` | 数组，如 `[weapon]` / `[hands]` / `[feet]` |
| `modifiers` | `equipment` | `{ hp, mp, patk, matk, pdef, mdef }`，**整数增量**（非区间） |
| `usable` | `consumable` | 数组，`battle` / `move`；**空数组 = 不能"使用"，只能拿去交易** |
| `effects` | 否 | 效果数组，算子见下 |
| `tags` | 否 | 如 `[火抗]`（通行能力）、`[货币]`（仅供编辑器筛选，**引擎不认识**）、`[common]`（可被商店 `filter` 命中） |
| `desc` | 否 | 说明 |

**`effects` 算子**（道具与技能共用一族）：

| `op` | 参数 | 语义 |
|---|---|---|
| `add_stat` | `target` / `stat` / `delta` | 即时改数值（`stat` 取六维之一） |
| `add_tag` | `tag` / `duration` / `per_turn?` / `modifiers?` | 挂持续状态；`duration` 受 `Rules.state.max_duration` 夹制 |
| `remove_tag` | `tag` | 解状态 |
| `learn_skill` | `skill` | 学会一个技能（技能书即此行） |

#### 4.2.3 `Buildings`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `encounter` | 是 | `empty` / `treasure` / `monster` / `event` / `shop` / `talk`（六种行为） |
| `reward_pool` | `treasure` | 给什么（结构见 §4.2.9） |
| `mimic` | 否 | `{ chance, monster, reward_pool }`：概率变成怪物屋 |
| `monster_pool` | `monster` | 怪物池（单只 = 单元素池） |
| `event` | `event` | `{ text, gate?, check?, on_success, on_fail, once? }`，见下 |
| `stock` | `shop` | 上架池，与 `reward_pool` 同构，可带 `pick` |
| `price` | 否 | `{ currency, algo, dice?, range? }`；`algo` = `value`（掷骰映射区间）或 `fixed`（明码） |
| `restock` | 否 | 补货时机（如 `on_enter`） |
| `desc` | 否 | 说明 |

**`event` 子结构**：`gate` = 门槛（`{ tags, mode: all, on_missing: blocked | penalty }`）；`check` = 手艺判定（`{ dice, add, target }`，默认骰取 `Rules.event.dice`）；`on_success` / `on_fail` = 后果（含 `text`、`point_reward` / `grant` / `cost` / `effects`）；`once` 显式一次。

> **NPC 不写在建筑定义上**——NPC 与其对话方案挂在地图节点（`npcs` / `dialog`，见 §4.5）。`talk` 只是"该建筑里会触发对话"的行为标记。

#### 4.2.4 `Roads`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `cost` | 否 | `{ step: <整数> }`；**省略 = `{ step: 1 }`**，`0` = 不耗步 |
| `gate` | 否 | 通行门槛：`{ tags, missing: block \| penalty, penalty?: { hp } }` |

#### 4.2.5 `Classes`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `base_stats` | 是 | `{ hp, mp, patk, matk, pdef, mdef }`，**整数**初始属性 |
| `free_points` | 是 | 开局自由点数 |
| `buffs` | 是 | `{ <维度>: <百分比整数> }`，百分比放大（`{ patk: 120 }` = ×1.2） |
| `inventory_size` | 否 | 背包格数；**省略 = 50，`0` = 无限** |
| `starting_items` | 否 | 出生道具 id 数组 |
| `desc` | 否 | 说明 |

> 职业**不限定能学什么**（无 `skills` 字段）；`Rules.class_pool` 只决定"用哪些职业"，"给多少点"在职业自己身上。

#### 4.2.6 `Skills`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `dim` | 是 | 基准维度（六维之一），如 `patk` / `matk` |
| `target` | 是 | `opponent` / `self` |
| `vs` | 是 | `auto`（按 `dim` 配对：`patk→pdef` / `matk→mdef`）或 `none`（不对抗、不落空） |
| `bonus` | 是 | 力值加成（整数） |
| `apply` | 是 | 力值作用目标：`hp` / `mp` / `none`（纯挂状态） |
| `cost` | 否 | `{ mp: <整数> }`；`{}` = 免费 |
| `effects` | 否 | 与道具同一族算子（见 §4.2.2） |

> **保底对**：`basic_attack` / `basic_magic` 人人开局都有、`cost` 为空，保证任何情况下都能施放。

#### 4.2.7 `NPCs`

| 字段 | 必填 | 取值 / 形状 |
|---|---|---|
| `tags` | 否 | 如 `[村庄]` |
| `desc` | 否 | 说明 |
| `dialogs` | 是 | `{ <方案名>: <对话树根数组> }`，多套方案；**方案名即 key** |

**对话树节点**（全树同构，逐层递归）：

| 字段 | 必填 | 语义 |
|---|---|---|
| `message` | **是** | 台词，字符串或字符串数组（逐条展示） |
| `dice` | 否 | 写了则本层**先列出全部选项（各标命中区间）＋ 一枚骰子**，点了才掷、按 `hit` 命中；不写即直接点选 |
| `if` / `pool` | 否 | **V2.3 条件判断**：同层数组按 **if-else 链**求值（自上而下取第一条 `if` 成立者、命中即停；末尾无 `if` 的记录 = `else`）；`pool` 为门锁 / 触发判定。**同层 `if` 与 `dice`/`hit` 二选一**。旧写法 `when` 读作单分支 `if` |
| `items` | 否 | 子节点数组；每个子节点可含 `result` / `hit` 与**完整同构字段**（可再嵌 `dice`） |
| `give` | 否 | 道具 id 数组（**交付清单叫 `give`，不是 `items`**）；同种写两次 = 给两份 |

- **`result`**：仅当该节点作为父层选项时展示（根层数组元素不写 `result`）。
- **`hit`**：命中区间，如 `"1-2"`，与父层 `dice` 配套。
- **无 `items` = 交付后结束**，本实例此后只回放该台词。

#### 4.2.8 `Backgrounds`

全局底色组件，**至少提供一条**；字段仅 `id` / `name` / `icon` / `desc`。

#### 4.2.9 池（`*_pool` / `stock` 共用结构）

```yaml
source: ids | filter        # ids = 手选；filter = 从整个组件库里筛
ids:    [{ id: <组件 id>, weight: <权重> }]      # source: ids 时
filter: { itemKind: consumable, tags: [common] } # source: filter 时（字段随节而异）
pick:   { algo: count | tiers | multiplier, dice: 1D6, range?: [min, max], tiers?: [...], steps?: [...] }
```

- **算法 `algo` 词表与用法**（各池位的可选值不同，语义固定）：

| `algo` | 语义 | 常用池位 |
|---|---|---|
| `tiers` | 掷 `dice`，**自上而下取第一个 `upto ≥ 点数` 的档**，取该档的 `n` 为件数 | `treasure.pick` |
| `count` | 掷 `dice`，按 `range` 映射为该区间内的件数 | `loot.pick` / `stock.pick` / `monster_pool.pick` |
| `multiplier` | 掷 `dice`，按 `steps` 查档得到倍率 | `treasure.copies` |
| `value` | 掷 `dice`，按 `range` 映射为该区间内的数值（定价用） | `price` |
| `fixed` | 不掷骰，直接取字段 `n` 为结果 | `loot.copies` / `price` |

- **没有 `algo: all`**：池来自 `filter` 时可能命中上百件，全给等于倒空仓库，故不提供此值。
- `source: ids` 时按 `ids[].weight` 加权抽取；`source: filter` 时先按 `filter` 在组件库内筛选、再按权重抽取；`pick` 省略时按该池位的缺省（`## Rules` 里的对应项）执行。

### 4.3 `## Rules`（前置配置，共 14 项）

```yaml
move:   { dice: 1D6 }                       # ① 每回合掷骰定步数
combat:                                     # ②–⑤
  stat_dice: 1D6                            # ② 怪物区间 → 具体值
  pick_dice: 1D6                            # ③ 随机挑技能
  atk_roll: { add_dice: 1D4, mult: { dice: 1D6, steps: [0.5,1,1,1.5,2,3] } }   # ④ 攻方力值链骰（可省）
  def_roll: { add_dice: 1D4 }               # ⑤ 守方力值链骰
treasure: { pick: { algo: tiers, dice: 1D6, tiers: [...] }, copies: { algo: multiplier, dice: 1D6, steps: [...] } }  # ⑥⑦
loot:     { pick: { algo: count, dice: 1D6, range: [1,2] }, copies: { algo: fixed, n: 1 } }                          # ⑧⑨
state:    { max_duration: 10 }              # ⑩ 状态时限上限
shop:     { price: { algo: value, dice: 1D6, range: [5,15] } }   # ⑪ 默认定价
event:    { dice: 2D6 }                     # ⑫ 事件默认判定骰
talk:     { dice: 1D6 }                     # ⑬ 抽 NPC / 抽方案
class_pool: [knight, mage]                  # ⑭ 开局可选职业；长度 1 = 唯一
```

- **`combat` 没有 `attacks`**："攻击方式"已升级为技能组件（§4.2.6）。
- 难度值与后果写在**组件**上（那是内容），`## Rules` 只给**默认骰与兜底**。
- **早期草案字段已删除，不要写**：`combat.attacks`（攻击方式已升级为技能组件）、`dice.available` / `dice.default`（每个场景算法自带骰子）、`damage.algo`（收敛为一条力值链）、`pick.algo: all`、`crit` / 大成功大失败。写了不产生任何效果。

### 4.4 `## Pool`（状态池声明段）

三段：变量 `pool`、判定模板 `conds`、回合判定 `checks`。**只登记作者空间（`usr-`）**。

#### 4.4.1 变量 `pool`

| 字段 | 必填 | 含义 |
|---|---|---|
| `key` | 是 | **短名**（不含空间词）；落盘由解析器补 `usr-` |
| `type` | 是 | `string` / `number` / `boolean` |
| `value` | 是 | 默认值（须与 `type` 相符） |
| `desc` | 否 | 说明 |

- 同段内**同短名（`key`）只允许一次**（重复即 `K21`，取先出现者）；短名**含 `-` 或为空**即 `K27`。
- 落盘时 `key` **强制补 `usr-` 前缀**（写 `engine-aaa` 亦落为 `usr-engine-aaa`），故作者**不可能覆写引擎键**。

#### 4.4.2 判定模板 `conds`（命名条件 / `CondTpl`）

| 字段 | 必填 | 含义 |
|---|---|---|
| `key` | 是 | **短名**；落盘补 `usr-<短名>` |
| `desc` | 否 | 说明 |
| `when` | 是 | 模板条件（读算子，见 §4.4.4） |

- **`CondTpl` 本质是"判定的函数"**：一段可命名的条件，**可以用在所有能使用判定的地方**（对话 `if` / `pool`、门锁 `pool`、建筑触发前置、**回合判定的 `when`**……）。使用处只写模板名。
- **与回合判定不是一回事**：`CondTpl` 是**纯条件、随处即时求值**；`RoundCheck` 是**带动作的定时执行**（每回合开始跑一次）。**两者天生可嵌套**——`RoundCheck` 的 `when` 可直接测一个 `CondTpl`：

  ```text
  RoundCheck: A = if (CondTpl) { hp + 1 }
  ```

  即某条回合判定 `A` 的 `when` 引用模板 `CondTpl`、`pool` 写 `hp + 1`。
- **模板不含动作**：要"条件 ＋ 效果"一起按回合复用，用 `checks` 的 `alias`，不是模板。
- **模板不引用模板**：模板的 `when` 只引用变量与字面量（避免成环与查错困难）；多条件用 `mode: all` 并列写。
- **命名空间**：模板短名与变量短名**共用**；重名即 `K36`（取先出现者）。引用**未声明**的模板名即 `K35`，运行时该条件**恒不成立**。
- **模板属于作者素材（预设库）的一部分**：作者可**自建**模板、把常用判定沉淀为预设；与组件一样，模板库是"待用的工具"，**本局用到哪些就随 `.pmod` 带走**。各使用处条件栏可「转存为模板」。

#### 4.4.3 回合判定 `checks`（`RoundCheck`）

| 字段 | 必填 | 含义 |
|---|---|---|
| `alias` | 否 | 别名；**只有带别名者才能被依赖** |
| `deps` | 否 | 前置依赖的别名数组，**可多条** |
| `when` | 是 | 触发条件（读算子） |
| `pool` | 是 | 条件成立时执行的修改动作数组（写算子） |

- **每回合开始执行一次**。**来源三批**：`pmod`（作者业务）→ `state`（`Rules.state` 派生的 buff tick）→ `engine`（内置基础判定，含存活 / 死亡，**强制最后**）。**来源不是 `.pmod` 字段**，由登记方标注。
- **批内排序**：有名判定按 `deps` **稳定拓扑排序**（同层按声明顺序），**匿名判定排在本批有名判定之后**。
- **依赖必须指名到别名**：别名不存在（`K28`）或对方无别名（`K31`）时**只忽略该条依赖，本判定照常执行**。
- **禁环**：依赖成环即 `K30`——**唯一一条阻塞校验**，编辑器禁止保存 / 导出该依赖（手写文件按声明顺序兜底）。
- 条件不成立的回合判定**不执行 `pool`**，但依赖它的判定**照常执行**（依赖表达排序关系，不是成功条件）。

#### 4.4.4 判定与修改的写法（`when` / `if` / `pool`）

- **判定**（读）：`{ mode?: all | any, items: [ { name, op, value | ref } ] }`，或**整体替换为一个模板名**。空判定集合**视为成立**（`K25`）。
- **读算子**：`equals` / `notEquals` / `greater` / `less` / `greaterEqual` / `lessEqual` / `contain` / `notContain`。值可为字面量 `value`，**也可为另一池键的引用 `ref`**（键对键比较）；`ref` 与 `value` 二选一。
- **写动作**（`pool`）：`{ name, op, value }[]`，`op` 为写算子 `set` / `append` / `add` / `minus` / `multiply` / `divide` / `toggle`；值**一律字面量**；每条修改只作用一个键。
- **键名匹配**：使用处按**规范全名**精确匹配（`usr-aaa` / `engine-hpMax`），**不做前缀补齐**；引用不存在的全名即 `K20`，运行时该判定不成立 / 该修改不执行。
- **可写引擎键仅四类**：六维资源 `engine-hpValue` / `engine-mpValue`、点数 `engine-points`、道具件数 `engine-item.<道具 id>`、剩余步数 `engine-stepsLeft`；其余 `engine-` 键写入即 `K23`、运行时不执行。
- **算子表是穷举**：读算子八项、写算子七项，表外没有算子；`when` / `if` 用读算子，`pool` 用写算子，两处词表不通用。键名补前缀的容错规则见 §七。

### 4.5 `## Maps`

```yaml
### <地图名>
start: [x, y]
end:   [x, y]
nodes:
  - { x, y, type, ref?, w?, h?, npcs?, dialog? }
```

| 字段 | 必填 | 语义 |
|---|---|---|
| `x` / `y` | 是 | 格坐标 |
| `type` | 是 | `start` / `end` / `road` / `building` |
| `ref` | `road` / `building` | 引用组件 id（道路也要 `ref`——不同路的 `cost` / `gate` 不同） |
| `w` / `h` | 否 | **只对 `building` 有意义**，单位格；**省略 = 1**（导出时只写 `> 1` 的值） |
| `npcs` | 否 | **只对 `building` 有意义**：NPC 候选 id 数组；**省略 = 不触发对话** |
| `dialog` | 否 | **只对 `building` 有意义**：对象 `{ mod? }`；`mod` = 写死方案名，**省略 = 单套即用、多套掷骰** |

- **一座建筑 = 一个节点**：多格建筑用 `w`×`h` 覆盖，整座共享同一身份（对话抽取 / "已开过"记账都按此节点）。**紧挨的同名建筑是两个节点、两座**，引擎**绝不**按相邻同种聚合。
- **`road` / `start` / `end` 恒 1×1**：写 `w` / `h` 无效，导入时归一为 1 并提示。
- **地图名是建筑实例 key 的一部分**：必须唯一且稳定。重名时编辑器标黄不改名；导出与开局**自动加后缀**（第一张原名，第 2 张起 `名字 (2)` …）。
- ~~`dialog.retalk`~~ **已退役**（V2.3）：是否只说一次改由**池标记 ＋ `if` / 判定模板**表达；旧包里的 `retalk` 读取时忽略，导出不再写出。裸方案名（`dialog: Mod1`）照旧能读，导入升级为 `{ mod: Mod1 }`。

## 五、实体 ID 与引用规则

- 所有结构化实体（怪物 / 道具 / 建筑 / 道路 / 职业 / 技能 / NPC）都有全局唯一 `id`：定义段定义一次，地图节点用 `ref`（NPC 由 `npcs`）引用。
- **id 形状是判断"预设还是自建"的唯一依据**：

| 来源 | id 形状 | 例 |
|---|---|---|
| **预设**（系统自带，八类都有） | 固定可读词 | `goblin` / `red_potion` / `chest_room` / `path` / `knight` / `basic_attack` / `elder` |
| **自建**（用户自建，八类都能建） | 类型前缀 ＋ 随机串 | `m_a1z2` / `i_7kf0` / `b_3kf9` / `k_4x8q` / `n_5t2w` |

- **禁止顺序编号**（`b_1` / `b_2` 这类自增一律禁止）：删除 / 重排后错位会破坏地图 `ref` 引用与 `.psave` 的建筑实例 key。
- **id 一经分配永不变**：① 删除不回收、② 新增不复用、③ 导出 → 导入原样带出。唯一例外是"导入时本地已有同 `id` 但内容不同"——此时另分配新 `id`，并**把这一定义里所有引用一起改名搬家**（含地图节点 `ref`），必须整套同步，否则错位。
- **"预设 / 自建"是派生信息，不存字段、不写进文件**：拿 id 去内置预设表查，查得到即 `预设`，否则 `自建`。
- `name` 可随时改而不影响引用与来源判定；高级用户可手改 `id`（改 id 即改来源判定，属可接受）。

## 六、自包含规则（哪些组件进文件）

| 组件类型 | 什么情况下被写进 `.pmod` |
|---|---|
| 消耗品 / 装备 / 怪物 / 职业 / 技能 | 在本局中被**启用** |
| 道路 / 建筑 | 被**铺到某张地图的格子上** |
| **NPC** | 被**某个建筑实例（地图节点）的 `npcs` 引用**（NPC **不走"启用"**） |
| 背景 / 规则配置 / 地图 | **始终** |

- 库里没启用、没铺设的组件**不进文件**——它们只是待用的工具。
- 组件定义**原样带出**（`id` / `name` / `icon` / `tags` / 各自属性），**没有来源标记字段**；来源由导入方按 §五 自行判定。
- **往返一致**：导出 → 导入后，启用集合、铺设节点、地图顺序、组件定义全部一致。

## 七、编码与兼容（改动时最易踩）

| 情形 | 处理 |
|---|---|
| 结构标题写成中文 | 乱码后匹配不上 → 组件**静默丢弃**。务必用英文；旧中文标题仅在英文未命中时才被降级匹配 |
| 声明里写无前后缀的名字（如 `aaa`） | 按 `usr-aaa` 补齐，并在导入提示里说明一句 |
| 声明里写 `engine-` 开头的名字 | 改写为 `usr-engine-` 并提示"该名字已归入作者空间" |
| 引用里写无前后缀的名字 | 按 `usr-` 补齐后匹配；仍匹配不到出 `K20` |
| 引用 `engine-` 开头的名字 | 按引擎空间读取；读得到即可用，读不到出 `K20` |
| 读到更高版本 | 照常解析、控制台警告一次 |

## 八、校验项（状态池家族 `K20`–`K37`）

**仅 `K30` 阻塞导出；其余一律只提示、不阻断。**

| 编号 | 检查 | 运行时行为 |
|---|---|---|
| `K20` | 引用的规范全名未声明（`usr-`），或 `engine-` 键不在引擎总表内（`engine-item.*` 除外） | 该判定不成立、该修改不执行；导出不剔除该字段 |
| `K21` | `## Pool` 的 `pool` 段内重复 `name` | 取先出现的一条 |
| `K22` | 写算子为 `divide` 且值为 `0` | 不执行 |
| `K23` | 写算子落在只读的 `engine-` 键上（可写四类之外） | 不执行 |
| `K24` | 声明项 `value` 与 `type` 不符 | 按 `type` 取零值 |
| `K25` | 判定集合为空（`when` / `if` 无条件） | **视为成立** |
| `K26` | 算子不适用于该键的声明类型 | 不执行（判定不成立） |
| `K27` | 声明的短名含 `-` 或为空 | 提示改用下划线 / 补名 |
| `K28` | 回合判定 `deps` 引用不存在的别名 | **仅忽略该条依赖**，本条照常执行 |
| `K29` | `checks` 内别名重复 | 取先出现者作为被依赖目标 |
| `K30` | 回合判定依赖**成环** | **阻塞**：编辑器禁止保存 / 导出该依赖；手写文件按声明顺序兜底 |
| `K31` | `deps` 指向无别名的判定 | **仅忽略该条依赖**，本条照常执行 |
| `K32` | `engine-item.<道具 id>` 的道具 id 不在组件库 | 按件数正常读写，不阻塞 |
| `K33` | 对话同层混用 `if` 与 `dice` / `hit` | **以 `if` 优先** |
| `K34` | if-else 链里"无 `if` 记录"不在本层末尾 | 其后的 `if` 永不求值 |
| `K35` | 使用处引用的判定模板名**未声明** | 该条件**恒不成立** |
| `K36` | 判定模板名与变量短名**重名** | 取先出现者 |
| `K37` | 条件项同时写 `value` 与 `ref`，或 `ref` 与 `name` 类型不一致 | **只认 `ref`** 并提示 |

**组件与地图侧的自定义校验**（编号与状态池家族各自独立，**全部只提示、不阻塞导出**）：

| 项 | 规则 | 违反时 |
|---|---|---|
| 起 / 终点 | 每张地图恰好各一个 | 导出前提示，不阻塞 |
| 引用完整性 | `reward_pool` / `monster_pool` / `stock` / `price.currency` / `mimic.monster` / `class_pool` / `starting_items` / `learn_skill.skill` / `attack_weights` 的键 / `npcs` / `dialog.mod` / `give` / `grant` 指向的组件必须存在且已启用（**NPC 例外**：在库里存在即可，它没有"启用"开关） | 标红 ＋ 快捷修复；**导出时剔除**悬空引用（`dialog.mod` 例外：不剔除，运行时时跳过对话） |
| 技能指向失效 | `learn_skill` / `attack_weights` 指向已停用 / 已删的技能 | 标红 ＋ 快捷修复 |
| 技能无法获得 | 某已启用技能没有任何获得途径 | 标黄提示，不阻塞 |
| 技能自相矛盾 | `target: self` 却写 `vs:` 具体维；`vs: none` 却指望伤害；`apply: none` 且 `effects` 为空 | 标黄说明后果 ＋ 建议 |
| 池筛空 | `source: filter` 的条件筛出 0 项 | 标黄"这个池是空的" |
| 权限死路 | `gate.tags` 里的标签没有任何已启用组件带 | 标黄，不阻塞（可能是先铺路、装备还没做） |
| 事件必成 / 必败 | 判定命中率为 100% 或 0% | 提示 / 标黄，不阻塞 |
| 状态无上限 | `add_tag` 的 `duration` 缺失或超过 `Rules.state.max_duration` | **`duration` 必填**，缺失禁止保存；超限夹到上限并提示 |
| 商店缺货币 | `price.currency` 指向的道具未启用，或全图无产出 | 标黄 |
| 说了要对话却没配人 | `encounter: talk` 但实例 `npcs` 为空 | 标黄，不阻塞 |
| 空宝箱 | `treasure` 奖励池为空；**实例配了 `npcs` 时属合法配置、不提示** | 无 NPC 时标黄 |
| `dialog.mod` 方案名悬空 | 方案名不在所抽到 NPC 的 `dialogs` 里 | 标红；**导出不剔除**；运行时按"该实例没有 NPC"处理 |
| 非建筑节点带了大小 | `road` / `start` / `end` 写了 `w` / `h` ≠ 1 | 归一为 1×1 并提示 |
| 建筑 `w` / `h` 非法 | 不是 ≥ 1 的整数 | 归一为 1 并提示 |
| 地图名重复 | 两张地图同名 | 标黄；**导出与开局自动加后缀**（第一张原名，第 2 张起 `名字 (2)`） |
| 空对话 | 某方案根节点 `message` 与 `items` 都为空 | 标黄 |
| 赠予悬空 | `give` 里出现未启用 / 已删的道具 | 标红；导出剔除 |
| 根层写了 `result` | 根层元素带 `result`（只在作为上层选项时有意义） | 标黄；导出剔除 |
| 命中覆盖不全 | 各 `hit` 的并集没盖满该骰子全部点数 | 标黄"掷到该点数无选项命中，运行时会要求重掷" |
| `hit` 重叠 / 无所属 / 越界 | 区间有交集 / 节点无 `dice` 却写 `hit` / 点数超出骰子范围 | 重叠取先出现者；无所属导出剔除；越界标红 |
| 道路引用 | 地图上的 `road` 节点必须带 `ref` | 缺失标红；旧档无 `ref` 的路节点回退为 `cost: { step: 1 }` 且无 `gate` |
| 背包容量 | 职业 `inventory_size` 小于开局要发的道具条目数 | 提示不拦截 |

## 九、最小完整示例

````markdown
<!-- charset: utf-8 -->
<!-- poprpg-version: 1 -->

# 哥布林地穴

## Background
你是一名误入地穴的冒险者，空气中弥漫着霉味……

## Pool
```yaml
pool:
  - { key: gate_open, type: boolean, value: false, desc: 石门是否已开 }
  - { key: hp_bonus, type: number, value: 0, desc: 额外回血累计 }
conds:
  - { key: bag_full, desc: 背包满, when: { mode: all, items: [ { name: engine-item.red_potion, op: greaterEqual, value: 10 } ] } }
checks:
  - { alias: regen, when: { mode: all, items: [ { name: usr-gate_open, op: equals, value: true } ] }, pool: [ { name: usr-hp_bonus, op: add, value: 1 } ] }
```

## Components

### Roads
```yaml
- { id: path, name: 小路, icon: 🛤️ }
```

### Backgrounds
```yaml
- { id: cavern, name: 阴湿地穴, icon: 🌑, desc: 潮湿的石壁。 }
```

## Rules
```yaml
move: { dice: 1D6 }
combat: { stat_dice: 1D6, pick_dice: 1D6 }
treasure: { pick: { algo: tiers, dice: 1D6, tiers: [{ upto: 2, n: 0 }, { upto: 6, n: 1 }] }, copies: { algo: fixed, n: 1 } }
loot: { pick: { algo: count, dice: 1D6, range: [1, 1] }, copies: { algo: fixed, n: 1 } }
state: { max_duration: 10 }
shop: { price: { algo: value, dice: 1D6, range: [5, 15] } }
event: { dice: 2D6 }
talk: { dice: 1D6 }
class_pool: [knight]
```

## Maps
### 地下城入口
```yaml
start: [0, 0]
end: [5, 5]
nodes:
  - { x: 0, y: 0, type: start }
  - { x: 1, y: 0, type: road, ref: path }
  - { x: 5, y: 5, type: end }
```
````

> 上面是**最小**可用文件；八类组件、事件 / 商店 / NPC 对话树、状态池与多地图**逐字段出现一次**的完整范式见 §十。

## 十、完整范式示例

本节把八类组件、六种建筑行为、对话树、状态池与多地图都用上一遍，**每个字段至少出现一次**，供比对与抄改。

````markdown
<!-- charset: utf-8 -->
<!-- poprpg-version: 1 -->

# 哥布林地穴

## Background
你是一名误入地穴的冒险者，空气中弥漫着霉味……

## Pool
```yaml
pool:
  - { key: gate_open, type: boolean, value: false, desc: 石门是否已开 }
  - { key: hp_bonus, type: number, value: 0, desc: 额外回血累计 }
  - { key: warned, type: boolean, value: false, desc: 是否已提醒过守卫 }
conds:
  - { key: bag_full, desc: 背包满, when: { mode: all, items: [ { name: engine-item.red_potion, op: greaterEqual, value: 10 } ] } }
  - { key: rich, desc: 钱够, when: { mode: any, items: [ { name: engine-item.gold, op: greaterEqual, value: 50 } ] } }
checks:
  - { alias: regen, when: { mode: all, items: [ { name: usr-gate_open, op: equals, value: true } ] }, pool: [ { name: usr-hp_bonus, op: add, value: 1 } ] }
  - { alias: tidy, deps: [regen], when: usr-rich, pool: [ { name: engine-hpValue, op: add, value: 1 }, { name: usr-warned, op: toggle } ] }
```

## Components

### Monsters
```yaml
- id: goblin
  name: 哥布林
  icon: 👹
  stats: { hp: [8, 12], mp: [0, 0], patk: [3, 5], matk: [0, 0], pdef: [1, 2], mdef: [0, 0] }
  attack_weights: { basic_attack: 3, bite: 1 }
  tags: [精英]
  reward_pool:
    source: ids
    ids: [ { id: red_potion, weight: 3 }, { id: rusty_sword, weight: 1 } ]
    pick: { algo: count, dice: 1D6, range: [1, 1] }
  atk_roll: { add_dice: 1D4 }
  desc: 地穴里最常见的那种。
```

### Items
```yaml
- id: red_potion
  name: 红色药水
  icon: 🧪
  kind: consumable
  usable: [battle, move]
  effects: [ { op: add_stat, target: self, stat: hp, delta: 12 } ]
  tags: [common]
  desc: 一口回血。
- id: rusty_sword
  name: 锈剑
  icon: 🗡️
  kind: equipment
  slots: [weapon]
  modifiers: { hp: 0, mp: 0, patk: 3, matk: 0, pdef: 0, mdef: 0 }
  desc: 砍得动就行。
- id: gold
  name: 金币
  icon: 🪙
  kind: consumable
  usable: []
  tags: [货币, common]
  desc: 只能当通货用。
- id: tome_guard
  name: 守御手册
  icon: 📕
  kind: consumable
  usable: [move]
  effects:
    - { op: learn_skill, skill: guard }
    - { op: add_tag, tag: 坚壁, duration: 3, per_turn: true, modifiers: { pdef: 6 } }
  desc: 学一次，带一阵。
```

### Buildings
```yaml
- id: chest_room
  name: 宝箱屋
  icon: 📦
  encounter: treasure
  reward_pool:
    source: filter
    filter: { itemKind: consumable, tags: [common] }
    pick: { algo: tiers, dice: 1D6, tiers: [ { upto: 2, n: 0 }, { upto: 6, n: 1 } ] }
  desc: 空手而归也是常事。
- id: goblin_den
  name: 哥布林窝
  icon: 🏚️
  encounter: monster
  monster_pool:
    source: ids
    ids: [ { id: goblin, weight: 1 } ]
  desc: 一窝。
- id: deep_pit
  name: 深坑
  icon: 🕳️
  encounter: event
  event:
    text: 坑底传来水声……
    gate: { tags: [攀爬], mode: all, on_missing: penalty }
    check: { dice: 2D6, add: 2, target: 9 }
    on_success: { text: 你摸到一只箱子。, point_reward: 5, grant: [red_potion], effects: [ { op: add_stat, target: self, stat: hp, delta: 3 } ] }
    on_fail: { text: 摔了一跤。, cost: { hp: 4 }, effects: [ { op: remove_tag, tag: 坚壁 } ] }
    once: true
  desc: 只灵验一次。
- id: mimic_gate
  name: 会咬人的箱子
  icon: 👺
  encounter: treasure
  mimic: { chance: 3, monster: goblin, reward_pool: { source: ids, ids: [ { id: gold, weight: 1 } ] } }
  desc: 三成概率翻脸。
- id: shop_hall
  name: 杂货厅
  icon: 🏪
  encounter: shop
  stock:
    source: filter
    filter: { itemKind: consumable }
    pick: { algo: count, dice: 1D6, range: [2, 4] }
  price: { currency: gold, algo: fixed, n: 20 }
  restock: on_enter
  desc: 每次进来都不一样。
- id: chapel
  name: 小圣堂
  icon: ⛪
  encounter: talk
  desc: 谁在里面，看运气。
```

### Roads
```yaml
- { id: path, name: 小路, icon: 🛤️, cost: { step: 1 } }
- { id: rockslide, name: 塌方, icon: 🪨, cost: { step: 2 }, gate: { tags: [攀爬], missing: penalty, penalty: { hp: 2 } } }
- { id: portal, name: 传送门, icon: 🌀, cost: { step: 0 }, gate: { tags: [符文], missing: block } }
```

### Classes
```yaml
- id: knight
  name: 骑士
  icon: 🛡️
  base_stats: { hp: 30, mp: 4, patk: 7, matk: 1, pdef: 6, mdef: 3 }
  free_points: 5
  buffs: { patk: 120 }
  inventory_size: 20
  starting_items: [red_potion, rusty_sword]
  desc: 硬一点。
- id: mage
  name: 法师
  icon: 🔮
  base_stats: { hp: 18, mp: 12, patk: 2, matk: 8, pdef: 2, mdef: 6 }
  free_points: 7
  buffs: { matk: 130 }
  desc: 玻璃大炮。
```

### Skills
```yaml
- { id: basic_attack, name: 普通攻击, icon: ⚔️, dim: patk, target: opponent, vs: auto, bonus: 0, apply: hp, cost: {} }
- { id: basic_magic, name: 普通魔法, icon: ✨, dim: matk, target: opponent, vs: auto, bonus: 0, apply: hp, cost: {} }
- { id: bite, name: 撕咬, icon: 🦷, dim: patk, target: opponent, vs: auto, bonus: 2, apply: hp, cost: { mp: 1 } }
- id: guard
  name: 守御
  icon: 🧱
  dim: pdef
  target: self
  vs: none
  bonus: 0
  apply: none
  effects: [ { op: add_tag, tag: 坚壁, duration: 2, modifiers: { pdef: 6 } } ]
```

### NPCs
```yaml
- id: elder
  name: 长老
  icon: 🧙
  tags: [村庄]
  desc: 话多。
  dialogs:
    Mod1:
      - message: 你终于来了。
        dice: 1D6
        items:
          - { hit: "1-3", result: 我在找地穴的路。, message: 往下走，别回头。, give: [red_potion] }
          - { hit: "4-6", result: 长老，这里有什么。, message: 有石头，还有别的。 }
      - message: 还有别的事吗？
    Mod2:
      - if: { mode: all, items: [ { name: usr-gate_open, op: equals, value: true } ] }
        message: 门开了？
        items:
          - { result: 开了。, message: 那你去吧。, pool: [ { name: usr-warned, op: set, value: true } ] }
      - message: 你先去把门打开。
- id: ghost
  name: 游魂
  icon: 👻
  dialogs:
    Mod1:
      - message: [哈……, 又是活人。]
        items:
          - { result: 你是谁？, message: 一个没走出地穴的人。 }
```

### Backgrounds
```yaml
- { id: cavern, name: 阴湿地穴, icon: 🌑, desc: 潮湿的石壁。 }
```

## Rules
```yaml
move: { dice: 1D6 }
combat:
  stat_dice: 1D6
  pick_dice: 1D6
  atk_roll: { add_dice: 1D4, mult: { dice: 1D6, steps: [0.5, 1, 1, 1.5, 2, 3] } }
  def_roll: { add_dice: 1D4 }
treasure: { pick: { algo: tiers, dice: 1D6, tiers: [ { upto: 2, n: 0 }, { upto: 6, n: 1 } ] }, copies: { algo: multiplier, dice: 1D6, steps: [1, 1, 1, 2, 2, 3] } }
loot: { pick: { algo: count, dice: 1D6, range: [1, 2] }, copies: { algo: fixed, n: 1 } }
state: { max_duration: 10 }
shop: { price: { algo: value, dice: 1D6, range: [5, 15] } }
event: { dice: 2D6 }
talk: { dice: 1D6 }
class_pool: [knight, mage]
```

## Maps
### 地下城入口
```yaml
start: [0, 0]
end: [5, 5]
nodes:
  - { x: 0, y: 0, type: start }
  - { x: 1, y: 0, type: road, ref: path }
  - { x: 1, y: 1, type: road, ref: rockslide }
  - { x: 2, y: 1, type: road, ref: portal }
  - { x: 2, y: 2, type: building, ref: chest_room }
  - { x: 3, y: 2, type: building, ref: mimic_gate }
  - { x: 3, y: 3, type: building, ref: shop_hall, w: 2, h: 1 }
  - { x: 4, y: 3, type: building, ref: chapel, npcs: [elder, ghost], dialog: { mod: Mod1 } }
  - { x: 5, y: 5, type: end }
```
### 下层墓室
```yaml
start: [5, 5]
end: [0, 0]
nodes:
  - { x: 5, y: 5, type: start }
  - { x: 4, y: 5, type: building, ref: deep_pit }
  - { x: 3, y: 5, type: building, ref: goblin_den }
  - { x: 0, y: 0, type: end }
```
````

## 十一、直接修改检查清单

1. 文件**首字节是 BOM**、首行是 `<!-- charset: utf-8 -->`、有版本注释。
2. 所有 `##` / `###` **结构标题是英文**；地图名是中文（内容）。
3. 结构化数据**全部在 ` ```yaml ` 围栏内**，围栏配平。
4. 新增实体的 `id`：**预设用固定词 / 自建用前缀＋随机串**，**不顺序编号**、不与既有 `id` 冲突。
5. 所有 `ref` / `npcs` / `class_pool` / `reward_pool.ids` / `attack_weights` 指向的 id **确实存在于本文件或预设表**。
6. `## Pool`：变量与模板短名**不重名**（`K36`）、不引用未声明名（`K20` / `K35`）、`checks.deps` 只填**已存在的别名**且**不成环**（`K30`）。
7. 写引擎键**只在可写四类内**（`K23`）。
8. `## Rules` **14 项**按需给全，`class_pool` 里的职业在本文件 `### Classes` 内。
9. 只用到的组件才留在 `## Components`（自包含规则 §六）。
10. **不存在**任何素材路径（那是 `.pp` 的事）。

## 十二、AI 读取接口

本手册同时是**机器可读**的：AI 与页面程序按下面的入口取用，不必解析散文。

| 接口 | 位置 | 内容 |
|---|---|---|
| 机读镜像 | [`rules.yaml`](rules.yaml) 的 `pmod:` 段 | 标题骨架、八类组件字段、`Rules` 十四项、`Pool` 三段、`Maps` 节点字段、校验编号（`K20`–`K37`）与提示级校验项 |
| 导读与流程 | [`ai.md`](ai.md) | AI 的读文档顺序、自然语言需求 → 字段改动的映射、改动后的自查与交付口径 |
| 渲染页 | 应用内 `#/guide` | 直接渲染本文件与 §十 的完整范式，并把 `rules.yaml` 渲染为字段速查表 |

- **机读镜像与本章同源同义**：本章增删字段 → 同步改 `rules.yaml`；冲突时**以本章为准**。
- 编辑器里的**呈现方式**（怎么提示、怎么快捷修复）不属文件规范，不在本手册范围；本手册只承诺「违反时被提示、且导出结果符合 §八 的运行时行为」。
