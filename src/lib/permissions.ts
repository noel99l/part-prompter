import { query } from './db'
import { MASTER_USER_ID } from './masterUser'

// ユーザーID1はマスターアカウントとして全楽曲の編集権限を持つ（定義は masterUser.ts）
export { MASTER_USER_ID }

export async function isMasterEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const res = await query(`SELECT 1 FROM users WHERE id = $1 AND email = $2`, [MASTER_USER_ID, email])
  return res.rows.length > 0
}
