import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  await initDb()
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json([])
  const result = await query(`
    SELECT p.*, u.account_name as created_by_name
    FROM playlists p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE u.email = $1
    ORDER BY p.created_at DESC
  `, [session.user.email])
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  let userId = null
  if (session?.user?.email) {
    const u = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
    userId = u.rows[0]?.id ?? null
  }
  const result = await query(
    `INSERT INTO playlists (name, created_by) VALUES ($1, $2) RETURNING *`,
    [name, userId]
  )
  return NextResponse.json(result.rows[0])
}
