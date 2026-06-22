// 完了時刻整形の純粋ロジック（副作用なし）。

/**
 * Date を UTC・ISO 8601・ミリ秒精度の文字列へ整形する。
 * 例: 2025-01-01T12:34:56.789Z
 *
 * `Date#toISOString()` は常に UTC・ミリ秒精度・末尾 Z の ISO 8601 を返すため、
 * `new Date(result)` でラウンドトリップが恒等になる。
 *
 * Requirements 6.1, 7.3
 */
export function formatCompletionTimestamp(date: Date): string {
  return date.toISOString()
}
