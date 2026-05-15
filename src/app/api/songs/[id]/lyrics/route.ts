import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(
    `SELECT * FROM prompter_lyrics WHERE song_id=$1 ORDER BY block_index, line_index`,
    [id]
  )
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lyrics: { block_index: number; line_index: number; text: string; member_ids: number[]; timestamp_ms: number | null; word_members?: { text: string; member_ids: number[] }[] }[] = await req.json()

  await query(`DELETE FROM prompter_lyrics WHERE song_id=$1`, [id])
  for (const l of lyrics) {
    await query(
      `INSERT INTO prompter_lyrics (song_id, block_index, line_index, text, member_ids, timestamp_ms, word_members)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, l.block_index, l.line_index, l.text, l.member_ids, l.timestamp_ms, JSON.stringify(l.word_members ?? [])]
    )
  }
  return NextResponse.json({ ok: true })
}
