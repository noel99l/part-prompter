import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { consumeRateLimit, rateLimitedResponse } from '@/lib/rateLimit'

const QUERY_MAX = 100

// 公開曲の検索（曲名・アーティスト・歌詞の部分一致）。セットリスト編集画面からだけ使う。
// 歌詞全体を対象にした重い検索なので、ログイン必須にして、1ユーザーあたり1分に60回までにする。
export async function GET(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = consumeRateLimit(`song-search:${email}`, 60, 60_000)
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSec)

  const q = (req.nextUrl.searchParams.get('q')?.trim() || '').slice(0, QUERY_MAX)
  if (!q) return NextResponse.json([])

  const result = await query(`
    SELECT DISTINCT s.id, s.title, s.artist, u.account_name as created_by_name, s.updated_at,
      (SELECT COUNT(*) FROM prompter_lyrics l2 WHERE l2.song_id = s.id) as lyric_count,
      (SELECT COUNT(*) FROM prompter_lyrics l2 WHERE l2.song_id = s.id AND l2.timestamp_ms IS NOT NULL) as timestamp_count,
      (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count
    FROM prompter_songs s
    LEFT JOIN prompter_lyrics l ON l.song_id = s.id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.is_public = true AND (s.title ILIKE $1 OR s.artist ILIKE $1 OR l.text ILIKE $1)
    ORDER BY s.title
    LIMIT 20
  `, [`%${q}%`])

  return NextResponse.json(result.rows)
}
