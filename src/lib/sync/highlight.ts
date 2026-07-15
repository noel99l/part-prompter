export type HighlightOpacity = 1 | 0.2 | 0.55
export type HighlightKind = 'selected' | 'other' | 'unassigned'

export interface HighlightResult {
  opacity: HighlightOpacity
  assigned: boolean
  kind: HighlightKind
}

const ID_KEYS = ['id', 'ids', 'member_id', 'member_ids', 'main', 'main_id', 'main_ids'] as const

function collectIds(value: unknown, ids: Set<number>, seen: WeakSet<object>): void {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) ids.add(value)
    return
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const id = Number(value)
    if (Number.isSafeInteger(id) && id > 0) ids.add(id)
    return
  }
  if (value == null || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value) || value instanceof Set) {
    for (const item of value) collectIds(item, ids, seen)
    return
  }
  const record = value as Record<string, unknown>
  const keyedValues = ID_KEYS.filter(key => key in record).map(key => record[key])
  for (const item of keyedValues.length > 0 ? keyedValues : Object.values(record)) {
    collectIds(item, ids, seen)
  }
}

/** number・配列・互換objectから、有効なメンバーIDだけを重複なしで取り出す。 */
export function normalizeMemberIds(value: unknown): number[] {
  const ids = new Set<number>()
  collectIds(value, ids, new WeakSet<object>())
  return [...ids]
}

/** word_members 1文字分の主旋律・上下ハモリをまとめた担当ID。 */
export function getEffectiveMemberIds(word: unknown): number[] {
  if (word == null || typeof word !== 'object' || Array.isArray(word)) return []
  const value = word as Record<string, unknown>
  return normalizeMemberIds([
    value.member_ids, value.member_id, value.main_ids, value.main_id, value.main,
    value.harmony_up_ids, value.harmony_up_id,
    value.harmony_down_ids, value.harmony_down_id,
  ])
}
/** 行フォールバックを含む任意の担当IDが、端末の選択集合と交差するか判定する。 */
export function hasSelectedMember(memberIds: unknown, selectedMemberIds: unknown): boolean {
  const selected = new Set(normalizeMemberIds(selectedMemberIds))
  return normalizeMemberIds(memberIds).some(id => selected.has(id))
}

function highlightForIds(memberIds: unknown, selectedMemberIds: unknown): HighlightResult {
  const ids = normalizeMemberIds(memberIds)
  // パート分けなし＝全員歌唱として扱い、常に担当表示
  if (ids.length === 0) return { opacity: 1, assigned: true, kind: 'unassigned' }
  const assigned = hasSelectedMember(ids, selectedMemberIds)
  return { opacity: assigned ? 1 : 0.2, assigned, kind: assigned ? 'selected' : 'other' }
}

export function getWordHighlight(word: unknown, selectedMemberIds: unknown): HighlightResult {
  return highlightForIds(getEffectiveMemberIds(word), selectedMemberIds)
}

/** word_members がない行で、行全体の memberIds を同じ規則で判定する。 */
export function getLineHighlight(memberIds: unknown, selectedMemberIds: unknown): HighlightResult {
  return highlightForIds(memberIds, selectedMemberIds)
}
