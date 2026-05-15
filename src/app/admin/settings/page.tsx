'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import styles from '../page.module.css'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (session?.user?.accountName) setAccountName(session.user.accountName)
  }, [session])

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.backLink}>← 管理トップ</Link>
        <h1 className={styles.title}>⚙️ アカウント設定</h1>
      </div>

      <div style={{ maxWidth: '400px' }}>
        <p className={styles.artist} style={{ marginBottom: '12px' }}>アカウント名</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className={styles.metaInput}
            value={accountName}
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
      </div>
    </div>
  )
}
