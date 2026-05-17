import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await query(`SELECT account_name, email FROM users WHERE email = $1`, [session.user.email])
  return NextResponse.json(result.rows[0] ?? {})
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountName } = await req.json()
  if (!accountName?.trim()) return NextResponse.json({ error: 'accountName required' }, { status: 400 })

  await query(
    `UPDATE users SET account_name = $1 WHERE email = $2`,
    [accountName.trim(), session.user.email]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userResult = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
  const userId = userResult.rows[0]?.id

  if (userId) {
    await query(`DELETE FROM prompter_songs WHERE created_by = $1`, [userId])
    await query(`DELETE FROM playlists WHERE created_by = $1`, [userId])
  }

  await query(`DELETE FROM users WHERE email = $1`, [session.user.email])
  return NextResponse.json({ ok: true })
}
