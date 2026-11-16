import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { ensureAnnouncementsSchema } from '@/lib/announcements'

// ログイン中のユーザーの「お知らせを最後に読んだ日時」を現在時刻に更新する。
// 未ログインの既読は端末側（localStorage）で管理するので、ここでは何もしない。
export async function POST() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ ok: true, readAt: null })

  await ensureAnnouncementsSchema()
  const result = await query(
    `UPDATE users SET announcements_read_at = NOW() WHERE email = $1 RETURNING announcements_read_at`,
    [email]
  )
  return NextResponse.json({ ok: true, readAt: result.rows[0]?.announcements_read_at ?? null })
}
