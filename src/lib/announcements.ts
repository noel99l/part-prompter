// お知らせ機能のサーバー側（DBアクセス）。
import { query } from './db'

let schemaPromise: Promise<void> | null = null

/**
 * お知らせ用のテーブル・カラムを用意する。プロセス内で1回だけ実行する。
 * 全APIが呼ぶ initDb() に足すと、お知らせを使わないリクエストのコールドスタートまで
 * 延びる（DDL 1本あたり約0.3秒）ため、お知らせ関連のAPIからだけ呼ぶ。
 */
export function ensureAnnouncementsSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'update',
          is_important BOOLEAN NOT NULL DEFAULT false,
          status TEXT NOT NULL DEFAULT 'draft',
          published_at TIMESTAMPTZ,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      // ユーザーごとの「お知らせを最後に読んだ日時」。未読バッジの判定に使う。
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS announcements_read_at TIMESTAMPTZ`)
    })().catch(error => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

export const ANNOUNCEMENT_COLUMNS = `id, title, body, category, is_important, status, published_at, created_at, updated_at`
