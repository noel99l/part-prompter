import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// 曲を追加
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { songId } = await req.json()
  const max = await query(`SELECT COALESCE(MAX(sort_order), -1) as m FROM playlist_songs WHERE playlist_id=$1`, [id])
  const nextOrder = max.rows[0].m + 1
  await query(`INSERT INTO playlist_songs (playlist_id, song_id, sort_order) VALUES ($1,$2,$3)`, [id, songId, nextOrder])
  return NextResponse.json({ ok: true })
}

// 並び順を更新（song_idの配列を受け取る）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { songIds }: { songIds: number[] } = await req.json()
  for (let i = 0; i < songIds.length; i++) {
    await query(`UPDATE playlist_songs SET sort_order=$1 WHERE playlist_id=$2 AND song_id=$3`, [i, id, songIds[i]])
  }
  return NextResponse.json({ ok: true })
}

// 曲を削除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { songId } = await req.json()
  await query(`DELETE FROM playlist_songs WHERE playlist_id=$1 AND song_id=$2`, [id, songId])
  return NextResponse.json({ ok: true })
}
