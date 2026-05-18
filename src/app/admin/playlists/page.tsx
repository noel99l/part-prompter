'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SongCard from '@/components/SongCard'
import ItemMenu from '@/components/ItemMenu'
import Pagination from '@/components/Pagination'
import skStyles from '@/components/skeleton.module.css'
import styles from '../page.module.css'

interface Playlist { id: number; name: string; created_at: string; created_by_name?: string; description?: string }

export default function PlaylistsPage() {
  const router = useRouter()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

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

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={skStyles.sk} style={{ width: 180, height: 28 }} />
        <div className={skStyles.sk} style={{ width: 140, height: 36, borderRadius: 8, marginLeft: 'auto' }} />
      </div>
      <div className={styles.list}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardInfo}>
              <div className={skStyles.sk} style={{ width: '50%', height: 18, marginBottom: 8 }} />
              <div className={skStyles.sk} style={{ width: '30%', height: 14 }} />
            </div>
            <div className={styles.cardActions}>
              <div className={skStyles.sk} style={{ width: 60, height: 32, borderRadius: 6 }} />
              <div className={skStyles.sk} style={{ width: 60, height: 32, borderRadius: 6 }} />
              <div className={skStyles.sk} style={{ width: 36, height: 32, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📋 プレイリスト管理</h1>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>＋追加</button>
      </div>

      {playlists.length === 0 ? (
        <p className={styles.empty}>プレイリストがありません。「プレイリストを追加」から作成してください。</p>
      ) : (
        <>
          <div className={styles.list}>
            {playlists.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(p => (
              <SongCard
                key={p.id}
                href={`/admin/playlists/${p.id}`}
                title={p.name}
                description={p.description}
                actions={<>
                  <Link href={`/admin/playlists/${p.id}`} className={styles.editBtn}><span className={styles.btnIcon}>✏️</span><span className={styles.btnLabel}> 編集</span></Link>
                  <Link href={`/prompter/playlist/${p.id}`} className={styles.viewBtn} target="_blank"><span className={styles.btnIcon}>▶</span><span className={styles.btnLabel}> 表示</span></Link>
                  <ItemMenu onDelete={() => remove(p.id)} />
                </>}
              />
            ))}
          </div>
          <Pagination page={page} total={playlists.length} perPage={PER_PAGE} onChange={setPage} />
        </>
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
