import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (req.nextUrl.searchParams.get('full') === '1') {
    const songIds = songs.rows.map((s: any) => s.id)
    const [membersRes, lyricsRes] = await Promise.all([
      songIds.length > 0
        ? query(`SELECT * FROM prompter_members WHERE song_id = ANY($1) ORDER BY song_id, sort_order`, [songIds])
        : { rows: [] },
      songIds.length > 0
        ? query(`SELECT * FROM prompter_lyrics WHERE song_id = ANY($1) ORDER BY song_id, block_index, line_index`, [songIds])
        : { rows: [] },
    ])
    const membersMap: Record<number, any[]> = {}
    const lyricsMap: Record<number, any[]> = {}
    for (const m of membersRes.rows) {
      if (!membersMap[m.song_id]) membersMap[m.song_id] = []
      membersMap[m.song_id].push(m)
    }
    for (const l of lyricsRes.rows) {
      if (!lyricsMap[l.song_id]) lyricsMap[l.song_id] = []
      lyricsMap[l.song_id].push(l)
    }
    const songsWithData = await Promise.all(songs.rows.map(async (s: any) => {
      const songRes = await query(`SELECT * FROM prompter_songs WHERE id=$1`, [s.id])
      return {
        ...songRes.rows[0],
        sort_order: s.sort_order,
        members: membersMap[s.id] || [],
        lyrics: lyricsMap[s.id] || [],
      }
    }))
    return NextResponse.json({ ...playlist.rows[0], songs: songsWithData })
  }

  return NextResponse.json({ ...playlist.rows[0], songs: songs.rows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, description } = await req.json()
  const result = await query(`UPDATE playlists SET name=$1, description=$2 WHERE id=$3 RETURNING *`, [name, description ?? null, id])
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await query(`DELETE FROM playlists WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
