'use client'

// APIレスポンスのメモリキャッシュ。SPA遷移をまたいで生存し、リロードで消える。
// stale-while-revalidate 方式: キャッシュ済みならまず即座に返して描画させ、
// 裏で再取得して変化があれば onUpdate で通知する。
const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

function fetchAndStore(url: string): Promise<unknown> {
  const existing = inflight.get(url)
  if (existing) return existing
  const p = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`fetch failed: ${r.status} ${url}`)
      return r.json()
    })
    .then(data => {
      cache.set(url, data)
      return data
    })
    .finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

export function getCachedJson(url: string, onUpdate?: (data: any) => void): Promise<any> {
  if (cache.has(url)) {
    const prev = cache.get(url)
    fetchAndStore(url)
      .then(data => {
        if (onUpdate && JSON.stringify(data) !== JSON.stringify(prev)) onUpdate(data)
      })
      .catch(() => {})
    return Promise.resolve(prev)
  }
  return fetchAndStore(url)
}

// リンクのホバーなど、遷移前にデータを温めておくための先読み。
export function prefetchJson(url: string) {
  if (!cache.has(url)) fetchAndStore(url).catch(() => {})
}
