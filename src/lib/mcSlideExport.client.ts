'use client'

const WIDTH = 1920
const HEIGHT = 1080
const CONTENT_WIDTH = WIDTH * 0.9
const RIGHT = WIDTH - 32
const BODY_FONT_SIZE = 60.8
const BODY_LINE_HEIGHT = BODY_FONT_SIZE * 1.7
const INITIAL_TITLE_FONT_SIZE = 72
const MIN_TITLE_FONT_SIZE = 40
const BADGE_FONT_SIZE = 25.6
const BADGE_LINE_HEIGHT = BADGE_FONT_SIZE * 1.4
const BADGE_MARGIN = 16
const TITLE_MARGIN = 24
const VERTICAL_PADDING = 32
const MAX_TITLE_HEIGHT = HEIGHT * 0.38

export interface McSlidePngInput {
  title?: string | null
  body?: string | null
  itemOrder: number
}

export interface McSlidePngResult {
  blob: Blob
  filename: string
}

function bodyParagraphs(body: string) {
  const paragraphs: string[][] = []
  let current: string[] = []
  for (const raw of body.split('\n')) {
    const text = raw.trimEnd()
    if (text.trim() === '') {
      if (current.length > 0) {
        paragraphs.push(current)
        current = []
      }
    } else {
      current.push(text)
    }
  }
  if (current.length > 0) paragraphs.push(current)
  return paragraphs
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const rows: string[] = []
  let row = ''
  for (const character of Array.from(text)) {
    if (row && ctx.measureText(row + character).width > maxWidth) {
      rows.push(row)
      row = character
    } else {
      row += character
    }
  }
  rows.push(row)
  return rows
}

function safeFilename(value: string) {
  const normalized = value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'MC'
  return Array.from(normalized).slice(0, 60).join('')
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('PNGファイルを生成できませんでした。'))
    }, 'image/png')
  })
}

function resolveTitleLayout(ctx: CanvasRenderingContext2D, title: string) {
  let fontSize = INITIAL_TITLE_FONT_SIZE
  let rows: string[] = []
  while (fontSize >= MIN_TITLE_FONT_SIZE) {
    ctx.font = `700 ${fontSize}px "Hiragino Sans", "Yu Gothic", sans-serif`
    rows = title ? wrapText(ctx, title, CONTENT_WIDTH) : []
    if (rows.length * fontSize * 1.4 <= MAX_TITLE_HEIGHT || fontSize === MIN_TITLE_FONT_SIZE) break
    fontSize = Math.max(MIN_TITLE_FONT_SIZE, fontSize - 4)
  }
  return { rows, fontSize, lineHeight: fontSize * 1.4 }
}

export async function createMcSlidePngs(input: McSlidePngInput): Promise<McSlidePngResult[]> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PNG描画を初期化できませんでした。')
  await document.fonts?.ready

  const title = input.title?.trim() ?? ''
  const titleLayout = resolveTitleLayout(ctx, title)
  const titleHeight = titleLayout.rows.length * titleLayout.lineHeight
  const bodyHeight = Math.min(
    HEIGHT * 0.6,
    HEIGHT - VERTICAL_PADDING * 2 - BADGE_LINE_HEIGHT - BADGE_MARGIN
      - titleHeight - (titleLayout.rows.length > 0 ? TITLE_MARGIN : 0),
  )
  const maxBodyRows = Math.max(1, Math.floor(bodyHeight / BODY_LINE_HEIGHT))

  ctx.font = `400 ${BODY_FONT_SIZE}px "Hiragino Sans", "Yu Gothic", sans-serif`
  const paragraphs = bodyParagraphs(input.body ?? '')
  // 空行で区切られた段落は画面表示と同じく必ずページ境界にする。
  const pageRows = paragraphs.flatMap(paragraph => {
    const rows = paragraph.flatMap(line => wrapText(ctx, line, CONTENT_WIDTH))
    const chunks: string[][] = []
    for (let index = 0; index < rows.length; index += maxBodyRows) {
      chunks.push(rows.slice(index, index + maxBodyRows))
    }
    return chunks
  })
  if (pageRows.length === 0) pageRows.push([])

  const pageDigits = String(pageRows.length).length
  const itemPrefix = String(Math.max(1, input.itemOrder)).padStart(2, '0')
  const baseName = `${itemPrefix}_MC_${safeFilename(title)}`
  const results: McSlidePngResult[] = []

  for (let pageIndex = 0; pageIndex < pageRows.length; pageIndex += 1) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'

    const contentHeight = BADGE_LINE_HEIGHT + BADGE_MARGIN
      + titleHeight
      + (titleLayout.rows.length > 0 ? TITLE_MARGIN : 0)
      + pageRows[pageIndex].length * BODY_LINE_HEIGHT
    let y = Math.max(VERTICAL_PADDING, (HEIGHT - contentHeight) / 2)

    ctx.fillStyle = '#FF69B4'
    ctx.font = `700 ${BADGE_FONT_SIZE}px "Hiragino Sans", "Yu Gothic", sans-serif`
    ctx.fillText('🎤 MC', RIGHT, y)
    y += BADGE_LINE_HEIGHT + BADGE_MARGIN

    if (titleLayout.rows.length > 0) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `700 ${titleLayout.fontSize}px "Hiragino Sans", "Yu Gothic", sans-serif`
      for (const row of titleLayout.rows) {
        ctx.fillText(row, RIGHT, y)
        y += titleLayout.lineHeight
      }
      y += TITLE_MARGIN
    }

    ctx.fillStyle = '#EEEEEE'
    ctx.font = `400 ${BODY_FONT_SIZE}px "Hiragino Sans", "Yu Gothic", sans-serif`
    for (const row of pageRows[pageIndex]) {
      ctx.fillText(row, RIGHT, y)
      y += BODY_LINE_HEIGHT
    }

    const pageSuffix = pageRows.length > 1
      ? `_${String(pageIndex + 1).padStart(pageDigits, '0')}`
      : ''
    results.push({
      blob: await canvasToBlob(canvas),
      filename: `${baseName}${pageSuffix}.png`,
    })
  }

  return results
}
