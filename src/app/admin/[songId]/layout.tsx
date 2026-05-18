import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export default async function SongEditLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ songId: string }>
}) {
  const { songId } = await params
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  const result = await query(`
    SELECT s.id FROM prompter_songs s
    JOIN users u ON u.id = s.created_by
    WHERE s.id = $1 AND u.email = $2
  `, [songId, session.user.email])

  if (!result.rows[0]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#fff', gap: '1rem', fontFamily: 'Hiragino Sans, sans-serif' }}>
        <p style={{ fontSize: '1.2rem', color: '#888' }}>この楽曲を編集する権限がありません</p>
        <a href="/admin/songs" style={{ color: '#FF69B4', textDecoration: 'none', fontSize: '0.95rem' }}>← 楽曲管理に戻る</a>
      </div>
    )
  }

  return <>{children}</>
}
