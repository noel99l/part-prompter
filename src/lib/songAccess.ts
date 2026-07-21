import { query } from '@/lib/db'
import { MASTER_USER_ID } from '@/lib/permissions'

export interface SongAccess {
  userId: number
  isOwner: boolean
  isDirectCollaborator: boolean
  canEditViaPlaylist: boolean
  isMaster: boolean
  canEditContent: boolean
}

/** 楽曲自体または収録先セットリストから導出した編集権限を返す。 */
export async function getSongAccess(
  songId: string | number,
  email: string
): Promise<SongAccess | null> {
  const result = await query(`
    SELECT u.id AS user_id,
      s.created_by = u.id AS is_owner,
      EXISTS (
        SELECT 1 FROM song_collaborators sc
        JOIN song_collaborator_members scm ON scm.collaborator_id = sc.id
        WHERE sc.song_id = s.id AND scm.user_id = u.id
      ) AS is_direct_collaborator,
      EXISTS (
        SELECT 1 FROM playlist_songs ps
        JOIN playlists p ON p.id = ps.playlist_id
        WHERE ps.song_id = s.id
          -- 他ユーザーの公開曲を追加するだけで編集権限を得ないよう、
          -- セットリスト作成者自身が所有する楽曲だけ権限を委譲する。
          AND p.created_by = s.created_by
          AND (
            p.created_by = u.id OR EXISTS (
              SELECT 1 FROM playlist_collaborators pc
              WHERE pc.playlist_id = p.id AND pc.user_id = u.id
            )
          )
      ) AS can_edit_via_playlist,
      u.id = $3 AS is_master
    FROM prompter_songs s
    JOIN users u ON u.email = $2
    WHERE s.id = $1
  `, [songId, email, MASTER_USER_ID])
  const row = result.rows[0]
  if (!row) return null
  return {
    userId: row.user_id,
    isOwner: row.is_owner,
    isDirectCollaborator: row.is_direct_collaborator,
    canEditViaPlaylist: row.can_edit_via_playlist,
    isMaster: row.is_master,
    canEditContent: row.is_owner || row.is_direct_collaborator || row.can_edit_via_playlist || row.is_master,
  }
}
