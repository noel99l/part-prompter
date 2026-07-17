import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initDb, query } from '@/lib/db'
import { parseMemberTemplatePayload } from '@/lib/memberTemplates'

type RouteContext = { params: Promise<{ id: string }> }

async function currentUserId() {
  const session = await auth()
  if (!session?.user?.email) return { error: 'Unauthorized', status: 401 } as const
  const result = await query(`SELECT id FROM users WHERE email=$1`, [session.user.email])
  const userId = result.rows[0]?.id as number | undefined
  if (!userId) return { error: 'User not found', status: 404 } as const
  return { userId } as const
}

function templateId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  await initDb()
  const { id: rawId } = await params
  const id = templateId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })

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
      `UPDATE member_templates
       SET name=$1, members=$2::jsonb, updated_at=NOW()
       WHERE id=$3 AND user_id=$4
       RETURNING id, name, members, created_at, updated_at`,
      [payload.name, JSON.stringify(payload.members), id, currentUser.userId]
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: '同じ名前のテンプレートが既にあります。' }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  await initDb()
  const { id: rawId } = await params
  const id = templateId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })

  const currentUser = await currentUserId()
  if ('error' in currentUser) {
    return NextResponse.json({ error: currentUser.error }, { status: currentUser.status })
  }
  const result = await query(
    `DELETE FROM member_templates WHERE id=$1 AND user_id=$2 RETURNING id`,
    [id, currentUser.userId]
  )
  if (!result.rows[0]) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
