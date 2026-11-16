import { beforeEach, describe, expect, it } from 'vitest'
import { consumeRateLimit, rateLimitedResponse, resetRateLimits } from './rateLimit'

describe('consumeRateLimit', () => {
  beforeEach(() => resetRateLimits())

  it('上限回数までは許可し、超えたら拒否する', () => {
    const now = 1_000_000
    expect(consumeRateLimit('a', 3, 60_000, now).allowed).toBe(true)
    expect(consumeRateLimit('a', 3, 60_000, now + 1).allowed).toBe(true)
    expect(consumeRateLimit('a', 3, 60_000, now + 2).allowed).toBe(true)
    expect(consumeRateLimit('a', 3, 60_000, now + 3).allowed).toBe(false)
  })

  it('拒否時は、次に呼べるまでの秒数を返す', () => {
    const now = 1_000_000
    consumeRateLimit('a', 1, 60_000, now)
    expect(consumeRateLimit('a', 1, 60_000, now + 15_000)).toEqual({ allowed: false, retryAfterSec: 45 })
  })

  it('ウィンドウが過ぎれば回数はリセットされる', () => {
    const now = 1_000_000
    consumeRateLimit('a', 1, 60_000, now)
    expect(consumeRateLimit('a', 1, 60_000, now + 59_999).allowed).toBe(false)
    expect(consumeRateLimit('a', 1, 60_000, now + 60_000).allowed).toBe(true)
  })

  it('キーが違えば別々に数える', () => {
    const now = 1_000_000
    consumeRateLimit('user-1', 1, 60_000, now)
    expect(consumeRateLimit('user-1', 1, 60_000, now).allowed).toBe(false)
    expect(consumeRateLimit('user-2', 1, 60_000, now).allowed).toBe(true)
  })

  it('キーが大量に増えても、新しいキーを正しく数え続ける', () => {
    const now = 1_000_000
    for (let i = 0; i < 6000; i++) consumeRateLimit(`k${i}`, 1, 60_000, now)
    expect(consumeRateLimit('new-key', 1, 60_000, now).allowed).toBe(true)
    expect(consumeRateLimit('new-key', 1, 60_000, now).allowed).toBe(false)
  })
})

describe('rateLimitedResponse', () => {
  it('429 と Retry-After を返す', async () => {
    const res = rateLimitedResponse(30)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect((await res.json()).error).toContain('リクエストが多すぎます')
  })
})
