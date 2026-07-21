import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { auth } from '@/auth'
import { isMasterEmail } from '@/lib/permissions'

// 楽曲ごとの相関サブクエリ3本（メンバー数・歌詞行数・タイムスタンプ数）は
// 曲数×3回のインデックス参照になるため、テーブル1回ずつの GROUP BY 集計に
// まとめて JOIN する。
const COUNT_JOINS = `
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS member_count
    FROM prompter_members GROUP BY song_id
  ) mc ON mc.song_id = s.id
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS lyric_count, COUNT(timestamp_ms) AS timestamp_count
    FROM prompter_lyrics GROUP BY song_id
  ) lc ON lc.song_id = s.id
`

const COUNT_COLS = `
  COALESCE(mc.member_count, 0) AS member_count,
  COALESCE(lc.lyric_count, 0) AS lyric_count,
  COALESCE(lc.timestamp_count, 0) AS timestamp_count
`

export async function GET(req: NextRequest) {
  await initDb()
  const mine = req.nextUrl.searchParams.get('mine')
  const session = mine ? await auth() : null
  const email = mine && session?.user?.email ? session.user.email : null
  const master = email ? await isMasterEmail(email) : false

  const result = master
    ? await query(`
        SELECT s.*, u.account_name as created_by_name, ${COUNT_COLS}
        FROM prompter_songs s
        LEFT JOIN users u ON u.id = s.created_by
        ${COUNT_JOINS}
        ORDER BY s.created_at DESC
      `)
    : email
    ? await query(`
        SELECT s.*, u.account_name as created_by_name, ${COUNT_COLS}
        FROM prompter_songs s
        LEFT JOIN users u ON u.id = s.created_by
        ${COUNT_JOINS}
        WHERE u.email = $1 OR EXISTS (
          SELECT 1 FROM song_collaborators sc
          JOIN song_collaborator_members scm ON scm.collaborator_id = sc.id
          JOIN users cu ON cu.id = scm.user_id
          WHERE sc.song_id = s.id AND cu.email = $1
        )
        ORDER BY s.created_at DESC
      `, [email])
    : await query(`
        SELECT s.*, u.account_name as created_by_name, ${COUNT_COLS}
        FROM prompter_songs s
        LEFT JOIN users u ON u.id = s.created_by
        ${COUNT_JOINS}
        WHERE s.is_public = true
        ORDER BY s.created_at DESC
      `)

  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  const { title, artist } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  let userId = null
  if (session?.user?.email) {
    const u = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
    userId = u.rows[0]?.id ?? null
  }

  const result = await query(
    `INSERT INTO prompter_songs (title, artist, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [title, artist || '', userId]
  )
  return NextResponse.json(result.rows[0])
}
