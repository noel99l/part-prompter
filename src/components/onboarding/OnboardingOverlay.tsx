'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TOUR_STEPS,
  canGoBack,
  nextView,
  prevView,
  tourProgress,
  type OnboardingView,
} from '@/lib/onboarding/state'
import styles from './OnboardingOverlay.module.css'

const COMPLETE_TIMEOUT_MS = 5000
const BANNER_AUTO_DISMISS_MS = 10000

/** POST /api/onboarding を 5 秒タイムアウトで呼び、保存成否を返す（throw しない） */
async function postComplete(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), COMPLETE_TIMEOUT_MS)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return false
    const data = await res.json()
    return !!data.ok
  } catch {
    return false
  }
}

export default function OnboardingOverlay({ onClose, isReplay }: { onClose: () => void; isReplay?: boolean }) {
  const router = useRouter()
  const [view, setView] = useState<OnboardingView>({ kind: 'welcome' })
  const [saveFailed, setSaveFailed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const navigatingRef = useRef(false)

  // 異常系: ツアーステップが 0 件の場合は閉じて管理画面へ（防御的処理, Req 2.7）
  useEffect(() => {
    if (TOUR_STEPS.length === 0) {
      onClose()
      router.replace('/manage/songs')
    }
  }, [onClose, router])

  // マウント時に最初の操作要素へフォーカス（Req 9.3）
  useEffect(() => {
    const first = getFocusable()[0]
    first?.focus()
  }, [view.kind])

  function getFocusable(): HTMLElement[] {
    if (!dialogRef.current) return []
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement)
  }

  /** 完了/スキップ共通処理: 記録 → 閉じる → /manage/songs。失敗時はバナー表示（Req 4.4/5.3/8.1/8.2） */
  const complete = useCallback(
    async (navigate: boolean) => {
      if (navigatingRef.current) return
      navigatingRef.current = true
      const ok = await postComplete()
      onClose()
      if (navigate && !isReplay) {
        router.replace('/manage/songs')
      }
      if (!ok) {
        // 保存失敗: 遷移後に非ブロッキングなバナーを表示（最長 10 秒で自動消去）
        setSaveFailed(true)
      }
    },
    [onClose, router, isReplay]
  )

  // Esc でスキップ相当（完了記録 → 閉じる → フォーカス復帰）（Req 9.7）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void complete(false)
        return
      }
      if (e.key === 'Tab') {
        // フォーカストラップ（Req 9.4）
        const focusable = getFocusable()
        if (focusable.length === 0) return
        const idx = focusable.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        const nextIdx =
          e.shiftKey
            ? (idx <= 0 ? focusable.length - 1 : idx - 1)
            : (idx === focusable.length - 1 ? 0 : idx + 1)
        focusable[nextIdx]?.focus()
      }
    },
    [complete]
  )

  const progress = tourProgress(view)

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onKeyDown={handleKeyDown}
      >
        {/* スキップ（全 view 共通・常時表示, Req 5.1） */}
        <button
          type="button"
          className={styles.skip}
          onClick={() => void complete(true)}
        >
          スキップ
        </button>

        {view.kind === 'welcome' && (
          <div className={styles.content}>
            <h2 id="onboarding-title" className={styles.title}>
              ようこそ、PART-PROMPTER へ 🎤
            </h2>
            <p className={styles.lead}>
              PART-PROMPTER は、歌詞をメンバーごとに色分けして管理し、プロンプター表示・セットリスト再生・出力ができる歌詞パート分けアプリです。
            </p>
            <p className={styles.body}>
              かんたんなツアーで主な使い方を紹介します。あとからアカウント設定画面でいつでも見直せます。
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => setView(nextView(view))}
              >
                ツアーを開始
              </button>
            </div>
          </div>
        )}

        {view.kind === 'tour' && progress && (
          <div className={styles.content}>
            <div className={styles.progress} aria-live="polite">
              {progress.current} / {progress.total}
            </div>
            <div className={styles.emoji} aria-hidden="true">
              {TOUR_STEPS[view.step - 1].emoji}
            </div>
            <h2 id="onboarding-title" className={styles.title}>
              {TOUR_STEPS[view.step - 1].title}
            </h2>
            <p className={styles.body}>{TOUR_STEPS[view.step - 1].body}</p>
            <Link
              href={TOUR_STEPS[view.step - 1].howToUseHref}
              className={styles.howto}
              target="_blank"
            >
              詳しい使い方を見る →
            </Link>
            <div className={styles.actions}>
              {canGoBack(view) && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setView(prevView(view))}
                >
                  戻る
                </button>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={() => setView(nextView(view))}
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {view.kind === 'finalAction' && (
          <div className={styles.content}>
            <div className={styles.emoji} aria-hidden="true">
              🎉
            </div>
            <h2 id="onboarding-title" className={styles.title}>
              準備完了です
            </h2>
            <p className={styles.body}>
              さっそく最初の楽曲を追加して、パート分けを始めましょう。
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void complete(true)}
              >
                あとで始める
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void complete(true)}
              >
                楽曲を追加する
              </button>
            </div>
          </div>
        )}
      </div>

      {saveFailed && (
        <SaveFailedBanner onDismiss={() => setSaveFailed(false)} />
      )}
    </div>
  )
}

/** 保存失敗バナー（非ブロッキング・最長 10 秒で自動消去, Req 8.2） */
function SaveFailedBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, BANNER_AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={styles.banner} role="status">
      <span>オンボーディングの保存に失敗しました。次回また案内が表示されます。</span>
      <button type="button" className={styles.bannerClose} onClick={onDismiss}>
        ✕
      </button>
    </div>
  )
}
