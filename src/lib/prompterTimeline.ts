import type { DisplayChunk, PromptLine } from '@/lib/prompterBlocks'

const MAX_POSITION_MS = 2_147_483_647

/** 同期状態の基準位置と開始時刻から、端末内の現在位置を求める。 */
export function playbackPositionMs(
  positionMs: number,
  isPlaying: boolean,
  startedAt: string | null,
  nowMs = Date.now()
): number {
  if (!isPlaying || !startedAt) return positionMs
  const startedAtMs = Date.parse(startedAt)
  if (!Number.isFinite(startedAtMs)) return positionMs
  return Math.min(MAX_POSITION_MS, positionMs + Math.max(0, nowMs - startedAtMs))
}

/** タイムスタンプ済み表示チャンクから、指定位置で表示すべきindexを返す。 */
export function displayBlockAtPosition<L extends PromptLine>(
  blocks: DisplayChunk<L>[],
  positionMs: number,
  fallback = -1,
  bpmRate = 1
): number {
  let result = fallback
  for (let index = 0; index < blocks.length; index++) {
    const startMs = blocks[index]?.startMs
    if (startMs != null && positionMs >= startMs * bpmRate) result = index
  }
  return result
}

export function prompterBpmRate(
  originalBpm: number | null | undefined,
  playbackBpm: number | null | undefined
): number {
  return originalBpm && playbackBpm && originalBpm > 0 && playbackBpm > 0
    ? originalBpm / playbackBpm
    : 1
}

export function sourceBlockAtPosition(
  lines: { blockIndex: number; timestampMs: number | null }[],
  positionMs: number,
  fallback = -1,
  bpmRate = 1
): number {
  let result = -1
  let hasTimestamp = false
  let latestStart = Number.NEGATIVE_INFINITY
  for (const line of lines) {
    if (line.timestampMs == null) continue
    hasTimestamp = true
    const start = line.timestampMs * bpmRate
    if (start <= positionMs && start >= latestStart) {
      latestStart = start
      result = line.blockIndex
    }
  }
  return hasTimestamp ? result : fallback
}
