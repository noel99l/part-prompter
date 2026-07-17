import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'

async function findInvite(token: string) {
  const songResult = await query(`
    SELECT sc.*, s.title, s.artist, u.account_name AS invited_by_name,
      'song' AS resource_type, sc.song_id AS resource_id
    FROM song_collaborators sc
    JOIN prompter_songs s ON s.id = sc.song_id
    LEFT JOIN users u ON u.id = sc.invited_by
    WHERE sc.token = $1
  `, [token])
  if (songResult.rows[0]) return songResult.rows[0]

  const playlistResult = await query(`
    SELECT pci.*, p.name AS title, NULL::text AS artist,
      u.account_name AS invited_by_name,
      'playlist' AS resource_type, pci.playlist_id AS resource_id
    FROM playlist_collaboration_invites pci
    JOIN playlists p ON p.id = pci.playlist_id
    LEFT JOIN users u ON u.id = pci.invited_by
    WHERE pci.token = $1
  `, [token])
  return playlistResult.rows[0] ?? null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  await initDb()
  const { token } = await params
  const invite = await findInvite(token)
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await auth()
  let alreadyJoined = false
  if (session?.user?.email) {
    const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
    const userId = userRes.rows[0]?.id
    if (userId && invite.resource_type === 'song') {
      const existing = await query(`
        SELECT scm.id FROM song_collaborator_members scm
        JOIN song_collaborators sc ON sc.id = scm.collaborator_id
        WHERE sc.song_id = $1 AND scm.user_id = $2 LIMIT 1
      `, [invite.resource_id, userId])
      alreadyJoined = !!existing.rows[0]
    } else if (userId) {
      const existing = await query(`
        SELECT id FROM playlist_collaborators
        WHERE playlist_id = $1 AND user_id = $2
      `, [invite.resource_id, userId])
      alreadyJoined = !!existing.rows[0]
    }
  }

  return NextResponse.json({
    ...invite,
    resourceType: invite.resource_type,
    resourceId: invite.resource_id,
    expired: new Date(invite.expires_at) < new Date(),
    alreadyJoined,
  })
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  await initDb()
  const { token } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invite = await findInvite(token)
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Expired' }, { status: 400 })
  }

  const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = userRes.rows[0]?.id
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (invite.resource_type === 'playlist') {
    const playlist = await query(`SELECT created_by FROM playlists WHERE id = $1`, [invite.resource_id])
    if (playlist.rows[0]?.created_by === userId) {
      return NextResponse.json({ error: 'Owner cannot accept' }, { status: 400 })
    }
    const inserted = await query(`
      INSERT INTO playlist_collaborators (playlist_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (playlist_id, user_id) DO NOTHING
      RETURNING id
    `, [invite.resource_id, userId])
    return NextResponse.json({
      ok: true,
      resourceType: 'playlist',
      resourceId: invite.resource_id,
      playlistId: invite.resource_id,
      alreadyJoined: inserted.rows.length === 0,
    })
  }

  const songRes = await query(`SELECT created_by FROM prompter_songs WHERE id = $1`, [invite.resource_id])
  if (songRes.rows[0]?.created_by === userId) {
    return NextResponse.json({ error: 'Owner cannot accept' }, { status: 400 })
  }
  const existing = await query(`
    SELECT scm.id FROM song_collaborator_members scm
    JOIN song_collaborators sc ON sc.id = scm.collaborator_id
    WHERE sc.song_id = $1 AND scm.user_id = $2 LIMIT 1
  `, [invite.resource_id, userId])
  if (existing.rows[0]) {
    return NextResponse.json({
      ok: true,
      resourceType: 'song',
      resourceId: invite.resource_id,
      songId: invite.resource_id,
      alreadyJoined: true,
    })
  }

  await query(
    `INSERT INTO song_collaborator_members (collaborator_id, user_id) VALUES ($1, $2)`,
    [invite.id, userId]
  )
  return NextResponse.json({
    ok: true,
    resourceType: 'song',
    resourceId: invite.resource_id,
    songId: invite.resource_id,
  })
}
