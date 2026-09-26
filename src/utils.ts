import { Stats, StatKey, STAT_KEYS } from './types';

// 生成稳定唯一 id（类型前缀 + 随机串），详见 DESIGN §3.2
export function genId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

export function zeroStats(): Stats {
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = [0, 0];
    return acc;
  }, {} as Stats);
}

export function zeroMods(): Record<StatKey, number> {
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Record<StatKey, number>);
}

export function emptyBuffs(): Partial<Record<StatKey, number>> {
  return {};
}

// 把任意数值安全转成 [min,max] 范围（导入容错）
export function toRange(v: unknown): [number, number] {
  if (Array.isArray(v) && v.length === 2) {
    return [Number(v[0]) || 0, Number(v[1]) || 0];
  }
  const n = Number(v) || 0;
  return [n, n];
}
