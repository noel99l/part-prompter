// 歌詞編集時にパート分け（member_ids / word_members）を引き継ぐ純粋ロジック。
//
// 設計方針（想定外の場所に割り当てがズレて入るのを防ぐ）:
//  1. 引き継ぎは「テキスト完全一致」でのみ行う。1文字でも変わった行は新規行として扱い、
//     割り当ては引き継がない（誤った行へ移すより、引き継がない方が安全）。
//  2. 同一テキストが複数ある場合（サビの繰り返し等）は、出現順で1対1に対応付ける
//     （位置ベース）。先頭行の割り当てを全コピーして他の繰り返し行を上書きしない。
//  3. 既存より出現回数が増えた分の行は新規扱い（空の割り当て）。減った分の既存割り当ては破棄。
//  4. word_members の文字数が行テキストの文字数と一致しない場合は word_members を空にする
//     （文字単位の色が1文字でもズレた状態を伝播させない防御。member_ids は保持）。

export interface WordMemberLike {
  text: string
  member_ids: number[]
  harmony_up_id?: number
  harmony_down_id?: number
}

export interface MergeLine {
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members: WordMemberLike[]
}

/** word_members の文字数が text と一致しなければ空にする（member_ids は保持） */
function sanitizeWordMembers(text: string, wm: WordMemberLike[]): WordMemberLike[] {
  if (wm.length === 0) return []
  return wm.length === text.split('').length ? wm : []
}

/**
 * 既存行(existing)の割り当てを、パース後の新しい行(parsed)へテキスト一致・出現順で引き継ぐ。
 * parsed の text / timestamp_ms はそのまま使い、member_ids / word_members のみ引き継ぐ。
 */
export function mergeAssignments(existing: MergeLine[], parsed: MergeLine[]): MergeLine[] {
  // text ごとに、既存の割り当てを出現順のキューとして保持
  const buckets = new Map<string, { member_ids: number[]; word_members: WordMemberLike[] }[]>()
  for (const l of existing) {
    const arr = buckets.get(l.text) ?? []
    arr.push({ member_ids: l.member_ids ?? [], word_members: l.word_members ?? [] })
    buckets.set(l.text, arr)
  }

  const cursor = new Map<string, number>()

  return parsed.map((l) => {
    const arr = buckets.get(l.text)
    const idx = cursor.get(l.text) ?? 0
    if (!arr || idx >= arr.length) {
      // 一致する既存行がない（新規行 / 出現回数増加分） → 引き継がない
      return l
    }
    cursor.set(l.text, idx + 1)
    const e = arr[idx]
    return {
      ...l,
      member_ids: [...e.member_ids],
      word_members: sanitizeWordMembers(l.text, e.word_members),
    }
  })
}
