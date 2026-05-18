import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRes = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = userRes.rows[0]?.id
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // 元の曲を取得
  const songRes = await query(`SELECT * FROM prompter_songs WHERE id = $1`, [id])
  const orig = songRes.rows[0]
  if (!orig) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 曲を複製
  const newSong = await query(
    `INSERT INTO prompter_songs (title, artist, created_by, is_public, updated_at)
     VALUES ($1, $2, $3, false, NOW() AT TIME ZONE 'Asia/Tokyo') RETURNING *`,
    [`${orig.title}（複製）`, orig.artist, userId]
  )
  const newId = newSong.rows[0].id

  // メンバーを複製
  const members = await query(`SELECT * FROM prompter_members WHERE song_id = $1 ORDER BY sort_order`, [id])
  for (const m of members.rows) {
    await query(
      `INSERT INTO prompter_members (song_id, name, color, sort_order) VALUES ($1, $2, $3, $4)`,
      [newId, m.name, m.color, m.sort_order]
    )
  }

  // 歌詞を複製（新しいメンバーIDにリマップ）
  const newMembers = await query(`SELECT * FROM prompter_members WHERE song_id = $1 ORDER BY sort_order`, [newId])
  const idMap: Record<number, number> = {}
  members.rows.forEach((m: any, i: number) => { if (newMembers.rows[i]) idMap[m.id] = newMembers.rows[i].id })

  const lyrics = await query(`SELECT * FROM prompter_lyrics WHERE song_id = $1 ORDER BY block_index, line_index`, [id])
  for (const l of lyrics.rows) {
    const newMemberIds = (l.member_ids || []).map((mid: number) => idMap[mid] ?? mid)
    const newWordMembers = (l.word_members || []).map((w: any) => ({
      ...w,
      member_ids: (w.member_ids || []).map((mid: number) => idMap[mid] ?? mid),
    }))
    await query(
      `INSERT INTO prompter_lyrics (song_id, block_index, line_index, text, member_ids, timestamp_ms, word_members)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newId, l.block_index, l.line_index, l.text, newMemberIds, l.timestamp_ms, JSON.stringify(newWordMembers)]
    )
  }

  return NextResponse.json({ id: newId })
}
