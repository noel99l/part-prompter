import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query, withTransaction } from '@/lib/db'
import { getSongAccess } from '@/lib/songAccess'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(
    `SELECT * FROM prompter_lyrics WHERE song_id=$1 ORDER BY block_index, line_index`,
    [id]
  )
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getSongAccess(id, session.user.email)
  if (!access?.canEditContent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      `UPDATE prompter_songs SET updated_at=NOW() WHERE id=$1`,
      [id]
    )
  })

  return NextResponse.json({ ok: true })
}
