// APIの呼び出し回数制限（一定時間内の回数を数える固定ウィンドウ方式）。
//
// カウンターはサーバーのメモリに持つ。サーバーレス環境ではインスタンスごとに別々に
// 数えるため、厳密な上限にはならない（インスタンス数ぶん多く通ることがある）。
// 1ユーザーの連打や暴走したスクリプトを止める目的のもので、大規模な攻撃への備えは
// ホスティング側（Vercel Firewall など）の制限と併用する。

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export interface RateLimitResult {
  allowed: boolean
  /** 次に呼べるようになるまでの秒数（allowed のときは 0） */
  retryAfterSec: number
}

/**
 * key ごとに、windowMs の間に limit 回まで許可する。
 * @param now テスト用。省略時は現在時刻
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) pruneExpired(now)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: 0 }
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  bucket.count += 1
  return { allowed: true, retryAfterSec: 0 }
}

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // 期限切れを消しても溢れている場合は、古い順に捨てて上限を守る
  if (buckets.size >= MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS + 1
    let removed = 0
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (++removed >= excess) break
    }
  }
}

/** テスト用: カウンターを全消去する */
export function resetRateLimits() {
  buckets.clear()
}

export const RATE_LIMIT_MESSAGE = 'リクエストが多すぎます。しばらく待ってからもう一度お試しください。'

/** 制限超過時の 429 応答（Retry-After 付き） */
export function rateLimitedResponse(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: RATE_LIMIT_MESSAGE }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
  })
}
