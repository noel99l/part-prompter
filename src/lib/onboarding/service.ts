// サーバー側のオンボーディング・サービス層。DB と純粋ロジックを橋渡しする。
// I/O を伴うため、タイムアウト・例外を扱い、失敗時はフェイルセーフな値を返す（throw しない）。

import { query } from '@/lib/db'
import { shouldShowOnboarding } from './state'
import { formatCompletionTimestamp } from './time'

const READ_TIMEOUT_MS = 5000
const WRITE_TIMEOUT_MS = 5000

export interface OnboardingStatus {
  shouldShow: boolean
  completedAt: string | null
  /** 取得失敗時 true（UI は非表示・通常利用を維持） */
  error: boolean
}

export interface OnboardingRecordResult {
  ok: boolean
  completedAt: string | null
}

/** 指定ミリ秒でタイムアウトする Promise ラッパ */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ])
}

/**
 * email から判定材料を取得し、表示要否を返す。
 * 例外/タイムアウト時は記録を試み、{ shouldShow:false, completedAt:null, error:true } を返す。
 * Requirements 1.1, 1.6, 6.4, 6.6, 8.4
 */
export async function getOnboardingStatus(email: string): Promise<OnboardingStatus> {
  try {
    const result = await withTimeout(
      query(
        `SELECT account_name, onboarding_completed_at FROM users WHERE email = $1`,
        [email]
      ),
      READ_TIMEOUT_MS
    )
    const row = result.rows[0]
    const completedAtRaw = row?.onboarding_completed_at ?? null
    const completedAt =
      completedAtRaw instanceof Date
        ? completedAtRaw.toISOString()
        : completedAtRaw
    const shouldShow = shouldShowOnboarding({
      accountName: row?.account_name ?? null,
      onboardingCompletedAt: completedAt,
    })
    return { shouldShow, completedAt, error: false }
  } catch (e) {
    console.error('getOnboardingStatus error', e)
    return { shouldShow: false, completedAt: null, error: true }
  }
}

/**
 * 完了/スキップ/再表示完了を記録する。
 * 成功時 { ok:true, completedAt }、失敗/タイムアウト時は値を変更せず { ok:false, completedAt:null }。
 * Requirements 6.1, 6.5, 7.3, 7.5, 8.3
 */
export async function recordOnboardingComplete(
  email: string
): Promise<OnboardingRecordResult> {
  try {
    const now = new Date()
    await withTimeout(
      query(
        `UPDATE users SET onboarding_completed_at = $1 WHERE email = $2`,
        [now, email]
      ),
      WRITE_TIMEOUT_MS
    )
    return { ok: true, completedAt: formatCompletionTimestamp(now) }
  } catch (e) {
    console.error('recordOnboardingComplete error', e)
    return { ok: false, completedAt: null }
  }
}
