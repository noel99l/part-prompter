'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import skStyles from '@/components/skeleton.module.css'
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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎵 パート分け一覧</h1>
      <input
        className={styles.searchInput}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="曲名・アーティスト・作者で検索..."
      />

      {loading ? (
        <div className={styles.list}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.card} style={{ pointerEvents: 'none' }}>
              <div className={styles.cardMain}>
                <div className={skStyles.sk} style={{ width: '55%', height: 16, marginBottom: 6 }} />
                <div className={skStyles.sk} style={{ width: '35%', height: 13, marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className={skStyles.sk} style={{ width: 52, height: 18, borderRadius: 99 }} />
                  <div className={skStyles.sk} style={{ width: 36, height: 18, borderRadius: 99 }} />
                </div>
              </div>
              <div className={skStyles.sk} style={{ width: 48, height: 13, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>{query ? '該当する曲が見つかりません' : '曲が登録されていません'}</p>
      ) : (
        <div className={styles.list}>
          {filtered.map(s => (
            <Link key={s.id} href={`/prompter/${s.id}/detail`} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.titleRow}>
                  <span className={styles.songTitle}>{s.title}</span>
                  {parseInt(s.lyric_count) > 0 && parseInt(s.timestamp_count) === 0 && <span className={styles.tagBlue}>テキスト</span>}
                  {parseInt(s.timestamp_count) > 0 && <span className={styles.tagGreen}>タイムスタンプ付き</span>}
                  {parseInt(s.member_count) > 0 && <span className={styles.tagPink}>👥 {s.member_count}</span>}
                </div>
                {s.artist && <div className={styles.artist}>{s.artist}</div>}
                {s.created_by_name && <div className={styles.createdBy}>✍️ {s.created_by_name}</div>}
                <div className={styles.tagRow}>
                  {parseInt(s.lyric_count) === 0 && <span className={styles.tagGray}>歌詞なし</span>}
                  {s.updated_at && <span className={styles.updatedAt}>🕒 {new Date(s.updated_at).toLocaleString('ja-JP')}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #111', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/privacy" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>プライバシーポリシー</Link>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>|</span>
        <Link href="/how-to-use" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>HOW TO USE</Link>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>|</span>
        <a href="https://x.com/noel99l" target="_blank" rel="noreferrer" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>お問い合わせ: X @noel99l</a>
      </footer>
    </div>
  )
}
