import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { parseMemberTemplatePayload } from '@/lib/memberTemplates'

async function currentUserId() {
  const session = await auth()
  if (!session?.user?.email) return { error: 'Unauthorized', status: 401 } as const
  const result = await query(`SELECT id FROM users WHERE email=$1`, [session.user.email])
  const userId = result.rows[0]?.id as number | undefined
  if (!userId) return { error: 'User not found', status: 404 } as const
  return { userId } as const
}

export async function GET() {
  await initDb()
  const currentUser = await currentUserId()
  if ('error' in currentUser) {
    return NextResponse.json({ error: currentUser.error }, { status: currentUser.status })
  }
  const result = await query(
    `SELECT id, name, members, created_at, updated_at
     FROM member_templates WHERE user_id=$1
     ORDER BY updated_at DESC, id DESC`,
    [currentUser.userId]
  )
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const currentUser = await currentUserId()
  if ('error' in currentUser) {
    return NextResponse.json({ error: currentUser.error }, { status: currentUser.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '入力内容が不正です。' }, { status: 400 })
  }
  const parsed = parseMemberTemplatePayload(body)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const payload = parsed.value!

  try {
    const result = await query(
      `INSERT INTO member_templates (user_id, name, members)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, name, members, created_at, updated_at`,
      [currentUser.userId, payload.name, JSON.stringify(payload.members)]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: '同じ名前のテンプレートが既にあります。' }, { status: 409 })
    }
    throw error
  }
}
