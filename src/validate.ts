// 校验与「清单」汇总（§5.7 / A9）。返回分级问题，供「清单」按钮一键查看。
import { Gate, Library, Project } from './types';
import { poolCandidates, rewardId } from './engine';

export type IssueLevel = 'error' | 'warn' | 'pass';
export interface Issue {
  level: IssueLevel;
  code: string; // K 编号
  msg: string;
  mapId?: string;
  ref?: string; // 关联组件 id，便于定位
}

function isEnabled(project: Project, id: string): boolean {
  return project.enabledIds.includes(id);
}

function gateUsable(gate: Gate | undefined, available: Set<string>): boolean {
  if (!gate || !gate.tags.length) return true;
  return gate.mode === 'all' ? gate.tags.every((t) => available.has(t)) : gate.tags.some((t) => available.has(t));
}

export function runChecklist(library: Library, project: Project): Issue[] {
  const issues: Issue[] = [];
  const all = Object.values(library);
  const enabledSet = new Set(project.enabledIds);

  // 静态可用标签集合（仅看"能被装备/本身是职业"的，状态 tag 是动态的，故此处只给软警告）
  const availableTags = new Set<string>();
  for (const c of all) {
    if (isEnabled(project, c.id) && (c.kind === 'item' || c.kind === 'class')) (c.tags || []).forEach((t) => availableTags.add(t));
  }

  // K1 起/终点缺失（每层地图）
  for (const m of project.maps) {
    if (!m.start) issues.push({ level: 'error', code: 'K1', msg: `地图「${m.name}」缺少起点`, mapId: m.id });
    if (!m.end) issues.push({ level: 'error', code: 'K1', msg: `地图「${m.name}」缺少终点`, mapId: m.id });
  }

  // K3 悬空引用：地图节点 ref 指向不存在组件
  for (const m of project.maps) {
    for (const n of m.nodes) {
      if ((n.type === 'road' || n.type === 'building') && n.ref && !library[n.ref]) {
        issues.push({
          level: 'error',
          code: 'K3',
          msg: `地图「${m.name}」有节点引用了不存在的组件：${n.ref}`,
          mapId: m.id,
          ref: n.ref,
        });
      }
    }
  }

  // K4 技能指向失效 / 无法获得：怪物 attack_weights 指向未启用/不存在技能
  for (const c of all) {
    if (c.kind === 'monster' && c.attack_weights) {
      for (const sid of Object.keys(c.attack_weights)) {
        const sk = library[sid];
        if (!sk || sk.kind !== 'skill') {
          issues.push({ level: 'error', code: 'K4', msg: `怪物「${c.name}」的攻击权重指向不存在技能：${sid}`, ref: c.id });
        } else if (!isEnabled(project, sid)) {
          issues.push({ level: 'warn', code: 'K4', msg: `怪物「${c.name}」会用技能「${sk.name}」，但该技能未启用`, ref: c.id });
        }
      }
    }
    // 道具 learn_skill / forget_skill 指向不存在技能
    if (c.kind === 'item' && c.effects) {
      for (const e of c.effects) {
        if (e.op === 'learn_skill' || e.op === 'forget_skill') {
          const sk = library[e.skill];
          if (!sk || sk.kind !== 'skill') {
            issues.push({ level: 'error', code: 'K4', msg: `道具「${c.name}」引用了不存在技能：${e.skill}`, ref: c.id });
          } else if (!isEnabled(project, e.skill)) {
            issues.push({ level: 'warn', code: 'K4', msg: `道具「${c.name}」教技能「${sk.name}」，但该技能未启用`, ref: c.id });
          }
        }
      }
    }
    // 技能引用失效（事件/技能 effects 内 learn_skill 也已在上面覆盖；这里补 skill 组件本身无额外引用）
  }

  // K5 怪物池为空 / 引用未启用怪物 / 商店货币
  for (const c of all) {
    if (c.kind === 'building') {
      if (c.encounter === 'monster' && c.monster_pool) {
        const ids = (c.monster_pool.ids || []).map(rewardId);
        if (c.monster_pool.source === 'filter') {
          const cand = poolCandidates(c.monster_pool, all, enabledSet, 'monster');
          if (!cand.length) issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」的怪物筛选池当前为空（无已启用的匹配怪物）`, ref: c.id });
        } else if (!ids.length) {
          issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」的怪物池为空`, ref: c.id });
        }
        for (const id of ids) {
          const mon = library[id];
          if (!mon || mon.kind !== 'monster') {
            issues.push({ level: 'error', code: 'K5', msg: `建筑「${c.name}」怪物池引用不存在怪物：${id}`, ref: c.id });
          } else if (!isEnabled(project, id)) {
            issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」会出怪物「${mon.name}」，但该怪物未启用`, ref: c.id });
          }
        }
      }
      if ((c.encounter === 'treasure' || c.encounter === 'monster') && c.reward_pool?.source === 'filter') {
        const cand = poolCandidates(c.reward_pool, all, enabledSet, 'item');
        if (!cand.length) issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」的奖励筛选池当前为空（无已启用的匹配道具）`, ref: c.id });
      }
      if (c.encounter === 'shop') {
        if (c.stock?.source === 'filter') {
          const cand = poolCandidates(c.stock, all, enabledSet, 'item');
          if (!cand.length) issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」商店上架筛选池当前为空（无已启用的匹配道具）`, ref: c.id });
        }
        if (c.price) {
          const cur = library[c.price.currency];
          if (!cur || cur.kind !== 'item') {
            issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」商店货币道具不存在：${c.price.currency}`, ref: c.id });
          } else if (!isEnabled(project, c.price.currency)) {
            issues.push({ level: 'warn', code: 'K5', msg: `建筑「${c.name}」商店货币「${cur.name}」未启用`, ref: c.id });
          }
        }
      }
    }
  }

  // K2 权限死路：road/building/event 的 gate 需要的标签，静态集合里完全无法提供
  for (const c of all) {
    if (c.kind === 'road' && c.gate) {
      if (!gateUsable(c.gate, availableTags))
        issues.push({ level: 'warn', code: 'K2', msg: `道路「${c.name}」的权限需要标签 ${c.gate.tags.join('/')}，但没有任何已启用组件/职业能提供（可能权限死路）`, ref: c.id });
    }
    if (c.kind === 'building') {
      if (c.gate && !gateUsable(c.gate, availableTags))
        issues.push({ level: 'warn', code: 'K2', msg: `建筑「${c.name}」的权限需要标签 ${c.gate.tags.join('/')}，但没有任何已启用组件/职业能提供（可能权限死路）`, ref: c.id });
      if (c.event?.gate && !gateUsable(c.event.gate, availableTags))
        issues.push({ level: 'warn', code: 'K2', msg: `建筑「${c.name}」事件的门槛需要标签 ${c.event.gate.tags.join('/')}，但没有任何已启用组件/职业能提供（可能权限死路）`, ref: c.id });
    }
  }

  // K6 事件结构：有判定却无后果 / 目标异常
  for (const c of all) {
    if (c.kind === 'building' && c.encounter === 'event' && c.event) {
      const ev = c.event;
      if (ev.check) {
        if (!ev.on_success?.text && !ev.on_fail?.text)
          issues.push({ level: 'warn', code: 'K6', msg: `事件「${c.name}」有判定却没有任何后果文本`, ref: c.id });
        if (ev.check.target <= 0)
          issues.push({ level: 'warn', code: 'K6', msg: `事件「${c.name}」判定目标 ≤ 0，恒必成（等于没难度）`, ref: c.id });
      }
    }
  }

  return issues;
}

// 导出前快速判断：是否有阻断级错误
export function hasBlockingErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
