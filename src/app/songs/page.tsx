'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SongCard from '@/components/SongCard'
import SongCardSkeleton from '@/components/SongCardSkeleton'
import AddToPlaylistMenu from '@/components/AddToPlaylistMenu'
import Pagination from '@/components/Pagination'
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
      <div className={styles.header}>
        <h1 className={styles.title}>🎵 パート分け一覧</h1>
      </div>
      <input
        className={styles.searchInput}
        value={query}
        onChange={e => { setQuery(e.target.value); setPage(1) }}
        placeholder="曲名・アーティスト・作者で検索..."
      />

      {loading ? (
        <div className={styles.list}>
          <SongCardSkeleton count={5} showActions />
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>{query ? '該当する曲が見つかりません' : '曲が登録されていません'}</p>
      ) : (
        <>
          <div className={styles.list}>
            {paged.map(s => (
              <SongCard
                key={s.id}
                href={`/songs/${s.id}`}
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
                  ...(s.updated_at ? [`🕒 ${new Date(s.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`] : []),
                ]}
                actions={<AddToPlaylistMenu songId={s.id} songTitle={s.title} menuItems={[
                  { label: '▶ プロンプター', href: `/songs/${s.id}/prompter`, target: '_blank' },
                ]} />}
              />
            ))}
          </div>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}

      <footer className={styles.footer}>
        <Link href="/privacy" className={styles.footerLink}>プライバシーポリシー</Link>
        <span className={styles.footerSep}>|</span>
        <Link href="/terms" className={styles.footerLink}>利用規約</Link>
        <span className={styles.footerSep}>|</span>
        <Link href="/how-to-use" className={styles.footerLink}>HOW TO USE</Link>
        <span className={styles.footerSep}>|</span>
        <a href="https://x.com/noel99l" target="_blank" rel="noreferrer" className={styles.footerLink}>お問い合わせ: X @noel99l</a>
      </footer>
    </div>
  )
}
