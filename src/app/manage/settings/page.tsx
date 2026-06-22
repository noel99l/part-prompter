'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { ONBOARDING_REPLAY_EVENT } from '@/components/onboarding/OnboardingGate'
import styles from '@/app/manage/page.module.css'
import s from '@/app/common.module.css'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [accountName, setAccountName] = useState('')
  const [email, setEmail] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(data => {
      setAccountName(data.account_name ?? '')
      setEmail(data.email ?? '')
      setLoaded(true)
    })
  }, [])

  const handleSave = async () => {
    if (!accountName.trim()) return
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName }),
    })
    setSaving(false)
    setMessage(res.ok ? { text: '保存しました', ok: true } : { text: '保存に失敗しました', ok: false })
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    await fetch('/api/user', { method: 'DELETE' })
    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>⚙️ アカウント設定</h1>
      </div>

      <div className={styles.settingsWrap}>
        <p className={styles.artist}>メールアドレス</p>
        <p className={styles.emailDisplay}>
          {email || session?.user?.email || '—'}
        </p>

        <p className={styles.artist}>アカウント名</p>
        <div className={s.row}>
          <input
            className={styles.metaInput}
            value={loaded ? accountName : ''}
            onChange={e => setAccountName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="アカウント名"
            style={{ flex: 1 }}
          />
          <button className={styles.saveBtn} onClick={handleSave} disabled={!accountName.trim() || saving}>
            {saving ? '保存中...' : '💾 保存'}
          </button>
        </div>
        {message && (
          <p className={message.ok ? s.statusOk : s.statusError}>{message.text}</p>
        )}

        <hr className={s.divider} />

        <p className={styles.artist}>オンボーディング</p>
        <p className={s.dangerMuted}>
          アプリの使い方ガイドをもう一度確認できます。
        </p>
        <button
          className={s.btnOutline}
          onClick={() => window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT))}
        >
          🎤 オンボーディングをもう一度見る
        </button>

        <hr className={s.divider} />

        <p className={styles.withdrawLabel}>退会</p>
        <p className={s.dangerMuted}>
          退会するとアカウント情報および作成した楽曲・歌詞データが全て削除されます。
        </p>
        {!showConfirm ? (
          <button className={s.btnOutlineDanger} onClick={() => setShowConfirm(true)}>
            退会する
          </button>
        ) : (
          <div className={s.dangerBox}>
            <p className={s.dangerText}>本当に退会しますか？この操作は取り消せません。</p>
            <div className={s.row}>
              <button className={s.btnDanger} onClick={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? '処理中...' : '退会する'}
              </button>
              <button className={s.btnOutline} onClick={() => setShowConfirm(false)}>
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
