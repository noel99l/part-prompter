export const MAX_MEMBERS = 20

export interface MemberTemplateItem {
  name: string
  color: string
}

export interface MemberTemplatePayload {
  name: string
  members: MemberTemplateItem[]
}

type ParseResult =
  | { value: MemberTemplatePayload; error?: never }
  | { value?: never; error: string }

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function parseMemberTemplatePayload(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return { error: '入力内容が不正です。' }
  const body = input as { name?: unknown; members?: unknown }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'テンプレート名を入力してください。' }
  if (name.length > 50) return { error: 'テンプレート名は50文字以内で入力してください。' }
  if (!Array.isArray(body.members) || body.members.length === 0) {
    return { error: 'メンバーを1名以上登録してください。' }
  }
  if (body.members.length > MAX_MEMBERS) {
    return { error: `メンバーは${MAX_MEMBERS}名まで登録できます。` }
  }

  const members: MemberTemplateItem[] = []
  for (const item of body.members) {
    if (!item || typeof item !== 'object') return { error: 'メンバー情報が不正です。' }
    const member = item as { name?: unknown; color?: unknown }
    if (typeof member.name !== 'string' || member.name.trim().length > 50) {
      return { error: 'メンバー名は50文字以内で入力してください。' }
    }
    if (typeof member.color !== 'string' || !HEX_COLOR.test(member.color)) {
      return { error: 'メンバーカラーが不正です。' }
    }
    members.push({ name: member.name.trim(), color: member.color.toUpperCase() })
  }
  return { value: { name, members } }
}
