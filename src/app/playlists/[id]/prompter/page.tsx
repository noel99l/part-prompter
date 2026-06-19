'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from '@/app/songs/page.module.css'

interface Song { id: number; title: string; artist: string }

export default function PlaylistPrompterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [name, setName] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.json())
      .then(data => {
        setName(data.name)
        setSongs(data.songs || [])
        setLoading(false)
      })
  }, [id])

  if (loading) return <Loading label="セットリスト" />

  if (songs.length === 0) return (
    <div className={styles.container}>
      <h1 className={styles.title}>{name}</h1>
      <p className={styles.empty}>曲が登録されていません</p>
    </div>
  )

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h1 className={styles.title} style={{ margin: 0 }}>📋 {name}</h1>
      </div>
      <div className={styles.list}>
        {songs.map((s, i) => (
        <Link key={s.id} href={`/songs/${s.id}/prompter?playlist=${id}&index=${i}&total=${songs.length}`} className={styles.card}>
            <span style={{ color: '#666', flexShrink: 0, minWidth: '1.5rem', textAlign: 'right' }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.songTitle}>{s.title}</div>
              {s.artist && <div className={styles.artist}>{s.artist}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
