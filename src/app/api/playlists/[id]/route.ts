import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { getPlaylistAccess } from '@/lib/playlistAccess'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const playlist = await query(`SELECT * FROM playlists WHERE id=$1`, [id])
  if (!playlist.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let isOwner = false
  let viewerUserId: number | null = null
  if (req.nextUrl.searchParams.get('access') === '1') {
    const session = await auth()
    if (session?.user?.email) {
      const access = await getPlaylistAccess(id, session.user.email)
      isOwner = access?.isOwner ?? false
      viewerUserId = access?.canEdit ? access.userId : null
    }
  }

  const songs = await query(`
    SELECT ps.sort_order, s.id, s.title, s.artist,
      CASE WHEN $2::integer IS NULL THEN FALSE ELSE (
        s.created_by = $2 OR EXISTS (
          SELECT 1 FROM song_collaborators sc
          JOIN song_collaborator_members scm ON scm.collaborator_id = sc.id
          WHERE sc.song_id = s.id AND scm.user_id = $2
        ) OR p.created_by = s.created_by
      ) END AS can_edit,
      (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id) as lyric_count,
      (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id AND l.timestamp_ms IS NOT NULL) as timestamp_count,
      (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count
    FROM playlist_songs ps
    JOIN playlists p ON p.id = ps.playlist_id
    JOIN prompter_songs s ON s.id = ps.song_id
    WHERE ps.playlist_id=$1
    ORDER BY ps.sort_order
  `, [id, viewerUserId])

  if (req.nextUrl.searchParams.get('full') === '1') {
    const songIds = songs.rows.map((song: { id: number }) => song.id)
    const [membersRes, lyricsRes] = await Promise.all([
      songIds.length > 0
        ? query(`SELECT * FROM prompter_members WHERE song_id = ANY($1) ORDER BY song_id, sort_order`, [songIds])
        : { rows: [] },
      songIds.length > 0
        ? query(`SELECT * FROM prompter_lyrics WHERE song_id = ANY($1) ORDER BY song_id, block_index, line_index`, [songIds])
        : { rows: [] },
    ])
    const membersMap: Record<number, Record<string, unknown>[]> = {}
    const lyricsMap: Record<number, Record<string, unknown>[]> = {}
    for (const member of membersRes.rows) (membersMap[member.song_id] ??= []).push(member)
    for (const line of lyricsRes.rows) (lyricsMap[line.song_id] ??= []).push(line)
    const songsWithData = await Promise.all(songs.rows.map(async (song: { id: number; sort_order: number }) => {
      const songRes = await query(`SELECT * FROM prompter_songs WHERE id=$1`, [song.id])
      return {
        ...songRes.rows[0],
        sort_order: song.sort_order,
        members: membersMap[song.id] || [],
        lyrics: lyricsMap[song.id] || [],
      }
    }))
    return NextResponse.json({ ...playlist.rows[0], is_owner: isOwner, songs: songsWithData })
  }

  return NextResponse.json({ ...playlist.rows[0], is_owner: isOwner, songs: songs.rows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json()
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const safeDescription = typeof description === 'string' ? description.slice(0, 200) : null
  const result = await query(
    `UPDATE playlists SET name=$1, description=$2 WHERE id=$3 RETURNING *`,
    [trimmedName, safeDescription, id]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(`DELETE FROM playlists WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
