import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'

export async function GET() {
  await initDb()
  const result = await query(`SELECT * FROM playlists ORDER BY created_at DESC`)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const result = await query(`INSERT INTO playlists (name) VALUES ($1) RETURNING *`, [name])
  return NextResponse.json(result.rows[0])
}
