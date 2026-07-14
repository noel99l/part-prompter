import 'server-only'
import { withTransaction } from '@/lib/db'
import { SyncHttpError } from './errors'
import { applySyncCommand, type SyncCommand } from './state'
import type { PlaylistSnapshot, SyncState } from './types'

type StateRow = {
  id: string
  status: 'active' | 'ended' | 'expired'
  expires_at: Date
  playlist_snapshot: PlaylistSnapshot
  current_song_index: number
  current_block: number
  is_playing: boolean
  position_ms: number
  started_at: Date | null
  version: string | number
  last_command_id: string | null
}

function rowState(row: StateRow): SyncState {
  const song = row.playlist_snapshot.songs[row.current_song_index]
  if (!song) throw new SyncHttpError(409, '同期セッションの曲情報が不正です。')
  return {
    sessionId: row.id,
    songIndex: row.current_song_index,
    songId: song.id,
    currentBlock: row.current_block,
    isPlaying: row.is_playing,
    positionMs: row.position_ms,
    startedAt: row.started_at?.toISOString() ?? null,
    version: Number(row.version),
  }
}

export async function updateSyncState(
  sessionId: string,
  createdBy: number,
  command: SyncCommand
): Promise<{ state: SyncState; duplicate: boolean }> {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT * FROM prompter_sync_sessions
       WHERE id = $1 AND created_by = $2 FOR UPDATE`,
      [sessionId, createdBy]
    )
    const row = result.rows[0] as StateRow | undefined
    if (!row) throw new SyncHttpError(404, '同期セッションが見つかりません。')
    if (row.status === 'active' && row.expires_at.getTime() <= Date.now()) {
      await client.query(
        `UPDATE prompter_sync_sessions SET status = 'expired' WHERE id = $1`,
        [sessionId]
      )
      row.status = 'expired'
    }
    if (row.status !== 'active') {
      throw new SyncHttpError(410, '同期セッションは終了したか、有効期限が切れています。')
    }

    const commandResult = await client.query(
      `SELECT resulting_state FROM prompter_sync_commands
       WHERE session_id = $1 AND command_id = $2`,
      [sessionId, command.commandId]
    )
    if (commandResult.rows[0]) {
      return {
        state: commandResult.rows[0].resulting_state as SyncState,
        duplicate: true,
      }
    }
    if (row.last_command_id === command.commandId) {
      const state = rowState(row)
      await client.query(
        `INSERT INTO prompter_sync_commands (session_id, command_id, resulting_state)
         VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING`,
        [sessionId, command.commandId, JSON.stringify(state)]
      )
      return { state, duplicate: true }
    }

    const next = applySyncCommand(
      rowState(row),
      command,
      row.playlist_snapshot,
      new Date()
    )
    const updated = await client.query(
      `UPDATE prompter_sync_sessions
       SET current_song_index = $1, current_block = $2, is_playing = $3,
           position_ms = $4, started_at = $5, version = $6, last_command_id = $7
       WHERE id = $8 RETURNING *`,
      [
        next.songIndex,
        next.currentBlock,
        next.isPlaying,
        next.positionMs,
        next.startedAt,
        next.version,
        command.commandId,
        sessionId,
      ]
    )
    const state = rowState(updated.rows[0] as StateRow)
    await client.query(
      `INSERT INTO prompter_sync_commands (session_id, command_id, resulting_state)
       VALUES ($1, $2, $3::jsonb)`,
      [sessionId, command.commandId, JSON.stringify(state)]
    )
    return { state, duplicate: false }
  })
}
