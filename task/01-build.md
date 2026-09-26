# Phase A — BUILD（构建页，先做完整）

> **里程碑范围**：信息架构与数据模型 / 布局 / 图层 / 组件库面板 / 操作模式 / 画布 / 属性编辑（组件页·实例页·规则页）/ 各类组件编辑器 / 规则引擎纯函数 / 校验与「清单」按钮 / 预设最小清单 / 导入导出。
> **上层索引**：[`../task.md`](../task.md)　**设计依据**：[`../docs/DESIGN.md`](../docs/DESIGN.md) §4.0 / §5 全部 / §6.2 验收 / §4.8 引擎纯函数
> **前置**：[`task/00-foundation.md`](./00-foundation.md)　**顺序约束**：A 不验收不进 B（PLAY）。
> **目标**：一个能产出合法 `.pmod` 的完整体检式编辑器。

---

## A0 信息架构与数据模型（§3.3 / §4.0 / §4.7）

- [ ] 两层铁律落地：库（预设+自建同权）→ 内容（启用+铺设）；非地图件显式启用、地图件铺到格才算内容（§5.0）
- [ ] 组件分类八区（道路/建筑/消耗品/装备/怪物/职业/技能/背景），地图件与道具/内容不混排（§5.0.1）
- [ ] 起点/终点是画布内建标记，不占组件库名额（§5.0.1）
- [ ] **类型全集（§4）落地**：
  - `EntityBase.tags?: string[]`（三大用途共用：filter / 通行 / 分组搜索，七大类都有）；**不加来源字段**（由 `id` 派生）
  - `RewardEntry = string | { id, weight }`；`PoolRef { source:'ids'|'filter', ids?, filter?:{itemKind?,tags?} }`
  - `RewardPick { pick:{algo:'tiers'|'count', dice, tiers?:{upto,n}[], range?}, copies:{algo:'fixed'|'value'|'multiplier', n?, dice?, range?, steps?} }`
  - `MapCost { step?, hp?, mp? }`；`Gate { tags:string[], mode?:'any'|'all', missing?:'block'|'penalty', penalty?:MapCost }`
  - `RollSet { add_dice?, mult?:{dice, steps} }`（**没有 base_dice**——属性由 `stat_dice` 在登场时摇定）
  - **第七类 `SkillDef`**：`{ dim:StatKey, target:'opponent'|'self', vs:StatKey|'auto'|'none', bonus:number, apply:'hp'|'mp'|'none', cost?:MapCost, roll?:RollSet, effects?:EffectOp[] }`
  - `AUTO_VS: Record<StatKey,StatKey>`：`patk→pdef` / `matk→mdef` / `pdef→patk` / `mdef→matk`
  - **删掉 `AttackDef` 与 `Rules.combat.attacks`**——攻击方式已升级为技能组件
  - `Rules { move:{dice}, combat:{stat_dice, pick_dice, atk_roll, def_roll}, treasure:RewardPick, loot:RewardPick, class_pool:string[], state:{max_duration:number}, shop:{price:PriceDef}, event:{dice:Dice} }`（**共 13 项配置，一个不多**，§4.8.6）
  - `Monster` 加 `attack_weights?` / `atk_roll?` / `def_roll?` / `stat_dice?` / `point_reward?` / `reward_pool?` / `pick?` / `copies?` / `effects?`（命中玩家时施加）
  - `Building` 加 `cost?` / `gate?` / `point_reward?` / `reward_pool?` / `monster_pool?:PoolRef` / `event?:EventBlock` / `stock?:PoolRef` / `price?:PriceDef`；`mimic` 由 `reward` 改成同一 `reward_pool` 结构
  - `Road` 加 `cost?:MapCost` / `gate?:Gate`
  - `ClassDef`：`{ base_stats:StatValues, free_points:number, buffs, tags, inventory_size?, starting_items? }`（**去掉 `stats` 区间**；无 `skills`——职业只给先天牌面）
  - `EffectOp`（五 op）：`add_stat` / `add_tag`(duration, per_turn?, modifiers?) / `remove_tag` / `learn_skill` / `forget_skill`
  - `CheckDef { dice?, add:StatKey|'none', target:number }`；`EventBlock { text, gate?, check?, on_success, on_fail, once? }`；`PriceDef { currency:string, algo:'fixed'|'value', n?, dice?, range? }`
  - **删掉** `Monster.dice` / `Building.dice` / `Building.monster_ref` / `Road.step_cost` / `diceConfig`

## A1 布局栅格（§5.1）

- [ ] 单一栅格 `.app-shell { padding: var(--gap) }`；`--gap:10px` 唯一间距 token
- [ ] **删除所有面板/子组件 inline margin**（`Toolbar`/`KitPanel`/`Inspector`）
- [ ] 顶栏 `nowrap`，溢出收 `⋯`；只留 项目名·撤销/重做·导入/导出
- [ ] 统一 `.panel` 类（同圆角/边框/内距/min-height:0）；滚动只在内层
- [ ] `≤880px`：中栏全屏 + 左右抽屉 + 模式条底部横排

## A2 图层块（左栏 ①，§5.2）

- [ ] 列出全部地图：`序号·名称·N节点·状态点`；点击切换/双击重命名/上下移/删除(≥2)/`+新建`
- [ ] 起终点缺失红点；可折叠；**顶栏地图 Tab 全移除**

## A3 组件库面板（左栏 ②，§5.3）

- [ ] 单一列表、无 Tab；顶部筛选 `[全部][本局已用]` + 搜索
- [ ] 分区可折叠 + 计数 + `+新建`；徽章：`预设/自建`（id 派生）、`已启用/未启用`、`已铺设×N`、`被引用×N`（技能也显示）
- [ ] `⋯`菜单：编辑/复制成新组件/启用停用/删除（被引用先提示）/恢复默认（仅预设）
- [ ] 选中分岔：地图件→可放置/连线；非地图件→只开右栏表单，**不再拖到地图**
- [ ] **「标记」移出组件库**，改由模式条「标记」模式放置

## A4 操作模式（§5.4，核心）

- [ ] 模式条：6 模式 + 当前提示，画布左上唯一入口；快捷键 `V B L M E S F`
- [ ] 选择/放置/连线/框选/擦除/标记 行为严格按 §5.4 表；`Esc` 全局退回选择并清中间态
- [ ] G1–G6 全部落地（拖空白=平移、入口唯一、提示进模式条、一步撤销、快捷键）
- [ ] 框选浮动条「批量删除(N个)」=一步撤销；删除面板底部长段说明文字

## A5 画布基础（§5.5，沿用 M0）

- [ ] 网格/十格粗线/`[0,0]`/坐标域/视口虚拟化；缩放锚点光标；平移只"拖空白"

## A6 属性编辑 · 组件页（§5.6，逐类编辑器）

- [ ] 公共字段 + 来源徽章 + 恢复默认 + 本局状态（启用/铺设/被引用）
- [ ] **道路**：`cost`(step/hp/mp) + `gate`(tags/mode/missing/penalty)；实时反查带标签的已启用组件；权限死路标黄
- [ ] **建筑 `encounter` 五选一**，按选中行为只显示对应块：
  - `empty`：`cost`/`gate`/`point_reward`/`desc`
  - `treasure`：奖励池(`ids`手选/`filter`筛，可权重) + 覆盖 `pick`/`copies` + `mimic`
  - `monster`：怪物池（同结构）
  - `event`：`gate` + `check`(骰子/加值属性/目标值) + `on_success`/`on_fail`(可增删项) + `once`；**实时显示必成/必败**
  - `shop`：上架池 `stock` + 定价 `price`(货币下拉+fixed/value/掷骰)
- [ ] **怪物**：6 属性区间 + `attack_weights`(已启用技能多选+权重，旁注"按 普通攻击3:毒牙1 挑") + 可选 `effects`(命中施状态) + 可选 `atk_roll`/`def_roll`/`stat_dice` 覆盖 + `point_reward` + 可选战利品池；档位对照小怪/精英
- [ ] **技能**（§4.8.3，5 个控件）：`dim`/`target`/`vs`/`bonus`/`apply`/`cost`/`effects`；**人话预览**；底部「这一局里谁能学到它」反查，0 来源标黄
- [ ] **职业**（§4.2.3）：`base_stats`(6 初始) + `free_points` + `buffs`% + `tags` + `inventory_size`(数字+无限勾选) + `starting_items`(多选已启用道具)；**无 `skills`**；三句人话提示
- [ ] **道具**（§4.3）：kind 切换 → 装备(`slots`+`modifiers` 6 属性)/消耗品(`usable`+`effects` 五 op 混合列表)；`add_tag` 必填 `duration`(超 `state.max_duration` 夹上限)、可 `per_turn`/`modifiers`；`learn_skill` 行选已启用技能+实时人话预览（技能书）；`tags` 框旁注"给编辑器筛选用"
- [ ] 技能/道具/怪物/事件四处 `effects` 共用同一控件；一行一效果 + 「＋加一条」

## A7 属性编辑 · 实例页 & 规则页（§5.6 / §4.8.6）

- [ ] **实例页**：坐标/类型/引用组件名 + `[编辑该组件定义]` 跳转 + 建筑宽高 + 复制/删除节点；悬空引用标红 + 快捷修复
- [ ] **规则页**（13 项，一个不多，无 `combat.attacks`）：
  - 硬规则**只读展示**（§4.8.0，标"不可配置"）
  - `move.dice`；`combat` 的 `stat_dice`/`pick_dice`/`atk_roll`/`def_roll`；`treasure`/`loot` 的 `pick`+`copies`；`state.max_duration`；`shop.price`；`event.dice`；`class_pool`
  - **每字段人话预览 + 「模拟10次」按钮**
- [ ] 规则页 `rules` 导出/导入；旧文件缺 `rules`/残留 `diceConfig` 用 `DEFAULT_RULES` 兜底并提示
- [ ] 骰子输入校验：只接受 `nDf`，非法报错不静默默认

## A8 规则引擎纯函数（§4.8，PLAY 复用，须单测）

- [ ] 三个积木：`rollRange` / `rollSteps` / `rollSum`；加权轮盘 `rollWeights`（技能选择+池抽取共用）
- [ ] `settleStats(monster, stat_dice)`：**仅怪物**，登场摇 6 属性区间→具体值，**本场固定**（**不同遭遇各自独立摇**，见决策 2）
- [ ] `playerStats(cls, alloc)`：玩家侧**不摇**，`base_stats + alloc`
- [ ] 属性点账本：`remainingPoints = free_points + Σpoint_reward − Σ分配`；不可洗点、余点保留
- [ ] `buildPower(...)`：返回可拆解五环明细（属性/加值环/职业%/骰叠加/骰倍率）
- [ ] `capabilities(player)`：`⋃装备.tags ∪ 职业.tags ∪ 身上状态.tags`（状态 tag 算能力）
- [ ] `canPass(gate, caps)`：`any`/`all`/`block`/`penalty`
- [ ] `resolveVs(skill)`：`auto`→查 `AUTO_VS`
- [ ] `canUseSkill(user, skill)`：查 `cost` 够不够（**决策 7：mp 由 cost 定**）
- [ ] `resolveSkill(user, target, skill, rules)`（6 步）：查扣 cost→算本力值→判定分支(`self`/`vs:none` 跳过)→作用(`max(1,力值−防值)`/治=`本力值`)→**仅命中才执行 effects**；返回明细（`target:self` 时无 `foeDetail`、`hit` 恒 true）
- [ ] `pickSkill(unit, rules)`（怪物侧）：`pick_dice` 按 `attack_weights` 加权轮盘；**选中 cost 不足→回退同表 cost 空技能**；**无配置→引擎内建 `basic_attack`**（决策 9）；玩家侧返回 null
- [ ] `resolvePool` / `resolveReward`（件数恒被 `|池|` 夹住；不实现 `all`；池空 `[]`）
- [ ] `resolveMonster(project, library, building, rules)`：**怪物池抽1只→`settleStats`摇属性**（决策 2）；池空返回 null
- [ ] `resolveCheck` / `resolveEvent`（§4.8.9，门槛+手艺；必成/必败 `verdict`；`once` 降级 `empty`）
- [ ] `tickStates(player)`（§4.8.10）：**每回合【开始】先判存活、再 tick**；`per_turn` 增减→`duration−1`→归零移除；**本回合新挂状态不当期 tick**（决策 6）
- [ ] `applyEffects(target, effects)`（五 op）：`add_stat`/`add_tag`(夹上限)/`remove_tag`/`learn_skill`(已在栏→`alreadyLearned`不消耗)/`forget_skill`(不在栏→静默)；怪物命中另调 `applyEffects(player, monster.effects)`（独立来源）
- [ ] `resolvePointReward` / `resolveShop` / `payAndTake` / `canPickUp`（§4.8.8/§4.8.11/§4.2.4）
- [ ] **玩家技能栏**：默认模板 `['basic_attack','basic_magic']`（**决策 8：作者可删改，自创角色不受影响**），进 `.psave` 不进 `.pmod`
- [ ] **单测边界**（全量）：单值区间/掷最大最小/`|池|<n`夹紧/权重全0/`mp`边界(恰好可施/少1不可)/`free_points:0|300`/事件必成必败/`check`省略=成功/`on_missing`两分支/状态超上限夹紧/`remove_tag`解不存在不报错/`inventory_size:0|1`(同种叠加占1格)/`price.fixed`不掷/`target:self`不判定仍掷骰/`vs:none`同/`apply:none`只挂效果/对手落空 effects 不执行/`attack_weights`空或全0→内建 basic_attack/`AUTO_VS`四维覆盖/**掷3步走3格只tick一次**/**用两件道具不tick**/本回合新挂状态下回合才 tick

## A9 校验与「清单」按钮（§5.7）

- [ ] 起/终点缺失：图层红点 + 导出前 toast（不阻塞）
- [ ] 建筑多格重叠：放置直接替换，计一步撤销
- [ ] 引用完整性：悬空引用导出时自动剔除 + 提示
- [ ] 技能指向失效 / 无法获得 / 自相矛盾（标黄不阻塞）
- [ ] 池筛空 / 权限死路 / 事件必成必败 / 状态无上限 / 商店缺货币 / 背包容量 各 K 项
- [ ] **「清单」按钮（决策 11）**：一键跑 K1~Kn 全部校验并**汇总成一张清单**（通过/标红/标黄 + 各自定位），不阻塞导出

## A10 预设最小清单（§6.1 / §6.1.1）

- [ ] 道路四种演示：小路(`step:1`)/沼泽(`step:2`)/河流(`gate:[渡河]+block`)/火焰山(`gate:[火抗]+penalty hp:5`)
- [ ] 能力路径：火抗鞋/小船(`patk-1`)/撬锁工具
- [ ] 怪物房 `monster_pool` 装哥布林+史莱姆（非写死）；哥布林 `attack_weights:{basic_attack:3, basic_magic:1}`
- [ ] 预设技能全套：`普通攻击`/`普通法术`(cost空)/`治疗术`(self)/`力量祝福`(self+apply:none+modifiers)/`虚弱诅咒`(opponent+apply:none+减益)/`盾击`/`毒牙`(伤害+挂中毒)
- [ ] 五种行为闭环：上锁石门(event)/流浪商人(shop)/御火符/解毒剂/金币(`tags:[货币]`)/毒牙哥布林
- [ ] 数值基线：小怪 `hp[6,12]`+`point_reward:1`；精英 `hp[24,40]`+`tags:[精英]`+`point_reward:5`；红蓝瓶 `delta:5`；铁剑 `patk+5`
- [ ] 职业只给先天牌面：骑士/法师 `base_stats`+`free_points:25`+`buffs`+`inventory_size`+`starting_items`（无 `skills`）；法师 `starting_items:[blue_potion, scroll_of_fireball]`
- [ ] 预设技能书 `scroll_of_fireball`(`learn_skill: fireball`)，可进奖励池/商店/事件后果

## A11 导入 / 导出 .pmod

- [ ] 导出：启用集合/铺设节点/地图顺序/组件定义/`rules` 全一致（round-trip）
- [ ] 导入：定义并入库、启用/铺设还原；同名不同内容→新 id 提示
- [ ] 刷新页面数据不丢失（库与项目分别持久化）

---

## A 验收（照 DESIGN §6.2 逐条勾）

- [ ] 1. 四条栅格边任意宽度对齐；面板无自带 margin
- [ ] 2. 左栏图层管理全部地图；顶栏无地图 Tab
- [ ] 3. 每条组件可辨库身份(预设/自建)与本局状态(启用/铺设/被引用)
- [ ] 3b. 七大类来源判定一致（技能也能自建，无多余字段）
- [ ] 4. 6 模式行为一致；入口唯一；`Esc` 干净退回
- [ ] 5. 框选批量删除只占一步撤销
- [ ] 6. 奖励池 `filter` 实时命中数；无 `all`；件数夹 `|池|`
- [ ] 7. 力值链五环可拆解明细；换装/挂状态/换职业/换技能即时反映
- [ ] 7a. 同一技能编辑器造出五类技能不改代码；编辑器不认识"火球术"
- [ ] 7b. `target:opponent` 对抗落空；`target:self` 不对抗仍掷骰
- [ ] 7c. 技能不绑职业（清空 starting_items 不少技能；法师开箱学盾击；forget 能夺）
- [ ] 7c2. "存在"与"谁会"两件事；技能页反查书/怪物，不显示谁会
- [ ] 7c3. "法师练成战士"能跑（buffs.patk:80 永存）
- [ ] 7c4. 技能书=道具，进奖励池/事件/商店任一都能学
- [ ] 7d. 回合定义可验：走3格只tick一次；交锋结束tick一次；**用道具不tick**
- [ ] 7e. 怪物登场摇定（同场固定，可见"物攻[2~4]→3"）；**不同遭遇各自独立摇**（决策 2）
- [ ] 7f. 怪物不写死（池+权重抽，抽完摇属性；单只=单元素池）
- [ ] 7g. 技能两侧不对称（怪掷骰随机、玩家自选）
- [ ] 7h. 点数归职业(`free_points:300` 直接生效)；"1点=+1/不可洗点/余点保留"改不了
- [ ] 7i. 战斗能加点：`point_reward` 跨场景保留
- [ ] 7j. `mp` 五处贯通（分配/cost/蓝瓶/地形cost/怪物stats），无半套
- [ ] 8. 消耗与权限可配；双向反查
- [ ] 8b. 标签驱动不写死（造 `gate.tags:[飞行]`+装备 `[飞行]` 不改代码走通）
- [ ] 8c. 权限死路可见标黄
- [ ] 9. 自建与预设同库同权；改库对用到它的局立即生效
- [ ] 9b. 规则页=§4.8.6 13 项，无 `combat.attacks`；硬规则只读；每字段人话
- [ ] 10. `.pmod` 导出→导入全一致
- [ ] 11. 刷新不丢数据
- [ ] 11b. 事件跑通（gate+check+on_success/fail+once）；必成/必败实时提示
- [ ] 11c. 状态闭环（中毒→每回合掉血→解毒剂解→到点消失；超上限夹；无永久状态）
- [ ] 11d. 临时通行（御火符火抗3回合过火焰山）
- [ ] 11e. 商店跑通；货币只是一件道具
- [ ] 11f. 背包上限（`inventory_size:1` 第二件不同道具被拒；同种占1格；0=无限）
- [ ] 11g. 五种行为面板分明（切换 encounter 只显对应块）
- [ ] 11h. 跑团立场可验：编辑器无"难度评估/多结局/条件通关"入口
- [ ] **12. 「清单」按钮一键汇总 K1~Kn，一眼看全图健康度**（决策 11）

> **A 阶段完成判据**：以上 1–12 全勾 + `npm run build` 通过(tsc 无错) + 本地 `npm run dev` 手测走一遍；导出的 `.pmod` 能被 Phase B 加载开玩。完成后进入 [`task/02-play.md`](./02-play.md)。
