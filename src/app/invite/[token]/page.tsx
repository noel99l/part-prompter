'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        setInvite(data)
        if (data.alreadyJoined) setError('すでにこの楽曲の共同編集者として登録済みです。')
        setLoading(false)
      })
      .catch(() => { setError('招待リンクが無効です'); setLoading(false) })
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      if (data.alreadyJoined) {
        setError('すでにこの楽曲の共同編集者として登録済みです。')
        setAccepting(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push(`/admin/${data.songId}`), 1500)
    } else {
      setError(data.error === 'Expired' ? '招待リンクの有効期限が切れています'
        : data.error === 'Already accepted' ? 'この招待はすでに承認済みです'
        : data.error === 'Owner cannot accept' ? '自分の楽曲には承認できません'
        : '承認に失敗しました')
      setAccepting(false)
    }
  }

  const s: React.CSSProperties = { background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: "'Hiragino Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }
  const card: React.CSSProperties = { background: '#111', border: '1px solid #222', borderRadius: 12, padding: '2rem', maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }

  if (loading) return <div style={s}><div style={card}>読み込み中...</div></div>

  if (error) return (
    <div style={s}>
      <div style={card}>
        <h1 style={{ fontSize: '1.2rem', margin: 0, color: error.includes('登録済み') ? '#FF69B4' : '#FF4444' }}>
          {error.includes('登録済み') ? 'ℹ️ すでに登録済み' : '⚠️ エラー'}
        </h1>
        <p style={{ color: '#aaa', margin: 0 }}>{error}</p>
        {error.includes('登録済み') && invite?.song_id && (
          <a href={`/admin/${invite.song_id}`} style={{ background: '#FF69B4', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontSize: '0.95rem' }}>
            → 編集ページへ
          </a>
        )}
        <Link href="/prompter" style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center' }}>← 一覧に戻る</Link>
      </div>
    </div>
  )

  if (invite?.error) return (
    <div style={s}>
      <div style={card}>
        <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#FF4444' }}>⚠️ 無効なリンク</h1>
        <p style={{ color: '#aaa', margin: 0 }}>この招待リンクは存在しないか、有効期限が切れています。</p>
        <Link href="/prompter" style={{ color: '#FF69B4', fontSize: '0.9rem' }}>← 一覧に戻る</Link>
      </div>
    </div>
  )

  if (done) return (
    <div style={s}>
      <div style={card}>
        <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#7CFC00' }}>✓ 承認しました</h1>
        <p style={{ color: '#aaa', margin: 0 }}>編集ページに移動します...</p>
      </div>
    </div>
  )

  return (
    <div style={s}>
      <div style={card}>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>🎨 共同編集への招待</h1>
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{invite.title}</div>
          {invite.artist && <div style={{ color: '#888', fontSize: '0.9rem' }}>{invite.artist}</div>}
          {invite.invited_by_name && <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.25rem' }}>招待者: {invite.invited_by_name}</div>}
        </div>
        <div style={{ color: '#666', fontSize: '0.8rem' }}>
          有効期限: {new Date(invite.expires_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </div>
        {status === 'unauthenticated' ? (
          <>
            <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>承認するにはログインが必要です。</p>
            <Link href={`/auth/signin?callbackUrl=/invite/${token}`} style={{ background: '#FF69B4', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontSize: '0.95rem' }}>
              Googleでログインして承認
            </Link>
          </>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{ background: '#FF69B4', border: 'none', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 8, cursor: accepting ? 'not-allowed' : 'pointer', fontSize: '0.95rem', opacity: accepting ? 0.6 : 1 }}
          >
            {accepting ? '承認中...' : '✓ 共同編集を承認する'}
          </button>
        )}
        <Link href="/prompter" style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center' }}>キャンセル</Link>
      </div>
    </div>
  )
}
