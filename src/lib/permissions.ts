import { query } from './db'

// ユーザーID1はマスターアカウントとして全楽曲の編集権限を持つ
export const MASTER_USER_ID = 1

export async function isMasterEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const res = await query(`SELECT 1 FROM users WHERE id = $1 AND email = $2`, [MASTER_USER_ID, email])
  return res.rows.length > 0
}
