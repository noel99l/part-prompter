'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from '../page.module.css'

interface Playlist { id: number; name: string; created_at: string; created_by_name?: string }

export default function PlaylistsPage() {
  const router = useRouter()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/playlists')
    setPlaylists(await res.json())
    setLoading(false)
  }

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const playlist = await res.json()
    setCreating(false)
    setShowModal(false)
    setName('')
    router.push(`/admin/playlists/${playlist.id}`)
  }

  const closeModal = () => {
    setShowModal(false)
    setName('')
  }

  const remove = async (id: number) => {
    if (!confirm('このプレイリストを削除しますか？')) return
    setDeletingId(id)
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
    setPlaylists(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  if (loading) return <Loading label="プレイリスト一覧" />

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.backLink}>← 管理トップ</Link>
        <h1 className={styles.title}>📋 プレイリスト管理</h1>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>＋ プレイリストを追加</button>
      </div>

      {playlists.length === 0 ? (
        <p className={styles.empty}>プレイリストがありません。「プレイリストを追加」から作成してください。</p>
      ) : (
        <div className={styles.list}>
          {playlists.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <div className={styles.songTitle}>{p.name}</div>
                {p.created_by_name && <div className={styles.artist}>作成者: {p.created_by_name}</div>}
              </div>
              <div className={styles.cardActions}>
                <Link href={`/admin/playlists/${p.id}`} className={styles.editBtn}>✏️ 編集</Link>
                <Link href={`/prompter/playlist/${p.id}`} className={styles.viewBtn} target="_blank">▶ 表示</Link>
                <button className={styles.deleteBtn} onClick={() => remove(p.id)} disabled={deletingId === p.id}>
                  {deletingId === p.id ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>プレイリストを追加</h2>
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="プレイリスト名（必須）"
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={closeModal}>キャンセル</button>
              <button
                className={styles.submitBtn}
                onClick={create}
                disabled={!name.trim() || creating}
              >
                {creating ? '作成中...' : '作成して編集'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
