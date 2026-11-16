// 運営への連絡（ご意見・不具合報告）をメールで受け付けるための共有ロジック。
// 宛先はマスタ設定の contact_email。未設定なら連絡用リンクは表示しない。

export const CONTACT_EMAIL_SETTING_KEY = 'contact_email'
export const CONTACT_MAIL_SUBJECT = '【PART-PROMPTER】ご意見・不具合報告'

/**
 * 連絡先として使えるメールアドレスか。
 * mailto リンクに埋め込むため、件名や宛先を書き換えられる記号（? & 空白など）を含むものは通さない。
 */
export function isValidContactEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(value)
}

export interface ContactContext {
  pageUrl?: string
  userAgent?: string
}

/** メールアプリで開く下書きの本文。調査に役立つ情報は、送る人が見て消せる形で添える。 */
export function buildContactMailBody({ pageUrl, userAgent }: ContactContext = {}): string {
  const lines = ['（ここにご意見・不具合の内容をお書きください）', '', '']
  const info = [
    pageUrl ? `ページ: ${pageUrl}` : null,
    userAgent ? `ブラウザ: ${userAgent}` : null,
  ].filter((line): line is string => line != null)
  if (info.length > 0) {
    lines.push('--- 以下は調査用の情報です（削除しても送信できます） ---', ...info)
  }
  return lines.join('\n')
}

/** 件名と本文をあらかじめ入れた mailto リンクを作る。 */
export function buildContactMailto(email: string, context: ContactContext = {}): string {
  const subject = encodeURIComponent(CONTACT_MAIL_SUBJECT)
  const body = encodeURIComponent(buildContactMailBody(context))
  return `mailto:${email}?subject=${subject}&body=${body}`
}
