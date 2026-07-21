import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { initDb } from '@/lib/db'
import { getSongAccess } from '@/lib/songAccess'

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
  const access = await getSongAccess(songId, session.user.email)

  if (!access?.canEditContent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#fff', gap: '1rem', fontFamily: 'Hiragino Sans, sans-serif' }}>
        <p style={{ fontSize: '1.2rem', color: '#888' }}>この楽曲を編集する権限がありません</p>
        <Link href="/manage/playlists" style={{ color: '#FF69B4', textDecoration: 'none', fontSize: '0.95rem' }}>← セットリスト管理に戻る</Link>
      </div>
    )
  }

  return <>{children}</>
}
