import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { mergeAssignments, type MergeLine } from './merge'

const NUM_RUNS = 100

// テスト用の行を作るヘルパー
function line(
  text: string,
  member_ids: number[] = [],
  opts: { ts?: number | null; wm?: boolean } = {}
): MergeLine {
  const wm = opts.wm
    ? text.split('').map((c) => ({ text: c, member_ids }))
    : []
  return { text, member_ids, timestamp_ms: opts.ts ?? null, word_members: wm }
}

describe('mergeAssignments パターン網羅', () => {
  it('1. 変更なし: 割り当てがそのまま維持される', () => {
    const existing = [line('A', [1]), line('B', [2]), line('C', [3])]
    const parsed = [line('A'), line('B'), line('C')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => l.member_ids)).toEqual([[1], [2], [3]])
  })

  it('2. 末尾に行追加: 既存は維持・新規は空', () => {
    const existing = [line('A', [1]), line('B', [2])]
    const parsed = [line('A'), line('B'), line('C')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => l.member_ids)).toEqual([[1], [2], []])
  })

  it('3. 中間に行追加: 後続の割り当てがズレない', () => {
    const existing = [line('A', [1]), line('B', [2]), line('C', [3])]
    const parsed = [line('A'), line('X'), line('B'), line('C')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => [l.text, l.member_ids])).toEqual([
      ['A', [1]],
      ['X', []],
      ['B', [2]],
      ['C', [3]],
    ])
  })

  it('4. 行削除: 残りは維持', () => {
    const existing = [line('A', [1]), line('B', [2]), line('C', [3])]
    const parsed = [line('A'), line('C')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => [l.text, l.member_ids])).toEqual([
      ['A', [1]],
      ['C', [3]],
    ])
  })

  it('5. 並べ替え: 割り当てはテキストに追従', () => {
    const existing = [line('A', [1]), line('B', [2]), line('C', [3])]
    const parsed = [line('C'), line('A'), line('B')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => [l.text, l.member_ids])).toEqual([
      ['C', [3]],
      ['A', [1]],
      ['B', [2]],
    ])
  })

  it('6. 同一テキストの繰り返しに別々の割り当て: 出現順で個別に維持（先頭で上書きしない）', () => {
    const existing = [line('サビ', [1]), line('間奏', [9]), line('サビ', [2])]
    const parsed = [line('サビ'), line('間奏'), line('サビ')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => l.member_ids)).toEqual([[1], [9], [2]])
  })

  it('7. 繰り返しが増えた: 増えた分は空', () => {
    const existing = [line('サビ', [1]), line('サビ', [2])]
    const parsed = [line('サビ'), line('サビ'), line('サビ')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => l.member_ids)).toEqual([[1], [2], []])
  })

  it('8. 繰り返しが減った: 余った既存割り当ては破棄され、他テキストへ漏れない', () => {
    const existing = [line('サビ', [1]), line('サビ', [2]), line('終', [5])]
    const parsed = [line('サビ'), line('終')]
    const out = mergeAssignments(existing, parsed)
    expect(out.map((l) => [l.text, l.member_ids])).toEqual([
      ['サビ', [1]],
      ['終', [5]],
    ])
  })

  it('9. タイムスタンプのみ変更（テキスト同一）: 割り当て維持・新しいtsを採用', () => {
    const existing = [line('A', [1], { ts: 1000 })]
    const parsed = [line('A', [], { ts: 2000 })]
    const out = mergeAssignments(existing, parsed)
    expect(out[0].member_ids).toEqual([1])
    expect(out[0].timestamp_ms).toBe(2000)
  })

  it('10. テキストを1文字編集: 割り当ては引き継がれない（誤配置を防ぐ）', () => {
    const existing = [line('あいう', [1], { wm: true })]
    const parsed = [line('あいえ')]
    const out = mergeAssignments(existing, parsed)
    expect(out[0].member_ids).toEqual([])
    expect(out[0].word_members).toEqual([])
  })

  it('11. word_membersの文字数が不一致（破損データ）: word_membersは空・member_idsは保持', () => {
    const broken: MergeLine = {
      text: 'あいうえお', // 5文字
      member_ids: [1],
      timestamp_ms: null,
      word_members: [
        { text: 'か', member_ids: [1] },
        { text: 'き', member_ids: [1] },
      ], // 2件しかない＝不一致
    }
    const parsed = [line('あいうえお')]
    const out = mergeAssignments([broken], parsed)
    expect(out[0].member_ids).toEqual([1])
    expect(out[0].word_members).toEqual([])
  })

  it('11b. word_membersの文字数が一致: そのまま維持', () => {
    const existing = [line('あい', [1], { wm: true })]
    const parsed = [line('あい')]
    const out = mergeAssignments(existing, parsed)
    expect(out[0].word_members).toHaveLength(2)
    expect(out[0].word_members.map((w) => w.text).join('')).toBe('あい')
  })

  it('12. 既存なし / 全て新規: すべて空のまま', () => {
    const out = mergeAssignments([], [line('A'), line('B')])
    expect(out.map((l) => l.member_ids)).toEqual([[], []])
  })
})

describe('mergeAssignments 不変条件（プロパティ）', () => {
  const wordArb = fc.constantFrom('A', 'B', 'C', 'サビ', '間奏', 'D')
  const lineArb = fc.record({
    text: wordArb,
    member_ids: fc.array(fc.integer({ min: 1, max: 5 }), { maxLength: 3 }),
  })

  it('引き継いだ割り当ては必ず同一テキストの既存行由来（他テキストへ漏れない）', () => {
    // Feature: lyrics-merge, Property: no cross-text assignment leakage
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 12 }),
        fc.array(wordArb, { maxLength: 12 }),
        (ex, pTexts) => {
          const existing = ex.map((e) => line(e.text, e.member_ids))
          const parsed = pTexts.map((t) => line(t))
          const out = mergeAssignments(existing, parsed)

          // text ごとの既存 member_ids 集合（順序付き多重集合）
          const byText = new Map<string, number[][]>()
          for (const e of existing) {
            const arr = byText.get(e.text) ?? []
            arr.push(e.member_ids)
            byText.set(e.text, arr)
          }
          for (const o of out) {
            if (o.member_ids.length === 0) continue
            const pool = byText.get(o.text) ?? []
            // 引き継いだ値は、同一テキストの既存行のいずれかに存在する
            expect(pool.some((m) => JSON.stringify(m) === JSON.stringify(o.member_ids))).toBe(true)
          }
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('text と timestamp は常に parsed 側を保持し、行数は parsed と一致', () => {
    // Feature: lyrics-merge, Property: parsed identity preserved
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 10 }),
        fc.array(wordArb, { maxLength: 10 }),
        (ex, pTexts) => {
          const existing = ex.map((e) => line(e.text, e.member_ids))
          const parsed = pTexts.map((t, i) => line(t, [], { ts: i * 100 }))
          const out = mergeAssignments(existing, parsed)
          expect(out).toHaveLength(parsed.length)
          out.forEach((o, i) => {
            expect(o.text).toBe(parsed[i].text)
            expect(o.timestamp_ms).toBe(parsed[i].timestamp_ms)
          })
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('同一テキストで引き継がれる件数は既存件数を超えない', () => {
    // Feature: lyrics-merge, Property: carry count bounded by existing occurrences
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 12 }),
        fc.array(wordArb, { maxLength: 12 }),
        (ex, pTexts) => {
          const existing = ex.map((e) => line(e.text, e.member_ids.length ? e.member_ids : [1]))
          const parsed = pTexts.map((t) => line(t))
          const out = mergeAssignments(existing, parsed)

          const existCount = new Map<string, number>()
          for (const e of existing) existCount.set(e.text, (existCount.get(e.text) ?? 0) + 1)

          const carriedCount = new Map<string, number>()
          for (const o of out) {
            if (o.member_ids.length > 0) carriedCount.set(o.text, (carriedCount.get(o.text) ?? 0) + 1)
          }
          for (const [t, c] of carriedCount) {
            expect(c).toBeLessThanOrEqual(existCount.get(t) ?? 0)
          }
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
