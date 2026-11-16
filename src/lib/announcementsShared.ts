// お知らせ機能の、DBに依存しない共有ロジック（サーバー・クライアント両方から使う）。

export const ANNOUNCEMENT_CATEGORIES = ['update', 'maintenance', 'info'] as const
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

export const ANNOUNCEMENT_STATUSES = ['draft', 'published'] as const
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  update: 'アップデート',
  maintenance: 'メンテナンス',
  info: 'お知らせ',
}

export const ANNOUNCEMENT_TITLE_MAX = 100
export const ANNOUNCEMENT_BODY_MAX = 5000

export interface Announcement {
  id: number
  title: string
  body: string
  category: AnnouncementCategory
  is_important: boolean
  status: AnnouncementStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementInput {
  title: string
  body: string
  category: AnnouncementCategory
  is_important: boolean
  status: AnnouncementStatus
}

/** 投稿内容を検証して正規化する。問題があれば error に日本語のメッセージを返す。 */
export function parseAnnouncementInput(raw: unknown): { ok: true; value: AnnouncementInput } | { ok: false; error: string } {
  const data = (raw ?? {}) as Record<string, unknown>
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const body = typeof data.body === 'string' ? data.body.trim() : ''
  if (!title) return { ok: false, error: 'タイトルを入力してください' }
  if (title.length > ANNOUNCEMENT_TITLE_MAX) return { ok: false, error: `タイトルは${ANNOUNCEMENT_TITLE_MAX}文字以内で入力してください` }
  if (!body) return { ok: false, error: '本文を入力してください' }
  if (body.length > ANNOUNCEMENT_BODY_MAX) return { ok: false, error: `本文は${ANNOUNCEMENT_BODY_MAX}文字以内で入力してください` }
  const category = ANNOUNCEMENT_CATEGORIES.find(c => c === data.category)
  if (!category) return { ok: false, error: '種別が正しくありません' }
  const status = ANNOUNCEMENT_STATUSES.find(s => s === data.status)
  if (!status) return { ok: false, error: '公開状態が正しくありません' }
  return { ok: true, value: { title, body, category, is_important: data.is_important === true, status } }
}

/** readAt より後に公開されたお知らせ。readAt が null（一度も読んでいない）なら全件が未読。 */
export function unreadAnnouncements<T extends Pick<Announcement, 'published_at'>>(items: T[], readAt: string | null): T[] {
  const readTime = readAt ? Date.parse(readAt) : NaN
  if (Number.isNaN(readTime)) return items.filter(item => item.published_at != null)
  return items.filter(item => item.published_at != null && Date.parse(item.published_at) > readTime)
}

/** 2つの既読日時のうち新しい方を返す（サーバー保存分と端末保存分の統合用）。 */
export function latestReadAt(a: string | null, b: string | null): string | null {
  const ta = a ? Date.parse(a) : NaN
  const tb = b ? Date.parse(b) : NaN
  if (Number.isNaN(ta)) return Number.isNaN(tb) ? null : b
  if (Number.isNaN(tb)) return a
  return ta >= tb ? a : b
}

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string }

/**
 * 本文を「文字列」と「URL」に分ける。本文はHTMLとして解釈せず、
 * http(s) のURLだけをリンクにするために使う（描画側はテキストとして出力する）。
 */
export function splitTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  const pattern = /https?:\/\/[^\s<>"'（）「」、。]+/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    // 文末の句読点や閉じ括弧はURLに含めない
    const url = match[0].replace(/[.,!?:;)\]]+$/, '')
    if (!url) continue
    if (index > last) parts.push({ type: 'text', value: text.slice(last, index) })
    parts.push({ type: 'link', value: url })
    last = index + url.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
