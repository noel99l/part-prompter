// プロンプターの「パート名ラベル表示」用ロジック。
//
// 仕様:
// - 行を「担当（メイン・上ハモ・下ハモ）が同じ区間」に分け、区間の先頭にメンバー名ラベルを出す。
// - ラベルは担当が直前の区間から変わったときだけ出す（同じ担当が続く行では繰り返さない）。
// - 「直前」は呼び出し側が渡すグループ（スライドやブロック）単位でリセットする。
//   グループの先頭は必ずラベルが付くので、スライドを開いた時点で誰のパートか分かる。
// - メイン担当が未設定の区間は全員歌唱として扱う（mainIds が空）。
import { harmonyIds, type HarmonyWordLike } from './harmony'

export interface PartLabelWord extends HarmonyWordLike {
  text: string
  member_ids?: number[] | null
  member_id?: number | null
}

export interface PartLabelLine {
  text: string
  member_ids?: number[] | null
  word_members?: PartLabelWord[] | null
}

export interface PartSegmentBase {
  text: string
  mainIds: number[]
  upIds: number[]
  downIds: number[]
}

export interface PartSegment extends PartSegmentBase {
  showLabel: boolean
}

const isSpace = (text: string) => text === ' ' || text === '　'
const sortedKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(',')

/** 担当の同一性を判定するキー（メンバーの並び順には依存しない） */
export function partKey(seg: Pick<PartSegmentBase, 'mainIds' | 'upIds' | 'downIds'>): string {
  return `${sortedKey(seg.mainIds)}|${sortedKey(seg.upIds)}|${sortedKey(seg.downIds)}`
}

/** 行を、担当が同じ連続区間に分ける。空白は担当の切れ目にせず直前の区間に含める。 */
export function splitLineSegments(line: PartLabelLine): PartSegmentBase[] {
  const lineIds = line.member_ids ?? []
  const words = line.word_members ?? []
  if (words.length === 0) {
    return [{ text: line.text, mainIds: lineIds, upIds: [], downIds: [] }]
  }
  const segments: PartSegmentBase[] = []
  let pendingSpace = ''
  for (const w of words) {
    if (isSpace(w.text)) {
      if (segments.length > 0) segments[segments.length - 1].text += w.text
      else pendingSpace += w.text
      continue
    }
    const wordIds = w.member_ids ?? (w.member_id ? [w.member_id] : [])
    // 文字にメイン色が無ければ行のメイン色にフォールバックする（色分け表示と同じ扱い）
    const mainIds = wordIds.length > 0 ? wordIds : lineIds
    const seg: PartSegmentBase = { text: w.text, mainIds, upIds: harmonyIds(w, 'up'), downIds: harmonyIds(w, 'down') }
    const last = segments[segments.length - 1]
    if (last && partKey(last) === partKey(seg)) {
      last.text += w.text
    } else {
      seg.text = pendingSpace + seg.text
      pendingSpace = ''
      segments.push(seg)
    }
  }
  if (segments.length === 0) {
    return [{ text: line.text, mainIds: lineIds, upIds: [], downIds: [] }]
  }
  return segments
}

/**
 * 行ごとの区間とラベル表示有無を求める。
 * groups の各要素（スライドやブロック）の先頭で「直前の担当」をリセットする。
 */
export function buildPartLabelMap<L extends PartLabelLine, K>(
  groups: L[][],
  keyOfLine: (line: L) => K
): Map<K, PartSegment[]> {
  const map = new Map<K, PartSegment[]>()
  for (const group of groups) {
    let prevKey: string | null = null
    for (const line of group) {
      const segments = splitLineSegments(line).map(seg => {
        const key = partKey(seg)
        const showLabel = key !== prevKey
        prevKey = key
        return { ...seg, showLabel }
      })
      map.set(keyOfLine(line), segments)
    }
  }
  return map
}

/**
 * 自動ブロック分けの高さ見積もり用。この行がラベル分の高さを持つかを返す。
 * prev は同じスライド内の直前の行（スライド先頭なら null）。
 */
export function lineHasLabelRow(line: PartLabelLine, prev: PartLabelLine | null): boolean {
  const segments = splitLineSegments(line)
  // 行の途中で担当が変わる場合、2つ目以降の区間には必ずラベルが付く
  if (segments.length > 1) return true
  if (!prev) return true
  const prevSegments = splitLineSegments(prev)
  return partKey(segments[0]) !== partKey(prevSegments[prevSegments.length - 1])
}

/** メンバー色のラベル上で読める文字色（明るい色には濃色、暗い色には白）を返す */
export function readableTextColor(hex: string): string {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#111'
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#111' : '#fff'
}
