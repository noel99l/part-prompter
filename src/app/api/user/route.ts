import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

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
