import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query, initDb } from '@/lib/db'

const MASTER_EMAIL = 'noelkaikei@gmail.com'

async function isMasterUser(): Promise<boolean> {
  const session = await auth()
  return session?.user?.email === MASTER_EMAIL
}

// 公開設定取得（認証不要）
export async function GET() {
  await initDb()
  const result = await query(`SELECT key, value FROM master_settings`)
  const settings: Record<string, string> = {}
  for (const row of result.rows) {
    settings[row.key] = row.value
  }
  return NextResponse.json(settings)
}

// マスタユーザーのみ設定変更可
export async function PUT(req: NextRequest) {
  await initDb()
  if (!(await isMasterUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: Record<string, string> = await req.json()

  for (const [key, value] of Object.entries(body)) {
    await query(
      `INSERT INTO master_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, value]
    )
  }

  return NextResponse.json({ ok: true })
}
