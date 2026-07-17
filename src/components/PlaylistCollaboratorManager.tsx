'use client'
import { useState } from 'react'
import styles from './PlaylistCollaboratorManager.module.css'

interface Member { id: number; user_name?: string | null }

export default function PlaylistCollaboratorManager({ playlistId }: { playlistId: string }) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [expireMinutes, setExpireMinutes] = useState(10080)
  const [generating, setGenerating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')

  const loadMembers = async () => {
    const response = await fetch(`/api/playlists/${playlistId}/collaborators`)
    const data = await response.json()
    if (response.ok) setMembers(data.members ?? [])
    else setMessage('共同編集者を取得できませんでした')
  }

  const openModal = () => {
    setOpen(true)
    setInviteUrl('')
    setMessage('')
    void loadMembers()
  }

  const generate = async () => {
    setGenerating(true)
    setMessage('')
    const response = await fetch(`/api/playlists/${playlistId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expireMinutes }),
    })
    const data = await response.json()
    if (response.ok && data.token) {
      const url = `${window.location.origin}/invite/${data.token}`
      setInviteUrl(url)
      try { await navigator.clipboard.writeText(url); setMessage('✓ リンクをコピーしました') }
      catch { setMessage('リンクをコピーして共有してください') }
    } else setMessage('招待リンクを発行できませんでした')
    setGenerating(false)
  }

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setMessage('✓ リンクをコピーしました') }
    catch { setMessage('コピーできませんでした') }
  }

  const removeMember = async (memberId: number) => {
    if (!confirm('この共同編集者を削除しますか？')) return
    const response = await fetch(`/api/playlists/${playlistId}/collaborators`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    if (response.ok) setMembers(current => current.filter(member => member.id !== memberId))
    else setMessage('共同編集者を削除できませんでした')
  }

  return (
    <>
      <button className={styles.trigger} onClick={openModal}>👥 共同編集</button>
      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="playlist-collab-title" onClick={event => event.stopPropagation()}>
            <div className={styles.header}>
              <h2 id="playlist-collab-title" className={styles.title}>👥 共同編集管理</h2>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="閉じる">✕</button>
            </div>

            <div className={styles.label}>招待リンクを発行</div>
            <div className={styles.row}>
              <select className={styles.select} value={expireMinutes} onChange={event => setExpireMinutes(Number(event.target.value))}>
                <option value={30}>30分有効</option>
                <option value={60}>1時間有効</option>
                <option value={360}>6時間有効</option>
                <option value={720}>12時間有効</option>
                <option value={1440}>1日有効</option>
                <option value={4320}>3日有効</option>
                <option value={10080}>7日有効</option>
                <option value={20160}>14日有効</option>
                <option value={43200}>30日有効</option>
              </select>
              <button className={styles.primary} onClick={generate} disabled={generating}>
                {generating ? '生成中...' : '🔗 発行'}
              </button>
            </div>
            {inviteUrl && (
              <div className={styles.row}>
                <input className={styles.url} value={inviteUrl} readOnly aria-label="招待URL" />
                <button className={styles.secondary} onClick={copyInvite}>コピー</button>
              </div>
            )}
            {message && <p className={styles.message}>{message}</p>}

            <div className={styles.label}>共同編集者</div>
            {members.length === 0 ? <p className={styles.empty}>共同編集者はいません</p> : members.map(member => (
              <div className={styles.row} key={member.id}>
                <span className={styles.member}>✓ {member.user_name || '名前未設定'}</span>
                <button className={styles.secondary} onClick={() => removeMember(member.id)}>削除</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
