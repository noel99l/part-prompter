export type SyncSessionStatus = 'active' | 'ended' | 'expired'

export interface SyncMember {
  id: number
  name: string
  color: string
  sortOrder: number
}

export interface SyncLyricLine {
  id: number
  blockIndex: number
  lineIndex: number
  text: string
  memberIds: number[]
  timestampMs: number | null
  wordMembers: unknown[]
}

export interface SyncSongSnapshot {
  id: number
  title: string
  artist: string | null
  description: string
  coverText: string
  bgColor: string
  originalBpm: number | null
  playbackBpm: number | null
  showProgressBar: boolean
  sortOrder: number
  members: SyncMember[]
  lyrics: SyncLyricLine[]
}

export interface PlaylistSnapshot {
  id: number
  name: string
  description: string | null
  songs: SyncSongSnapshot[]
}

export interface SyncState {
  sessionId: string
  songIndex: number
  songId: number
  currentBlock: number
  isPlaying: boolean
  positionMs: number
  startedAt: string | null
  version: number
}

export interface SyncDevice {
  id: string
  deviceNumber: number
  displayName: string | null
  configured: boolean
  configuredAt: string | null
}

export interface SyncSessionInfo {
  id: string
  playlistId: number
  status: SyncSessionStatus
  createdAt: string
  expiresAt: string
  endedAt: string | null
}

export interface SyncSnapshot {
  session: SyncSessionInfo
  playlist: PlaylistSnapshot
  state: SyncState
}

export interface MasterSyncSnapshot extends SyncSnapshot {
  devices: SyncDevice[]
  configuringCount: number
}

export type SyncEvent =
  | { name: 'state.updated'; data: SyncState }
  | { name: 'session.ended'; data: { sessionId: string; endedAt: string } }

export interface PresenceData {
  deviceId: string
  deviceNumber: number
  displayName: string
  configured: boolean
  songId: number
  ready: boolean
}
