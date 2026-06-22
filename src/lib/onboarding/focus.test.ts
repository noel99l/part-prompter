import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { nextFocusIndex } from './focus'

const NUM_RUNS = 100

describe('focus.nextFocusIndex', () => {
  it('戻り値は [0,count) に収まり、末尾→先頭・先頭→末尾 にラップする', () => {
    // Feature: user-onboarding, Property 5: フォーカストラップのラップ計算
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.boolean(),
        (count, shift) => {
          return fc.assert(
            fc.property(fc.integer({ min: 0, max: count - 1 }), (current) => {
              const result = nextFocusIndex(current, count, shift)
              // 範囲内
              expect(result).toBeGreaterThanOrEqual(0)
              expect(result).toBeLessThanOrEqual(count - 1)
              // ラップとステップ
              if (!shift && current === count - 1) {
                expect(result).toBe(0)
              } else if (shift && current === 0) {
                expect(result).toBe(count - 1)
              } else if (!shift) {
                expect(result).toBe(current + 1)
              } else {
                expect(result).toBe(current - 1)
              }
            }),
            { numRuns: NUM_RUNS }
          )
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
