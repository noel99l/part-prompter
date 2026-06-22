import { describe, it, expect, vi, beforeEach } from 'vitest'

const authMock = vi.fn()
const getStatusMock = vi.fn()
const recordMock = vi.fn()

vi.mock('@/auth', () => ({ auth: () => authMock() }))
vi.mock('@/lib/onboarding/service', () => ({
  getOnboardingStatus: (...a: unknown[]) => getStatusMock(...a),
  recordOnboardingComplete: (...a: unknown[]) => recordMock(...a),
}))

import { GET, POST } from './route'

beforeEach(() => {
  authMock.mockReset()
  getStatusMock.mockReset()
  recordMock.mockReset()
})

describe('GET /api/onboarding', () => {
  it('未認証で 401', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('認証済みで状態を返す', async () => {
    authMock.mockResolvedValueOnce({ user: { email: 'a@example.com' } })
    getStatusMock.mockResolvedValueOnce({ shouldShow: true, completedAt: null, error: false })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shouldShow).toBe(true)
  })
})

describe('POST /api/onboarding', () => {
  it('未認証で 401', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('保存失敗でも HTTP 200 + ok:false', async () => {
    authMock.mockResolvedValueOnce({ user: { email: 'a@example.com' } })
    recordMock.mockResolvedValueOnce({ ok: false, completedAt: null })
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('成功で ok:true', async () => {
    authMock.mockResolvedValueOnce({ user: { email: 'a@example.com' } })
    recordMock.mockResolvedValueOnce({ ok: true, completedAt: '2025-01-01T00:00:00.000Z' })
    const res = await POST()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.completedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})
