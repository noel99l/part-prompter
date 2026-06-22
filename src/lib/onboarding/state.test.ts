import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  shouldShowOnboarding,
  nextView,
  prevView,
  canGoBack,
  tourProgress,
  TOUR_TOTAL,
  type OnboardingView,
} from './state'

const NUM_RUNS = 100

// 全 view を生成するアービトラリ
const viewArb: fc.Arbitrary<OnboardingView> = fc.oneof(
  fc.constant<OnboardingView>({ kind: 'welcome' }),
  fc
    .integer({ min: 1, max: TOUR_TOTAL })
    .map<OnboardingView>((step) => ({ kind: 'tour', step })),
  fc.constant<OnboardingView>({ kind: 'finalAction' })
)

describe('state.shouldShowOnboarding', () => {
  it('account_name 設定済み かつ 未完了 のときのみ true', () => {
    // Feature: user-onboarding, Property 1: 表示判定はアカウント名設定済みかつ未完了のときのみ真
    const accountNameArb = fc.oneof(
      fc.constant<string | null>(null),
      fc.constant(''),
      fc.constant('   '),
      fc.string({ minLength: 1 }).map((s) => `name-${s}`)
    )
    const completedArb = fc.oneof(
      fc.constant<string | null>(null),
      fc.date().map((d) => d.toISOString())
    )
    fc.assert(
      fc.property(accountNameArb, completedArb, (accountName, onboardingCompletedAt) => {
        const result = shouldShowOnboarding({ accountName, onboardingCompletedAt })
        const expected =
          !!accountName && accountName.trim().length > 0 && onboardingCompletedAt == null
        expect(result).toBe(expected)
      }),
      { numRuns: NUM_RUNS }
    )
  })
})

describe('state transitions', () => {
  it('next を最大 TOUR_TOTAL 回で finalAction 到達、finalAction で不動点、tour step は 1..5', () => {
    // Feature: user-onboarding, Property 2: ステップ遷移の前進と戻りの整合性
    fc.assert(
      fc.property(viewArb, (view) => {
        // 前進を繰り返すと必ず finalAction に到達する
        let cur = view
        for (let i = 0; i < TOUR_TOTAL + 1; i++) {
          if (cur.kind === 'tour') {
            expect(cur.step).toBeGreaterThanOrEqual(1)
            expect(cur.step).toBeLessThanOrEqual(TOUR_TOTAL)
          }
          cur = nextView(cur)
        }
        expect(cur.kind).toBe('finalAction')
        // finalAction は不動点
        expect(nextView({ kind: 'finalAction' })).toEqual({ kind: 'finalAction' })

        // next の後に prev で往復一致（finalAction へ進むケースを除く）
        if (view.kind === 'tour' && view.step < TOUR_TOTAL) {
          expect(prevView(nextView(view))).toEqual(view)
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('canGoBack は tour step n>=2 のときのみ true', () => {
    // Feature: user-onboarding, Property 3: 戻る操作要素の表示可否
    fc.assert(
      fc.property(viewArb, (view) => {
        const expected = view.kind === 'tour' && view.step >= 2
        expect(canGoBack(view)).toBe(expected)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('tourProgress は tour で {current:n,total:5}、非 tour で null', () => {
    // Feature: user-onboarding, Property 4: ツアー進捗表示は現在ステップと総数5を反映
    fc.assert(
      fc.property(viewArb, (view) => {
        const p = tourProgress(view)
        if (view.kind === 'tour') {
          expect(p).toEqual({ current: view.step, total: TOUR_TOTAL })
          expect(p!.total).toBe(5)
        } else {
          expect(p).toBeNull()
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })
})
