'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './AddToPlaylistMenu.module.css'
import modalStyles from './AddToPlaylistMenu.modal.module.css'

interface Playlist { id: number; name: string }
interface MenuItem { label: string; href: string; target?: string; download?: boolean }
interface MenuAction { label: string; action: () => void; danger?: boolean }
interface MenuDivider { divider: true; label?: string }
type MenuEntry = MenuItem | MenuAction | MenuDivider

export default function AddToPlaylistMenu({
  songId,
  songTitle,
  onDelete,
  menuItems,
}: {
  songId: number
  songTitle?: string
  onDelete?: () => void
  menuItems?: MenuEntry[]
}) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpenModal = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    setAdded(new Set())
    setLoading(true)
    setShowModal(true)
    const res = await fetch('/api/playlists')
    setPlaylists(await res.json())
    setLoading(false)
  }

  const handleAdd = async (playlistId: number) => {
    await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    setAdded(prev => new Set(prev).add(playlistId))
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    onDelete?.()
  }

  return (
    <>
      <div className={styles.wrapper} ref={ref}>
        <button className={styles.menuBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }} title="メニュー">⋯</button>
        {open && (
          <div className={styles.dropdown}>
            {menuItems && menuItems.length > 0 && (
              <>
                {menuItems.map((entry, i) => (
                  'divider' in entry
                    ? <div key={i}><div className={styles.divider} />{entry.label && <div className={styles.label}>{entry.label}</div>}</div>
                    : 'action' in entry
                      ? <button key={i} className={styles.item + (entry.danger ? ' ' + styles.itemDanger : '')} onClick={() => { setOpen(false); entry.action() }}>{entry.label}</button>
                      : entry.download
                        ? <a key={i} href={entry.href} download className={styles.item} onClick={() => setOpen(false)}>{entry.label}</a>
                        : <Link key={i} href={entry.href} target={entry.target} className={styles.item} onClick={() => setOpen(false)}>{entry.label}</Link>
                ))}
                <div className={styles.divider} />
              </>
            )}
            <button className={styles.item} onClick={handleOpenModal}>📋 セットリストに追加</button>
            {onDelete && (
              <>
                <div className={styles.divider} />
                <button className={`${styles.item} ${styles.itemDanger}`} onClick={handleDelete}>
                  🗑️ 削除
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h2 className={modalStyles.title}>📋 セットリストに追加</h2>
              <button onClick={() => setShowModal(false)} className={modalStyles.close}>✕</button>
            </div>
            {songTitle && <p className={modalStyles.songName}>{songTitle}</p>}
            {loading ? (
              <p className={modalStyles.muted}>読み込み中...</p>
            ) : playlists.length === 0 ? (
              <p className={modalStyles.muted}>セットリストがありません</p>
            ) : (
              <div className={modalStyles.list}>
                {playlists.map(p => (
                  <div key={p.id} className={modalStyles.row}>
                    <span className={modalStyles.name}>{p.name}</span>
                    <button
                      className={modalStyles.addBtn}
                      onClick={() => handleAdd(p.id)}
                      style={{ color: added.has(p.id) ? '#7CFC00' : undefined }}
                    >
                      {added.has(p.id) ? '✓ 追加済み' : '追加'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
