import { useState, ReactNode } from 'react';
import { useStore } from '../store';
import {
  AnyComponent,
  Building,
  ClassDef,
  EffectOp,
  EntityKind,
  Gate,
  Item,
  Library,
  MapCost,
  Monster,
  PoolRef,
  PriceDef,
  RewardEntry,
  Road,
  SkillDef,
  StatKey,
  STAT_KEYS,
  STAT_LABELS,
  SLOTS,
  SLOT_LABELS,
} from '../types';
import { zeroMods } from '../utils';

// ───────────── 通用控件 ─────────────
function parseDice(s: string): { count: number; faces: number } {
  const m = /^(\d*)\s*[dD]\s*(\d+)$/.exec((s || '').trim());
  if (m) return { count: m[1] ? Number(m[1]) : 1, faces: Number(m[2]) };
  return { count: 1, faces: 6 };
}
const clampInt = (v: string, min: number, max: number, fb: number) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fb;
  return Math.min(max, Math.max(min, n));
};
function DiceField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { count, faces } = parseDice(value);
  const apply = (c: number, f: number) => onChange(`${c}D${f}`);
  return (
    <div className="field">
      <label>{label}（数量 × 面数）</label>
      <div className="range-row" style={{ alignItems: 'center', gap: 6 }}>
        <input type="number" min={1} max={100} value={count} onChange={(e) => apply(clampInt(e.target.value, 1, 100, count), faces)} style={{ width: 70 }} />
        <span>颗 ×</span>
        <input type="number" min={2} max={1000} value={faces} onChange={(e) => apply(count, clampInt(e.target.value, 2, 1000, faces))} style={{ width: 80 }} />
        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{count}D{faces}</span>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// 池编辑（reward/monster/stock）：ids（带权重）+ filter 二选一
function PoolField({ value, onChange, candidates, label }: {
  value?: PoolRef;
  onChange: (p: PoolRef) => void;
  candidates: AnyComponent[];
  label: string;
}) {
  const useFilter = value?.source === 'filter';
  const ids = value?.ids || [];
  const toggleId = (id: string) => {
    const has = ids.some((e) => (typeof e === 'string' ? e : e.id) === id);
    const next: RewardEntry[] = has
      ? ids.filter((e) => (typeof e === 'string' ? e : e.id) !== id)
      : [...ids, { id, weight: 1 }];
    onChange({ source: 'ids', ids: next });
  };
  const setWeight = (id: string, w: number) =>
    onChange({ source: 'ids', ids: ids.map((e) => (typeof e === 'string' ? e : e.id) === id ? { id, weight: w } : e) as RewardEntry[] });
  return (
    <div className="field">
      <label>{label}</label>
      <div className="range-row" style={{ gap: 6 }}>
        <button className={`hp-btn ${!useFilter ? 'on' : ''}`} onClick={() => onChange({ source: 'ids', ids })}>手选</button>
        <button className={`hp-btn ${useFilter ? 'on' : ''}`} onClick={() => onChange({ source: 'filter', filter: value?.filter || { tags: [] } })}>筛选</button>
      </div>
      {useFilter ? (
        <div>
          <div className="range-row" style={{ gap: 6 }}>
            <select value={value?.filter?.itemKind || ''} onChange={(e) => onChange({ source: 'filter', filter: { ...(value?.filter || {}), itemKind: (e.target.value || undefined) as any } })}>
              <option value="">任意类别</option>
              <option value="equipment">装备</option>
              <option value="consumable">消耗品</option>
            </select>
          </div>
          <TagInput tags={value?.filter?.tags || []} onChange={(t) => onChange({ source: 'filter', filter: { ...(value?.filter || {}), tags: t } })} />
          <p className="muted">筛选从「已启用」组件中按类别/标签抽；实时命中数由引擎计算。</p>
        </div>
      ) : (
        <div className="pool-list">
          {candidates.map((c) => {
            const entry = ids.find((e) => (typeof e === 'string' ? e : e.id) === c.id);
            const on = !!entry;
            return (
              <div key={c.id} className={`pool-row ${on ? 'on' : ''}`} onClick={() => toggleId(c.id)}>
                <span>{c.icon} {c.name}</span>
                {on && !useFilter && (
                  <input
                    type="number" min={0} value={(entry as any)?.weight ?? 1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setWeight(c.id, Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: 56 }}
                    title="权重"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState('');
  return (
    <div>
      <div className="tag-list">
        {tags.map((t) => (
          <span key={t} className="tag on" onClick={() => onChange(tags.filter((x) => x !== t))}>{t} ×</span>
        ))}
      </div>
      <input
        value={v}
        placeholder="输入标签后回车"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v.trim()) {
            onChange([...tags, v.trim()]);
            setV('');
          }
        }}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function GateField({ value, onChange }: { value?: Gate; onChange: (g?: Gate) => void }) {
  const on = !!value;
  return (
    <div className="field">
      <label>通行权限 Gate</label>
      <div className="range-row" style={{ gap: 6 }}>
        <button className={`hp-btn ${on ? 'on' : ''}`} onClick={() => onChange(on ? undefined : { tags: [], mode: 'any', missing: 'block' })}>
          {on ? '移除权限' : '添加权限'}
        </button>
      </div>
      {on && (
        <>
          <TagInput tags={value!.tags} onChange={(t) => onChange({ ...value!, tags: t })} />
          <div className="range-row" style={{ gap: 6 }}>
            <select value={value!.mode || 'any'} onChange={(e) => onChange({ ...value!, mode: e.target.value as any })}>
              <option value="any">任一即可</option>
              <option value="all">全部都要</option>
            </select>
            <select value={value!.missing || 'block'} onChange={(e) => onChange({ ...value!, missing: e.target.value as any })}>
              <option value="block">过不去(挡)</option>
              <option value="penalty">能走但加罚</option>
            </select>
          </div>
          {value!.missing === 'penalty' && <CostField value={value!.penalty} onChange={(p) => onChange({ ...value!, penalty: p })} />}
        </>
      )}
    </div>
  );
}

function CostField({ value, onChange, label }: { value?: MapCost; onChange: (c?: MapCost) => void; label?: string }) {
  const v = value || {};
  const set = (k: keyof MapCost, n: number) => {
    const next = { ...v, [k]: n };
    if (!next.step && !next.hp && !next.mp) onChange(undefined);
    else onChange(next);
  };
  return (
    <div className="field">
      <label>{label || '消耗 Cost（步/血/蓝）'}</label>
      <div className="range-row" style={{ gap: 6 }}>
        <span>步</span>
        <input type="number" min={0} value={v.step ?? 0} onChange={(e) => set('step', Number(e.target.value) || 0)} style={{ width: 56 }} />
        <span>血</span>
        <input type="number" min={0} value={v.hp ?? 0} onChange={(e) => set('hp', Number(e.target.value) || 0)} style={{ width: 56 }} />
        <span>蓝</span>
        <input type="number" min={0} value={v.mp ?? 0} onChange={(e) => set('mp', Number(e.target.value) || 0)} style={{ width: 56 }} />
      </div>
    </div>
  );
}

// 效果列表（五 op）
function EffectList({ effects, onChange }: { effects?: EffectOp[]; onChange: (e: EffectOp[]) => void }) {
  const add = () => onChange([...(effects || []), { op: 'add_stat', target: 'self', stat: 'hp', delta: 0 }]);
  return (
    <div className="field">
      <label>效果（五 op：加数值 / 挂状态 / 解状态 / 学技能 / 夺技能）</label>
      {(effects || []).map((ef, i) => (
        <div key={i} className="effect-row">
          <select value={ef.op} onChange={(e) => {
            const op = e.target.value as EffectOp['op'];
            let next: EffectOp;
            if (op === 'add_stat') next = { op, target: 'self', stat: 'hp', delta: 0 };
            else if (op === 'add_tag') next = { op, tag: '', duration: 3 };
            else if (op === 'remove_tag') next = { op, tag: '' };
            else if (op === 'learn_skill') next = { op, skill: '' };
            else next = { op, skill: '' };
            const arr = [...(effects || [])]; arr[i] = next; onChange(arr);
          }}>
            <option value="add_stat">加数值</option>
            <option value="add_tag">挂状态</option>
            <option value="remove_tag">解状态</option>
            <option value="learn_skill">学技能</option>
            <option value="forget_skill">夺技能</option>
          </select>
          <EffectFields ef={ef} onChange={(nf) => { const arr = [...(effects || [])]; arr[i] = nf; onChange(arr); }} />
          <button className="hp-btn mini danger" onClick={() => onChange((effects || []).filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="hp-btn" onClick={add}>＋ 一条效果</button>
    </div>
  );
}
function EffectFields({ ef, onChange }: { ef: EffectOp; onChange: (e: EffectOp) => void }) {
  if (ef.op === 'add_stat') {
    return (
      <>
        <select value={ef.target} onChange={(e) => onChange({ ...ef, target: e.target.value as any })}>
          <option value="self">自己</option>
          <option value="opponent">对手</option>
        </select>
        <select value={ef.stat} onChange={(e) => onChange({ ...ef, stat: e.target.value as StatKey })}>
          {STAT_KEYS.map((s) => <option key={s} value={s}>{STAT_LABELS[s]}</option>)}
          <option value="mp">法力</option>
        </select>
        <input type="number" value={ef.delta} onChange={(e) => onChange({ ...ef, delta: Number(e.target.value) || 0 })} style={{ width: 56 }} />
      </>
    );
  }
  if (ef.op === 'add_tag') {
    return (
      <>
        <input placeholder="标签" value={ef.tag} onChange={(e) => onChange({ ...ef, tag: e.target.value })} style={{ width: 70 }} />
        <span>时长</span>
        <input type="number" min={1} value={ef.duration} onChange={(e) => onChange({ ...ef, duration: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 50 }} />
        <input placeholder="每回合(如 hp:-1)" value={ef.per_turn?.hp ?? ''} onChange={(e) => onChange({ ...ef, per_turn: e.target.value ? { hp: Number(e.target.value) || 0 } : undefined })} style={{ width: 90 }} />
      </>
    );
  }
  if (ef.op === 'remove_tag') {
    return <input placeholder="标签" value={ef.tag} onChange={(e) => onChange({ ...ef, tag: e.target.value })} style={{ width: 90 }} />;
  }
  return (
    <>
      <span>技能</span>
      <input placeholder="技能 id" value={ef.skill} onChange={(e) => onChange({ ...ef, skill: e.target.value })} style={{ width: 110 }} />
    </>
  );
}

// 事件块编辑
function EventField({ value, onChange, library }: { value?: Building['event']; onChange: (e?: Building['event']) => void; library: Library }) {
  const set = (patch: Partial<NonNullable<Building['event']>>) => onChange({ ...(value || { text: '', on_success: { text: '' }, on_fail: { text: '' } }), ...patch } as Building['event']);
  const setCheck = (patch: any) => set({ check: { ...(value?.check || { add: 'none', target: 0 }), ...patch } });
  const setOut = (which: 'on_success' | 'on_fail', patch: any) =>
    set({ [which]: { ...(value?.[which] || { text: '' }), ...patch } });
  return (
    <div className="field">
      <label>事件（门槛 + 手艺 + 后果）</label>
      <textarea value={value?.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder="事件描述" />
      <GateField value={value?.gate} onChange={(g) => set({ gate: g })} />
      <div className="range-row" style={{ gap: 4 }}>
        <span>手艺骰</span>
        <input value={value?.check?.dice || '2D6'} onChange={(e) => setCheck({ dice: e.target.value })} style={{ width: 70 }} />
        <span>加值</span>
        <select value={value?.check?.add || 'none'} onChange={(e) => setCheck({ add: e.target.value as any })}>
          <option value="none">无</option>
          {STAT_KEYS.map((s) => <option key={s} value={s}>{STAT_LABELS[s]}</option>)}
        </select>
        <span>目标</span>
        <input type="number" value={value?.check?.target ?? 0} onChange={(e) => setCheck({ target: Number(e.target.value) || 0 })} style={{ width: 50 }} />
      </div>
      <p className="muted">必成：目标 ≤ 加值；必败：目标 ≥ 骰子最大 + 加值。</p>
      <div className="event-out">
        <b>成功：</b>
        <textarea value={value?.on_success.text || ''} onChange={(e) => setOut('on_success', { text: e.target.value })} />
        <OutcomeMini out={value?.on_success} onChange={(p) => setOut('on_success', p)} library={library} />
      </div>
      <div className="event-out">
        <b>失败：</b>
        <textarea value={value?.on_fail.text || ''} onChange={(e) => setOut('on_fail', { text: e.target.value })} />
        <OutcomeMini out={value?.on_fail} onChange={(p) => setOut('on_fail', p)} library={library} />
      </div>
      <label className="range-row" style={{ gap: 6 }}>
        <input type="checkbox" checked={!!value?.once} onChange={(e) => set({ once: e.target.checked })} /> 只触发一次
      </label>
    </div>
  );
}
function OutcomeMini({ out, onChange, library }: { out?: Building['event'] extends infer _ ? any : any; onChange: (p: any) => void; library: Library }) {
  const v = out || {};
  const grantIds = (v.grant || []).map((g: any) => (typeof g === 'string' ? g : g.id));
  const toggleGrant = (id: string) => {
    const has = grantIds.includes(id);
    onChange({ ...v, grant: has ? (v.grant || []).filter((g: any) => (typeof g === 'string' ? g : g.id) !== id) : [...(v.grant || []), id] });
  };
  return (
    <div className="outcome-mini">
      <div className="range-row" style={{ gap: 6 }}>
        <span>奖励点</span>
        <input type="number" value={v.point_reward ?? 0} onChange={(e) => onChange({ ...v, point_reward: Number(e.target.value) || 0 })} style={{ width: 50 }} />
        <span>扣血</span>
        <input type="number" value={v.cost?.hp ?? 0} onChange={(e) => onChange({ ...v, cost: { ...(v.cost || {}), hp: Number(e.target.value) || 0 } })} style={{ width: 50 }} />
      </div>
      <div className="tag-list">
        {Object.values(library).filter((c) => c.kind === 'item').map((c) => (
          <span key={c.id} className={`tag ${grantIds.includes(c.id) ? 'on' : ''}`} onClick={() => toggleGrant(c.id)}>{c.icon}{c.name}</span>
        ))}
      </div>
    </div>
  );
}

// ───────────── 各组件编辑器 ─────────────
function MonsterEditor({ ent, set }: { ent: Monster; set: (p: Partial<Monster>) => void }) {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const skills = Object.values(library).filter((c) => c.kind === 'skill');
  const items = Object.values(library).filter((c) => c.kind === 'item');
  const toggleWeight = (id: string) => {
    const aw = { ...(ent.attack_weights || {}) };
    if (id in aw) delete aw[id]; else aw[id] = 1;
    set({ attack_weights: aw });
  };
  const setW = (id: string, w: number) => set({ attack_weights: { ...(ent.attack_weights || {}), [id]: w } });
  return (
    <>
      <h4>六维（区间 min ~ max，登场摇定）</h4>
      {STAT_KEYS.map((k) => (
        <Field key={k} label={`${STAT_LABELS[k]} 区间`}>
          <div className="range-row">
            <input type="number" style={{ width: 70 }} value={ent.stats[k][0]} onChange={(e) => set({ stats: { ...ent.stats, [k]: [Number(e.target.value) || 0, ent.stats[k][1]] } })} />
            <span>~</span>
            <input type="number" style={{ width: 70 }} value={ent.stats[k][1]} onChange={(e) => set({ stats: { ...ent.stats, [k]: [ent.stats[k][0], Number(e.target.value) || 0] } })} />
          </div>
        </Field>
      ))}
      <Field label="攻击权重（键=技能 id，值=权重；省略=只用内建基础攻击）">
        <div className="pool-list">
          {skills.map((s) => {
            const on = ent.attack_weights && s.id in ent.attack_weights;
            return (
              <div key={s.id} className={`pool-row ${on ? 'on' : ''}`} onClick={() => toggleWeight(s.id)}>
                <span>{s.icon} {s.name}</span>
                {on && <input type="number" min={0} value={ent.attack_weights![s.id]} onClick={(e) => e.stopPropagation()} onChange={(e) => setW(s.id, Math.max(0, Number(e.target.value) || 0))} style={{ width: 56 }} />}
              </div>
            );
          })}
        </div>
      </Field>
      <DiceField label="属性结算骰 stat_dice（覆盖）" value={ent.stat_dice || '1D6'} onChange={(v) => set({ stat_dice: v })} />
      <DiceField label="攻击骰 atk_roll（覆盖）" value={ent.atk_roll ? diceOf(ent.atk_roll) : '1D4'} onChange={(v) => set({ atk_roll: v === '1D4' ? undefined : { add_dice: v } })} />
      <DiceField label="防御骰 def_roll（覆盖）" value={ent.def_roll ? diceOf(ent.def_roll) : '1D4'} onChange={(v) => set({ def_roll: v === '1D4' ? undefined : { add_dice: v } })} />
      <Field label="奖励点 point_reward（默认 0）"><input type="number" value={ent.point_reward ?? 0} onChange={(e) => set({ point_reward: Number(e.target.value) || 0 })} style={{ width: 70 }} /></Field>
      <PoolField label="战利品池 reward_pool" value={ent.reward_pool} onChange={(p) => set({ reward_pool: p })} candidates={items} />
      <Field label="命中玩家时施加（三 op）"><EffectList effects={ent.effects} onChange={(e) => set({ effects: e })} /></Field>
    </>
  );
}
function diceOf(r: { add_dice?: string }): string {
  return r.add_dice || '1D4';
}

function ClassEditor({ ent, set }: { ent: ClassDef; set: (p: Partial<ClassDef>) => void }) {
  const library = useStore((s) => s.library);
  const items = Object.values(library).filter((c) => c.kind === 'item');
  const startItems = ent.starting_items || [];
  const toggleStart = (id: string) => set({ starting_items: startItems.includes(id) ? startItems.filter((x) => x !== id) : [...startItems, id] });
  return (
    <>
      <h4>初始六维 base_stats（确定值）</h4>
      {STAT_KEYS.map((k) => (
        <Field key={k} label={STAT_LABELS[k]}><input type="number" value={ent.base_stats[k]} onChange={(e) => set({ base_stats: { ...ent.base_stats, [k]: Number(e.target.value) || 0 } })} style={{ width: 70 }} /></Field>
      ))}
      <Field label="开局自由点 free_points"><input type="number" value={ent.free_points} onChange={(e) => set({ free_points: Number(e.target.value) || 0 })} style={{ width: 70 }} /></Field>
      <h4>优劣百分比 buffs（100=无变化）</h4>
      {STAT_KEYS.map((k) => (
        <Field key={k} label={STAT_LABELS[k]}><input type="number" value={ent.buffs?.[k] ?? 100} onChange={(e) => set({ buffs: { ...(ent.buffs || {}), [k]: Number(e.target.value) || 100 } })} style={{ width: 70 }} /></Field>
      ))}
      <Field label="背包容量 inventory_size（0=无限，默认50）">
        <div className="range-row" style={{ gap: 6 }}>
          <input type="number" min={0} value={ent.inventory_size ?? 50} onChange={(e) => set({ inventory_size: Number(e.target.value) || 0 })} style={{ width: 70 }} />
        </div>
      </Field>
      <Field label="出生家当 starting_items">
        <div className="tag-list">
          {items.map((c) => <span key={c.id} className={`tag ${startItems.includes(c.id) ? 'on' : ''}`} onClick={() => toggleStart(c.id)}>{c.icon}{c.name}</span>)}
        </div>
      </Field>
    </>
  );
}

function ItemEditor({ ent, set }: { ent: Item; set: (p: Partial<Item>) => void }) {
  return (
    <>
      <Field label="类型">
        <select value={ent.itemKind} onChange={(e) => set({ itemKind: e.target.value as any })}>
          <option value="equipment">装备（持续）</option>
          <option value="consumable">消耗品（一次性）</option>
        </select>
      </Field>
      {ent.itemKind === 'equipment' ? (
        <>
          <h4>占用槽位（冲突则旧装备整体脱落）</h4>
          <div className="tag-list">
            {SLOTS.map((s) => {
              const on = ent.slots?.includes(s);
              return <span key={s} className={`tag ${on ? 'on' : ''}`} onClick={() => { const sl = new Set(ent.slots || []); on ? sl.delete(s) : sl.add(s); set({ slots: [...sl] }); }}>{SLOT_LABELS[s]}</span>;
            })}
          </div>
          <h4>六维加值（含血/蓝）</h4>
          {STAT_KEYS.map((k) => (
            <Field key={k} label={STAT_LABELS[k]}><input type="number" value={ent.modifiers?.[k] ?? 0} onChange={(e) => set({ modifiers: { ...zeroMods(), ...(ent.modifiers || {}), [k]: Number(e.target.value) || 0 } })} style={{ width: 70 }} /></Field>
          ))}
        </>
      ) : (
        <>
          <h4>可用时机</h4>
          <div className="tag-list">
            {(['battle', 'move'] as const).map((u) => {
              const on = ent.usable?.includes(u);
              return <span key={u} className={`tag ${on ? 'on' : ''}`} onClick={() => { const us = new Set(ent.usable || []); on ? us.delete(u) : us.add(u); set({ usable: [...us] }); }}>{u === 'battle' ? '对战' : '前进'}</span>;
            })}
          </div>
          <EffectList effects={ent.effects} onChange={(e) => set({ effects: e })} />
        </>
      )}
    </>
  );
}

function BuildingEditor({ ent, set }: { ent: Building; set: (p: Partial<Building>) => void }) {
  const library = useStore((s) => s.library);
  const items = Object.values(library).filter((c) => c.kind === 'item');
  const monsters = Object.values(library).filter((c) => c.kind === 'monster');
  return (
    <>
      <Field label="遭遇类型">
        <select value={ent.encounter} onChange={(e) => set({ encounter: e.target.value as any })}>
          <option value="empty">空房间</option>
          <option value="treasure">宝箱屋（开箱）</option>
          <option value="monster">怪物房</option>
          <option value="event">事件（门槛+判定）</option>
          <option value="shop">商店</option>
        </select>
      </Field>
      <CostField value={ent.cost} onChange={(c) => set({ cost: c })} />
      <GateField value={ent.gate} onChange={(g) => set({ gate: g })} />
      <Field label="奖励点 point_reward（默认 0）"><input type="number" value={ent.point_reward ?? 0} onChange={(e) => set({ point_reward: Number(e.target.value) || 0 })} style={{ width: 70 }} /></Field>

      {ent.encounter === 'treasure' && (
        <>
          <PoolField label="奖励池 reward_pool" value={ent.reward_pool} onChange={(p) => set({ reward_pool: p })} candidates={items} />
          <label className="range-row" style={{ gap: 6 }}>
            <input type="checkbox" checked={!!ent.mimic} onChange={(e) => set({ mimic: e.target.checked ? { chance: 0.2, monster: monsters[0]?.id || '', reward_pool: undefined } : undefined })} /> 宝箱怪物（伪装）
          </label>
          {ent.mimic && (
            <>
              <Field label="伪装概率"><input type="number" step="0.05" min={0} max={1} value={ent.mimic.chance} onChange={(e) => set({ mimic: { ...ent.mimic!, chance: Number(e.target.value) || 0 } })} style={{ width: 70 }} /></Field>
              <Field label="伪装成"><select value={ent.mimic.monster} onChange={(e) => set({ mimic: { ...ent.mimic!, monster: e.target.value } })}>{monsters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
              <PoolField label="战胜后奖励" value={ent.mimic.reward_pool} onChange={(p) => set({ mimic: { ...ent.mimic!, reward_pool: p } })} candidates={items} />
            </>
          )}
        </>
      )}
      {ent.encounter === 'monster' && (
        <PoolField label="怪物池 monster_pool（单只=单元素池）" value={ent.monster_pool} onChange={(p) => set({ monster_pool: p })} candidates={monsters} />
      )}
      {ent.encounter === 'event' && (
        <EventField value={ent.event} onChange={(ev) => set({ event: ev })} library={library} />
      )}
      {ent.encounter === 'shop' && (
        <>
          <PoolField label="上架池 stock" value={ent.stock} onChange={(p) => set({ stock: p })} candidates={items} />
          <PriceEditor value={ent.price} onChange={(p) => set({ price: p })} library={library} />
        </>
      )}
    </>
  );
}
function PriceEditor({ value, onChange, library }: { value?: PriceDef; onChange: (p?: PriceDef) => void; library: Library }) {
  const cur = value?.currency || Object.values(library).find((c) => c.kind === 'item' && c.tags?.includes('货币'))?.id || 'gold';
  const base: PriceDef = value || { currency: cur, algo: 'value', dice: '1D6', range: [5, 15] };
  return (
    <div className="field">
      <label>定价 price</label>
      <div className="range-row" style={{ gap: 6 }}>
        <span>货币</span>
        <select value={cur} onChange={(e) => onChange({ ...base, currency: e.target.value })}>
          {Object.values(library).filter((c) => c.kind === 'item').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={value?.algo || 'value'} onChange={(e) => onChange({ ...base, algo: e.target.value as any })}>
          <option value="fixed">明码</option>
          <option value="value">掷骰映射区间</option>
        </select>
      </div>
      {value?.algo === 'fixed' ? (
        <input type="number" value={value.n ?? 0} onChange={(e) => onChange({ ...value, n: Number(e.target.value) || 0 })} style={{ width: 70 }} />
      ) : (
        <div className="range-row" style={{ gap: 6 }}>
          <span>骰</span><input value={value?.dice || '1D6'} onChange={(e) => onChange({ ...base, dice: e.target.value })} style={{ width: 70 }} />
          <span>区间</span><input type="number" value={value?.range?.[0] ?? 5} onChange={(e) => onChange({ ...base, range: [Number(e.target.value) || 0, value?.range?.[1] ?? 15] })} style={{ width: 50 }} />
          <input type="number" value={value?.range?.[1] ?? 15} onChange={(e) => onChange({ ...base, range: [value?.range?.[0] ?? 5, Number(e.target.value) || 0] })} style={{ width: 50 }} />
        </div>
      )}
    </div>
  );
}

function RoadEditor({ ent, set }: { ent: Road; set: (p: Partial<Road>) => void }) {
  return (
    <>
      <CostField value={ent.cost} onChange={(c) => set({ cost: c })} />
      <GateField value={ent.gate} onChange={(g) => set({ gate: g })} />
      <p className="muted">道路只回答"走过去要付什么（消耗）"和"凭什么能过去（权限）"。</p>
    </>
  );
}

function SkillEditor({ ent, set }: { ent: SkillDef; set: (p: Partial<SkillDef>) => void }) {
  return (
    <>
      <Field label="取哪一维 dim"><select value={ent.dim} onChange={(e) => set({ dim: e.target.value as StatKey })}>{STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}</select></Field>
      <Field label="打谁 target"><select value={ent.target} onChange={(e) => set({ target: e.target.value as any })}><option value="opponent">对手</option><option value="self">自己</option></select></Field>
      <Field label="对抗 vs"><select value={ent.vs} onChange={(e) => set({ vs: e.target.value as any })}><option value="auto">自动(auto)</option>{STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}<option value="none">不对抗(none)</option></select></Field>
      <Field label="加成 bonus"><input type="number" value={ent.bonus} onChange={(e) => set({ bonus: Number(e.target.value) || 0 })} style={{ width: 70 }} /></Field>
      <Field label="作用 apply"><select value={ent.apply} onChange={(e) => set({ apply: e.target.value as any })}><option value="hp">血</option><option value="mp">蓝</option><option value="none">只挂效果</option></select></Field>
      <CostField value={ent.cost} onChange={(c) => set({ cost: c })} label="消耗 cost（mp 由它定）" />
      <EffectList effects={ent.effects} onChange={(e) => set({ effects: e })} />
      <p className="muted">人话：用{STAT_LABELS[ent.dim]}打{ent.target === 'self' ? '自己' : '对手'}，对抗{ent.vs === 'auto' ? '自动配对' : ent.vs === 'none' ? '不对抗' : STAT_LABELS[ent.vs as StatKey]}，作用到{ent.apply === 'none' ? '只挂效果' : ent.apply === 'hp' ? '血' : '蓝'}。</p>
    </>
  );
}

// ───────────── 顶层 ─────────────
export default function Inspector() {
  const rightTab = useStore((s) => s.ui.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);
  return (
    <div className="panel hand-border" style={{ margin: '0 8px 8px 0' }}>
      <div className="insp-tabs">
        <button className={rightTab === 'template' ? 'on' : ''} onClick={() => setRightTab('template')}>组件</button>
        <button className={rightTab === 'instance' ? 'on' : ''} onClick={() => setRightTab('instance')}>当前节点</button>
        <button className={rightTab === 'rules' ? 'on' : ''} onClick={() => setRightTab('rules')}>规则</button>
      </div>
      {rightTab === 'template' ? <TemplatePane /> : rightTab === 'instance' ? <InstancePane /> : <RulesPane />}
    </div>
  );
}

function TemplatePane() {
  const library = useStore((s) => s.library);
  const ui = useStore((s) => s.ui);
  const updateComponent = useStore((s) => s.updateComponent);
  const removeComponent = useStore((s) => s.removeComponent);
  const duplicateComponent = useStore((s) => s.duplicateComponent);
  const setBackground = useStore((s) => s.setBackground);
  const project = useStore((s) => s.project);

  if (ui.selectedEntityId === '__bg__') {
    return (
      <>
        <h3>背景设定</h3>
        <Field label="世界观 / 故事背景（纯文本，游玩时直接展示）">
          <textarea value={project.background} onChange={(e) => setBackground(e.target.value)} />
        </Field>
      </>
    );
  }
  const ent = ui.selectedEntityId ? library[ui.selectedEntityId] : undefined;
  if (!ent) {
    return (
      <>
        <h3>组件模板</h3>
        <p className="muted">在左侧组件库选择一个组件进行编辑。选中「道路/建筑」后点地图即可连续放置。</p>
      </>
    );
  }
  const set = (patch: Partial<AnyComponent>) => updateComponent(ent.id, patch);
  return (
    <>
      <h3>{kindLabel(ent.kind)} 编辑</h3>
      <Field label="名称"><input value={ent.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="图标（Emoji）"><input value={ent.icon} onChange={(e) => set({ icon: e.target.value })} /></Field>
      <Field label="标签 tags（筛选/通行/分组共用）"><TagInput tags={ent.tags || []} onChange={(t) => set({ tags: t })} /></Field>
      <Field label="描述"><textarea value={ent.desc || ''} onChange={(e) => set({ desc: e.target.value })} /></Field>

      {ent.kind === 'monster' && <MonsterEditor ent={ent} set={set} />}
      {ent.kind === 'class' && <ClassEditor ent={ent} set={set} />}
      {ent.kind === 'item' && <ItemEditor ent={ent} set={set} />}
      {ent.kind === 'building' && <BuildingEditor ent={ent} set={set} />}
      {ent.kind === 'road' && <RoadEditor ent={ent} set={set} />}
      {ent.kind === 'skill' && <SkillEditor ent={ent} set={set} />}

      <div className="range-row" style={{ marginTop: 10 }}>
        <button className="hp-btn" onClick={() => { const nid = duplicateComponent(ent.id); }}>复制</button>
        <button className="hp-btn danger" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => removeComponent(ent.id)}>删除</button>
      </div>
    </>
  );
}

function InstancePane() {
  const project = useStore((s) => s.project);
  const library = useStore((s) => s.library);
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
        <h3>当前节点</h3>
        <p className="muted">在地图上点选一个已放置的组件，可在此编辑位置 / 尺寸。</p>
      </>
    );
  }
  const [x, y] = ui.selectedNode.split(',').map(Number);
  const node = project.maps.find((m) => m.id === ui.selectedMapId)?.nodes.find((n) => n.x === x && n.y === y);
  if (!node) return null;
  let info: string = node.type;
  if (node.type === 'building') info = library[node.ref!]?.name || '建筑';
  else if (node.type === 'road') info = library[node.ref!]?.name || '道路';
  else if (node.type === 'start') info = '起点';
  else if (node.type === 'end') info = '终点';

  return (
    <>
      <h3>当前节点</h3>
      <p>坐标 [{x}, {y}] ｜ 类型：{info}</p>
      {node.type === 'building' && node.ref && (
        <button className="hp-btn" style={{ marginBottom: 8 }} onClick={() => { selectEntity(node.ref!); setRightTab('template'); }}>编辑该建筑定义</button>
      )}
      {node.type === 'building' && (
        <div className="range-row">
          <Field label="宽（格）"><input type="number" min={1} max={50} value={node.w ?? 1} onChange={(e) => updateNode(x, y, { w: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 70 }} /></Field>
          <Field label="高（格）"><input type="number" min={1} max={50} value={node.h ?? 1} onChange={(e) => updateNode(x, y, { h: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 70 }} /></Field>
        </div>
      )}
      {node.type !== 'start' && node.type !== 'end' && (
        <button className="hp-btn" style={{ marginTop: 8, marginRight: 8 }} onClick={() => duplicateNode(x, y)}>复制该节点</button>
      )}
      <button className="hp-btn danger" style={{ marginTop: 8, borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => { eraseNode(x, y); selectNode(null); }}>删除该节点</button>
    </>
  );
}

// 规则页（A7）：13 项，硬规则只读，其余可编辑
function RulesPane() {
  const rules = useStore((s) => s.project.rules);
  const setRules = useStore((s) => s.setRules);
  const set = (patch: Partial<typeof rules>) => setRules(patch);
  return (
    <>
      <h3>规则配置（前置配置）</h3>
      <p className="muted">硬规则（一回合=一次推进时间；移动/技能占回合；状态必有期限）不可配置。</p>
      <Field label="移动骰 move.dice"><input value={rules.move.dice} onChange={(e) => set({ move: { dice: e.target.value } })} style={{ width: 80 }} /></Field>
      <h4>战斗 combat</h4>
      <Field label="属性结算骰 stat_dice"><input value={rules.combat.stat_dice} onChange={(e) => set({ combat: { ...rules.combat, stat_dice: e.target.value } })} style={{ width: 80 }} /></Field>
      <Field label="选技骰 pick_dice"><input value={rules.combat.pick_dice} onChange={(e) => set({ combat: { ...rules.combat, pick_dice: e.target.value } })} style={{ width: 80 }} /></Field>
      <Field label="攻方骰 atk_roll（叠加骰）"><input value={rules.combat.atk_roll.add_dice || '1D4'} onChange={(e) => set({ combat: { ...rules.combat, atk_roll: { add_dice: e.target.value } } })} style={{ width: 80 }} /></Field>
      <Field label="守方骰 def_roll（叠加骰）"><input value={rules.combat.def_roll.add_dice || '1D4'} onChange={(e) => set({ combat: { ...rules.combat, def_roll: { add_dice: e.target.value } } })} style={{ width: 80 }} /></Field>
      <h4>开箱算法 treasure</h4>
      <Field label="抽几件 pick 骰"><input value={rules.treasure.pick.dice} onChange={(e) => set({ treasure: { ...rules.treasure, pick: { ...rules.treasure.pick, dice: e.target.value } } })} style={{ width: 80 }} /></Field>
      <Field label="每件几份 copies 骰"><input value={rules.treasure.copies.dice || '1D6'} onChange={(e) => set({ treasure: { ...rules.treasure, copies: { ...rules.treasure.copies, dice: e.target.value } } })} style={{ width: 80 }} /></Field>
      <h4>战利品 loot</h4>
      <Field label="抽几件 pick 骰"><input value={rules.loot.pick.dice} onChange={(e) => set({ loot: { ...rules.loot, pick: { ...rules.loot.pick, dice: e.target.value } } })} style={{ width: 80 }} /></Field>
      <Field label="状态上限 max_duration"><input type="number" value={rules.state.max_duration} onChange={(e) => set({ state: { max_duration: Number(e.target.value) || 0 } })} style={{ width: 70 }} /></Field>
      <Field label="事件默认骰 event.dice"><input value={rules.event.dice} onChange={(e) => set({ event: { dice: e.target.value } })} style={{ width: 80 }} /></Field>
      <Field label="开局职业 class_pool（逗号分隔 id）"><input value={rules.class_pool.join(',')} onChange={(e) => set({ class_pool: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
      <h4>商店默认定价 shop.price</h4>
      <Field label="货币"><input value={rules.shop.price.currency} onChange={(e) => set({ shop: { price: { ...rules.shop.price, currency: e.target.value } } })} /></Field>
      <Field label="定价骰"><input value={rules.shop.price.dice || '1D6'} onChange={(e) => set({ shop: { price: { ...rules.shop.price, dice: e.target.value } } })} style={{ width: 80 }} /></Field>
    </>
  );
}

function kindLabel(k: EntityKind): string {
  return { monster: '怪物', item: '道具', building: '建筑', road: '道路', class: '职业', skill: '技能' }[k];
}
