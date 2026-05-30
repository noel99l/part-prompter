import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { auth } from '@/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await query(`
    SELECT sc.*, s.title, s.artist, u.account_name as invited_by_name
    FROM song_collaborators sc
    JOIN prompter_songs s ON s.id = sc.song_id
    LEFT JOIN users u ON u.id = sc.invited_by
    WHERE sc.token = $1
  `, [token])
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const invite = result.rows[0]
  const session = await auth()
  let alreadyJoined = false
  if (session?.user?.email) {
    const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
    const userId = userRes.rows[0]?.id
    if (userId) {
      const existing = await query(`
        SELECT scm.id FROM song_collaborator_members scm
        JOIN song_collaborators sc ON sc.id = scm.collaborator_id
        WHERE sc.song_id = $1 AND scm.user_id = $2
        LIMIT 1
      `, [invite.song_id, userId])
      alreadyJoined = !!existing.rows[0]
    }
  }

  return NextResponse.json({ ...invite, alreadyJoined })
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inv = await query(`SELECT * FROM song_collaborators WHERE token = $1`, [token])
  const invite = inv.rows[0]
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Expired' }, { status: 400 })

  const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = userRes.rows[0]?.id
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // 作成者自身は承認不可
  const songRes = await query(`SELECT created_by FROM prompter_songs WHERE id = $1`, [invite.song_id])
  if (songRes.rows[0]?.created_by === userId) return NextResponse.json({ error: 'Owner cannot accept' }, { status: 400 })

  // 既に参加済みかチェック（同じ楽曲の別リンク含む）
  const existing = await query(`
    SELECT scm.id FROM song_collaborator_members scm
    JOIN song_collaborators sc ON sc.id = scm.collaborator_id
    WHERE sc.song_id = $1 AND scm.user_id = $2
    LIMIT 1
  `, [invite.song_id, userId])
  if (existing.rows[0]) return NextResponse.json({ ok: true, songId: invite.song_id, alreadyJoined: true })

  // 参加者として登録
  await query(`INSERT INTO song_collaborator_members (collaborator_id, user_id) VALUES ($1, $2)`, [invite.id, userId])

  return NextResponse.json({ ok: true, songId: invite.song_id })
}
