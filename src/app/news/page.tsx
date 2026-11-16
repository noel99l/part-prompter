import Link from 'next/link'
import NewsList from '@/components/announcements/NewsList'

export const metadata = { title: 'お知らせ | PART-PROMPTER' }

export default function NewsPage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#ccc', fontFamily: "'Hiragino Sans', sans-serif", padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/songs" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>← 一覧に戻る</Link>
        <h1 style={{ color: '#fff', fontSize: '1.6rem', margin: '1.5rem 0 1.5rem' }}>お知らせ</h1>
        <NewsList />
      </div>
    </div>
  )
}
