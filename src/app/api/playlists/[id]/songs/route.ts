import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query, withTransaction } from '@/lib/db'
import { getPlaylistAccess } from '@/lib/playlistAccess'

async function authorizeEditor(id: string): Promise<NextResponse | null> {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// 曲を追加
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { songId } = await req.json()
  if (!Number.isInteger(songId)) return NextResponse.json({ error: 'songId required' }, { status: 400 })
  await query(`
    INSERT INTO playlist_songs (playlist_id, song_id, sort_order)
    SELECT $1, $2, COALESCE(MAX(sort_order), -1) + 1
    FROM playlist_songs WHERE playlist_id = $1
  `, [id, songId])
  return NextResponse.json({ ok: true })
}

// 並び順を更新（playlist_songs.idの配列を受け取る。旧クライアント互換でsongIdsも受ける）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { itemIds, songIds }: { itemIds?: number[]; songIds?: number[] } = await req.json()
  if (Array.isArray(itemIds) && itemIds.every(Number.isInteger)) {
    await withTransaction(async (client) => {
      for (let index = 0; index < itemIds.length; index++) {
        await client.query(
          `UPDATE playlist_songs SET sort_order=$1 WHERE playlist_id=$2 AND id=$3`,
          [index, id, itemIds[index]]
        )
      }
    })
    return NextResponse.json({ ok: true })
  }
  if (!Array.isArray(songIds) || !songIds.every(Number.isInteger)) {
    return NextResponse.json({ error: 'itemIds or songIds required' }, { status: 400 })
  }
  await withTransaction(async (client) => {
    for (let index = 0; index < songIds.length; index++) {
      await client.query(
        `UPDATE playlist_songs SET sort_order=$1 WHERE playlist_id=$2 AND song_id=$3`,
        [index, id, songIds[index]]
      )
    }
  })
  return NextResponse.json({ ok: true })
}

// 曲を削除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { songId } = await req.json()
  if (!Number.isInteger(songId)) return NextResponse.json({ error: 'songId required' }, { status: 400 })
  await query(`DELETE FROM playlist_songs WHERE playlist_id=$1 AND song_id=$2`, [id, songId])
  return NextResponse.json({ ok: true })
}
