'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from '@/app/manage/page.module.css'

export default function MasterSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isMaster, setIsMaster] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 設定値
  const [showDownload, setShowDownload] = useState(true)
  const [showPartsCopy, setShowPartsCopy] = useState(true)
  const [downloadWhitelist, setDownloadWhitelist] = useState('')
  const [newEmail, setNewEmail] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.email) { router.push('/auth/signin'); return }
    if (session.user.email !== 'noelkaikei@gmail.com') { router.push('/manage/songs'); return }
    setIsMaster(true)

    fetch('/api/master-settings')
      .then(r => r.json())
      .then(data => {
        setShowDownload(data.show_download === '1')
        setShowPartsCopy(data.show_parts_copy === '1')
        setDownloadWhitelist(data.download_whitelist || '')
        setLoading(false)
      })
  }, [session, status, router])

  const whitelistEmails = downloadWhitelist
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (whitelistEmails.includes(email)) { setNewEmail(''); return }
    const updated = [...whitelistEmails, email].join(',')
    setDownloadWhitelist(updated)
    setNewEmail('')
  }

  const removeEmail = (email: string) => {
    const updated = whitelistEmails.filter(e => e !== email).join(',')
    setDownloadWhitelist(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/master-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        show_download: showDownload ? '1' : '0',
        show_parts_copy: showPartsCopy ? '1' : '0',
        download_whitelist: downloadWhitelist,
      }),
    })
    setSaving(false)
    setToast('保存しました')
    setTimeout(() => setToast(null), 2000)
  }

  if (!isMaster || loading) return (
    <div className={styles.container}>
      <p style={{ color: '#888' }}>読み込み中...</p>
    </div>
  )

  return (
    <div className={styles.container}>
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#222', color: '#7CFC00', padding: '0.5rem 1.5rem',
          borderRadius: 8, zIndex: 1000, fontSize: '0.9rem',
        }}>✓ {toast}</div>
      )}
      <div className={styles.header}>
        <h1 className={styles.title}>⚙️ マスタ設定</h1>
      </div>

      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '1.2rem 1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 1rem' }}>表示設定</h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '0.95rem' }}>ダウンロード項目（全体）</div>
              <div style={{ color: '#666', fontSize: '0.8rem' }}>OFFの場合、ホワイトリストのユーザーのみ表示</div>
            </div>
            <button
              type="button"
              onClick={() => setShowDownload(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: showDownload ? '#7CFC00' : '#444',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: showDownload ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', display: 'block',
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '0.95rem' }}>パート分けコピー</div>
              <div style={{ color: '#666', fontSize: '0.8rem' }}>公開ページの「パート分けをコピー」ボタン</div>
            </div>
            <button
              type="button"
              onClick={() => setShowPartsCopy(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: showPartsCopy ? '#7CFC00' : '#444',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: showPartsCopy ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', display: 'block',
              }} />
            </button>
          </div>
        </div>

        {/* ダウンロードホワイトリスト */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '1.2rem 1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 0.5rem' }}>ダウンロード ホワイトリスト</h2>
          <p style={{ color: '#666', fontSize: '0.8rem', margin: '0 0 1rem' }}>
            全体OFFでも、ここに登録されたメールアドレスのユーザーにはダウンロード項目が表示されます
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
              placeholder="メールアドレスを入力"
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6,
                color: '#fff', padding: '0.5rem 0.75rem', fontSize: '0.9rem',
              }}
            />
            <button
              onClick={addEmail}
              style={{
                background: '#333', border: '1px solid #555', color: '#fff',
                padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.9rem', whiteSpace: 'nowrap',
              }}
            >追加</button>
          </div>

          {whitelistEmails.length === 0 ? (
            <p style={{ color: '#555', fontSize: '0.85rem' }}>登録なし</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {whitelistEmails.map(email => (
                <div key={email} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#1a1a1a', borderRadius: 6, padding: '0.4rem 0.75rem',
                }}>
                  <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    style={{
                      background: 'none', border: 'none', color: '#888',
                      cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#FF69B4', border: 'none', color: '#fff',
            padding: '0.7rem 2rem', borderRadius: 8, fontSize: '1rem',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            alignSelf: 'flex-start', transition: 'opacity 0.2s',
          }}
        >
          {saving ? '保存中...' : '💾 保存'}
        </button>
      </div>
    </div>
  )
}
