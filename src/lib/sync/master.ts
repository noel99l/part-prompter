import 'server-only'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { SyncHttpError } from './errors'

export interface SyncMaster {
  id: 1
  email: string
}

export type SyncMasterResult =
  | { kind: 'master'; user: SyncMaster }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }

export async function getSyncMaster(): Promise<SyncMasterResult> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return { kind: 'unauthenticated' }

  const result = await query(
    `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )
  const user = result.rows[0] as { id: number; email: string } | undefined
  if (!user || user.id !== 1) return { kind: 'forbidden' }
  return { kind: 'master', user: { id: 1, email: user.email } }
}

export async function requireSyncMaster(): Promise<SyncMaster> {
  const result = await getSyncMaster()
  if (result.kind === 'unauthenticated') {
    throw new SyncHttpError(401, 'ログインが必要です。')
  }
  if (result.kind === 'forbidden') {
    throw new SyncHttpError(403, '同期プロンプターを操作する権限がありません。')
  }
  return result.user
}
