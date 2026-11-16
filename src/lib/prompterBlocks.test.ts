import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { buildDisplayBlocks, type PromptLine, type PromptLayout } from './prompterBlocks'

const line = (text: string, ts: number | null = null): PromptLine => ({ text, timestamp_ms: ts })
// lineFont 10px / contentW 1000px = 全角100文字までは折り返しなし
const layout = (maxRows: number): PromptLayout => ({ maxRows, lineFont: 10, contentW: 1000 })

describe('buildDisplayBlocks', () => {
  it('画面に収まるブロックは分割されない', () => {
    const blocks = [[line('あ'), line('い')], [line('う')]]
    const result = buildDisplayBlocks(blocks, layout(3), true)
    expect(result.map(c => c.lines.length)).toEqual([2, 1])
  })

  it('収まらないブロックは1ページの上限まで詰める（上限5行の7行 → 5+2）', () => {
    const blocks = [Array.from({ length: 7 }, (_, i) => line(`行${i}`))]
    const result = buildDisplayBlocks(blocks, layout(5), true)
    expect(result.map(c => c.lines.length)).toEqual([5, 2])
  })

  it('autoSplit=false では元ブロックがそのまま使われる', () => {
    const blocks = [Array.from({ length: 7 }, (_, i) => line(`行${i}`))]
    const result = buildDisplayBlocks(blocks, layout(2), false)
    expect(result.map(c => c.lines.length)).toEqual([7])
  })

  it('パート分けの元ブロック境界では必ずページが変わる（ブロックをまたいで結合されない）', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 1, maxLength: 8 }),
          { minLength: 1, maxLength: 6 }
        ),
        fc.integer({ min: 1, max: 5 }),
        fc.boolean(),
        (blockShapes, maxRows, autoSplit) => {
          const blocks = blockShapes.map(lens => lens.map(len => line('あ'.repeat(len))))
          const chunks = buildDisplayBlocks(blocks, { maxRows, lineFont: 10, contentW: 300 }, autoSplit)

          // 全行が順序を保って過不足なく含まれる
          expect(chunks.flatMap(c => c.lines)).toEqual(blocks.flat())

          // 各チャンクの行はすべて同一の元ブロックに属する（参照で判定）
          for (const chunk of chunks) {
            const owner = blocks.find(b => b.includes(chunk.lines[0]))
            expect(owner).toBeDefined()
            for (const l of chunk.lines) expect(owner!.includes(l)).toBe(true)
          }

          // 各元ブロックの先頭行は必ずいずれかのチャンクの先頭（＝新しいページ）になる
          for (const block of blocks) {
            expect(chunks.some(c => c.lines[0] === block[0])).toBe(true)
          }
        }
      )
    )
  })

  it('折り返しの長い行は視覚行数として数えて分割する', () => {
    // contentW 300px / lineFont 10px = 30文字で折り返し。60文字の行は2視覚行
    const blocks = [[line('あ'.repeat(60)), line('あ'.repeat(60)), line('あ'.repeat(60))]]
    const result = buildDisplayBlocks(blocks, { maxRows: 4, lineFont: 10, contentW: 300 }, true)
    // 計6視覚行なので2ページ以上に分かれ、各ページは4視覚行以内
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.flatMap(c => c.lines)).toEqual(blocks[0])
  })

  it('分割チャンクの開始時刻は前後ブロックのタイムスタンプから比例配分される', () => {
    const blocks = [
      [line('a', 1000), line('b'), line('c'), line('d')],
      [line('e', 5000)],
    ]
    const result = buildDisplayBlocks(blocks, layout(2), true)
    expect(result.map(c => c.lines.length)).toEqual([2, 2, 1])
    expect(result[0].startMs).toBe(1000)
    expect(result[1].startMs).toBe(3000) // 1000 + (5000-1000) × 2/4
    expect(result[2].startMs).toBe(5000)
  })

  it('分割チャンクの先頭行にタイムスタンプがあればそれを優先する', () => {
    const blocks = [
      [line('a', 1000), line('b'), line('c', 2500), line('d')],
      [line('e', 5000)],
    ]
    const result = buildDisplayBlocks(blocks, layout(2), true)
    expect(result[1].startMs).toBe(2500)
  })

  it('後続ブロックにタイムスタンプがなければ分割チャンクの開始時刻はnull', () => {
    const blocks = [[line('a', 1000), line('b'), line('c'), line('d')]]
    const result = buildDisplayBlocks(blocks, layout(2), true)
    expect(result[0].startMs).toBe(1000)
    expect(result[1].startMs).toBeNull()
  })

  describe('extraRows（行ごとの追加の高さ）', () => {
    // チャンク先頭の行だけ 0.5 行分の高さが増える（パート名ラベルを想定）
    const headOnly = (_l: PromptLine, prev: PromptLine | null) => (prev === null ? 0.5 : 0)

    it('追加の高さを含めて収まるならブロックは分割されない', () => {
      const blocks = [[line('a'), line('b'), line('c')]]
      const result = buildDisplayBlocks(blocks, layout(3.5), true, headOnly)
      expect(result.map(c => c.lines.length)).toEqual([3])
    })

    it('追加の高さで上限を超えるなら分割され、各チャンクが上限に収まる', () => {
      // 3行 + 先頭ラベル0.5 = 3.5行 > 上限3 → 2行(2.5) + 1行(1.5)
      const blocks = [[line('a'), line('b'), line('c')]]
      const result = buildDisplayBlocks(blocks, layout(3), true, headOnly)
      expect(result.map(c => c.lines.length)).toEqual([2, 1])
    })

    it('チャンク先頭になった行には prev=null が渡される', () => {
      const blocks = [[line('a'), line('b'), line('c'), line('d')]]
      const heads: string[] = []
      buildDisplayBlocks(blocks, layout(2.5), true, (l, prev) => {
        if (prev === null) heads.push(l.text)
        return prev === null ? 0.5 : 0
      })
      // 分割後のチャンク先頭は a と c（a は収まり判定時にも先頭として評価される）
      expect([...new Set(heads)]).toEqual(['a', 'c'])
    })

    it('extraRows を渡さなければ従来どおりの分割になる', () => {
      const blocks = [Array.from({ length: 7 }, (_, i) => line(`行${i}`))]
      expect(buildDisplayBlocks(blocks, layout(5), true).map(c => c.lines.length)).toEqual([5, 2])
    })
  })
})
