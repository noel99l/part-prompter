import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { auth } from '@/auth'
import crypto from 'crypto'
import { isMasterEmail } from '@/lib/permissions'

async function canEdit(songId: string, email: string): Promise<boolean> {
  if (await isMasterEmail(email)) return true
  const res = await query(`
    SELECT 1 FROM prompter_songs s
    LEFT JOIN users u ON u.id = s.created_by
    LEFT JOIN song_collaborators sc ON sc.song_id = s.id
    LEFT JOIN song_collaborator_members scm ON scm.collaborator_id = sc.id
    LEFT JOIN users cu ON cu.id = scm.user_id
    WHERE s.id = $1 AND (u.email = $2 OR cu.email = $2)
    LIMIT 1
  `, [songId, email])
  return res.rows.length > 0
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEdit(id, session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 招待リンク一覧
  const links = await query(`
    SELECT sc.id, sc.token, sc.expires_at, sc.created_at,
      u.account_name as invited_by_name
    FROM song_collaborators sc
    LEFT JOIN users u ON u.id = sc.invited_by
    WHERE sc.song_id = $1
    ORDER BY sc.created_at DESC
  `, [id])

  // 参加者一覧（ユーザー単位・重複なし）
  const members = await query(`
    SELECT DISTINCT ON (scm.user_id) scm.id, scm.user_id, scm.joined_at, cu.account_name as user_name
    FROM song_collaborator_members scm
    JOIN song_collaborators sc ON sc.id = scm.collaborator_id
    LEFT JOIN users cu ON cu.id = scm.user_id
    WHERE sc.song_id = $1
    ORDER BY scm.user_id, scm.joined_at
  `, [id])

  return NextResponse.json({
    links: links.rows.map((l: any) => ({
      ...l,
      expired: new Date(l.expires_at) < new Date(),
    })),
    members: members.rows,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEdit(id, session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = userRes.rows[0]?.id
  const token = crypto.randomBytes(32).toString('hex')
  const body = await req.json().catch(() => ({}))
  const expireMinutes = Math.min(Math.max(Number(body.expireMinutes) || 10080, 30), 43200)
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000)

  // 期限切れのリンクを自動削除
  await query(`DELETE FROM song_collaborators WHERE song_id = $1 AND expires_at < NOW()`, [id])

  const result = await query(`
    INSERT INTO song_collaborators (song_id, invited_by, token, expires_at)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [id, userId, token, expiresAt])
  return NextResponse.json({ ...result.rows[0], members: [], expired: false })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEdit(id, session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: collabId, memberId } = await req.json()

  if (memberId) {
    // 共同編集者（ユーザー）を削除
    await query(`
      DELETE FROM song_collaborator_members scm
      USING song_collaborators sc
      WHERE scm.id = $1 AND sc.song_id = $2 AND scm.collaborator_id = sc.id
    `, [memberId, id])
  } else {
    // 招待リンクを削除
    await query(`DELETE FROM song_collaborators WHERE id = $1 AND song_id = $2`, [collabId, id])
  }

  return NextResponse.json({ ok: true })
}
