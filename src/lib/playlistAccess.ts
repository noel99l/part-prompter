import { query } from '@/lib/db'

export interface PlaylistAccess {
  userId: number
  isOwner: boolean
  canEdit: boolean
}

/** ログインユーザーのセットリスト権限を返す。対象またはユーザーがなければ null。 */
export async function getPlaylistAccess(
  playlistId: string | number,
  email: string
): Promise<PlaylistAccess | null> {
  const result = await query(`
    SELECT u.id AS user_id,
      p.created_by = u.id AS is_owner,
      (p.created_by = u.id OR EXISTS (
        SELECT 1 FROM playlist_collaborators pc
        WHERE pc.playlist_id = p.id AND pc.user_id = u.id
      )) AS can_edit
    FROM playlists p
    JOIN users u ON u.email = $2
    WHERE p.id = $1
  `, [playlistId, email])
  const row = result.rows[0]
  if (!row) return null
  return {
    userId: row.user_id,
    isOwner: row.is_owner,
    canEdit: row.can_edit,
  }
}
