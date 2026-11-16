'use client'
import { useContactEmail } from '@/lib/contactClient'
import { buildContactMailto } from '@/lib/contact'

/**
 * 運営へのご意見・不具合報告リンク。押すとメールアプリが開く。
 * マスタ設定で連絡用メールアドレスが指定されているときだけ表示する。
 */
export default function ContactLink({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const email = useContactEmail()
  if (!email) return null

  return (
    <a
      className={className}
      // JavaScriptが動く前でも宛先だけは入った状態で開けるようにしておく
      href={`mailto:${email}`}
      onClick={event => {
        // 押した時点で開いているページとブラウザの情報を、下書きの本文に添える
        event.currentTarget.href = buildContactMailto(email, {
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        })
        onNavigate?.()
      }}
    >
      ✉️ ご意見・不具合報告
    </a>
  )
}
