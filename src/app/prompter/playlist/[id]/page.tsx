'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from '../../page.module.css'

interface PlaylistItem {
  item_id: number
  item_type: 'song' | 'mc'
  mc_title: string | null
  mc_body: string | null
  id: number | null; title: string | null; artist: string | null
}

export default function PlaylistPrompterPage() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [songTotal, setSongTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.json())
      .then(data => {
        setName(data.name)
        setItems(data.items || [])
        setSongTotal((data.songs || []).length)
        setLoading(false)
      })
  }, [id])

  if (loading) return <Loading label="セットリスト" />

  if (items.length === 0) return (
    <div className={styles.container}>
      <h1 className={styles.title}>{name}</h1>
      <p className={styles.empty}>曲が登録されていません</p>
    </div>
  )

  let songIndex = -1

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Link href="/prompter" className={styles.backLink}>← 一覧</Link>
        <h1 className={styles.title} style={{ margin: 0 }}>📋 {name}</h1>
      </div>
      <div className={styles.list}>
        {items.map(it => {
          if (it.item_type === 'mc') {
            return (
              <Link key={`mc-${it.item_id}`} href={`/playlists/${id}/mc/${it.item_id}?from=prompter`} className={styles.card} style={{ borderStyle: 'dashed' }}>
                <span style={{ color: '#666', flexShrink: 0, minWidth: '1.5rem', textAlign: 'right' }}>🎤</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.songTitle}>{it.mc_title || 'MC'}</div>
                  {it.mc_body && <div className={styles.artist}>{it.mc_body.split('\n')[0]}</div>}
                </div>
              </Link>
            )
          }
          songIndex++
          return (
            <Link key={`song-${it.item_id}`} href={`/prompter/${it.id}?playlist=${id}&index=${songIndex}&total=${songTotal}`} className={styles.card}>
              <span style={{ color: '#666', flexShrink: 0, minWidth: '1.5rem', textAlign: 'right' }}>{songIndex + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.songTitle}>{it.title}</div>
                {it.artist && <div className={styles.artist}>{it.artist}</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
