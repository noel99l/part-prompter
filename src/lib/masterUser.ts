// マスターアカウントの判定に使う定数。DBに依存しないのでクライアントからも import できる。
// ユーザーID1がマスターアカウント（全楽曲の編集、マスタ設定、お知らせ投稿ができる）。
export const MASTER_USER_ID = 1

/** セッションの user.id（文字列）からマスターかどうかを判定する（画面の出し分け用）。 */
export function isMasterSessionUserId(id: string | null | undefined): boolean {
  return id != null && id === String(MASTER_USER_ID)
}
