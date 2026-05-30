import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(`
    SELECT s.*, u.account_name as created_by_name
    FROM prompter_songs s
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = $1
  `, [id])
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { title, artist, is_public, description, cover_text, bg_color } = await req.json()
  const result = await query(
    `UPDATE prompter_songs SET title=$1, artist=$2, is_public=$3, description=$4, cover_text=$5, bg_color=$6, updated_at=(NOW() AT TIME ZONE 'Asia/Tokyo') WHERE id=$7 RETURNING *`,
    [title, artist, is_public ?? true, description ?? '', cover_text ?? '', bg_color ?? '#000000', id]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await query(`DELETE FROM prompter_songs WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
