import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { query, initDb } from '@/lib/db'

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

  await initDb()

  const result = await query(`
    SELECT s.id FROM prompter_songs s
    LEFT JOIN users u ON u.id = s.created_by
    LEFT JOIN song_collaborators sc ON sc.song_id = s.id
    LEFT JOIN song_collaborator_members scm ON scm.collaborator_id = sc.id
    LEFT JOIN users cu ON cu.id = scm.user_id
    WHERE s.id = $1 AND (u.email = $2 OR cu.email = $2)
    LIMIT 1
  `, [songId, session.user.email])

  if (!result.rows[0]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#fff', gap: '1rem', fontFamily: 'Hiragino Sans, sans-serif' }}>
        <p style={{ fontSize: '1.2rem', color: '#888' }}>この楽曲を編集する権限がありません</p>
        <Link href="/manage/songs" style={{ color: '#FF69B4', textDecoration: 'none', fontSize: '0.95rem' }}>← パート分け管理に戻る</Link>
      </div>
    )
  }

  return <>{children}</>
}
