interface MemberNameLike {
  name?: string | null
  sortOrder?: number
  sort_order?: number
}

/** 未命名メンバーを既存の並び順に沿って A、B、C… と表示する。 */
export function memberDisplayName(member: MemberNameLike, index: number): string {
  const name = member.name?.trim()
  if (name) return name
  const order = member.sortOrder ?? member.sort_order ?? index
  return String.fromCharCode(65 + Math.max(0, order))
}
