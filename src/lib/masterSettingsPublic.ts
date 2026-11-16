// マスタ設定のうち、APIから返してよい内容を決めるロジック。
//
// /api/master-settings の GET は未ログインでも呼べるため、DBの全項目をそのまま返すと
// ダウンロード許可リスト（他のユーザーのメールアドレス）まで誰でも取得できてしまう。
// ここで「公開してよい項目」を明示的に選び、許可リストは本人への判定結果（can_download）
// だけを返す。許可リスト本体は編集に必要なマスターにだけ返す。
import { CONTACT_EMAIL_SETTING_KEY } from './contact'

/** 未ログインを含む全員に返してよい設定項目。新しい項目を公開するときはここに足す。 */
export const PUBLIC_MASTER_SETTING_KEYS = ['show_download', 'show_parts_copy', CONTACT_EMAIL_SETTING_KEY] as const

export const DOWNLOAD_WHITELIST_KEY = 'download_whitelist'

export type PublicMasterSettings = Record<string, string | boolean>

/** カンマ区切りの許可リストを、比較用に正規化したメールアドレスの配列にする。 */
export function parseDownloadWhitelist(value: string | null | undefined): string[] {
  return (value ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
}

/** ダウンロード項目を表示してよいか。全体ONか、本人が許可リストに入っていれば表示する。 */
export function canDownload(all: Record<string, string>, email: string | null | undefined): boolean {
  if (all.show_download === '1') return true
  if (!email) return false
  return parseDownloadWhitelist(all[DOWNLOAD_WHITELIST_KEY]).includes(email.trim().toLowerCase())
}

/**
 * APIの応答を組み立てる。
 * @param all DBに保存されている全設定
 * @param viewer 呼び出したユーザー（未ログインなら email は null）
 */
export function buildMasterSettingsResponse(
  all: Record<string, string>,
  viewer: { email: string | null | undefined; isMaster: boolean }
): PublicMasterSettings {
  const response: PublicMasterSettings = {}
  for (const key of PUBLIC_MASTER_SETTING_KEYS) {
    if (all[key] !== undefined) response[key] = all[key]
  }
  response.can_download = canDownload(all, viewer.email)
  // 許可リスト本体は、マスタ設定画面で編集するマスターにだけ返す
  if (viewer.isMaster) response[DOWNLOAD_WHITELIST_KEY] = all[DOWNLOAD_WHITELIST_KEY] ?? ''
  return response
}
