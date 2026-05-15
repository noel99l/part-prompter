import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const playlist = await query(`SELECT * FROM playlists WHERE id=$1`, [id])
  if (!playlist.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const songs = await query(`
    SELECT ps.sort_order, s.id, s.title, s.artist
    FROM playlist_songs ps
    JOIN prompter_songs s ON s.id = ps.song_id
    WHERE ps.playlist_id=$1
    ORDER BY ps.sort_order
  `, [id])
  return NextResponse.json({ ...playlist.rows[0], songs: songs.rows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name } = await req.json()
  const result = await query(`UPDATE playlists SET name=$1 WHERE id=$2 RETURNING *`, [name, id])
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await query(`DELETE FROM playlists WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
