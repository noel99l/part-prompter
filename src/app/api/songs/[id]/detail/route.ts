import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { getSongAccess } from '@/lib/songAccess'

// 詳細画面用に楽曲・メンバー・歌詞を1リクエストで返す。
// 個別エンドポイント3本を順に呼ぶとサーバーレス起動とDB接続がその本数分
// 発生するため、ここでまとめて並列取得する。
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const withAccess = req.nextUrl.searchParams.get('access') === '1'

  const [songRes, membersRes, lyricsRes, session] = await Promise.all([
    query(`
      SELECT s.*, u.account_name as created_by_name
      FROM prompter_songs s
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.id = $1
    `, [id]),
    query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id]),
    query(`SELECT * FROM prompter_lyrics WHERE song_id=$1 ORDER BY block_index, line_index`, [id]),
    withAccess ? auth() : Promise.resolve(null),
  ])

  if (!songRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let canManageSong = false
  if (withAccess && session?.user?.email) {
    const access = await getSongAccess(id, session.user.email)
    canManageSong = access?.isOwner ?? false
  }

  return NextResponse.json({
    song: { ...songRes.rows[0], can_manage_song: canManageSong },
    members: membersRes.rows,
    lyrics: lyricsRes.rows,
  })
}
