import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import PptxGenJS from 'pptxgenjs'

const SLIDE_W = 10
const FONT_SIZE = 36
const LINE_H = 0.9
const X_MARGIN = 0.3

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const songRes = await query(`SELECT * FROM prompter_songs WHERE id=$1`, [id])
  const song = songRes.rows[0]
  if (!song) return new globalThis.Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  const membersRes = await query(`SELECT * FROM prompter_members WHERE song_id=$1 ORDER BY sort_order`, [id])
  const memberMap: Record<number, { color: string }> = {}
  for (const m of membersRes.rows) memberMap[m.id] = { color: m.color }

  const lyricsRes = await query(
    `SELECT * FROM prompter_lyrics WHERE song_id=$1 ORDER BY block_index, line_index`,
    [id]
  )

  const blocks: typeof lyricsRes.rows[] = []
  for (const line of lyricsRes.rows) {
    if (!blocks[line.block_index]) blocks[line.block_index] = []
    blocks[line.block_index].push(line)
  }

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  function buildRuns(text: string, memberIds: number[], wordMembers?: { text: string; member_ids?: number[] }[]) {
    if (wordMembers && wordMembers.length > 0) {
      return wordMembers.flatMap(w => {
        const isSpace = w.text === ' ' || w.text === '\u3000'
        const ids: number[] = (w as any).member_ids ?? []
        if (isSpace || ids.length === 0) return [{ text: w.text, options: { color: 'FFFFFF', fontSize: FONT_SIZE } }]
        if (ids.length === 1) {
          const color = (memberMap[ids[0]]?.color || '#FFFFFF').replace('#', '')
          return [{ text: w.text, options: { color, fontSize: FONT_SIZE } }]
        }
        return w.text.split('').map((char, ci) => {
          const color = (memberMap[ids[ci % ids.length]]?.color || '#FFFFFF').replace('#', '')
          return { text: char, options: { color, fontSize: FONT_SIZE } }
        })
      })
    }
    if (!memberIds || memberIds.length === 0) return [{ text, options: { color: 'FFFFFF', fontSize: FONT_SIZE } }]
    if (memberIds.length === 1) {
      const color = (memberMap[memberIds[0]]?.color || '#FFFFFF').replace('#', '')
      return [{ text, options: { color, fontSize: FONT_SIZE } }]
    }
    return text.split('').map((char, i) => {
      const mid = memberIds[i % memberIds.length]
      const color = (memberMap[mid]?.color || '#FFFFFF').replace('#', '')
      return { text: char, options: { color, fontSize: FONT_SIZE } }
    })
  }

  // 表紙スライド
  const cover = pptx.addSlide()
  cover.background = { color: '000000' }
  cover.addText(song.title, { x: X_MARGIN, y: 0.4, w: SLIDE_W - X_MARGIN * 2, h: 1.0, fontFace: 'Hiragino Sans', fontSize: 44, bold: true, color: 'FFFFFF' })
  if (song.artist) {
    cover.addText(song.artist, { x: X_MARGIN, y: 1.3, w: SLIDE_W - X_MARGIN * 2, h: 0.6, fontFace: 'Hiragino Sans', fontSize: 28, bold: false, color: 'AAAAAA' })
  }
  cover.addShape('rect' as any, { x: X_MARGIN, y: 2.0, w: SLIDE_W - X_MARGIN * 2, h: 0.05, fill: { color: 'FF69B4' }, line: { color: 'FF69B4', width: 0 } })
  const members = membersRes.rows
  const memberColW = (SLIDE_W - X_MARGIN * 2) / Math.max(members.length, 1)
  members.forEach((m: { name: string; color: string }, i: number) => {
    const x = X_MARGIN + i * memberColW
    const color = m.color.replace('#', '')
    cover.addShape('rect' as any, { x, y: 2.2, w: memberColW * 0.15, h: 0.35, fill: { color }, line: { color, width: 0 } })
    cover.addText(m.name, { x: x + memberColW * 0.2, y: 2.2, w: memberColW * 0.78, h: 0.35, fontFace: 'Hiragino Sans', fontSize: 20, bold: false, color })
  })

  const blockList = blocks.filter(Boolean)
  for (let bi = 0; bi < blockList.length; bi++) {
    const currentBlock = blockList[bi]
    const nextBlock = blockList[bi + 1] || []
    const slide = pptx.addSlide()
    slide.background = { color: '000000' }
    let y = 0.3
    for (const line of currentBlock) {
      const runs = buildRuns(line.text, line.member_ids || [], line.word_members || [])
      slide.addText(runs as any, { x: X_MARGIN, y, w: SLIDE_W - X_MARGIN * 2, h: LINE_H, fontFace: 'Hiragino Sans', fontSize: FONT_SIZE, bold: false })
      y += LINE_H
    }
    slide.addShape('rect' as any, { x: X_MARGIN, y: y + 0.05, w: SLIDE_W - X_MARGIN * 2, h: 0.06, fill: { color: 'FF69B4' }, line: { color: 'FF69B4', width: 0 } })
    y += 0.3
    for (const line of nextBlock.slice(0, 2)) {
      const runs = buildRuns(line.text, line.member_ids || [], line.word_members || [])
      slide.addText(runs as any, { x: X_MARGIN, y, w: SLIDE_W - X_MARGIN * 2, h: LINE_H, fontFace: 'Hiragino Sans', fontSize: FONT_SIZE, bold: false })
      y += LINE_H
    }
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as unknown as ArrayBuffer
  return new globalThis.Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(song.title)}.pptx"`,
    },
  })
}
