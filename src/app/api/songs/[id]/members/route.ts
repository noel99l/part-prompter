import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id])
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const members: { id?: number; name: string; color: string; sort_order: number }[] = await req.json()

  const existingResult = await query(`SELECT id FROM prompter_members WHERE song_id=$1`, [id])
  const existingIds = new Set(existingResult.rows.map((r: { id: number }) => r.id))

  const incomingIds = new Set(members.filter(m => m.id && m.id > 0).map(m => m.id!))

  // 削除：既存にあって送信データにないID
  for (const eid of existingIds) {
    if (!incomingIds.has(eid)) {
      await query(`DELETE FROM prompter_members WHERE id=$1`, [eid])
    }
  }

  const saved: { id: number; name: string; color: string; sort_order: number }[] = []
  for (const m of members) {
    if (m.id && m.id > 0 && existingIds.has(m.id)) {
      // 既存メンバー：UPDATE（IDを保持）
      await query(
        `UPDATE prompter_members SET name=$1, color=$2, sort_order=$3 WHERE id=$4`,
        [m.name, m.color, m.sort_order, m.id]
      )
      saved.push({ id: m.id, name: m.name, color: m.color, sort_order: m.sort_order })
    } else {
      // 新規メンバー：INSERT
      const res = await query(
        `INSERT INTO prompter_members (song_id, name, color, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, m.name, m.color, m.sort_order]
      )
      saved.push(res.rows[0])
    }
  }

  return NextResponse.json(saved)
}
