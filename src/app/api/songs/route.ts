import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  await initDb()
  const result = await query(`SELECT * FROM prompter_songs ORDER BY created_at DESC`)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, artist } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const result = await query(
    `INSERT INTO prompter_songs (title, artist) VALUES ($1, $2) RETURNING *`,
    [title, artist || '']
  )
  return NextResponse.json(result.rows[0])
}
