import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db'

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

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM prompter_lyrics WHERE song_id=$1`, [id])

    if (lyrics.length > 0) {
      // 行ごとの個別 INSERT ではなく、複数行をまとめた単一 INSERT にして往復回数を削減する
      const COLS = 7
      const values: unknown[] = []
      const placeholders = lyrics
        .map((l, i) => {
          const b = i * COLS
          values.push(
            id,
            l.block_index,
            l.line_index,
            l.text,
            l.member_ids,
            l.timestamp_ms,
            JSON.stringify(l.word_members ?? [])
          )
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`
        })
        .join(',')

      await client.query(
        `INSERT INTO prompter_lyrics (song_id, block_index, line_index, text, member_ids, timestamp_ms, word_members)
         VALUES ${placeholders}`,
        values
      )
    }

    await client.query(
      `UPDATE prompter_songs SET updated_at=(NOW() AT TIME ZONE 'Asia/Tokyo') WHERE id=$1`,
      [id]
    )
  })

  return NextResponse.json({ ok: true })
}
