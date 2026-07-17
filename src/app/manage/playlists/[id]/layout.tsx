import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { initDb } from '@/lib/db'
import { getPlaylistAccess } from '@/lib/playlistAccess'

export default async function PlaylistEditLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  await initDb()
  const access = await getPlaylistAccess(id, session.user.email)
  if (!access?.canEdit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#fff', gap: '1rem', fontFamily: 'Hiragino Sans, sans-serif' }}>
        <p style={{ fontSize: '1.2rem', color: '#888' }}>このセットリストを編集する権限がありません</p>
        <Link href="/manage/playlists" style={{ color: '#FF69B4', textDecoration: 'none', fontSize: '0.95rem' }}>← セットリスト管理に戻る</Link>
      </div>
    )
  }

  return <>{children}</>
}
