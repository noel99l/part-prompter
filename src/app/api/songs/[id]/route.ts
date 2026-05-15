import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(`SELECT * FROM prompter_songs WHERE id = $1`, [id])
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { title, artist } = await req.json()
  const result = await query(
    `UPDATE prompter_songs SET title=$1, artist=$2 WHERE id=$3 RETURNING *`,
    [title, artist, id]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await query(`DELETE FROM prompter_songs WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
