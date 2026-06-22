import { describe, it, expect, vi, beforeEach } from 'vitest'

// @/lib/db の query をモックする
const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}))

import { getOnboardingStatus, recordOnboardingComplete } from './service'

beforeEach(() => {
  queryMock.mockReset()
})

describe('getOnboardingStatus', () => {
  it('account_name 設定済み・未完了で shouldShow=true', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ account_name: '山田', onboarding_completed_at: null }],
    })
    const res = await getOnboardingStatus('a@example.com')
    expect(res).toEqual({ shouldShow: true, completedAt: null, error: false })
  })

  it('完了済みで shouldShow=false', async () => {
    const d = new Date('2025-01-01T00:00:00.000Z')
    queryMock.mockResolvedValueOnce({
      rows: [{ account_name: '山田', onboarding_completed_at: d }],
    })
    const res = await getOnboardingStatus('a@example.com')
    expect(res.shouldShow).toBe(false)
    expect(res.error).toBe(false)
    expect(res.completedAt).toBe(d.toISOString())
  })

  it('取得失敗時は error:true・shouldShow:false', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'))
    const res = await getOnboardingStatus('a@example.com')
    expect(res).toEqual({ shouldShow: false, completedAt: null, error: true })
  })
})

describe('recordOnboardingComplete', () => {
  it('成功時は ok:true・completedAt を返す', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await recordOnboardingComplete('a@example.com')
    expect(res.ok).toBe(true)
    expect(res.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  })

  it('UPDATE 失敗時は ok:false・値不変（completedAt:null）', async () => {
    queryMock.mockRejectedValueOnce(new Error('update failed'))
    const res = await recordOnboardingComplete('a@example.com')
    expect(res).toEqual({ ok: false, completedAt: null })
  })
})
