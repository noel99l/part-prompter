import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'

export async function GET() {
  await initDb()
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json([], { status: 401 })

  const result = await query(`
    SELECT p.*, owner.account_name AS created_by_name,
      p.created_by = viewer.id AS is_owner
    FROM playlists p
    JOIN users viewer ON viewer.email = $1
    LEFT JOIN users owner ON owner.id = p.created_by
    WHERE p.created_by = viewer.id OR EXISTS (
      SELECT 1 FROM playlist_collaborators pc
      WHERE pc.playlist_id = p.id AND pc.user_id = viewer.id
    )
    ORDER BY p.created_at DESC
  `, [session.user.email])
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const user = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = user.rows[0]?.id
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const result = await query(
    `INSERT INTO playlists (name, created_by) VALUES ($1, $2) RETURNING *`,
    [trimmedName, userId]
  )
  return NextResponse.json({ ...result.rows[0], is_owner: true }, { status: 201 })
}
