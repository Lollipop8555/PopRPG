# PopRPG 设计文档 — 模块：01-pmod

> 本文件从原 `DESIGN.md` 按章节切片而来，作为独立模块阅读。文中交叉引用保留原章节号（如 §4.8），可在根 `DESIGN.md` 索引的「章节→模块映射」查到对应文件。

## 3. `.pmod` 文件格式

单文件 Markdown，后缀 `.pmod`。**一个 `.pmod` = 一局游戏的全部内容**（"内容"的定义见 §4.0）：

- **一级标题 `#`** = 游戏名
- **二级标题 `##`** = 模块（背景 / 设定 / **规则配置** / 地图）
- **三级标题 `###`** = 分组（怪物 / 道具 / 建筑 / 道路 / 职业 / **技能**）或每张地图
- **散文段**（背景）= 普通 Markdown 正文，游玩时直接渲染
- **结构化数据**（怪物/道具/地图等）= ```` ```yaml ```` 围栏块，保证人读 + 机解析都稳
- **`## 设定` 段 = 组件快照**：这一局用到的组件定义会**随文件一起带走**，所以 `.pmod` **自包含**——别人拿到就能玩，不依赖他本地的组件库。
  导入时这些定义**并入本地组件库**，成为用户自己的组件。

### 3.1 完整结构示例

````markdown
# 哥布林地穴

## 背景
你是一名误入地穴的冒险者，空气中弥漫着霉味……
（多段纯文本，游玩时直接展示）

## 设定

### 怪物
```yaml
# 6 个属性都是区间：hp / mp / patk / matk / pdef / mdef
- id: goblin                     # 小怪档：区间低
  name: 哥布林
  icon: 👺
  stats: { hp: [6, 12], mp: [0, 2], patk: [2, 4], matk: [0, 2], pdef: [1, 2], mdef: [1, 2] }
  attack_weights: { basic_attack: 3, basic_magic: 1 }  # 技能权重（键 = 技能 id）：掷骰随机挑，逼玩家两维都堆
  desc: 洞穴里常见的小怪。
- id: slime                      # 小怪档：只会物理
  name: 史莱姆
  icon: 🟢
  stats: { hp: [6, 10], mp: [0, 0], patk: [1, 3], matk: [0, 0], pdef: [0, 1], mdef: [3, 5] }
  attack_weights: { basic_attack: 1 }
  desc: 软软的胶质生物，弱物理、抗魔法。
- id: goblin_king                # 精英档：区间高一大截，靠 tags 标注
  name: 哥布林王
  icon: 👑
  tags: [精英]
  stats: { hp: [24, 40], mp: [4, 8], patk: [6, 10], matk: [4, 8], pdef: [4, 6], mdef: [4, 6] }
  attack_weights: { basic_attack: 2, basic_magic: 1 }
  reward_pool:
    source: ids
    ids: [{ id: iron_sword, weight: 1 }, { id: blue_potion, weight: 2 }]
  desc: 洞穴深处的老大，比普通哥布林硬得多。
- id: mimic_chest
  name: 伪装宝箱
  icon: 🦞
  tags: [精英]
  stats: { hp: [18, 28], mp: [0, 0], patk: [5, 8], matk: [0, 0], pdef: [3, 5], mdef: [3, 5] }
  attack_weights: { basic_attack: 1 }
  atk_roll: { add_dice: 1D6 }      # 可选：覆盖前置配置里的攻方骰（§4.8.7）
  reward_pool:                     # 打赢后的战利品池（§4.8.5①）
    source: ids
    ids: [{ id: red_potion, weight: 3 }, { id: iron_sword, weight: 1 }]
  desc: 伪装成宝箱的怪物。
```

### 道具
```yaml
# 持续性 = 装备
- id: iron_sword
  name: 铁剑
  icon: 🗡️
  kind: equipment
  slots: [weapon]
  modifiers: { hp: 0, mp: 0, patk: 5, matk: 0, pdef: 0, mdef: 0 }   # 5 点 ≈ 初始预算的 1/6
  desc: 普通的铁剑，物攻 +5。
- id: fire_boots
  name: 火抗鞋
  icon: 🥾
  kind: equipment
  slots: [feet]
  modifiers: { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 1, mdef: 1 }
  tags: [火抗]                     # 通行能力：靠它过"火焰山"（§4.5.2）
- id: rowboat
  name: 小船
  icon: 🛶
  kind: equipment
  slots: [hands]
  modifiers: { hp: 0, mp: 0, patk: -1, matk: 0, pdef: 0, mdef: 0 }
  tags: [渡河]                     # 通行能力：靠它过"河流"
  desc: 占着两只手，带着它就别想同时挥剑。
- id: lockpick
  name: 撬锁工具
  icon: 🗝️
  kind: equipment
  slots: [hands]
  modifiers: { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0 }
  tags: [撬锁]                     # 通行能力：这就是"上锁的石门"要的标签（§4.8.9）
  desc: 没有它，那扇石门你连试都试不了。
# 一次性 = 消耗品（恢复道具：量级按 §6.1.1 基线，各约 1/7 预算）
- id: red_potion
  name: 红瓶
  icon: 🧪
  kind: consumable
  usable: [battle, move]
  effects:
    - op: add_stat                 # 即时改数值（§4.8.10）
      target: self
      stat: hp
      delta: 5                     # 回 5 点血
- id: blue_potion
  name: 蓝瓶
  icon: 🔵
  kind: consumable
  usable: [battle, move]
  effects:
    - op: add_stat
      target: self
      stat: mp
      delta: 5                     # 回 5 点蓝（放法术前先嗑一瓶）
- id: fire_ward
  name: 御火符
  icon: 🧧
  kind: consumable
  usable: [move]
  effects:
    - op: add_tag                  # 挂状态：临时获得 `火抗`，撑 3 回合（§4.8.10）
      tag: 火抗
      duration: 3
- id: antidote
  name: 解毒剂
  icon: 💊
  kind: consumable
  usable: [battle, move]
  effects:
    - op: remove_tag               # 解状态：这就是"解药"
      tag: 中毒
- id: gold
  name: 金币
  icon: 🪙
  kind: consumable
  usable: []                       # 不能"使用"，只能拿去付钱
  tags: [货币]                     # 只是给编辑器筛选用（§4.8.11）；引擎不认识这个词
- id: scroll_of_fireball
  name: 火球术残卷
  icon: 📜
  kind: consumable
  usable: [move]
  effects:
    - op: learn_skill              # ← 技能书的全部秘密：就这一行（§4.8.3）
      skill: fireball
```

### 建筑
```yaml
- id: chest_room
  name: 宝箱屋
  icon: 📦
  encounter: treasure            # empty | treasure | monster | event | shop（五种，§4.4）
  reward_pool:                   # 池（§4.8.5①）：算法走前置配置的 treasure，这里只给"给什么"
    source: ids                  # ids = 手选 | filter = 从整个组件库里筛
    ids: [{ id: red_potion, weight: 5 }, { id: iron_sword, weight: 1 }]
  mimic:                         # 可选：勾选"宝箱怪物"后出现
    chance: 0.2                  # 概率变成怪物屋
    monster: mimic_chest
    reward_pool: { source: ids, ids: [red_potion] }
  desc: 你不知道里面有什么。
- id: monster_room
  name: 怪物房
  icon: 💀
  encounter: monster
  monster_pool:                  # 怪物池：踩到掷骰抽一只（单只 = 单元素池）
    source: ids
    ids: [{ id: goblin, weight: 3 }, { id: slime, weight: 2 }]
  desc: 里面盘踞着一只怪物，但你不确定是什么。
- id: stone_door
  name: 上锁的石门
  icon: 🚪
  encounter: event               # 建筑行为 `event`：门槛 + 判定 + 后果（§4.8.9）
  event:
    text: 一扇刻着古文字的石门挡住了去路。
    gate:                        # ① 门槛：没带 `撬锁` 就不给"尝试"选项
      tags: [撬锁]
      mode: all
      on_missing: blocked        # blocked = 不给选项 | penalty = 允许强行尝试但吃惩罚
    check:                       # ② 手艺：掷 2D6 + 物攻 ≥ 15（复用力值链，§4.8.9）
      dice: 2D6
      add: patk
      target: 15
    on_success:
      text: 锁芯"咔"地一声弹开了。
      point_reward: 2
      grant: [{ id: red_potion, count: 1 }]
    on_fail:
      text: 门缝里弹出一排铁针。
      cost: { hp: 3 }
      effects: [{ op: add_tag, tag: 扎伤, duration: 3, per_turn: { hp: -1 } }]
    once: false
- id: merchant
  name: 流浪商人
  icon: 🧳
  encounter: shop                # 建筑行为 `shop`：用钱换东西（§4.8.11）
  stock:                         # 上架池（与 reward_pool 同一套结构）
    source: filter
    filter: { itemKind: consumable, tags: [common] }
    pick: { algo: count, dice: 1D6, range: [2, 3] }
  price:                         # 定价：货币就是一件普通道具
    currency: gold
    algo: value                  # value = 掷骰映射到区间 | fixed = 明码标价
    dice: 1D6
    range: [5, 15]
  restock: on_enter
  desc: 他不问你要去哪，只问你有多少钱。
- id: inn
  name: 客栈
  icon: 🏠
  encounter: talk                # 第六种行为：与建筑里的 NPC 对话（§4.9）
  desc: 屋里有人在等你说点什么。
  # NPC 不写在建筑定义上——挂在地图节点：npcs: [elder] / dialog: Mod1（§4.9.3）
```

### 道路
```yaml
- id: path
  name: 小路
  icon: 🛤️
  # cost 省略 = { step: 1 }
- id: swamp
  name: 沼泽
  icon: 🟫
  cost: { step: 2 }                # 难行：走一格吃掉两步
- id: belt
  name: 传送带
  icon: ➡️
  cost: { step: 0 }                # 不耗步
- id: river
  name: 河流
  icon: 🌊
  cost: { step: 1 }
  gate: { tags: [渡河], missing: block }     # 没"渡河"能力就过不去
- id: volcano
  name: 火焰山
  icon: 🌋
  cost: { step: 1 }
  gate: { tags: [火抗], missing: penalty, penalty: { hp: 5 } }   # 强行通过也行，每格掉 5 血
```

### 职业
```yaml
# 职业给"起点"：初始属性 base_stats + 开局自由点 free_points
- id: knight
  name: 骑士
  icon: 🛡️
  base_stats: { hp: 5, mp: 0, patk: 3, matk: 0, pdef: 2, mdef: 0 }   # 初始属性
  free_points: 25                                                     # 开局自由点数（想给 300 也行）
  buffs: { hp: 110, patk: 120, pdef: 110, matk: 80 }                  # 百分比放大
  inventory_size: 50                                                  # 背包格数（省略 = 50；0 = 无限，§4.2.4）
  starting_items: [red_potion]                                        # 出生时的家当（可选）
  desc: 物理攻击较强、法术攻击较弱的近战。
  # 没有 skills —— 职业不限定你能学什么（§4.8.3）
- id: mage
  name: 法师
  icon: 🧙
  base_stats: { hp: 3, mp: 4, patk: 0, matk: 3, pdef: 0, mdef: 2 }
  free_points: 25
  buffs: { hp: 90, matk: 130, mdef: 120, patk: 80 }
  inventory_size: 30                                                  # 书多的人可携带量少
  starting_items: [blue_potion, scroll_of_fireball]                   # 出生带一本《火球术》——但它只是道具，可丢弃可出售
  desc: 生命值偏低、魔攻突出，物攻 -20%、魔攻 +30%。
  # 那个 -20% 使他的物攻先天低于基准：可以练成战士，但需更多资源投入
```

### 技能
```yaml
# 技能 = 取哪一维属性 + 攻击目标 + 附带什么（§4.8.3）
# 前两个是"保底对"：人人开局都有，cost 都是空的（免费），保证任何情况下都能施放
- id: basic_attack
  name: 普通攻击
  icon: ⚔️
  dim: patk              # 基准维度：取物攻
  target: opponent       # 攻击对手
  vs: auto               # auto → 按 dim 配对：patk 对 pdef
  bonus: 0               # 0 加成：纯粹依靠属性，技能自身不提供加值
  apply: hp              # 力值作用到对方 hp
  cost: {}               # 免费
- id: basic_magic
  name: 普通法术
  icon: ✨
  dim: matk              # ← 与普通攻击只差一维
  target: opponent
  vs: auto               # matk 对 mdef
  bonus: 0
  apply: hp
  cost: {}               # ← 也免费：没有 mp 也能放，不会因此陷入死局
- id: heal
  name: 治疗术
  icon: 💚
  dim: matk
  target: self           # ← 只改这一项：从"攻击对手"变为"治疗自身"
  vs: none               # 不对抗、不落空
  bonus: 2
  apply: hp              # 回自己 hp，量 = 力值
  cost: { mp: 3 }
- id: bless
  name: 力量祝福
  icon: 💪
  dim: patk
  target: self
  vs: none
  bonus: 0
  apply: none            # 不伤不治，纯挂状态
  cost: { mp: 2 }
  effects:
    - op: add_tag        # 3 回合内物攻 +2（进力值链 ②，§4.8.10）
      tag: 力量祝福
      duration: 3
      modifiers: { patk: 2 }
- id: weaken
  name: 虚弱诅咒
  icon: 🌀
  dim: matk
  target: opponent       # ← 同一条路：对对手挂减益
  vs: auto
  bonus: 0
  apply: none
  cost: { mp: 3 }
  effects:
    - op: add_tag
      tag: 虚弱
      duration: 3
      modifiers: { patk: -2, pdef: -1 }
- id: poison_bite
  name: 毒牙
  icon: 🐍
  dim: patk
  target: opponent
  vs: auto
  bonus: 1
  apply: hp              # 既造成伤害…
  effects:
    - op: add_tag        # …又挂中毒
      tag: 中毒
      duration: 3
      per_turn: { hp: -1 }
```

### NPC
```yaml
# NPC 只出现在建筑里：本身不铺地图格，由建筑实例（地图节点）引用（§4.9）
# 触发时机：进入建筑之后、该建筑的建筑事件之前（V2.0 追加设定，§4.9.3）
- id: elder
  name: 长老
  icon: 🧓
  tags: [村庄]
  desc: 村中的长者，对地穴的来历知道得比谁都多。
  dialogs:                              # 多套对话方案；key 即方案名（§4.9.2）
    Mod1:
      - result: 开场                     # 节点标题（编辑器用，运行时不展示）
        message: ["地穴的入口已被封了三代。", "你若执意下去，先听我一句。"]
        dice: 1D6                        # 写了 dice：本层靠掷骰命中（未命中可再掷）；不写则玩家直接点选
        items:
          - type: chat
            hit: "1-2"                   # 掷出 1~2 命中该选项
            result: "A：我想知道那扇门后面有什么。"
            message: ["门后是路，路上是选择。"]
            items: []
          - type: chat
            hit: "3-4"
            result: "B：我只是路过。"
            message: ["慢走。"]
            items: []
          - type: prop
            hit: "5-6"
            result: "C：这些药你带上。"
            items: [red_potion, red_potion, blue_potion]   # 同种写两次＝给两份；交付后本实例只回放此节点台词
    Mod2:
      - message: ["又见面了。"]
        items: []                        # 不写 dice：选项列表直接可点
```

## 规则配置
```yaml
move:                               # 移动（§4.8.4）：配置只有这一个字段
  dice: 1D6                         # 每回合掷这枚骰，点数 = 可走的格数
combat:                             # 战斗（§4.8.3）
  # 注意：没有 attacks——"攻击方式"已升级为技能组件（技能表在 `## 设定` 里）
  stat_dice: 1D6                    # 属性结算骰：怪物登场时把区间摇成具体值（一次摇定）
  pick_dice: 1D6                    # 怪物随机挑技能时掷的骰
  atk_roll:                         # 攻方力值链上的骰子（§4.8.2 第二步）
    add_dice: 1D4                   # ⑤ 叠加到力值上（可省）
    mult:                           # ⑥ 力值倍率（可省）
      dice: 1D6
      steps: [0.5, 1, 1, 1.5, 2, 3]
  def_roll:                         # 守方力值链上的骰子
    add_dice: 1D4
treasure:                           # 开箱算法（§4.8.5）
  pick:                             # 抽几件
    algo: tiers                     # tiers = 骰点落档
    dice: 1D6
    tiers: [{ upto: 2, n: 0 }, { upto: 4, n: 1 }, { upto: 6, n: 2 }]   # 1~2 → 空箱
  copies:                           # 每件几份
    algo: multiplier                # multiplier = 骰点查档 → 倍率
    dice: 1D6
    steps: [1, 1, 1, 2, 2, 3]
loot:                               # 战利品算法（§4.8.5）
  pick:   { algo: count, dice: 1D6, range: [1, 2] }
  copies: { algo: fixed, n: 1 }
state:                              # 状态上限（§4.8.10）
  max_duration: 10                  # 任何状态的 duration 都会被夹到不超过这个值
shop:                               # 商店默认定价（§4.8.11）；组件可用自己的 price 覆盖
  price: { algo: value, dice: 1D6, range: [5, 15] }
event:                              # 事件默认判定骰（§4.8.9）；难度值与后果在事件组件上（那是内容）
  dice: 2D6
class_pool: [knight, mage]          # 开局给玩家挑的出身卡片；长度 1 = 只有一种；>1 = 手选（可自愿「掷骰决定出身」）
```

## 地图
### 地下城入口
```yaml
start: [0, 0]
end: [5, 5]
nodes:
  - { x: 0, y: 0, type: start }
  - { x: 1, y: 0, type: road, ref: path }        # 道路也要 ref：不同路的 cost / gate 不同
  - { x: 2, y: 0, type: building, ref: chest_room }
  - { x: 3, y: 1, type: road, ref: swamp }
  - { x: 5, y: 5, type: end }
```
### 下层墓室
（起点自动接上一张终点 [5, 5]）
````

### 3.2 实体 ID 与引用规则
- 所有结构化实体（怪物/道具/建筑/道路/职业/技能/NPC）都有全局唯一 `id`：定义段里定义一次，地图节点用 `ref` 引用（NPC 由建筑实例的 `npcs` 引用，§4.9.3），保证同一建筑可放在多个格子而只维护一份定义。
- **id 形状决定来源**，这是全篇判断"预设还是自建"的**唯一依据**：

| 来源 | id 形状 | 例 |
|---|---|---|
| **预设**（系统自带，八大类都有） | 固定可读词 | `goblin` / `red_potion` / `chest_room` / `path` / `knight` / `basic_attack` / **`elder`** |
| **自建**（用户自己创建，八大类都能建） | 类型前缀 + 随机串 | `m_a1z2` / `i_7kf0` / `b_3kf9` / `k_4x8q` / **`n_5t2w`** |

- **不做顺序编号**——顺序编号会在删除/重排后错位、破坏地图引用。
- **"预设 / 自建"是派生信息，不存字段、不写进 `.pmod`**：拿 id 去内置预设表里查，查得到就是 `预设`，查不到就是 `自建`。
  好处是**八大类天然一视同仁**，不存在"建筑有、怪物没有"这种事。
- 显示 `name` 与 `id` 分离：`name` 可随时改名而不影响地图引用、也不影响来源判定。
- 高级用户可在编辑器里手动改 `id`（默认隐藏）；**改 id 会同时改变来源判定**（改成随机串就变成 `自建`），这是可接受的——
  id 本来就该是"身份的锚"，改锚就是换了身份。

### 3.3 `.pmod` 里装什么（自包含规则）

`.pmod` 只装**这一局真正用到**的组件：

| 组件类型 | 什么情况下被写进 `.pmod` |
|---|---|
| 消耗品 / 装备 / 怪物 / 职业 / 技能 | 在本局中被**启用** |
| 道路 / 建筑 | 被**铺到某张地图的格子上** |
| **NPC** | 被**某个建筑实例（地图节点）引用**（节点的 `npcs`，§4.9.3）——NPC **不走"启用"**（它不是道具／内容那一类） |
| 背景 / 规则配置 / 地图 | 始终 |

- 库里那些**没启用、没铺设**的组件，不进 `.pmod`——它们只是待用的工具，不是这局的内容。
- 组件定义原样带出（`id` / `name` / `icon` / `tags` / 各自属性），**没有来源标记字段**；来源由导入方按 §3.2 的 id 形状自行判定。
- **round-trip**：导出 → 导入后，启用集合、铺设节点、地图顺序、组件定义全部一致（无丢失）。


---

