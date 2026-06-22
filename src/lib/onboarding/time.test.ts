import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatCompletionTimestamp } from './time'

const NUM_RUNS = 100
const ISO_MS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

describe('time.formatCompletionTimestamp', () => {
  it('UTC・ミリ秒精度の ISO 8601 を返し、ラウンドトリップが恒等', () => {
    // Feature: user-onboarding, Property 6: 完了時刻整形の往復一致と形式
    fc.assert(
      fc.property(
        // 有効な範囲の Date（過去〜未来）
        fc.date({ min: new Date('1970-01-01T00:00:00.000Z'), max: new Date('2100-01-01T00:00:00.000Z') }),
        (date) => {
          const out = formatCompletionTimestamp(date)
          expect(out).toMatch(ISO_MS_UTC)
          // ラウンドトリップ恒等: 文字列を解釈して再整形しても一致
          expect(formatCompletionTimestamp(new Date(out))).toBe(out)
          expect(new Date(out).getTime()).toBe(date.getTime())
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
