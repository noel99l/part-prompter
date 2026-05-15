import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id])
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members: { name: string; color: string; sort_order: number }[] = await req.json()
  await query(`DELETE FROM prompter_members WHERE song_id=$1`, [id])
  for (const m of members) {
    await query(
      `INSERT INTO prompter_members (song_id, name, color, sort_order) VALUES ($1,$2,$3,$4)`,
      [id, m.name, m.color, m.sort_order]
    )
  }
  const result = await query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id])
  return NextResponse.json(result.rows)
}
