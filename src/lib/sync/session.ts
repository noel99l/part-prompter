import 'server-only'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { query, withTransaction } from '@/lib/db'
import { SyncHttpError } from './errors'
import { generateSecretToken, hashSecretToken } from './tokens'
import type {
  MasterSyncSnapshot,
  PlaylistSnapshot,
  SyncDevice,
  SyncSessionInfo,
  SyncSnapshot,
  SyncState,
} from './types'

type SessionRow = {
  id: string
  playlist_id: number
  status: 'active' | 'ended' | 'expired'
  playlist_snapshot: PlaylistSnapshot
  current_song_index: number
  current_block: number
  is_playing: boolean
  position_ms: number
  started_at: Date | string | null
  version: string | number
  created_at: Date | string
  expires_at: Date | string
  ended_at: Date | string | null
}

type DeviceRow = {
  id: string
  session_id: string
  device_number: number
  display_name: string | null
  configured_at: Date | string | null
  created_at: Date | string
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function toIso(value: Date | string | null): string | null {
  return value === null ? null : toDate(value).toISOString()
}

function sessionInfo(row: SessionRow): SyncSessionInfo {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    status: row.status,
    createdAt: toDate(row.created_at).toISOString(),
    expiresAt: toDate(row.expires_at).toISOString(),
    endedAt: toIso(row.ended_at),
  }
}

function stateFromRow(row: SessionRow): SyncState {
  const song = row.playlist_snapshot.songs[row.current_song_index]
  if (!song) throw new SyncHttpError(409, '同期セッションの曲情報が不正です。')
  return {
    sessionId: row.id,
    songIndex: row.current_song_index,
    songId: song.id,
    currentBlock: row.current_block,
    isPlaying: row.is_playing,
    positionMs: row.position_ms,
    startedAt: toIso(row.started_at),
    version: Number(row.version),
  }
}

function snapshotFromRow(row: SessionRow): SyncSnapshot {
  return {
    session: sessionInfo(row),
    playlist: row.playlist_snapshot,
    state: stateFromRow(row),
  }
}

function deviceFromRow(row: DeviceRow): SyncDevice {
  return {
    id: row.id,
    deviceNumber: row.device_number,
    displayName: row.display_name,
    configured: row.configured_at !== null,
    configuredAt: toIso(row.configured_at),
  }
}

async function expireSessions(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE prompter_sync_sessions
     SET status = 'expired'
     WHERE status = 'active' AND expires_at <= CURRENT_TIMESTAMP`
  )
}

function assertActive(row: SessionRow): void {
  if (row.status !== 'active' || toDate(row.expires_at).getTime() <= Date.now()) {
    throw new SyncHttpError(410, '同期セッションは終了したか、有効期限が切れています。')
  }
}

async function loadPlaylistSnapshot(
  client: PoolClient,
  playlistId: number,
  creatorId: number
): Promise<PlaylistSnapshot> {
  const playlistResult = await client.query(
    `SELECT id, name, description FROM playlists
     WHERE id = $1 AND created_by = $2`,
    [playlistId, creatorId]
  )
  const playlist = playlistResult.rows[0] as {
    id: number
    name: string
    description: string | null
  } | undefined
  if (!playlist) {
    throw new SyncHttpError(404, '指定されたセットリストが見つかりません。')
  }

  const songsResult = await client.query(
    `SELECT s.id, s.title, s.artist, s.description, s.cover_text, s.bg_color,
            s.original_bpm, s.playback_bpm, s.show_progress_bar, ps.sort_order
     FROM playlist_songs ps
     JOIN prompter_songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = $1
     ORDER BY ps.sort_order, ps.id`,
    [playlistId]
  )
  if (songsResult.rows.length === 0) {
    throw new SyncHttpError(400, '曲が1件以上あるセットリストを指定してください。')
  }

  const songIds = [...new Set(songsResult.rows.map((row: { id: number }) => row.id))]
  const membersResult = await client.query(
    `SELECT id, song_id, name, color, sort_order
     FROM prompter_members WHERE song_id = ANY($1::int[])
     ORDER BY song_id, sort_order, id`,
    [songIds]
  )
  const lyricsResult = await client.query(
    `SELECT id, song_id, block_index, line_index, text, member_ids,
            timestamp_ms, word_members
     FROM prompter_lyrics WHERE song_id = ANY($1::int[])
     ORDER BY song_id, block_index, line_index, id`,
    [songIds]
  )

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    songs: songsResult.rows.map((song: Record<string, unknown>) => ({
      id: song.id as number,
      title: song.title as string,
      artist: song.artist as string | null,
      description: (song.description as string | null) ?? '',
      coverText: (song.cover_text as string | null) ?? '',
      bgColor: (song.bg_color as string | null) ?? '#000000',
      originalBpm: song.original_bpm as number | null,
      playbackBpm: song.playback_bpm as number | null,
      showProgressBar: (song.show_progress_bar as boolean | null) ?? true,
      sortOrder: song.sort_order as number,
      members: membersResult.rows
        .filter((member: { song_id: number }) => member.song_id === song.id)
        .map((member: Record<string, unknown>) => ({
          id: member.id as number,
          name: member.name as string,
          color: member.color as string,
          sortOrder: member.sort_order as number,
        })),
      lyrics: lyricsResult.rows
        .filter((line: { song_id: number }) => line.song_id === song.id)
        .map((line: Record<string, unknown>) => ({
          id: line.id as number,
          blockIndex: line.block_index as number,
          lineIndex: line.line_index as number,
          text: line.text as string,
          memberIds: (line.member_ids as number[] | null) ?? [],
          timestampMs: line.timestamp_ms as number | null,
          wordMembers: (line.word_members as unknown[] | null) ?? [],
        })),
    })),
  }
}

export async function getActiveSession(createdBy: number): Promise<SyncSessionInfo | null> {
  return withTransaction(async (client) => {
    await expireSessions(client)
    const result = await client.query(
      `SELECT * FROM prompter_sync_sessions
       WHERE created_by = $1 AND status = 'active' LIMIT 1`,
      [createdBy]
    )
    const row = result.rows[0] as SessionRow | undefined
    return row ? sessionInfo(row) : null
  })
}

export async function createSyncSession(createdBy: number, playlistId: number) {
  try {
    return await withTransaction(async (client) => {
      // セットリスト・曲・歌詞を同一時点のスナップショットとして読む。
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      await expireSessions(client)
      const active = await client.query(
        `SELECT id FROM prompter_sync_sessions
         WHERE created_by = $1 AND status = 'active' LIMIT 1`,
        [createdBy]
      )
      if (active.rows[0]) {
        throw new SyncHttpError(409, '進行中の同期セッションがあります。', {
          activeSessionId: active.rows[0].id as string,
        })
      }

      const playlistSnapshot = await loadPlaylistSnapshot(client, playlistId, createdBy)
      const id = randomUUID()
      const joinToken = generateSecretToken()
      const result = await client.query(
        `INSERT INTO prompter_sync_sessions
          (id, playlist_id, created_by, status, join_token_hash, playlist_snapshot, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5::jsonb, CURRENT_TIMESTAMP + INTERVAL '24 hours')
         RETURNING *`,
        [id, playlistId, createdBy, hashSecretToken(joinToken), JSON.stringify(playlistSnapshot)]
      )
      return { snapshot: snapshotFromRow(result.rows[0] as SessionRow), joinToken }
    })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '23505') {
      const active = await query(
        `SELECT id FROM prompter_sync_sessions
         WHERE created_by = $1 AND status = 'active' LIMIT 1`,
        [createdBy]
      )
      throw new SyncHttpError(409, '進行中の同期セッションがあります。', {
        activeSessionId: active.rows[0]?.id as string | undefined,
      })
    }
    throw error
  }
}

export async function getMasterSnapshot(
  sessionId: string,
  createdBy: number
): Promise<MasterSyncSnapshot> {
  return withTransaction(async (client) => {
    await expireSessions(client)
    const sessionResult = await client.query(
      `SELECT * FROM prompter_sync_sessions WHERE id = $1 AND created_by = $2`,
      [sessionId, createdBy]
    )
    const row = sessionResult.rows[0] as SessionRow | undefined
    if (!row) throw new SyncHttpError(404, '同期セッションが見つかりません。')

    const devicesResult = await client.query(
      `SELECT id, session_id, device_number, display_name, configured_at, created_at
       FROM prompter_sync_devices WHERE session_id = $1
       ORDER BY device_number`,
      [sessionId]
    )
    const devices = (devicesResult.rows as DeviceRow[])
    return {
      ...snapshotFromRow(row),
      devices: devices.filter((device) => device.configured_at !== null).map(deviceFromRow),
      configuringCount: devices.filter((device) => device.configured_at === null).length,
    }
  })
}

export async function rotateJoinToken(sessionId: string, createdBy: number): Promise<string> {
  const token = generateSecretToken()
  return withTransaction(async (client) => {
    await expireSessions(client)
    const result = await client.query(
      `UPDATE prompter_sync_sessions SET join_token_hash = $1
       WHERE id = $2 AND created_by = $3 AND status = 'active'
       RETURNING *`,
      [hashSecretToken(token), sessionId, createdBy]
    )
    const row = result.rows[0] as SessionRow | undefined
    if (row) return token
    const existing = await client.query(
      `SELECT status FROM prompter_sync_sessions WHERE id = $1 AND created_by = $2`,
      [sessionId, createdBy]
    )
    if (!existing.rows[0]) throw new SyncHttpError(404, '同期セッションが見つかりません。')
    throw new SyncHttpError(410, '同期セッションは終了したか、有効期限が切れています。')
  })
}

export async function endSyncSession(sessionId: string, createdBy: number) {
  return withTransaction(async (client) => {
    await expireSessions(client)
    const result = await client.query(
      `UPDATE prompter_sync_sessions
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP, is_playing = false, started_at = NULL
       WHERE id = $1 AND created_by = $2 AND status = 'active'
       RETURNING *`,
      [sessionId, createdBy]
    )
    const row = result.rows[0] as SessionRow | undefined
    if (row) return { snapshot: snapshotFromRow(row), changed: true }
    const existing = await client.query(
      `SELECT * FROM prompter_sync_sessions WHERE id = $1 AND created_by = $2`,
      [sessionId, createdBy]
    )
    const existingRow = existing.rows[0] as SessionRow | undefined
    if (!existingRow) throw new SyncHttpError(404, '同期セッションが見つかりません。')
    return { snapshot: snapshotFromRow(existingRow), changed: false }
  })
}

async function activeSessionByJoinToken(
  client: PoolClient,
  joinTokenHash: string
): Promise<SessionRow> {
  const result = await client.query(
    `SELECT * FROM prompter_sync_sessions
     WHERE join_token_hash = $1 FOR UPDATE`,
    [joinTokenHash]
  )
  const row = result.rows[0] as SessionRow | undefined
  if (!row) throw new SyncHttpError(404, '参加URLが正しくありません。')
  if (row.status === 'active' && toDate(row.expires_at).getTime() <= Date.now()) {
    await client.query(
      `UPDATE prompter_sync_sessions SET status = 'expired' WHERE id = $1`,
      [row.id]
    )
    row.status = 'expired'
  }
  assertActive(row)
  return row
}

export async function joinSyncSession(joinToken: string, reconnectToken?: string) {
  const joinTokenHash = hashSecretToken(joinToken)
  return withTransaction(async (client) => {
    const session = await activeSessionByJoinToken(client, joinTokenHash)
    if (reconnectToken) {
      const existing = await client.query(
        `UPDATE prompter_sync_devices SET last_seen_at = CURRENT_TIMESTAMP
         WHERE session_id = $1 AND reconnect_token_hash = $2 AND released_at IS NULL
         RETURNING id, session_id, device_number, display_name, configured_at, created_at`,
        [session.id, hashSecretToken(reconnectToken)]
      )
      const device = existing.rows[0] as DeviceRow | undefined
      if (device) {
        return { device: deviceFromRow(device), snapshot: snapshotFromRow(session) }
      }
    }

    const numberResult = await client.query(
      `SELECT COALESCE(MAX(device_number), 0) + 1 AS next_number
       FROM prompter_sync_devices WHERE session_id = $1`,
      [session.id]
    )
    const newReconnectToken = generateSecretToken()
    const deviceResult = await client.query(
      `INSERT INTO prompter_sync_devices
        (id, session_id, device_number, reconnect_token_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, session_id, device_number, display_name, configured_at, created_at`,
      [
        randomUUID(),
        session.id,
        Number(numberResult.rows[0].next_number),
        hashSecretToken(newReconnectToken),
      ]
    )
    return {
      device: deviceFromRow(deviceResult.rows[0] as DeviceRow),
      reconnectToken: newReconnectToken,
      snapshot: snapshotFromRow(session),
    }
  })
}

async function authenticateDeviceWithClient(
  client: PoolClient,
  deviceId: string,
  reconnectToken: string,
  lock = false
): Promise<{ device: DeviceRow; session: SessionRow }> {
  const result = await client.query(
    `SELECT d.id, d.session_id, d.device_number, d.display_name, d.configured_at,
            d.created_at, s.id AS sync_id, s.playlist_id, s.status,
            s.playlist_snapshot, s.current_song_index, s.current_block,
            s.is_playing, s.position_ms, s.started_at, s.version,
            s.created_at AS sync_created_at, s.expires_at, s.ended_at
     FROM prompter_sync_devices d
     JOIN prompter_sync_sessions s ON s.id = d.session_id
     WHERE d.id = $1 AND d.reconnect_token_hash = $2 AND d.released_at IS NULL
     ${lock ? 'FOR UPDATE OF d, s' : ''}`,
    [deviceId, hashSecretToken(reconnectToken)]
  )
  const row = result.rows[0] as Record<string, unknown> | undefined
  if (!row) throw new SyncHttpError(401, '端末の認証情報が正しくありません。')
  const session: SessionRow = {
    id: row.sync_id as string,
    playlist_id: row.playlist_id as number,
    status: row.status as SessionRow['status'],
    playlist_snapshot: row.playlist_snapshot as PlaylistSnapshot,
    current_song_index: row.current_song_index as number,
    current_block: row.current_block as number,
    is_playing: row.is_playing as boolean,
    position_ms: row.position_ms as number,
    started_at: row.started_at as Date | null,
    version: row.version as string,
    created_at: row.sync_created_at as Date,
    expires_at: row.expires_at as Date,
    ended_at: row.ended_at as Date | null,
  }
  if (session.status === 'active' && toDate(session.expires_at).getTime() <= Date.now()) {
    await client.query(
      `UPDATE prompter_sync_sessions SET status = 'expired' WHERE id = $1`,
      [session.id]
    )
    session.status = 'expired'
  }
  assertActive(session)
  await client.query(
    `UPDATE prompter_sync_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [deviceId]
  )
  return {
    device: {
      id: row.id as string,
      session_id: row.session_id as string,
      device_number: row.device_number as number,
      display_name: row.display_name as string | null,
      configured_at: row.configured_at as Date | null,
      created_at: row.created_at as Date,
    },
    session,
  }
}

export async function configureSyncDevice(
  deviceId: string,
  reconnectToken: string,
  displayName: string
): Promise<SyncDevice> {
  return withTransaction(async (client) => {
    await authenticateDeviceWithClient(client, deviceId, reconnectToken, true)
    const result = await client.query(
      `UPDATE prompter_sync_devices
       SET display_name = $1, configured_at = COALESCE(configured_at, CURRENT_TIMESTAMP),
           last_seen_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, session_id, device_number, display_name, configured_at, created_at`,
      [displayName, deviceId]
    )
    return deviceFromRow(result.rows[0] as DeviceRow)
  })
}

export async function getDeviceSnapshot(
  deviceId: string,
  reconnectToken: string
): Promise<{ device: SyncDevice; snapshot: SyncSnapshot }> {
  return withTransaction(async (client) => {
    const { device, session } = await authenticateDeviceWithClient(
      client,
      deviceId,
      reconnectToken
    )
    return { device: deviceFromRow(device), snapshot: snapshotFromRow(session) }
  })
}

export async function getDeviceTokenContext(
  deviceId: string,
  reconnectToken: string
): Promise<{ sessionId: string; expiresAt: Date; clientId: string }> {
  return withTransaction(async (client) => {
    const { session } = await authenticateDeviceWithClient(client, deviceId, reconnectToken)
    return {
      sessionId: session.id,
      expiresAt: toDate(session.expires_at),
      clientId: `device:${deviceId}`,
    }
  })
}

export async function getMasterTokenContext(sessionId: string, createdBy: number) {
  return withTransaction(async (client) => {
    await expireSessions(client)
    const result = await client.query(
      `SELECT * FROM prompter_sync_sessions
       WHERE id = $1 AND created_by = $2`,
      [sessionId, createdBy]
    )
    const row = result.rows[0] as SessionRow | undefined
    if (!row) throw new SyncHttpError(404, '同期セッションが見つかりません。')
    assertActive(row)
    return {
      sessionId: row.id,
      expiresAt: toDate(row.expires_at),
      clientId: `master:${row.id}`,
    }
  })
}
