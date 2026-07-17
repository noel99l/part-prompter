// プロンプターの自動ブロック分け（表示用チャンク化）ロジック。
//
// 仕様:
// - パート分けで定義された元ブロックの境界は必ずページ境界になる。
//   自動分割は各ブロックの「内部」でのみ行い、ブロックをまたいで結合することはない。
// - 画面に収まるブロックはそのまま1ページで表示する。
// - 収まらないブロックは視覚行数（折り返し込み）を上限まで詰めてチャンクに分割する。
// - 分割チャンクの開始時刻は、行自身のタイムスタンプがあればそれを、
//   なければ前後ブロックのタイムスタンプから行位置で比例配分する。

export interface PromptLine {
  text: string
  timestamp_ms: number | null
  word_members?: { text: string }[]
}

export interface PromptLayout {
  maxRows: number   // 1画面に収まる視覚行数
  lineFont: number  // 歌詞行のフォントサイズ(px)
  contentW: number  // 歌詞表示領域の幅(px)
}

export interface DisplayChunk<L extends PromptLine> {
  lines: L[]
  startMs: number | null
  sourceBlockIndex: number
}

// 行の折り返しを含めた視覚行数を推定する（全角≈1em・半角≈0.6em）
export function estimateRows(line: PromptLine, layout: PromptLayout | null): number {
  if (!layout) return 1
  const text = line.word_members?.length ? line.word_members.map(w => w.text).join('') : line.text
  let units = 0
  for (const ch of text) units += (ch.codePointAt(0) ?? 0) > 0xff ? 1 : 0.6
  return Math.max(1, Math.ceil((units * layout.lineFont) / layout.contentW))
}

export function buildDisplayBlocks<L extends PromptLine>(
  blocks: L[][],
  layout: PromptLayout | null,
  autoSplit: boolean
): DisplayChunk<L>[] {
  return blocks.flatMap((block, bi) => {
    const startTs = block[0]?.timestamp_ms ?? null
    const maxRows = layout?.maxRows ?? Infinity
    const rows = block.map(l => estimateRows(l, layout))
    const totalRows = rows.reduce((a, b) => a + b, 0)
    if (!autoSplit || totalRows <= maxRows) return [{ lines: block, startMs: startTs, sourceBlockIndex: bi }]
    const nextTs = blocks[bi + 1]?.[0]?.timestamp_ms ?? null
    const chunks: DisplayChunk<L>[] = []
    let cur: L[] = []
    let curRows = 0
    let startIdx = 0
    const pushChunk = () => {
      if (cur.length === 0) return
      let startMs: number | null
      if (startIdx === 0) startMs = startTs
      else if (cur[0]?.timestamp_ms != null) startMs = cur[0].timestamp_ms
      else if (startTs != null && nextTs != null && nextTs > startTs) startMs = Math.round(startTs + ((nextTs - startTs) * startIdx) / block.length)
      else startMs = null
      chunks.push({ lines: cur, startMs, sourceBlockIndex: bi })
    }
    block.forEach((line, li) => {
      if (cur.length > 0 && curRows + rows[li] > maxRows) {
        pushChunk()
        cur = []
        curRows = 0
        startIdx = li
      }
      cur.push(line)
      curRows += rows[li]
    })
    pushChunk()
    return chunks
  })
}
