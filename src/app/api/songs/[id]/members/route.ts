import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query, withTransaction } from '@/lib/db'
import { getSongAccess } from '@/lib/songAccess'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id])
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getSongAccess(id, session.user.email)
  if (!access?.canEditContent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members: { id?: number; name: string; color: string; sort_order: number }[] = await req.json()

  const saved = await withTransaction(async (client) => {
    const existingResult = await client.query(`SELECT id FROM prompter_members WHERE song_id=$1`, [id])
    const existingIds = new Set<number>(existingResult.rows.map((r: { id: number }) => r.id))

    const incomingIds = new Set(members.filter(m => m.id && m.id > 0).map(m => m.id!))

    // 削除：既存にあって送信データにないIDを 1 クエリでまとめて削除
    const toDelete = [...existingIds].filter(eid => !incomingIds.has(eid))
    if (toDelete.length > 0) {
      await client.query(`DELETE FROM prompter_members WHERE id = ANY($1::int[])`, [toDelete])
    }

    const result: { id: number; name: string; color: string; sort_order: number }[] = []
    for (const m of members) {
      if (m.id && m.id > 0 && existingIds.has(m.id)) {
        // 既存メンバー：UPDATE（IDを保持）
        await client.query(
          `UPDATE prompter_members SET name=$1, color=$2, sort_order=$3 WHERE id=$4`,
          [m.name, m.color, m.sort_order, m.id]
        )
        result.push({ id: m.id, name: m.name, color: m.color, sort_order: m.sort_order })
      } else {
        // 新規メンバー：INSERT（新IDを返してクライアントのリマップに使う）
        const res = await client.query(
          `INSERT INTO prompter_members (song_id, name, color, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
          [id, m.name, m.color, m.sort_order]
        )
        result.push(res.rows[0])
      }
    }
    return result
  })

  return NextResponse.json(saved)
}
