'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './AddToPlaylistMenu.module.css'

interface Playlist { id: number; name: string }
interface MenuItem { label: string; href: string; target?: string }

export default function AddToPlaylistMenu({
  songId,
  onDelete,
  menuItems,
}: {
  songId: number
  onDelete?: () => void
  menuItems?: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (open) { setOpen(false); return }
    setLoading(true)
    setOpen(true)
    const res = await fetch('/api/playlists')
    setPlaylists(await res.json())
    setLoading(false)
  }

  const handleAdd = async (e: React.MouseEvent, playlistId: number) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    setAdded(playlistId)
    setTimeout(() => { setAdded(null); setOpen(false) }, 1200)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    onDelete?.()
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.menuBtn} onClick={handleOpen} title="メニュー">⋯</button>
      {open && (
        <div className={styles.dropdown}>
          {menuItems && menuItems.length > 0 && (
            <>
              {menuItems.map((item, i) => (
                <Link key={i} href={item.href} target={item.target} className={styles.item} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <div className={styles.divider} />
            </>
          )}
          <div className={styles.label}>セットリストに追加</div>
          {loading ? (
            <div className={`${styles.item} ${styles.itemMuted}`}>読み込み中...</div>
          ) : playlists.length === 0 ? (
            <div className={`${styles.item} ${styles.itemMuted}`}>セットリストがありません</div>
          ) : (
            playlists.map(p => (
              <button key={p.id} className={styles.item} onClick={e => handleAdd(e, p.id)}>
                {added === p.id ? '✓ 追加しました' : `📋 ${p.name}`}
              </button>
            ))
          )}
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
  )
}
