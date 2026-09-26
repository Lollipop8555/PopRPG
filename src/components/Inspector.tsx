import { useStore, findEntity } from '../store';
import {
  Entity,
  Monster,
  ClassDef,
  Item,
  Building,
  Project,
  StatKey,
  STAT_KEYS,
  STAT_LABELS,
  SLOTS,
  SLOT_LABELS,
  ItemKind,
  Encounter,
  EffectTarget,
  Stats,
} from '../types';
import { zeroMods } from '../utils';

const LABELS: Record<Entity['kind'], string> = {
  monster: '怪物',
  item: '道具',
  building: '建筑',
  road: '道路',
  class: '职业',
};

// 解析 "2D6" → { count: 2, faces: 6 }；非法/空则回退 1D6
function parseDice(s: string): { count: number; faces: number } {
  const m = /^(\d*)\s*[dD]\s*(\d+)$/.exec((s || '').trim());
  if (m) return { count: m[1] ? Number(m[1]) : 1, faces: Number(m[2]) };
  return { count: 1, faces: 6 };
}

const clampInt = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

// 骰子：数量 × 面数（纯数字输入，无法输入非数字）
function DiceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { count, faces } = parseDice(value);
  const apply = (c: number, f: number) => onChange(`${c}D${f}`);
  return (
    <div className="field">
      <label>{label}（数量 × 面数）</label>
      <div className="range-row" style={{ alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => apply(clampInt(e.target.value, 1, 100, count), faces)}
          style={{ width: 70 }}
        />
        <span>颗 ×</span>
        <input
          type="number"
          min={2}
          max={1000}
          value={faces}
          onChange={(e) => apply(count, clampInt(e.target.value, 2, 1000, faces))}
          style={{ width: 80 }}
        />
        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>面 ＝ {count}D{faces}</span>
      </div>
    </div>
  );
}

export default function Inspector() {
  const rightTab = useStore((s) => s.ui.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);

  return (
    <div className="panel hand-border" style={{ margin: '0 8px 8px 0' }}>
      <div className="insp-tabs">
        <button
          className={rightTab === 'template' ? 'on' : ''}
          onClick={() => setRightTab('template')}
        >
          组件模板
        </button>
        <button
          className={rightTab === 'instance' ? 'on' : ''}
          onClick={() => setRightTab('instance')}
        >
          当前组件
        </button>
      </div>
      {rightTab === 'template' ? <TemplatePane /> : <InstancePane />}
    </div>
  );
}

// 组件模板（定义）编辑
function TemplatePane() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const updateEntity = useStore((s) => s.updateEntity);
  const removeEntity = useStore((s) => s.removeEntity);
  const duplicateEntity = useStore((s) => s.duplicateEntity);
  const setBackground = useStore((s) => s.setBackground);

  if (ui.selectedEntityId === '__bg__') {
    return (
      <>
        <h3>背景设定</h3>
        <div className="field">
          <label>世界观 / 故事背景（纯文本，游玩时直接展示）</label>
          <textarea
            value={project.background}
            onChange={(e) => setBackground(e.target.value)}
          />
        </div>
      </>
    );
  }

  const ent = ui.selectedEntityId ? findEntity(project, ui.selectedEntityId) : undefined;
  if (ent) {
    return (
      <EntityEditor
        key={ent.id}
        ent={ent}
        project={project}
        update={updateEntity}
        remove={removeEntity}
        duplicate={duplicateEntity}
      />
    );
  }

  return (
    <>
      <h3>组件模板</h3>
      <p style={{ color: 'var(--ink-soft)' }}>
        在左侧套件选择一个组件模板进行编辑（名称、图标、属性、遭遇等）。
      </p>
      <p style={{ color: 'var(--ink-soft)' }}>
        选中「建筑 / 道路」后，点地图即可连续放置（铺路很方便）；再点一次该组件、点"结束"按钮或按 Esc 可取消选中。
      </p>
    </>
  );
}

// 当前组件（画布上的实例节点）编辑
function InstancePane() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const eraseNode = useStore((s) => s.eraseNode);
  const selectNode = useStore((s) => s.selectNode);
  const selectEntity = useStore((s) => s.selectEntity);
  const updateNode = useStore((s) => s.updateNode);
  const duplicateNode = useStore((s) => s.duplicateNode);
  const setRightTab = useStore((s) => s.setRightTab);

  if (!ui.selectedNode) {
    return (
      <>
        <h3>当前组件</h3>
        <p style={{ color: 'var(--ink-soft)' }}>
          在地图上点选一个已放置的组件，可在此编辑它的位置 / 尺寸。
        </p>
        <p style={{ color: 'var(--ink-soft)' }}>
          放置方法：选中左侧模板后点地图即可连续放置（铺路很方便）；再点一次该组件、点"结束"或按 Esc 取消。
          起点 / 终点用左侧「标记」组件放置（每图各一个，放完自动退出）。
          选中后可拖动移动、拖四角缩放（建筑）；顶部「擦除」可清除已部署节点。
        </p>
      </>
    );
  }

  const [x, y] = ui.selectedNode.split(',').map(Number);
  const node = project.maps
    .find((m) => m.id === ui.selectedMapId)
    ?.nodes.find((n) => n.x === x && n.y === y);
  if (!node) return null;

  let info: string;
  if (node.type === 'building') {
    const b = project.buildings.find((b) => b.id === node.ref);
    info = b ? `建筑：${b.name}` : '建筑';
  } else if (node.type === 'road') {
    info = '道路';
  } else if (node.type === 'start') {
    info = '起点';
  } else if (node.type === 'end') {
    info = '终点';
  } else {
    info = node.type;
  }

  return (
    <>
      <h3>当前组件</h3>
      <p>坐标 [{x}, {y}]</p>
      <p>类型：{info}</p>
      <p style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
        快捷键：方向键微调 · Ctrl/Cmd+D 复制 · Delete 删除
      </p>
      {node.type === 'building' && node.ref && (
        <button
          className="hp-btn"
          style={{ marginBottom: 8, borderColor: 'var(--ink)', color: 'var(--ink)' }}
          onClick={() => {
            selectEntity(node.ref!);
            setRightTab('template');
          }}
        >
          编辑该建筑定义
        </button>
      )}
      {node.type === 'building' && (
        <div className="range-row">
          <div className="field" style={{ flex: 1 }}>
            <label>宽（格）</label>
            <input
              type="number"
              min={1}
              max={50}
              value={node.w ?? 1}
              onChange={(e) =>
                updateNode(x, y, {
                  w: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>高（格）</label>
            <input
              type="number"
              min={1}
              max={50}
              value={node.h ?? 1}
              onChange={(e) =>
                updateNode(x, y, {
                  h: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
        </div>
      )}
      {node.type !== 'start' && node.type !== 'end' && (
        <button
          className="hp-btn"
          style={{ marginTop: 8, marginRight: 8 }}
          onClick={() => duplicateNode(x, y)}
          title="复制到旁边的空位（Ctrl/Cmd+D）"
        >
          复制该节点
        </button>
      )}
      <button
        className="hp-btn"
        style={{ marginTop: 8, borderColor: 'var(--accent)', color: 'var(--accent)' }}
        onClick={() => {
          eraseNode(x, y);
          selectNode(null);
        }}
      >
        删除该节点
      </button>
    </>
  );
}

function EntityEditor({
  ent,
  project,
  update,
  remove,
  duplicate,
}: {
  ent: Entity;
  project: Project;
  update: (id: string, patch: any) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
}) {
  const set = (patch: any) => update(ent.id, patch);
  const setTool = useStore((s) => s.setTool);
  return (
    <>
      <h3>{LABELS[ent.kind]} 编辑</h3>
      <div className="field">
        <label>名称</label>
        <input value={ent.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>图标（Emoji 或文字）</label>
        <input value={ent.icon} onChange={(e) => set({ icon: e.target.value })} />
      </div>
      <div className="field">
        <label>描述</label>
        <textarea value={ent.desc || ''} onChange={(e) => set({ desc: e.target.value })} />
      </div>

      {ent.kind === 'monster' && <MonsterForm ent={ent} set={set} />}
      {ent.kind === 'class' && <ClassForm ent={ent} set={set} />}
      {ent.kind === 'item' && <ItemForm ent={ent} project={project} set={set} />}
      {ent.kind === 'building' && <BuildingForm ent={ent} project={project} set={set} />}
      {ent.kind === 'road' && (
        <>
          <p style={{ color: 'var(--ink-soft)' }}>道路仅作可走节点，无需额外属性。</p>
          <button
            className="hp-btn"
            style={{ borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }}
            onClick={() => setTool('line')}
          >
            ✏️ 铺设（画线）
          </button>
          <p style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
            进入铺路：在图上<b>点起点 → 点终点</b>，自动铺满这条线（对角自动拐角），铺的还是当前这条道路。
            点顶部「选择/放置」或其它工具即退出。
          </p>
        </>
      )}

      <button
        className="hp-btn"
        style={{ marginTop: 10, marginRight: 8 }}
        onClick={() => duplicate(ent.id)}
      >
        复制此{LABELS[ent.kind]}
      </button>
      <button
        className="hp-btn"
        style={{ marginTop: 10, borderColor: 'var(--accent)', color: 'var(--accent)' }}
        onClick={() => remove(ent.id)}
      >
        删除此{LABELS[ent.kind]}
      </button>
    </>
  );
}

function StatRanges({
  stats,
  onChange,
}: {
  stats: Stats;
  onChange: (s: Stats) => void;
}) {
  return (
    <>
      {STAT_KEYS.map((k) => (
        <div className="field" key={k}>
          <label>
            {STAT_LABELS[k]}（范围 min ~ max）
          </label>
          <div className="range-row">
            <input
              type="number"
              style={{ width: 70 }}
              value={stats[k][0]}
              onChange={(e) =>
                onChange({ ...stats, [k]: [Number(e.target.value) || 0, stats[k][1]] })
              }
            />
            <span>~</span>
            <input
              type="number"
              style={{ width: 70 }}
              value={stats[k][1]}
              onChange={(e) =>
                onChange({ ...stats, [k]: [stats[k][0], Number(e.target.value) || 0] })
              }
            />
          </div>
        </div>
      ))}
    </>
  );
}

function MonsterForm({ ent, set }: { ent: Monster; set: (p: any) => void }) {
  return (
    <>
      <h4>五维</h4>
      <StatRanges stats={ent.stats} onChange={(stats) => set({ stats })} />
      <DiceField
        label="战斗结算掷骰"
        value={ent.dice}
        onChange={(dice) => set({ dice })}
      />
      <p style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
        与这只怪物战斗时掷的骰子（游玩态使用）。
      </p>
    </>
  );
}

function ClassForm({ ent, set }: { ent: ClassDef; set: (p: any) => void }) {
  const buffs = ent.buffs || {};
  return (
    <>
      <h4>基础五维</h4>
      <StatRanges stats={ent.stats} onChange={(stats) => set({ stats })} />
      <h4>职业 Buff（百分比，100=无变化）</h4>
      {STAT_KEYS.map((k) => (
        <div className="field" key={k}>
          <label>{STAT_LABELS[k]}</label>
          <input
            type="number"
            value={buffs[k] ?? 100}
            onChange={(e) =>
              set({ buffs: { ...buffs, [k]: Number(e.target.value) || 100 } })
            }
          />
        </div>
      ))}
    </>
  );
}

function ItemForm({
  ent,
  project,
  set,
}: {
  ent: Item;
  project: Project;
  set: (p: any) => void;
}) {
  return (
    <>
      <div className="field">
        <label>类型</label>
        <select
          value={ent.itemKind}
          onChange={(e) => set({ itemKind: e.target.value as ItemKind })}
        >
          <option value="consumable">一次性（消耗品）</option>
          <option value="equipment">持续性（装备）</option>
        </select>
      </div>

      {ent.itemKind === 'equipment' ? (
        <>
          <h4>占用槽位（可多槽，冲突则旧装备整体脱落）</h4>
          <div>
            {SLOTS.map((s) => {
              const on = ent.slots?.includes(s);
              return (
                <span
                  key={s}
                  className={`tag ${on ? 'on' : ''}`}
                  onClick={() => {
                    const slots = new Set(ent.slots || []);
                    on ? slots.delete(s) : slots.add(s);
                    set({ slots: [...slots] });
                  }}
                >
                  {SLOT_LABELS[s]}
                </span>
              );
            })}
          </div>
          <h4>五维加值</h4>
          {STAT_KEYS.map((k) => (
            <div className="field" key={k}>
              <label>{STAT_LABELS[k]}</label>
              <input
                type="number"
                value={ent.modifiers?.[k] ?? 0}
                onChange={(e) =>
                  set({
                    modifiers: {
                      ...zeroMods(),
                      ...(ent.modifiers || {}),
                      [k]: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          ))}
        </>
      ) : (
        <>
          <h4>可用时机</h4>
          <div>
            {(['battle', 'move'] as const).map((u) => {
              const on = ent.usable?.includes(u);
              return (
                <span
                  key={u}
                  className={`tag ${on ? 'on' : ''}`}
                  onClick={() => {
                    const us = new Set(ent.usable || []);
                    on ? us.delete(u) : us.add(u);
                    set({ usable: [...us] });
                  }}
                >
                  {u === 'battle' ? '对战' : '前进'}
                </span>
              );
            })}
          </div>
          <h4>效果（影响自己或对手的任意数值）</h4>
          {(ent.effects || []).map((ef, i) => (
            <div
              key={i}
              className="range-row"
              style={{ alignItems: 'flex-end', marginBottom: 4 }}
            >
              <select
                value={ef.target}
                onChange={(e) => {
                  const effects = [...(ent.effects || [])];
                  effects[i] = { ...ef, target: e.target.value as EffectTarget };
                  set({ effects });
                }}
              >
                <option value="self">自己</option>
                <option value="opponent">对手</option>
              </select>
              <select
                value={ef.stat}
                onChange={(e) => {
                  const effects = [...(ent.effects || [])];
                  effects[i] = { ...ef, stat: e.target.value as StatKey | 'mp' };
                  set({ effects });
                }}
              >
                {[...STAT_KEYS, 'mp'].map((s) => (
                  <option key={s} value={s}>
                    {s === 'mp' ? '法力' : STAT_LABELS[s as StatKey]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                style={{ width: 60 }}
                value={ef.delta}
                onChange={(e) => {
                  const effects = [...(ent.effects || [])];
                  effects[i] = { ...ef, delta: Number(e.target.value) || 0 };
                  set({ effects });
                }}
              />
              <button
                className="hp-btn"
                onClick={() => {
                  const effects = (ent.effects || []).filter((_, j) => j !== i);
                  set({ effects });
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="hp-btn"
            onClick={() =>
              set({ effects: [...(ent.effects || []), { target: 'self', stat: 'hp', delta: 0 }] })
            }
          >
            ＋ 效果
          </button>
        </>
      )}
    </>
  );
}

function BuildingForm({
  ent,
  project,
  set,
}: {
  ent: Building;
  project: Project;
  set: (p: any) => void;
}) {
  const items = project.items;
  const monsters = project.monsters;
  const toggleReward = (id: string) => {
    const pool = new Set(ent.reward_pool || []);
    pool.has(id) ? pool.delete(id) : pool.add(id);
    set({ reward_pool: [...pool] });
  };
  return (
    <>
      <div className="field">
        <label>遭遇类型</label>
        <select
          value={ent.encounter}
          onChange={(e) => set({ encounter: e.target.value as Encounter })}
        >
          <option value="empty">空房间</option>
          <option value="treasure">宝箱屋（奖励）</option>
          <option value="monster">怪物房</option>
        </select>
      </div>
      {ent.encounter !== 'empty' && (
        <>
          <DiceField
            label={ent.encounter === 'treasure' ? '揭晓掷骰' : '战斗结算掷骰'}
            value={ent.dice}
            onChange={(dice) => set({ dice })}
          />
          <p style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
            踩到此建筑时用这颗骰子
            {ent.encounter === 'treasure' ? '从奖励池揭晓' : '做战斗结算'}
            ；与"能否进入"无关（游玩态使用）。
          </p>
        </>
      )}

      {ent.encounter === 'treasure' && (
        <>
          <h4>奖励池（点击选择道具）</h4>
          <div>
            {items.map((it) => (
              <span
                key={it.id}
                className={`tag ${ent.reward_pool?.includes(it.id) ? 'on' : ''}`}
                onClick={() => toggleReward(it.id)}
              >
                {it.icon} {it.name}
              </span>
            ))}
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={!!ent.mimic}
                onChange={(e) =>
                  set({
                    mimic: e.target.checked
                      ? { chance: 0.2, monster: monsters[0]?.id || '', reward: [] }
                      : undefined,
                  })
                }
              />
              宝箱怪物（伪装）：勾选后有一定概率为怪物
            </label>
          </div>
          {ent.mimic && (
            <>
              <div className="field">
                <label>伪装概率 (0~1)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={ent.mimic.chance}
                  onChange={(e) =>
                    set({ mimic: { ...ent.mimic!, chance: Number(e.target.value) || 0 } })
                  }
                />
              </div>
              <div className="field">
                <label>伪装成的怪物</label>
                <select
                  value={ent.mimic.monster}
                  onChange={(e) =>
                    set({ mimic: { ...ent.mimic!, monster: e.target.value } })
                  }
                >
                  {monsters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <h4>战胜后奖励</h4>
              <div>
                {items.map((it) => (
                  <span
                    key={it.id}
                    className={`tag ${ent.mimic!.reward.includes(it.id) ? 'on' : ''}`}
                    onClick={() => {
                      const r = new Set(ent.mimic!.reward);
                      r.has(it.id) ? r.delete(it.id) : r.add(it.id);
                      set({ mimic: { ...ent.mimic!, reward: [...r] } });
                    }}
                  >
                    {it.icon} {it.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {ent.encounter === 'monster' && (
        <div className="field">
          <label>怪物</label>
          <select
            value={ent.monster_ref || ''}
            onChange={(e) => set({ monster_ref: e.target.value })}
          >
            {monsters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
