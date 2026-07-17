import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { getSongAccess } from '@/lib/songAccess'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const result = await query(`
    SELECT s.*, u.account_name as created_by_name
    FROM prompter_songs s
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = $1
  `, [id])
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let canManageSong = false
  if (req.nextUrl.searchParams.get('access') === '1') {
    const session = await auth()
    if (session?.user?.email) {
      const access = await getSongAccess(id, session.user.email)
      canManageSong = access?.isOwner ?? false
    }
  }
  return NextResponse.json({ ...result.rows[0], can_manage_song: canManageSong })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getSongAccess(id, session.user.email)
  if (!access?.canEditContent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, artist, is_public, description, cover_text, bg_color, original_bpm, playback_bpm, show_progress_bar } = await req.json()
  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  if (!trimmedTitle) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const result = await query(
    `UPDATE prompter_songs SET title=$1, artist=$2,
      is_public=CASE WHEN $3 THEN $4 ELSE is_public END,
      description=$5, cover_text=$6, bg_color=$7, original_bpm=$8,
      playback_bpm=$9, show_progress_bar=$10, updated_at=NOW()
     WHERE id=$11 RETURNING *`,
    [trimmedTitle, artist, access.isOwner, is_public ?? true, description ?? '', cover_text ?? '', bg_color ?? '#000000', original_bpm ?? null, playback_bpm ?? null, show_progress_bar ?? true, id]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getSongAccess(id, session.user.email)
  if (!access?.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(`DELETE FROM prompter_songs WHERE id=$1`, [id])
  return NextResponse.json({ ok: true })
}
