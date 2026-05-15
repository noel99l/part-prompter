'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from './page.module.css'

export default function PrompterList() {
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/songs')
      .then(r => r.json())
      .then(data => { setSongs(data); setLoading(false) })
  }, [])

  if (loading) return <Loading label="曲一覧" />

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎤 プロンプター</h1>
      {songs.length === 0 ? (
        <p className={styles.empty}>曲が登録されていません</p>
      ) : (
        <div className={styles.list}>
          {songs.map(s => (
            <Link key={s.id} href={`/prompter/${s.id}`} className={styles.card}>
              <div className={styles.songTitle}>{s.title}</div>
              {s.artist && <div className={styles.artist}>{s.artist}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
