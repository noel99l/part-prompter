// ダウンロード項目（PPTXなど）を使ってよいかの、サーバー側の判定。
// 画面でボタンを隠すだけでは、URLを直接開けば取得できてしまうため、APIでも確認する。
import { query } from './db'
import { canDownload } from './masterSettingsPublic'

/** マスタ設定（全体ON、または許可リスト）に照らして、このユーザーがダウンロードできるか。 */
export async function canUserDownload(email: string | null | undefined): Promise<boolean> {
  const result = await query(
    `SELECT key, value FROM master_settings WHERE key IN ('show_download', 'download_whitelist')`
  )
  const settings: Record<string, string> = {}
  for (const row of result.rows) settings[row.key] = row.value
  return canDownload(settings, email)
}
