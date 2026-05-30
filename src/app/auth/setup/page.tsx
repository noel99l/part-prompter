'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function SetupPage() {
  const { update } = useSession()
  const [accountName, setAccountName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = accountName.trim() && agreed && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    const res = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName }),
    })
    if (res.ok) {
      await fetch('/api/auth/session')
      await new Promise(r => setTimeout(r, 500))
      window.location.replace('/admin')
    } else {
      setError('保存に失敗しました')
      setSaving(false)
    }
  }

  const s = {
    wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', gap: '1.25rem', padding: '2rem', fontFamily: "'Hiragino Sans', sans-serif" } as React.CSSProperties,
    card: { background: '#111', border: '1px solid #222', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '1rem' } as React.CSSProperties,
    input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', padding: '0.75rem 1rem', fontSize: '1rem', width: '100%', boxSizing: 'border-box', outline: 'none' } as React.CSSProperties,
    btn: { background: '#FF69B4', border: 'none', color: '#fff', padding: '0.75rem', borderRadius: 8, fontSize: '1rem', cursor: 'pointer', opacity: canSubmit ? 1 : 0.4, width: '100%' } as React.CSSProperties,
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={{ color: '#fff', fontSize: '1.3rem', margin: 0 }}>🎤 アカウント設定</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>パート分けの作成者として表示される名前を設定してください。</p>

        <div>
          <label style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>アカウント名</label>
          <input
            style={s.input}
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="例：山田太郎"
            autoFocus
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: '0.15rem', accentColor: '#FF69B4', width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <Link href="/terms" target="_blank" style={{ color: '#FF69B4', textDecoration: 'none' }}>利用規約</Link>
            および
            <Link href="/privacy" target="_blank" style={{ color: '#FF69B4', textDecoration: 'none' }}>プライバシーポリシー</Link>
            に同意します
          </span>
        </label>

        {error && <p style={{ color: '#FF4444', margin: 0, fontSize: '0.85rem' }}>{error}</p>}

        <button style={s.btn} onClick={handleSubmit} disabled={!canSubmit}>
          {saving ? '保存中...' : '設定して始める'}
        </button>
      </div>
    </div>
  )
}
