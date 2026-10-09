/** 状态池：数据归一（§2.4 / §7.3）、`.pmod` 段往返（§7.1）与专项校验 K20~K37（§十） */

import { describe, expect, it } from 'vitest'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { normalizeNpc } from '../../lib/dialog'
import { normalizeCheckRef, normalizeGatePool, normalizePoolSection } from '../../lib/poolRefs'
import { exportPmod, parsePmod } from '../../io/pmod'
import type { CondTpl, DialogNode, NpcDef, PoolCheck, PoolRoundCheck, PoolVar, Project } from '../../types'
import { poolIssues } from '../poolValidate'

const library = presetLibrary()

const vars: PoolVar[] = [
  { key: 'morality', name: 'usr-morality', type: 'number', value: 50, desc: '道德' },
  { key: 'bag_full', name: 'usr-bag_full', type: 'boolean', value: false },
]
const conds: CondTpl[] = [{ key: 'rich', name: 'usr-rich', when: { mode: 'all', items: [{ name: 'usr-morality', op: 'greater', value: 10 }] } }]
const checks: PoolRoundCheck[] = [
  {
    alias: 'pay',
    when: { mode: 'all', items: [{ name: 'usr-morality', op: 'greater', value: 5 }] },
    pool: [{ name: 'usr-morality', op: 'minus', value: 1 }],
  },
]

function withPool(over: Partial<Project> = {}): Project {
  return { ...fixtureProject(), pool: vars, conds, checks, ...over }
}

const keys = (issues: { key: string }[]): string[] => issues.map((i) => i.key)

describe('数据归一（§2.2 / §2.4 / §7.3）', () => {
  it('声明侧强制补 usr-：连 engine- 开头也要归入作者空间', () => {
    const { pool } = normalizePoolSection({ pool: [{ key: 'aaa', type: 'number', value: 1 }, { key: 'engine-bbb', type: 'string', value: 'x' }] })
    expect(pool.map((v) => v.name)).toEqual(['usr-aaa', 'usr-engine-bbb'])
    expect(pool[0].key).toBe('aaa')
  })

  it('缺 type / value 时按类型取零值（§7.3）', () => {
    const { pool } = normalizePoolSection({ pool: [{ key: 'n' }, { key: 's', type: 'string' }, { key: 'b', type: 'boolean' }] })
    expect(pool.map((v) => v.value)).toEqual([0, '', false])
  })

  it('引用侧无前缀补 usr-，engine- / usr- 原样（§2.4）', () => {
    expect(normalizeCheckRef({ mode: 'all', items: [{ name: 'morality', op: 'greater', value: 1 }, { name: 'engine-round', op: 'greater', value: 0 }] })).toEqual({
      mode: 'all',
      items: [
        { name: 'usr-morality', op: 'greater', value: 1 },
        { name: 'engine-round', op: 'greater', value: 0 },
      ],
    })
    expect(normalizeCheckRef('rich')).toBe('usr-rich')
  })

  it('门锁 pool 补齐引用（§6.4）', () => {
    const def = normalizeGatePool({ id: 'b', gate: { tags: ['t'], pool: [{ name: 'g', op: 'equals', value: true }] } })
    expect(def.gate).toEqual({ tags: ['t'], pool: { mode: 'all', items: [{ name: 'usr-g', op: 'equals', value: true }] } })
  })

  it('对话记录里旧的 when 读作单分支 if（§7.3）', () => {
    const { npc } = normalizeNpc({ id: 'n', name: '商人', dialogs: { mod1: [{ message: '你好', when: { mode: 'all', items: [{ name: 'g', op: 'greater', value: 1 }] } }] } } as unknown as NpcDef)
    const node = (npc.dialogs.mod1 as DialogNode[])[0]
    expect((node as unknown as Record<string, unknown>).when).toBeUndefined()
    expect(node.if).toEqual({ mode: 'all', items: [{ name: 'usr-g', op: 'greater', value: 1 }] })
    expect(Object.keys(node)[0]).toBe('if')
  })
})

describe('`.pmod` 的 ## Pool 段往返（§7.1）', () => {
  it('导出 → 解析：三组声明一致，声明写短名、引用写全名', () => {
    const { text } = exportPmod(library, withPool())
    expect(text).toContain('## Pool')
    const parsed = parsePmod(text)
    expect(parsed.pool).toEqual(vars)
    expect(parsed.conds).toEqual(conds)
    expect(parsed.checks).toEqual(checks)
    expect(parsed.warnings).toEqual([])
  })

  it('三组全空 → 不写该段（老文件不变长）', () => {
    const { text } = exportPmod(library, fixtureProject())
    expect(text).not.toContain('## Pool')
  })

  it('手写文件：声明短名与引用无前缀都补齐', () => {
    const text = [
      '<!-- charset: utf-8 -->',
      '## Background',
      '',
      '## Components',
      '',
      '## Rules',
      '',
      '## Maps',
      '',
      '## Pool',
      '',
      '```yaml',
      'pool:',
      '- key: morality',
      '  type: number',
      '  value: 5',
      'checks:',
      '- alias: pay',
      '  when:',
      '    mode: all',
      '    items:',
      '    - name: morality',
      '      op: greater',
      '      value: 1',
      '  pool:',
      '  - name: morality',
      '    op: minus',
      '    value: 1',
      '```',
      '',
    ].join('\n')
    const parsed = parsePmod(text)
    expect(parsed.pool[0].name).toBe('usr-morality')
    expect((parsed.checks[0].when as PoolCheck).items[0].name).toBe('usr-morality')
    expect(parsed.checks[0].pool[0].name).toBe('usr-morality')
  })
})

describe('专项校验 K20~K37（§十）', () => {
  it('干净的声明与引用不报池问题', () => {
    expect(poolIssues(library, withPool())).toEqual([])
  })

  it('K20 引用没有声明的键（含 ref 侧）', () => {
    const bad = withPool({ checks: [{ when: { mode: 'all', items: [{ name: 'usr-ghost', op: 'equals', value: 1 }] }, pool: [] }] })
    expect(keys(poolIssues(library, bad))).toContain('K20')
  })

  it('K21 变量重复声明 / K27 短名含连字符', () => {
    const bad = withPool({ pool: [{ name: 'usr-a', type: 'number', value: 1 }, { name: 'usr-a', type: 'number', value: 2 }, { name: 'usr-b-c', type: 'number', value: 0 }] })
    const got = keys(poolIssues(library, bad))
    expect(got).toContain('K21')
    expect(got).toContain('K27')
  })

  it('K22 除以零 / K23 写只读引擎键 / K26 算子与类型不符', () => {
    const bad = withPool({
      checks: [
        {
          when: { mode: 'all', items: [] },
          pool: [
            { name: 'usr-morality', op: 'divide', value: 0 },
            { name: 'engine-patk', op: 'set', value: 1 },
          ],
        },
      ],
      conds: [{ name: 'usr-t', when: { mode: 'all', items: [{ name: 'usr-morality', op: 'contain', value: 'x' }] } }],
    })
    const got = keys(poolIssues(library, bad))
    expect(got).toContain('K22')
    expect(got).toContain('K23')
    expect(got).toContain('K26')
  })

  it('K25 空条件 / K35 模板没有声明 / K36 模板与变量重名', () => {
    const bad = withPool({
      conds: [{ name: 'usr-morality', when: { mode: 'all', items: [] } }],
      checks: [{ when: 'usr-nope', pool: [] }],
    })
    const got = keys(poolIssues(library, bad))
    expect(got).toContain('K25')
    expect(got).toContain('K35')
    expect(got).toContain('K36')
  })

  it('K28 依赖不存在 / K29 别名重复 / K30 依赖成环', () => {
    const bad = withPool({
      checks: [
        { alias: 'a', deps: ['b'], when: { mode: 'all', items: [] }, pool: [] },
        { alias: 'b', deps: ['a'], when: { mode: 'all', items: [] }, pool: [] },
        { alias: 'b', deps: ['ghost'], when: { mode: 'all', items: [] }, pool: [] },
      ],
    })
    const got = keys(poolIssues(library, bad))
    expect(got).toContain('K28')
    expect(got).toContain('K29')
    expect(got).toContain('K30')
  })

  it('K32 引用的道具不在组件库', () => {
    const bad = withPool({
      checks: [{ when: { mode: 'all', items: [{ name: 'engine-item.没有这件', op: 'greater', value: 0 }] }, pool: [] }],
    })
    expect(keys(poolIssues(library, bad))).toContain('K32')
  })

  it('K37 同时写 value 与 ref', () => {
    const bad = withPool({
      checks: [{ when: { mode: 'all', items: [{ name: 'usr-morality', op: 'equals', value: 1, ref: 'usr-bag_full' }] }, pool: [] }],
    })
    expect(keys(poolIssues(library, bad))).toContain('K37')
  })

  it('K33 / K34 对话树：同层混用骰子、条件分支不在末尾', () => {
    const npc = structureNpc()
    const bad = withPool()
    const lib = { ...library, npcs: [...library.npcs, npc] }
    const got = keys(poolIssues(lib, bad))
    expect(got).toContain('K33')
    expect(got).toContain('K34')
  })
})

/** 造一个含「同层混用」「条件分支不在末尾」的 NPC */
function structureNpc(): NpcDef {
  return {
    id: 'k_npc',
    name: '测试商贩',
    dialogs: {
      mod1: [
        { message: '第一条', if: { mode: 'all', items: [{ name: 'usr-morality', op: 'greater', value: 1 }] } },
        { message: '第二条', hit: [0, 0] },
        { message: '第三条', if: { mode: 'all', items: [{ name: 'usr-bag_full', op: 'equals', value: true }] } },
      ],
    },
  } as unknown as NpcDef
}
