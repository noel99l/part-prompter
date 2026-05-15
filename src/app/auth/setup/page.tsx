'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SetupPage() {
  const { update } = useSession()
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!accountName.trim()) return
    setSaving(true)
    const res = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName }),
    })
    if (res.ok) {
      // セッションを強制更新してからリダイレクト
      await fetch('/api/auth/session', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      // JWTのCookieが更新されるまで少し待つ
      await new Promise(r => setTimeout(r, 500))
      window.location.replace('/admin')
    } else {
      setError('保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#111', gap: '24px', padding: '2rem' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', margin: 0 }}>🎤 アカウント名を設定</h1>
      <p style={{ color: '#aaa', margin: 0, textAlign: 'center' }}>
        パート分けの作成者として表示される名前を設定してください
      </p>
      <input
        style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', padding: '0.8rem 1.2rem', fontSize: '1rem', width: '100%', maxWidth: '320px', boxSizing: 'border-box' }}
        value={accountName}
        onChange={e => setAccountName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="例：山田太郎"
        autoFocus
      />
      {error && <p style={{ color: '#FF4444', margin: 0 }}>{error}</p>}
      <button
        style={{ background: '#FF69B4', border: 'none', color: '#fff', padding: '0.8rem 2rem', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', opacity: !accountName.trim() || saving ? 0.5 : 1 }}
        onClick={handleSubmit}
        disabled={!accountName.trim() || saving}
      >
        {saving ? '保存中...' : '設定して始める'}
      </button>
    </div>
  )
}
