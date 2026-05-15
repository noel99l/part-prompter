'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from './page.module.css'

export default function PrompterList() {
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/songs')
      .then(r => r.json())
      .then(data => { setSongs(data); setLoading(false) })
  }, [])

  const filtered = songs.filter(s =>
    !query.trim() ||
    s.title?.toLowerCase().includes(query.toLowerCase()) ||
    s.artist?.toLowerCase().includes(query.toLowerCase()) ||
    s.created_by_name?.toLowerCase().includes(query.toLowerCase())
  )

  if (loading) return <Loading label="曲一覧" />

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🎵 歌詞分け一覧</h1>
        <Link href="/admin" className={styles.adminLink}>⚙️ 管理画面</Link>
      </div>
      <input
        className={styles.searchInput}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="曲名・アーティスト・作者で検索..."
      />
      {filtered.length === 0 ? (
        <p className={styles.empty}>{query ? '該当する曲が見つかりません' : '曲が登録されていません'}</p>
      ) : (
        <div className={styles.list}>
          {filtered.map(s => (
            <Link key={s.id} href={`/prompter/${s.id}/detail`} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.songTitle}>{s.title}</div>
                {s.artist && <div className={styles.artist}>{s.artist}</div>}
              </div>
              <div className={styles.cardMeta}>
                {s.created_by_name && <span className={styles.metaItem}>✍️ {s.created_by_name}</span>}
                {s.member_count > 0 && <span className={styles.metaItem}>👥 {s.member_count}人</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
