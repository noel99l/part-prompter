import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { consumeRateLimit, rateLimitedResponse } from '@/lib/rateLimit'

const QUERY_MAX = 100

// 外部の歌詞検索サービス（LRCLIB）への中継。楽曲作成画面からだけ使う。
// 誰でも無制限に呼べると、このサーバーを踏み台に外部サービスへ大量アクセスできてしまうため、
// ログイン必須にして、1ユーザーあたり1分に30回までにする。
export async function GET(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = consumeRateLimit(`lrclib:${email}`, 30, 60_000)
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSec)

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, QUERY_MAX)
  if (!q) return NextResponse.json([])

  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'part-prompter/1.0' },
    })
    if (!res.ok) return NextResponse.json({ error: '歌詞検索サービスに接続できませんでした。' }, { status: 502 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: '歌詞検索サービスに接続できませんでした。' }, { status: 502 })
  }
}
