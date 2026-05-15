'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

export default function PrompterList() {
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/songs')
      .then(r => r.json())
      .then(data => { setSongs(data); setLoading(false) })
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎤 プロンプター</h1>
      {loading ? (
        <p className={styles.empty}>読み込み中...</p>
      ) : songs.length === 0 ? (
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
