'use client'
import { useState } from 'react'
import Link from 'next/link'
import s from '@/app/common.module.css'
import styles from './page.module.css'

export default function SetupPage() {
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
      window.location.replace('/manage/songs')
    } else {
      setError('保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <div className={s.pageCenter}>
      <div className={`${s.card} ${s.cardSm}`}>
        <h1 className={s.cardTitle}>🎤 アカウント設定</h1>
        <p className={s.cardSub}>パート分けの作成者として表示される名前を設定してください。</p>

        <div>
          <label className={s.formLabel}>アカウント名</label>
          <input
            className={styles.input}
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="例：山田太郎"
            autoFocus
          />
        </div>

        <label className={s.checkLabel}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={s.checkText}>
            <Link href="/terms" target="_blank">利用規約</Link>
            および
            <Link href="/privacy" target="_blank">プライバシーポリシー</Link>
            に同意します
          </span>
        </label>

        {error && <p className={s.formError}>{error}</p>}

        <button className={`${s.btnPrimary} ${!canSubmit ? styles.btnDisabled : ''}`} onClick={handleSubmit} disabled={!canSubmit}>
          {saving ? '保存中...' : '設定して始める'}
        </button>
      </div>
    </div>
  )
}
