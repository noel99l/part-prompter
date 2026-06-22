// フォーカストラップの純粋計算ロジック（副作用なし）。

/**
 * フォーカス可能要素に対する Tab / Shift+Tab の次フォーカス位置を計算する。
 * 末尾で Tab → 先頭、先頭で Shift+Tab → 末尾 にラップする。
 *
 * @param current 現在フォーカス中のインデックス（0..count-1）
 * @param count   フォーカス可能要素数（>=1）
 * @param shift   Shift+Tab なら true
 * @returns 次にフォーカスすべきインデックス（常に 0..count-1）
 *
 * Requirements 9.2, 9.4
 */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return 0
  // current を正規化（範囲外でも安全に扱う）
  const safeCurrent = ((current % count) + count) % count
  const delta = shift ? -1 : 1
  return (safeCurrent + delta + count) % count
}
