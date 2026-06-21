import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import PptxGenJS from 'pptxgenjs'

const SLIDE_W = 13.33
const FONT_SIZE = 32
const LINE_H = 1.2
const X_MARGIN = 0.4

export const runtime = 'nodejs'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

  function buildRuns(text: string, memberIds: number[], wordMembers?: { text: string; member_ids?: number[]; harmony_up_id?: number; harmony_down_id?: number }[]) {
    if (wordMembers && wordMembers.length > 0) {
      return wordMembers.flatMap(w => {
        const ids: number[] = w.member_ids ?? []
        const strikeColor = w.harmony_up_id ? (memberMap[w.harmony_up_id]?.color || '#FFFFFF').replace('#', '') : null
        const underlineColor = w.harmony_down_id ? (memberMap[w.harmony_down_id]?.color || '#FFFFFF').replace('#', '') : null
        const baseOpts = {
          fontSize: FONT_SIZE,
          ...(underlineColor ? { underline: { style: 'sng', color: underlineColor } } : {}),
        }
        const runs: { text: string; options: any }[] = []
        if (ids.length === 0) {
          runs.push({ text: w.text, options: { color: 'FFFFFF', ...baseOpts } })
        } else if (ids.length === 1) {
          const color = (memberMap[ids[0]]?.color || '#FFFFFF').replace('#', '')
          runs.push({ text: w.text, options: { color, ...baseOpts } })
        } else {
          w.text.split('').forEach((char, ci) => {
            const color = (memberMap[ids[ci % ids.length]]?.color || '#FFFFFF').replace('#', '')
            runs.push({ text: char, options: { color, ...baseOpts } })
          })
        }
        if (strikeColor && w.harmony_up_id) {
          // 上ハモは行上バーで表現するためここでは何もしない
        }
        return runs
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
  cover.addText(song.title, { x: X_MARGIN, y: 0.5, w: SLIDE_W - X_MARGIN * 2, h: 1.2, fontFace: 'Hiragino Sans', fontSize: 44, bold: true, color: 'FFFFFF' })
  if (song.artist) {
    cover.addText(song.artist, { x: X_MARGIN, y: 1.8, w: SLIDE_W - X_MARGIN * 2, h: 0.7, fontFace: 'Hiragino Sans', fontSize: 28, bold: false, color: 'AAAAAA' })
  }
  cover.addShape('rect' as any, { x: X_MARGIN, y: 2.7, w: SLIDE_W - X_MARGIN * 2, h: 0.05, fill: { color: 'FF69B4' }, line: { color: 'FF69B4', width: 0 } })
  const members = membersRes.rows
  const memberColW = (SLIDE_W - X_MARGIN * 2) / Math.max(members.length, 1)
  members.forEach((m: { name: string; color: string }, i: number) => {
    const x = X_MARGIN + i * memberColW
    const color = m.color.replace('#', '')
    cover.addShape('rect' as any, { x, y: 2.9, w: memberColW * 0.08, h: 0.4, fill: { color }, line: { color, width: 0 } })
    cover.addText(m.name, { x: x + memberColW * 0.12, y: 2.9, w: memberColW * 0.86, h: 0.4, fontFace: 'Hiragino Sans', fontSize: 20, bold: false, color })
  })

  const blockList = blocks.filter(Boolean)

  const BAR_H = 0.06
  const BAR_GAP = 0.02
  const TEXT_Y_OFFSET = BAR_H + BAR_GAP

  for (let bi = 0; bi < blockList.length; bi++) {
    const currentBlock = blockList[bi]
    const slide = pptx.addSlide()
    slide.background = { color: '000000' }
    let y = 0.3
    for (const line of currentBlock) {
      const wm: any[] = line.word_members || []
      const hasUpHarmony = wm.some((w: any) => w.harmony_up_id)
      if (hasUpHarmony) {
        const totalChars = wm.reduce((s: number, w: any) => s + (w.text?.length || 0), 0) || 1
        const lineW = SLIDE_W - X_MARGIN * 2
        let charOffset = 0
        wm.forEach((w: any) => {
          const charLen = w.text?.length || 0
          if (w.harmony_up_id) {
            const color = (memberMap[w.harmony_up_id]?.color || '#FFFFFF').replace('#', '')
            const bx = X_MARGIN + (charOffset / totalChars) * lineW
            const bw = (charLen / totalChars) * lineW
            slide.addShape('rect' as any, { x: bx, y, w: bw, h: BAR_H, fill: { color }, line: { color, width: 0 } })
          }
          charOffset += charLen
        })
      }
      const runs = buildRuns(line.text, line.member_ids || [], line.word_members || [])
      const textY = hasUpHarmony ? y + TEXT_Y_OFFSET : y
      const textH = hasUpHarmony ? LINE_H - TEXT_Y_OFFSET : LINE_H
      slide.addText(runs as any, { x: X_MARGIN, y: textY, w: SLIDE_W - X_MARGIN * 2, h: textH, fontFace: 'Hiragino Sans', fontSize: FONT_SIZE, bold: false, autoFit: false, shrinkText: false })
      y += LINE_H
    }
  }

  const buffer = Buffer.from(await pptx.write({ outputType: 'base64' }) as string, 'base64')
  return new globalThis.Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(song.title)}.pptx"`,
    },
  })
  } catch (e) {
    console.error('PPTX export error:', e)
    return new globalThis.Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}
