import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { isMasterEmail } from '@/lib/permissions'
import { ANNOUNCEMENT_COLUMNS, ensureAnnouncementsSchema } from '@/lib/announcements'
import { parseAnnouncementInput } from '@/lib/announcementsShared'

// 公開中のお知らせ一覧（認証不要）。ログイン中は本人の既読日時も返す。
// ?all=1 はマスター専用で、下書きを含む全件を返す。
export async function GET(req: NextRequest) {
  await ensureAnnouncementsSchema()
  const session = await auth()
  const email = session?.user?.email ?? null

  if (req.nextUrl.searchParams.get('all') === '1') {
    if (!(await isMasterEmail(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const all = await query(`SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements ORDER BY created_at DESC`)
    return NextResponse.json({ items: all.rows })
  }

  const [items, read] = await Promise.all([
    query(`
      SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements
      WHERE status = 'published' AND published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 50
    `),
    email ? query(`SELECT announcements_read_at FROM users WHERE email = $1`, [email]) : Promise.resolve(null),
  ])
  return NextResponse.json({
    items: items.rows,
    readAt: read?.rows[0]?.announcements_read_at ?? null,
    loggedIn: !!email,
  })
}

// お知らせの新規作成（マスターのみ）
export async function POST(req: NextRequest) {
  await ensureAnnouncementsSchema()
  const session = await auth()
  const email = session?.user?.email ?? null
  if (!(await isMasterEmail(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseAnnouncementInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { title, body, category, is_important, status } = parsed.value

  const result = await query(
    `INSERT INTO announcements (title, body, category, is_important, status, published_at, created_by)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END,
       (SELECT id FROM users WHERE email = $6))
     RETURNING ${ANNOUNCEMENT_COLUMNS}`,
    [title, body, category, is_important, status, email]
  )
  return NextResponse.json(result.rows[0])
}
