'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import styles from '../page.module.css'

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

      <div style={{ maxWidth: '400px' }}>
        <p className={styles.artist} style={{ marginBottom: '4px' }}>メールアドレス</p>
        <p style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '1.5rem', padding: '0.5rem 0.75rem', background: '#111', border: '1px solid #222', borderRadius: '6px' }}>
          {email || session?.user?.email || '—'}
        </p>

        <p className={styles.artist} style={{ marginBottom: '12px' }}>アカウント名</p>
        <div style={{ display: 'flex', gap: '8px' }}>
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
          <p style={{ marginTop: '8px', color: message.ok ? '#7CFC00' : '#FF4444', fontSize: '0.9rem' }}>
            {message.text}
          </p>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #222', margin: '2rem 0' }} />

        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '8px' }}>退会</p>
        <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.6 }}>
          退会するとアカウント情報および作成した楽曲・歌詞データが全て削除されます。
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', transition: 'color 0.2s, border-color 0.2s' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#FF4444' }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#444' }}
          >
            退会する
          </button>
        ) : (
          <div style={{ background: '#1a0a0a', border: '1px solid #FF4444', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ color: '#FF4444', fontSize: '0.9rem', margin: 0 }}>本当に退会しますか？この操作は取り消せません。</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                style={{ background: '#FF4444', border: 'none', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', opacity: withdrawing ? 0.6 : 1 }}
              >
                {withdrawing ? '処理中...' : '退会する'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
