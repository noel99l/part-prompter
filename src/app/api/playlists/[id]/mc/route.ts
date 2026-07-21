import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { getPlaylistAccess } from '@/lib/playlistAccess'

const TITLE_MAX = 100
const BODY_MAX = 2000

async function authorizeEditor(id: string): Promise<NextResponse | null> {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

function sanitize(title: unknown, body: unknown): { title: string; body: string } | null {
  const t = typeof title === 'string' ? title.trim().slice(0, TITLE_MAX) : ''
  const b = typeof body === 'string' ? body.trim().slice(0, BODY_MAX) : ''
  if (!t && !b) return null
  return { title: t, body: b }
}

// MCスライドを追加（末尾に追加。位置はドラッグで調整する）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { title, body } = await req.json()
  const content = sanitize(title, body)
  if (!content) return NextResponse.json({ error: 'title or body required' }, { status: 400 })
  const result = await query(`
    INSERT INTO playlist_songs (playlist_id, item_type, mc_title, mc_body, sort_order)
    SELECT $1, 'mc', $2, $3, COALESCE(MAX(sort_order), -1) + 1
    FROM playlist_songs WHERE playlist_id = $1
    RETURNING id
  `, [id, content.title, content.body])
  return NextResponse.json({ ok: true, itemId: result.rows[0].id })
}

// MCスライドを更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { itemId, title, body } = await req.json()
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
  const content = sanitize(title, body)
  if (!content) return NextResponse.json({ error: 'title or body required' }, { status: 400 })
  const result = await query(
    `UPDATE playlist_songs SET mc_title=$1, mc_body=$2
     WHERE id=$3 AND playlist_id=$4 AND item_type='mc' RETURNING id`,
    [content.title, content.body, itemId, id]
  )
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// MCスライドを削除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const denied = await authorizeEditor(id)
  if (denied) return denied

  const { itemId } = await req.json()
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
  await query(
    `DELETE FROM playlist_songs WHERE id=$1 AND playlist_id=$2 AND item_type='mc'`,
    [itemId, id]
  )
  return NextResponse.json({ ok: true })
}
