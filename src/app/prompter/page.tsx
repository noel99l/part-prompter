'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SongCard from '@/components/SongCard'
import AddToPlaylistMenu from '@/components/AddToPlaylistMenu'
import Pagination from '@/components/Pagination'
import skStyles from '@/components/skeleton.module.css'
import styles from './page.module.css'

const PER_PAGE = 20

export default function PrompterList() {
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

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

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎵 パート分け一覧</h1>
      <input
        className={styles.searchInput}
        value={query}
        onChange={e => { setQuery(e.target.value); setPage(1) }}
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
        <>
          <div className={styles.list}>
            {paged.map(s => (
              <SongCard
                key={s.id}
                href={`/prompter/${s.id}/detail`}
                title={s.title}
                artist={s.artist}
                tags={[
                  ...(parseInt(s.member_count) > 0 ? [{ label: `👥 ${s.member_count}`, type: 'pink' as const }] : []),
                  ...(parseInt(s.lyric_count) > 0 && parseInt(s.timestamp_count) === 0 ? [{ label: 'テキスト', type: 'blue' as const }] : []),
                  ...(parseInt(s.timestamp_count) > 0 ? [{ label: 'タイムスタンプ', type: 'green' as const }] : []),
                  ...(parseInt(s.lyric_count) === 0 ? [{ label: '歌詞なし', type: 'gray' as const }] : []),
                ]}
                meta={[
                  ...(s.created_by_name ? [`✍️ ${s.created_by_name}`] : []),
                  ...(s.updated_at ? [`🕒 ${new Date(s.updated_at).toLocaleString('ja-JP')}`] : []),
                ]}
                actions={<AddToPlaylistMenu songId={s.id} menuItems={[
                  { label: '▶ プロンプター', href: `/prompter/${s.id}`, target: '_blank' },
                ]} />}
              />
            ))}
          </div>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}

      <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #111', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/privacy" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>プライバシーポリシー</Link>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>|</span>
        <Link href="/terms" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>利用規約</Link>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>|</span>
        <Link href="/how-to-use" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>HOW TO USE</Link>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>|</span>
        <a href="https://x.com/noel99l" target="_blank" rel="noreferrer" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none' }}>お問い合わせ: X @noel99l</a>
      </footer>
    </div>
  )
}
