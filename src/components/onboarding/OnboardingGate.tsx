'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import OnboardingOverlay from './OnboardingOverlay'

/** 設定画面からの再表示に使うイベント名 */
export const ONBOARDING_REPLAY_EVENT = 'onboarding:replay'

/**
 * オンボーディング表示制御。
 * - initialShouldShow=true で初期表示（新規ユーザー）
 * - CustomEvent('onboarding:replay') を購読して再表示（設定画面から）
 * - 開く直前のフォーカス要素を保存し、閉じる際に復元する
 */
export default function OnboardingGate({
  initialShouldShow,
}: {
  initialShouldShow: boolean
}) {
  const [open, setOpen] = useState(initialShouldShow)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const openOverlay = useCallback(() => {
    if (typeof document !== 'undefined') {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
    }
    setOpen(true)
  }, [])

  // 初期表示時もフォーカス復帰元を保存しておく
  useEffect(() => {
    if (initialShouldShow && typeof document !== 'undefined') {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
    }
  }, [initialShouldShow])

  useEffect(() => {
    const handler = () => openOverlay()
    window.addEventListener(ONBOARDING_REPLAY_EVENT, handler)
    return () => window.removeEventListener(ONBOARDING_REPLAY_EVENT, handler)
  }, [openOverlay])

  const handleClose = useCallback(() => {
    setOpen(false)
    const el = restoreFocusRef.current
    restoreFocusRef.current = null
    // 直前にフォーカスがあった要素へ復帰する
    if (el && typeof el.focus === 'function') {
      el.focus()
    }
  }, [])

  if (!open) return null

  return <OnboardingOverlay onClose={handleClose} />
}
