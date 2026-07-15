import { prompterBpmRate, sourceBlockAtPosition } from '@/lib/prompterTimeline'
import { SyncHttpError } from './errors'
import type { PlaylistSnapshot, SyncState } from './types'

export type SyncCommand =
  | { commandId: string; type: 'selectSong'; songIndex: number }
  | { commandId: string; type: 'selectPage'; block: number }
  | { commandId: string; type: 'previousPage' }
  | { commandId: string; type: 'nextPage' }
  | { commandId: string; type: 'play' }
  | { commandId: string; type: 'pause' }
  | { commandId: string; type: 'seek'; positionMs: number }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_POSITION_MS = 2_147_483_647

function assertExactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new SyncHttpError(400, '状態変更リクエストに未対応の項目が含まれています。')
  }
}

export function parseSyncCommand(value: unknown): SyncCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyncHttpError(400, '状態変更リクエストが不正です。')
  }
  const input = value as Record<string, unknown>
  if (typeof input.commandId !== 'string' || !UUID_PATTERN.test(input.commandId)) {
    throw new SyncHttpError(400, 'commandIdにはUUIDを指定してください。')
  }
  if (typeof input.type !== 'string') {
    throw new SyncHttpError(400, '操作種別を指定してください。')
  }
  if (input.type === 'selectSong') {
    assertExactKeys(input, ['commandId', 'type', 'songIndex'])
    if (!Number.isInteger(input.songIndex)) throw new SyncHttpError(400, '曲番号が不正です。')
    return { commandId: input.commandId, type: input.type, songIndex: input.songIndex as number }
  }
  if (input.type === 'selectPage') {
    assertExactKeys(input, ['commandId', 'type', 'block'])
    if (!Number.isInteger(input.block)) throw new SyncHttpError(400, 'ページ番号が不正です。')
    return { commandId: input.commandId, type: input.type, block: input.block as number }
  }
  if (input.type === 'seek') {
    assertExactKeys(input, ['commandId', 'type', 'positionMs'])
    if (!Number.isInteger(input.positionMs) || (input.positionMs as number) < 0 || (input.positionMs as number) > MAX_POSITION_MS) {
      throw new SyncHttpError(400, '再生位置が不正です。')
    }
    return { commandId: input.commandId, type: input.type, positionMs: input.positionMs as number }
  }
  if (['previousPage', 'nextPage', 'play', 'pause'].includes(input.type)) {
    assertExactKeys(input, ['commandId', 'type'])
    return { commandId: input.commandId, type: input.type } as SyncCommand
  }
  throw new SyncHttpError(400, '未対応の操作です。')
}

function positionAt(state: SyncState, now: Date): number {
  if (!state.isPlaying || !state.startedAt) return state.positionMs
  return Math.min(
    MAX_POSITION_MS,
    state.positionMs + Math.max(0, now.getTime() - Date.parse(state.startedAt))
  )
}

function blocksForSong(snapshot: PlaylistSnapshot, songIndex: number): number[] {
  return [...new Set(snapshot.songs[songIndex].lyrics.map((line) => line.blockIndex))]
    .sort((a, b) => a - b)
}

function blockStartPosition(
  snapshot: PlaylistSnapshot,
  songIndex: number,
  block: number
): number | null {
  if (block === -1) return 0
  const song = snapshot.songs[songIndex]
  const timestamps = song.lyrics
    .filter((line) => line.blockIndex === block && line.timestampMs !== null)
    .map((line) => line.timestampMs as number)
  return timestamps.length > 0
    ? Math.round(Math.min(...timestamps) * prompterBpmRate(song.originalBpm, song.playbackBpm))
    : null
}

function moveToBlock(
  state: SyncState,
  next: SyncState,
  snapshot: PlaylistSnapshot,
  block: number,
  now: Date
): SyncState {
  next.currentBlock = block
  const position = blockStartPosition(snapshot, state.songIndex, block)
  if (position !== null) {
    next.positionMs = position
    next.startedAt = state.isPlaying ? now.toISOString() : null
  }
  return next
}

function currentSourceBlock(
  state: SyncState,
  snapshot: PlaylistSnapshot,
  now: Date
): number {
  const song = snapshot.songs[state.songIndex]
  return sourceBlockAtPosition(
    song.lyrics,
    positionAt(state, now),
    state.currentBlock,
    prompterBpmRate(song.originalBpm, song.playbackBpm)
  )
}

export function applySyncCommand(
  state: SyncState,
  command: SyncCommand,
  snapshot: PlaylistSnapshot,
  now = new Date()
): SyncState {
  const song = snapshot.songs[state.songIndex]
  if (!song) throw new SyncHttpError(409, '現在の曲を特定できません。')
  const next: SyncState = { ...state, version: state.version + 1 }

  switch (command.type) {
    case 'selectSong': {
      const selected = snapshot.songs[command.songIndex]
      if (!selected) throw new SyncHttpError(400, '指定された曲はセットリストにありません。')
      return {
        ...next,
        songIndex: command.songIndex,
        songId: selected.id,
        currentBlock: -1,
        isPlaying: false,
        positionMs: 0,
        startedAt: null,
      }
    }
    case 'selectPage': {
      const blocks = blocksForSong(snapshot, state.songIndex)
      if (command.block !== -1 && !blocks.includes(command.block)) {
        throw new SyncHttpError(400, '指定されたページは現在の曲にありません。')
      }
      return moveToBlock(state, next, snapshot, command.block, now)
    }
    case 'previousPage': {
      const blocks = blocksForSong(snapshot, state.songIndex)
      const currentBlock = currentSourceBlock(state, snapshot, now)
      const index = blocks.indexOf(currentBlock)
      const block = index <= 0 ? -1 : blocks[index - 1]
      return moveToBlock(state, next, snapshot, block, now)
    }
    case 'nextPage': {
      const blocks = blocksForSong(snapshot, state.songIndex)
      const currentBlock = currentSourceBlock(state, snapshot, now)
      let block = currentBlock
      if (currentBlock === -1) block = blocks[0] ?? -1
      else {
        const index = blocks.indexOf(currentBlock)
        if (index >= 0 && index < blocks.length - 1) block = blocks[index + 1]
      }
      return moveToBlock(state, next, snapshot, block, now)
    }
    case 'play': {
      next.positionMs = positionAt(state, now)
      next.isPlaying = true
      next.startedAt = now.toISOString()
      return next
    }
    case 'pause': {
      next.positionMs = positionAt(state, now)
      next.currentBlock = sourceBlockAtPosition(
        song.lyrics,
        next.positionMs,
        state.currentBlock,
        prompterBpmRate(song.originalBpm, song.playbackBpm)
      )
      next.isPlaying = false
      next.startedAt = null
      return next
    }
    case 'seek': {
      next.positionMs = command.positionMs
      next.currentBlock = sourceBlockAtPosition(
        song.lyrics,
        next.positionMs,
        state.currentBlock,
        prompterBpmRate(song.originalBpm, song.playbackBpm)
      )
      next.startedAt = state.isPlaying ? now.toISOString() : null
      return next
    }
  }
}
