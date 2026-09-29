# Phase A — BUILD（构建页，先做完整）

> **里程碑范围**：信息架构与数据模型 / 布局 / 图层 / 组件库面板 / 操作模式 / 画布 / 属性编辑（组件页·实例页·规则页）/ 各类组件编辑器 / 规则引擎纯函数 / 校验与「清单」按钮 / 预设最小清单 / 导入导出。
> **上层索引**：[`../TASK.md`](../TASK.md)　**设计依据**：[`../docs/design/02-data-model.md`](../docs/design/02-data-model.md)(§4.0) · [`../docs/design/04-editor.md`](../docs/design/04-editor.md)(§5) · [`../docs/design/05-mvp.md`](../docs/design/05-mvp.md)(§6.2) · [`../docs/design/03-engine.md`](../docs/design/03-engine.md)(§4.8 引擎纯函数)（索引见 [`../docs/DESIGN.md`](../docs/DESIGN.md)）
> **前置**：[`task/00-foundation.md`](./00-foundation.md)　**顺序约束**：A 不验收不进 B（PLAY）。
> **目标**：一个能产出合法 `.pmod` 的完整体检式编辑器。
> **2026-09-29 修订**：**NPC 与对话（第 8 类组件）**为独立里程碑 [`05-npc.md`](./05-npc.md)（Phase E），**不在本文件实现**。本文件内「七类组件 / 13 项配置 / `encounter` 五选一 / 八区组件库」等表述是 Phase A 落地时的口径，已由该里程碑增补为 **八类 / 14 项 / 六选一 / 九区**——阅读时以 [`../docs/design/04-editor.md`](../docs/design/04-editor.md) 与 [`../docs/design/02-data-model.md`](../docs/design/02-data-model.md) §4.9 为准。

---

## A0 信息架构与数据模型（§3.3 / §4.0 / §4.7）

- [x] 两层铁律落地：库（预设+自建同权）→ 内容（启用+铺设）；非地图件显式启用、地图件铺到格才算内容（§5.0）
- [x] 组件分类八区（道路/建筑/消耗品/装备/怪物/职业/技能/背景），地图件与道具/内容不混排（§5.0.1）
- [x] 起点/终点是画布内建标记，不占组件库名额（§5.0.1）
- [x] **类型全集（§4）落地**：
  - `EntityBase.tags?: string[]`（三大用途共用：filter / 通行 / 分组搜索，七大类都有）；**不加来源字段**（由 `id` 派生）
  - `RewardEntry = string | { id, weight }`；`PoolRef { source:'ids'|'filter', ids?, filter?:{itemKind?,tags?} }`
  - `RewardPick { pick:{algo:'tiers'|'count', dice, tiers?:{upto,n}[], range?}, copies:{algo:'fixed'|'value'|'multiplier', n?, dice?, range?, steps?} }`
  - `MapCost { step?, hp?, mp? }`；`Gate { tags:string[], mode?:'any'|'all', missing?:'block'|'penalty', penalty?:MapCost }`
  - `RollSet { add_dice?, mult?:{dice, steps} }`（**没有 base_dice**——属性由 `stat_dice` 在登场时摇定）
  - **第七类 `SkillDef`**（**第 8 类 NPC 见 Phase E** [`05-npc.md`](./05-npc.md)）：`{ dim:StatKey, target:'opponent'|'self', vs:StatKey|'auto'|'none', bonus:number, apply:'hp'|'mp'|'none', cost?:MapCost, roll?:RollSet, effects?:EffectOp[] }`
  - `AUTO_VS: Record<StatKey,StatKey>`：`patk→pdef` / `matk→mdef` / `pdef→patk` / `mdef→matk`
  - **删掉 `AttackDef` 与 `Rules.combat.attacks`**——攻击方式已升级为技能组件
  - `Rules { move:{dice}, combat:{stat_dice, pick_dice, atk_roll, def_roll}, treasure:RewardPick, loot:RewardPick, class_pool:string[], state:{max_duration:number}, shop:{price:PriceDef}, event:{dice:Dice} }`（**共 13 项配置，一个不多**，§4.8.6；**已由 Phase E 增补 `talk.dice` 为 14 项**，见 [`05-npc.md`](./05-npc.md)）
  - `Monster` 加 `attack_weights?` / `atk_roll?` / `def_roll?` / `stat_dice?` / `point_reward?` / `reward_pool?` / `pick?` / `copies?` / `effects?`（命中玩家时施加）
  - `Building` 加 `cost?` / `gate?` / `point_reward?` / `reward_pool?` / `monster_pool?:PoolRef` / `event?:EventBlock` / `stock?:PoolRef` / `price?:PriceDef`；`mimic` 由 `reward` 改成同一 `reward_pool` 结构
  - `Road` 加 `cost?:MapCost` / `gate?:Gate`
  - `ClassDef`：`{ base_stats:StatValues, free_points:number, buffs, tags, inventory_size?, starting_items? }`（**去掉 `stats` 区间**；无 `skills`——职业只给先天属性配置）
  - `EffectOp`（五 op）：`add_stat` / `add_tag`(duration, per_turn?, modifiers?) / `remove_tag` / `learn_skill` / `forget_skill`
  - `CheckDef { dice?, add:StatKey|'none', target:number }`；`EventBlock { text, gate?, check?, on_success, on_fail, once? }`；`PriceDef { currency:string, algo:'fixed'|'value', n?, dice?, range? }`
  - **删掉** `Monster.dice` / `Building.dice` / `Building.monster_ref` / `Road.step_cost` / `diceConfig`

## A1 布局栅格（§5.1）

- [x] 单一栅格 `.app-shell { padding: var(--gap) }`；`--gap:10px` 唯一间距 token
- [x] **删除所有面板/子组件 inline margin**（`Toolbar`/`KitPanel`/`Inspector`）
- [x] 顶栏 `nowrap`，溢出收 `⋯`；只留 项目名·撤销/重做·导入/导出
- [x] 统一 `.panel` 类（同圆角/边框/内距/min-height:0）；滚动只在内层
- [x] `≤880px`：中栏全屏 + 左右抽屉 + 模式条底部横排

## A2 图层块（左栏 ①，§5.2）

- [x] 列出全部地图：`序号·名称·N节点·状态点`；点击切换/双击重命名/上下移/删除(≥2)/`+新建`
- [x] 起终点缺失红点；可折叠；**顶栏地图 Tab 全移除**

## A3 组件库面板（左栏 ②，§5.3）

- [x] 单一列表、无 Tab；顶部筛选 `[全部][本局已用]` + 搜索
- [x] 分区可折叠 + 计数 + `+新建`；徽章：`预设/自建`（id 派生）、`已启用/未启用`、`已铺设×N`、`被引用×N`（技能也显示）
- [x] `⋯`菜单：编辑/复制成新组件/启用停用/删除（被引用先提示）/恢复默认（仅预设）
- [x] 选中分岔：地图件→可放置/连线；非地图件→只开右栏表单，**不再拖到地图**
- [x] **「标记」移出组件库**，改由模式条「标记」模式放置

## A4 操作模式（§5.4，核心）

- [x] 模式条：6 模式 + 当前提示，画布左上唯一入口；快捷键 `V B L M E S F`
- [x] 选择/放置/连线/框选/擦除/标记 行为严格按 §5.4 表；`Esc` 全局退回选择并清中间态
- [x] G1–G6 全部落地（拖空白=平移、入口唯一、提示进模式条、一步撤销、快捷键）
- [x] 框选浮动条「批量删除(N个)」=一步撤销；删除面板底部长段说明文字

## A5 画布基础（§5.5，沿用 M0）

- [x] 网格/十格粗线/`[0,0]`/坐标域/视口虚拟化；缩放锚点光标；平移只"拖空白"

## A6 属性编辑 · 组件页（§5.6，逐类编辑器）

- [x] 公共字段 + 来源徽章 + 恢复默认 + 本局状态（启用/铺设/被引用）
- [x] **道路**：`cost`(step/hp/mp) + `gate`(tags/mode/missing/penalty)；实时反查带标签的已启用组件；权限死路标黄
- [x] **建筑 `encounter` 五选一**（**已由 Phase E 增补 `talk` 为六选一**，见 [`05-npc.md`](./05-npc.md)），按选中行为只显示对应块：
  - `empty`：`cost`/`gate`/`point_reward`/`desc`
  - `treasure`：奖励池(`ids`手选/`filter`筛，可权重) + 覆盖 `pick`/`copies` + `mimic`
  - `monster`：怪物池（同结构）
  - `event`：`gate` + `check`(骰子/加值属性/目标值) + `on_success`/`on_fail`(可增删项) + `once`；**实时显示必成/必败**
  - `shop`：上架池 `stock` + 定价 `price`(货币下拉+fixed/value/掷骰)
- [x] **怪物**：6 属性区间 + `attack_weights`(已启用技能多选+权重，旁注"按 普通攻击3:毒牙1 挑") + 可选 `effects`(命中施状态) + 可选 `atk_roll`/`def_roll`/`stat_dice` 覆盖 + `point_reward` + 可选战利品池；档位对照小怪/精英
- [x] **技能**（§4.8.3，5 个控件）：`dim`/`target`/`vs`/`bonus`/`apply`/`cost`/`effects`；**说明预览**；底部「这一局里谁能学到它」反查，0 来源标黄
- [x] **职业**（§4.2.3）：`base_stats`(6 初始) + `free_points` + `buffs`% + `tags` + `inventory_size`(数字+无限勾选) + `starting_items`(多选已启用道具)；**无 `skills`**；三句说明提示
- [x] **道具**（§4.3）：kind 切换 → 装备(`slots`+`modifiers` 6 属性)/消耗品(`usable`+`effects` 五 op 混合列表)；`add_tag` 必填 `duration`(超 `state.max_duration` 夹上限)、可 `per_turn`/`modifiers`；`learn_skill` 行选已启用技能+实时说明预览（技能书）；`tags` 框旁注"给编辑器筛选用"
- [x] 技能/道具/怪物/事件四处 `effects` 共用同一控件；一行一效果 + 「＋加一条」

## A7 属性编辑 · 实例页 & 规则面板（§5.6 / §4.8.6）

> **2026-09-27 修订**：规则**不进右栏**（右栏只有组件 / 实例）—— 入口在**顶栏「规则」按钮**，打开一整页面板。
> 同时删掉「硬规则只读展示」那一段：写死的东西不该拿一整块地方自我表彰。

- [x] **实例页**：坐标/类型/引用组件名 + `[编辑该组件定义]` 跳转 + 建筑宽高 + 复制/删除节点；悬空引用标红 + 快捷修复
- [x] **规则面板**（13 项，一个不多，无 `combat.attacks`；顶栏入口，不进右栏；**已由 Phase E 增补 `talk.dice` 为 14 项**，见 [`05-npc.md`](./05-npc.md)）：
  - `move.dice`；`combat` 的 `stat_dice`/`pick_dice`/`atk_roll`/`def_roll`；`treasure`/`loot` 的 `pick`+`copies`；`state.max_duration`；`shop.price`；`event.dice`；`class_pool`
  - **每字段说明预览 + 「模拟10次」按钮**
- [x] 规则面板 `rules` 导出/导入；旧文件缺 `rules`/残留 `diceConfig` 用 `DEFAULT_RULES` 兜底并提示
- [x] 骰子输入校验：只接受 `nDf`，非法报错不静默默认

## A8 规则引擎纯函数（§4.8，PLAY 复用，须单测）

- [x] 三个积木：`rollRange` / `rollSteps` / `rollSum`；加权轮盘 `rollWeights`（技能选择+池抽取共用）
- [x] `settleStats(monster, stat_dice)`：**仅怪物**，登场摇 6 属性区间→具体值，**本场固定**（**不同遭遇各自独立摇**，见决策 2）
- [x] `playerStats(cls, alloc)`：玩家侧**不摇**，`base_stats + alloc`
- [x] 属性点账本：`remainingPoints = free_points + Σpoint_reward − Σ分配`；不可洗点、余点保留
- [x] `buildPower(...)`：返回可拆解五环明细（属性/加值环/职业%/骰叠加/骰倍率）
- [x] `capabilities(player)`：`⋃装备.tags ∪ 职业.tags ∪ 身上状态.tags`（状态 tag 算能力）
- [x] `canPass(gate, caps)`：`any`/`all`/`block`/`penalty`
- [x] `resolveVs(skill)`：`auto`→查 `AUTO_VS`
- [x] `canUseSkill(user, skill)`：查 `cost` 够不够（**决策 7：mp 由 cost 定**）
- [x] `resolveSkill(user, target, skill, rules)`（6 步）：查扣 cost→算本力值→判定分支(`self`/`vs:none` 跳过)→作用(`max(1,力值−防值)`/治=`本力值`)→**仅命中才执行 effects**；返回明细（`target:self` 时无 `foeDetail`、`hit` 恒 true）
- [x] `pickSkill(unit, rules)`（怪物侧）：`pick_dice` 按 `attack_weights` 加权轮盘；**选中 cost 不足→回退同表 cost 空技能**；**无配置→引擎内建 `basic_attack`**（决策 9）；玩家侧返回 null
- [x] `resolvePool` / `resolveReward`（件数恒被 `|池|` 夹住；不实现 `all`；池空 `[]`）
- [x] `resolveMonster(project, library, building, rules)`：**怪物池抽1只→`settleStats`摇属性**（决策 2）；池空返回 null
- [x] `resolveCheck` / `resolveEvent`（§4.8.9，门槛+手艺；必成/必败 `verdict`；`once` 降级 `empty`）
- [x] `tickStates(player)`（§4.8.10）：**每回合【开始】先判存活、再 tick**；`per_turn` 增减→`duration−1`→归零移除；**本回合新挂状态不当期 tick**（决策 6）
- [x] `applyEffects(target, effects)`（五 op）：`add_stat`/`add_tag`(夹上限)/`remove_tag`/`learn_skill`(已在栏→`alreadyLearned`不消耗)/`forget_skill`(不在栏→静默)；怪物命中另调 `applyEffects(player, monster.effects)`（独立来源）
- [x] `resolvePointReward` / `resolveShop` / `payAndTake` / `canPickUp`（§4.8.8/§4.8.11/§4.2.4）
- [x] **玩家技能栏**：默认模板 `['basic_attack','basic_magic']`（**决策 8：作者可删改，自创角色不受影响**），进 `.psave` 不进 `.pmod`
- [x] **单测边界**（全量）：单值区间/掷最大最小/`|池|<n`夹紧/权重全0/`mp`边界(恰好可施/少1不可)/`free_points:0|300`/事件必成必败/`check`省略=成功/`on_missing`两分支/状态超上限夹紧/`remove_tag`解不存在不报错/`inventory_size:0|1`(同种叠加占1格)/`price.fixed`不掷/`target:self`不判定仍掷骰/`vs:none`同/`apply:none`只挂效果/对手落空 effects 不执行/`attack_weights`空或全0→内建 basic_attack/`AUTO_VS`四维覆盖/**掷3步走3格只tick一次**/**用两件道具不tick**/本回合新挂状态下回合才 tick

## A9 校验与「清单」按钮（§5.7）

- [x] 起/终点缺失：图层红点 + 导出前 toast（不阻塞）
- [x] 建筑多格重叠：放置直接替换，计一步撤销（**多格 ＝ 一个节点带 `w` / `h`**，不是每格一个节点）
- [x] 引用完整性：悬空引用导出时自动剔除 + 提示
- [x] 技能指向失效 / 无法获得 / 自相矛盾（标黄不阻塞）
- [x] 池筛空 / 权限死路 / 事件必成必败 / 状态无上限 / 商店缺货币 / 背包容量 各 K 项
- [x] **「清单」按钮（决策 11）**：一键跑 K1~Kn 全部校验并**汇总成一张清单**（通过/标红/标黄 + 各自定位），不阻塞导出

## A10 预设最小清单（§6.1 / §6.1.1）

- [x] 道路四种演示：小路(`step:1`)/沼泽(`step:2`)/河流(`gate:[渡河]+block`)/火焰山(`gate:[火抗]+penalty hp:5`)
- [x] 能力路径：火抗鞋/小船(`patk-1`)/撬锁工具
- [x] 怪物房 `monster_pool` 装哥布林+史莱姆（非写死）；哥布林 `attack_weights:{basic_attack:3, basic_magic:1}`
- [x] 预设技能全套：`普通攻击`/`普通法术`(cost空)/`治疗术`(self)/`力量祝福`(self+apply:none+modifiers)/`虚弱诅咒`(opponent+apply:none+减益)/`盾击`/`毒牙`(伤害+挂中毒)
- [x] 五种行为闭环：上锁石门(event)/流浪商人(shop)/御火符/解毒剂/金币(`tags:[货币]`)/毒牙哥布林
- [x] 数值基线：小怪 `hp[6,12]`+`point_reward:1`；精英 `hp[24,40]`+`tags:[精英]`+`point_reward:5`；红蓝瓶 `delta:5`；铁剑 `patk+5`
- [x] 职业只给先天属性配置：骑士/法师 `base_stats`+`free_points:25`+`buffs`+`inventory_size`+`starting_items`（无 `skills`）；法师 `starting_items:[blue_potion, scroll_of_fireball]`
- [x] 预设技能书 `scroll_of_fireball`(`learn_skill: fireball`)，可进奖励池/商店/事件后果

## A11 导入 / 导出 .pmod

- [x] 导出：启用集合/铺设节点/地图顺序/组件定义/`rules` 全一致（round-trip）
- [x] 导入：定义并入库、启用/铺设还原；同名不同内容→新 id 提示
- [x] 刷新页面数据不丢失（库与项目分别持久化）

---

## A 验收（照 DESIGN §6.2 逐条勾）

- [x] 1. 四条栅格边任意宽度对齐；面板无自带 margin
- [x] 2. 左栏图层管理全部地图；顶栏无地图 Tab
- [x] 3. 每条组件可辨库身份(预设/自建)与本局状态(启用/铺设/被引用)
- [x] 3b. 七大类来源判定一致（技能也能自建，无多余字段）
- [x] 4. 6 模式行为一致；入口唯一；`Esc` 干净退回
- [x] 5. 框选批量删除只占一步撤销
- [x] 6. 奖励池 `filter` 实时命中数；无 `all`；件数夹 `|池|`
- [x] 7. 力值链五环可拆解明细；换装/挂状态/换职业/换技能即时反映
- [x] 7a. 同一技能编辑器造出五类技能不改代码；编辑器不认识"火球术"
- [x] 7b. `target:opponent` 对抗落空；`target:self` 不对抗仍掷骰
- [x] 7c. 技能不绑职业（清空 starting_items 不少技能；法师开箱学盾击；forget 能夺）
- [x] 7c2. "存在"与"谁会"两件事；技能页反查书/怪物，不显示谁会
- [x] 7c3. "法师练成战士"能跑（buffs.patk:80 永存）
- [x] 7c4. 技能书=道具，进奖励池/事件/商店任一都能学
- [x] 7d. 回合定义可验：走3格只tick一次；交锋结束tick一次；**用道具不tick**
- [x] 7e. 怪物登场摇定（同场固定，可见"物攻[2~4]→3"）；**不同遭遇各自独立摇**（决策 2）
- [x] 7f. 怪物不写死（池+权重抽，抽完摇属性；单只=单元素池）
- [x] 7g. 技能两侧不对称（怪掷骰随机、玩家自选）
- [x] 7h. 点数归职业(`free_points:300` 直接生效)；"1点=+1/不可洗点/余点保留"改不了
- [x] 7i. 战斗能加点：`point_reward` 跨场景保留
- [x] 7j. `mp` 五处贯通（分配/cost/蓝瓶/地形cost/怪物stats），无不完整的 mp 体系
- [x] 8. 消耗与权限可配；双向反查
- [x] 8b. 标签驱动不写死（造 `gate.tags:[飞行]`+装备 `[飞行]` 不改代码走通）
- [x] 8c. 权限死路可见标黄
- [x] 9. 自建与预设同库同权；改库对用到它的局立即生效
- [x] 9b. 规则面板=§4.8.6 13 项，无 `combat.attacks`；每字段说明（无硬规则只读段）（**Phase E 后为 14 项**）
- [x] 10. `.pmod` 导出→导入全一致
- [x] 11. 刷新不丢数据
- [x] 11b. 事件跑通（gate+check+on_success/fail+once）；必成/必败实时提示
- [x] 11c. 状态闭环（中毒→每回合掉血→解毒剂解→到点消失；超上限夹；无永久状态）
- [x] 11d. 临时通行（御火符火抗3回合过火焰山）
- [x] 11e. 商店跑通；货币只是一件道具
- [x] 11f. 背包上限（`inventory_size:1` 第二件不同道具被拒；同种占1格；0=无限）
- [x] 11g. 五种行为面板分明（切换 encounter 只显对应块）（**Phase E 后为六种**）
- [x] 11h. 跑团立场可验：编辑器无"难度评估/多结局/条件通关"入口
- [x] **12. 「清单」按钮一键汇总 K1~Kn，一眼看全图健康度**（决策 11）

> **A 阶段完成判据**：以上 1–12 全勾 + `npm run build` 通过(tsc 无错) + 本地 `npm run dev` 手测走一遍；导出的 `.pmod` 能被 Phase B 加载开玩。完成后进入 [`task/02-play.md`](./02-play.md)。

---

## 进度同步（2026-09-27 · Phase A 首轮实现）

**代码从零重写**（旧实现已删除）。目录：`src/{types,engine,presets,lib,store,io,check,build,play,ui,app,styles}`。

| 模块 | 落点 |
|---|---|
| 类型全集 / 默认规则 | `src/types/*`（`DEFAULT_RULES` = §4.8.6 的 13 项；**Phase E 增补 `talk.dice` 后为 14 项**） |
| 引擎纯函数 | `src/engine/{dice,units,state,skill,pool,event,item}.ts`（**全是纯函数，UI 只调用**） |
| 内置预设 | `src/presets/*`（七大类 + 背景，`PRESET_INDEX` 供 id 派生来源） |
| store 分层 | `src/store/{library,project,ui,history,commit,storage}.ts`（库 / 项目 / 界面态分开，各自持久化） |
| `.pmod` 读写 | `src/io/{pmod,download}.ts`（自包含闭包、旧档 rules 兜底、round-trip 单测） |
| 校验 K1~Kn | `src/check/validate.ts` + `src/build/Checklist.tsx`（清单按钮） |
| 构建页 | `src/build/*`（TopBar / LayerPanel / KitPanel / ModeBar / Canvas / Inspector + 各分类编辑器） |

**已验证（`npm run build` + `npx vitest run`，78 项全绿）**：
- 引擎边界：单值区间 / 掷最大最小 / `|池|<n` 夹紧 / 权重全 0 / mp 恰好够 vs 少 1 / `free_points` 0 与 300 / 事件必成必败 / `check` 省略=必成 / `on_missing` 两分支 / 状态超上限夹 / `remove_tag` 解不存在的 / `inventory_size` 0 与 1 / `price.fixed` 不掷骰 / `target:self` 不对抗仍掷骰 / `apply:none` 只挂效果 / 落空 effects 不执行 / `attack_weights` 空与全 0 → 内建 `basic_attack` / AUTO_VS 四维 / 用道具不 tick / 本回合新挂状态下回合才 tick
- `.pmod` round-trip：地图顺序 / 节点 / 起终点 / 规则 / 组件定义一致，旧档缺 rules 与残留 `diceConfig` 有兜底提示
- 构建页冒烟：三栏 + 八区组件库（**Phase E 后为九区**）+ 六模式 + 清单弹层 + Esc 退回

**需要留意的三条（不阻塞，但别当成已做完）**：
1. **7d / 7e / 11c / 11d / 11e / 11f** 的“玩法流程验证”在引擎层已就绪（`tickStates` 每回合一次、`resolveMonster` 抽完才摇属性、背包/商店/状态都有单测），**但真正在游玩页里跑起来是 Phase B**（加点界面、掷骰公示、移动回合）。
2. **7j `mp` 五处贯通**：分配点数的界面属于游玩页（§7.1），数据链路（分配 / cost / 蓝瓶 / 地形 cost / 怪物 stats.mp）已通。
3. **本地 `npm run dev` 手测**：本轮没有浏览器可跑，用 jsdom 冒烟用例替代 —— 建议开工 Phase B 前人工点一遍。

**部署形态**：GitHub Pages 纯静态 —— `base: './'`（不耦合仓库名）+ **hash 路由**（`#/build`，无深链 404）+ 官方 Actions 工作流（`.github/workflows/deploy.yml`）。

**2026-09-29 · Phase E（NPC 与对话）改口径登记**
- 新增独立里程碑 [`05-npc.md`](./05-npc.md)：**第 8 类组件 NPC**、组件库 **八区 → 九区**、规则面板 **13 项 → 14 项**（新增 `talk.dice`）、建筑行为 **五选一 → 六选一**（新增 `talk`）。
- 本文件内相关条目已就地标注「Phase E 后为 …」；**Phase A 的验收结论不变**（该轮按当时的七类 / 13 项 / 五选一 口径通过），新口径在 E 里程碑内实现与验收。
