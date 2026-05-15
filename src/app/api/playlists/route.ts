import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  await initDb()
  const result = await query(`
    SELECT p.*, u.account_name as created_by_name
    FROM playlists p
    LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.created_at DESC
  `)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const result = await query(
    `INSERT INTO playlists (name, created_by) VALUES ($1, $2) RETURNING *`,
    [name, session?.user?.id ?? null]
  )
  return NextResponse.json(result.rows[0])
}
