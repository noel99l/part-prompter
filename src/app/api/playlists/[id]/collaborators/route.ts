import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { getPlaylistAccess } from '@/lib/playlistAccess'

async function requireOwner(id: string) {
  const session = await auth()
  if (!session?.user?.email) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.isOwner) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { access }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const authorization = await requireOwner(id)
  if ('error' in authorization) return authorization.error

  const [links, members] = await Promise.all([
    query(`
      SELECT pci.id, pci.token, pci.expires_at, pci.created_at,
        u.account_name AS invited_by_name
      FROM playlist_collaboration_invites pci
      LEFT JOIN users u ON u.id = pci.invited_by
      WHERE pci.playlist_id = $1
      ORDER BY pci.created_at DESC
    `, [id]),
    query(`
      SELECT pc.id, pc.user_id, pc.joined_at, u.account_name AS user_name
      FROM playlist_collaborators pc
      LEFT JOIN users u ON u.id = pc.user_id
      WHERE pc.playlist_id = $1
      ORDER BY pc.joined_at
    `, [id]),
  ])

  return NextResponse.json({
    links: links.rows.map((link: Record<string, unknown>) => ({
      ...link,
      expired: new Date(link.expires_at as string) < new Date(),
    })),
    members: members.rows,
  })
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const authorization = await requireOwner(id)
  if ('error' in authorization) return authorization.error

  const body = await req.json().catch(() => ({}))
  const expireMinutes = Math.min(Math.max(Number(body.expireMinutes) || 10080, 30), 43200)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000)

  await query(
    `DELETE FROM playlist_collaboration_invites WHERE playlist_id = $1 AND expires_at < NOW()`,
    [id]
  )
  const result = await query(`
    INSERT INTO playlist_collaboration_invites (playlist_id, invited_by, token, expires_at)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [id, authorization.access.userId, token, expiresAt])
  return NextResponse.json({ ...result.rows[0], expired: false }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const authorization = await requireOwner(id)
  if ('error' in authorization) return authorization.error

  const { id: inviteId, memberId } = await req.json()
  if (memberId) {
    await query(
      `DELETE FROM playlist_collaborators WHERE id = $1 AND playlist_id = $2`,
      [memberId, id]
    )
  } else if (inviteId) {
    await query(
      `DELETE FROM playlist_collaboration_invites WHERE id = $1 AND playlist_id = $2`,
      [inviteId, id]
    )
  } else {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
