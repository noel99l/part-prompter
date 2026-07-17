'use client'

import { harmonyIds } from '@/lib/harmony'
import { buildDisplayBlocks, type DisplayChunk } from '@/lib/prompterBlocks'
import { displayBlockAtPosition, prompterBpmRate } from '@/lib/prompterTimeline'

const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30
const CURRENT_FONT_SIZE = 96
const NEXT_FONT_SIZE = 64
const X_MARGIN = 77
const LAST_SLIDE_MS = 5000

interface VideoWordMember {
  text: string
  member_ids?: number[]
  harmony_up_ids?: number[]
  harmony_down_ids?: number[]
  harmony_up_id?: number
  harmony_down_id?: number
}

interface VideoLine {
  id: number
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: VideoWordMember[]
}

interface VideoMember {
  id: number
  name: string
  color: string
  sort_order: number
}

interface VideoSong {
  title: string
  artist?: string
  cover_text?: string
  bg_color?: string
  original_bpm?: number | null
  playback_bpm?: number | null
}

export interface Mp4ExportResult {
  blob: Blob
  filename: string
}
type ProgressCallback = (progress: number) => void

type StyledChar = {
  text: string
  memberIds: number[]
  upIds: number[]
  downIds: number[]
}

function safeColor(color: string | undefined, fallback = '#FFFFFF') {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color! : fallback
}

function lineChars(line: VideoLine): StyledChar[] {
  if (line.word_members?.length) {
    return line.word_members.flatMap(word =>
      Array.from(word.text).map(text => ({
        text,
        memberIds: word.member_ids || [],
        upIds: harmonyIds(word, 'up'),
        downIds: harmonyIds(word, 'down'),
      }))
    )
  }
  return Array.from(line.text).map(text => ({
    text,
    memberIds: line.member_ids || [],
    upIds: [],
    downIds: [],
  }))
}

function memberFill(
  ctx: CanvasRenderingContext2D,
  ids: number[],
  memberMap: Map<number, VideoMember>,
  top: number,
  bottom: number,
) {
  if (ids.length === 0) return '#FFFFFF'
  if (ids.length === 1) return safeColor(memberMap.get(ids[0])?.color)
  const gradient = ctx.createLinearGradient(0, top, 0, bottom)
  ids.forEach((id, index) => {
    const color = safeColor(memberMap.get(id)?.color)
    const start = index / ids.length
    const end = (index + 1) / ids.length
    gradient.addColorStop(start, color)
    gradient.addColorStop(end, color)
  })
  return gradient
}
function drawHarmonyBands(
  ctx: CanvasRenderingContext2D,
  char: StyledChar,
  memberMap: Map<number, VideoMember>,
  x: number,
  baseline: number,
  width: number,
  fontSize: number,
) {
  const stripeHeight = Math.max(3, Math.round(fontSize * 0.055))
  const top = baseline - fontSize * 0.9
  char.upIds.forEach((id, index) => {
    ctx.fillStyle = safeColor(memberMap.get(id)?.color, '#888888')
    ctx.fillRect(x, top + index * stripeHeight, width, stripeHeight)
  })
  char.downIds.forEach((id, index) => {
    ctx.fillStyle = safeColor(memberMap.get(id)?.color, '#888888')
    ctx.fillRect(x, baseline + 4 + index * stripeHeight, width, stripeHeight)
  })
}

function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  line: VideoLine,
  memberMap: Map<number, VideoMember>,
  options: { x: number; baseline: number; maxWidth: number; fontSize: number },
) {
  const { x: startX, baseline: startBaseline, maxWidth, fontSize } = options
  const rowHeight = fontSize * 1.3
  let x = startX
  let baseline = startBaseline
  let rows = 1
  ctx.font = `700 ${fontSize}px "Hiragino Sans", "Yu Gothic", sans-serif`
  ctx.textBaseline = 'alphabetic'

  for (const char of lineChars(line)) {
    const width = Math.max(ctx.measureText(char.text).width, char.text.trim() ? 1 : fontSize * 0.35)
    if (x > startX && x + width > startX + maxWidth) {
      x = startX
      baseline += rowHeight
      rows++
    }
    drawHarmonyBands(ctx, char, memberMap, x, baseline, width, fontSize)
    ctx.fillStyle = memberFill(ctx, char.memberIds, memberMap, baseline - fontSize, baseline + fontSize * 0.2)
    ctx.fillText(char.text, x, baseline)
    x += width
  }
  return rows
}

function wrapPlainText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const rows: string[] = []
  let row = ''
  for (const char of Array.from(text)) {
    if (char === '\n') {
      rows.push(row)
      row = ''
      continue
    }
    if (row && ctx.measureText(row + char).width > maxWidth) {
      rows.push(row)
      row = char
    } else row += char
  }
  if (row) rows.push(row)
  return rows
}
function clearCanvas(ctx: CanvasRenderingContext2D, song: VideoSong) {
  ctx.globalAlpha = 1
  ctx.fillStyle = safeColor(song.bg_color, '#000000')
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  song: VideoSong,
  members: VideoMember[],
) {
  clearCanvas(ctx, song)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 96px "Hiragino Sans", "Yu Gothic", sans-serif'
  wrapPlainText(ctx, song.title, WIDTH - X_MARGIN * 2).slice(0, 2)
    .forEach((row, index) => ctx.fillText(row, X_MARGIN, 180 + index * 112))

  if (song.artist) {
    ctx.fillStyle = '#AAAAAA'
    ctx.font = '400 52px "Hiragino Sans", "Yu Gothic", sans-serif'
    ctx.fillText(song.artist, X_MARGIN, 390)
  }

  ctx.fillStyle = '#FF69B4'
  ctx.fillRect(X_MARGIN, 450, WIDTH - X_MARGIN * 2, 6)

  if (song.cover_text) {
    ctx.fillStyle = '#DDDDDD'
    ctx.font = '400 38px "Hiragino Sans", "Yu Gothic", sans-serif'
    wrapPlainText(ctx, song.cover_text, WIDTH - X_MARGIN * 2).slice(0, 4)
      .forEach((row, index) => ctx.fillText(row, X_MARGIN, 535 + index * 52))
  }

  const memberY = 805
  const columnWidth = (WIDTH - X_MARGIN * 2) / Math.max(1, Math.min(members.length, 5))
  members.forEach((member, index) => {
    const row = Math.floor(index / 5)
    const column = index % 5
    const x = X_MARGIN + column * columnWidth
    const y = memberY + row * 70
    ctx.fillStyle = safeColor(member.color)
    ctx.fillRect(x, y - 28, 18, 36)
    ctx.font = '700 34px "Hiragino Sans", "Yu Gothic", sans-serif'
    ctx.fillText(member.name || String.fromCharCode(65 + member.sort_order), x + 32, y)
  })
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  song: VideoSong,
  members: VideoMember[],
  blocks: DisplayChunk<VideoLine>[],
  blockIndex: number,
) {
  clearCanvas(ctx, song)
  const memberMap = new Map(members.map(member => [member.id, member]))
  const current = blocks[blockIndex]
  let baseline = 145
  for (const line of current?.lines || []) {
    const rows = drawStyledLine(ctx, line, memberMap, {
      x: X_MARGIN,
      baseline,
      maxWidth: WIDTH - X_MARGIN * 2,
      fontSize: CURRENT_FONT_SIZE,
    })
    baseline += rows * CURRENT_FONT_SIZE * 1.3 + CURRENT_FONT_SIZE * 0.3
  }
  const next = blocks[blockIndex + 1]
  ctx.globalAlpha = 0.65
  ctx.fillStyle = '#FF69B4'
  ctx.fillRect(X_MARGIN, 820, WIDTH - X_MARGIN * 2, 5)
  if (next) {
    let nextBaseline = 910
    for (const line of next.lines.slice(0, 2)) {
      const rows = drawStyledLine(ctx, line, memberMap, {
        x: X_MARGIN,
        baseline: nextBaseline,
        maxWidth: WIDTH - X_MARGIN * 2,
        fontSize: NEXT_FONT_SIZE,
      })
      nextBaseline += rows * NEXT_FONT_SIZE * 1.3 + 10
      if (nextBaseline > 1050) break
    }
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'italic 52px "Hiragino Sans", "Yu Gothic", sans-serif'
    ctx.fillText('― End ―', X_MARGIN, 920)
  }
  ctx.globalAlpha = 1
}

function groupBlocks(lines: VideoLine[]) {
  const blocks: VideoLine[][] = []
  for (const line of [...lines].sort((a, b) =>
    a.block_index - b.block_index || a.line_index - b.line_index
  )) {
    if (!blocks[line.block_index]) blocks[line.block_index] = []
    blocks[line.block_index].push(line)
  }
  return blocks.filter(Boolean)
}

function downloadFilename(title: string) {
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'prompter'
  return `${safe}.mp4`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`動画データの読み込みに失敗しました（${response.status}）`)
  }
  return response.json() as Promise<T>
}

function yieldToBrowser() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function createPrompterMp4(
  songId: string,
  onProgress: ProgressCallback,
): Promise<Mp4ExportResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('このブラウザはMP4生成に対応していません。最新版のChromeまたはEdgeをご利用ください。')
  }

  const [song, members, lines] = await Promise.all([
    fetchJson<VideoSong>(`/api/songs/${songId}`),
    fetchJson<VideoMember[]>(`/api/songs/${songId}/members`),
    fetchJson<VideoLine[]>(`/api/songs/${songId}/lyrics`),
  ])
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('歌詞がありません。')
  if (!lines.some(line => line.timestamp_ms != null)) throw new Error('MP4出力にはタイムスタンプが必要です。')
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('動画描画を初期化できませんでした。')
  await document.fonts?.ready

  const sourceBlocks = groupBlocks(lines)
  const displayBlocks = buildDisplayBlocks(sourceBlocks, {
    maxRows: 4,
    lineFont: CURRENT_FONT_SIZE,
    contentW: WIDTH - X_MARGIN * 2,
  }, true)
  const bpmRate = prompterBpmRate(song.original_bpm, song.playback_bpm)
  const timedStarts = displayBlocks.flatMap(block =>
    block.startMs == null ? [] : [block.startMs * bpmRate]
  )
  if (timedStarts.length === 0) {
    throw new Error('各歌詞ブロックの先頭行にタイムスタンプを設定してください。')
  }
  const lastSlideStartMs = Math.max(...timedStarts)
  const durationMs = lastSlideStartMs + LAST_SLIDE_MS
  const totalFrames = Math.max(1, Math.ceil((durationMs / 1000) * FPS))

  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: 3_000_000,
  })
  output.addVideoTrack(videoSource, { frameRate: FPS })
  output.setMetadataTags({ title: song.title, artist: song.artist })

  try {
    await output.start()
    let renderedBlock = Number.NaN
    for (let frame = 0; frame < totalFrames; frame++) {
      const timestampSeconds = frame / FPS
      const positionMs = timestampSeconds * 1000
      const blockIndex = displayBlockAtPosition(displayBlocks, positionMs, -1, bpmRate)
      const blockChanged = blockIndex !== renderedBlock
      if (blockChanged) {
        if (blockIndex < 0) drawCover(ctx, song, members)
        else drawSlide(ctx, song, members, displayBlocks, blockIndex)
        renderedBlock = blockIndex
      }
      await videoSource.add(timestampSeconds, 1 / FPS, {
        keyFrame: frame === 0 || frame % (FPS * 2) === 0 || blockChanged,
      })
      if (frame % 15 === 0 || frame === totalFrames - 1) {
        onProgress(Math.round(((frame + 1) / totalFrames) * 95))
      }
      // エンコード中も進捗モーダルを再描画できるよう、定期的にイベントループへ制御を戻す。
      if (frame > 0 && frame % FPS === 0) await yieldToBrowser()
    }
    await output.finalize()
  } catch (error) {
    if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel()
    throw error
  }

  const buffer = output.target.buffer
  if (!buffer) throw new Error('MP4ファイルを生成できませんでした。')
  onProgress(100)
  return {
    blob: new Blob([buffer], { type: 'video/mp4' }),
    filename: downloadFilename(song.title),
  }
}
