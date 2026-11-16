import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { isMasterEmail } from '@/lib/permissions'
import { ANNOUNCEMENT_COLUMNS, ensureAnnouncementsSchema } from '@/lib/announcements'
import { parseAnnouncementInput } from '@/lib/announcementsShared'

async function requireMaster(): Promise<NextResponse | null> {
  const session = await auth()
  if (!(await isMasterEmail(session?.user?.email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// お知らせの更新（マスターのみ）。
// 公開日時は「初めて公開した時点」で確定し、編集や下書きへの戻しでは変えない
// （編集のたびに全員の未読に戻るのを防ぐ）。
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAnnouncementsSchema()
  const denied = await requireMaster()
  if (denied) return denied
  const id = parseId((await params).id)
  if (id == null) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = parseAnnouncementInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { title, body, category, is_important, status } = parsed.value

  const result = await query(
    `UPDATE announcements
     SET title = $1, body = $2, category = $3, is_important = $4, status = $5,
       published_at = CASE WHEN $5 = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
       updated_at = NOW()
     WHERE id = $6
     RETURNING ${ANNOUNCEMENT_COLUMNS}`,
    [title, body, category, is_important, status, id]
  )
  if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

// お知らせの削除（マスターのみ）
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAnnouncementsSchema()
  const denied = await requireMaster()
  if (denied) return denied
  const id = parseId((await params).id)
  if (id == null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await query(`DELETE FROM announcements WHERE id = $1`, [id])
  return NextResponse.json({ ok: true })
}
