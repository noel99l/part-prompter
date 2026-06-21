'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import s from '@/app/common.module.css'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { status } = useSession()
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
      setTimeout(() => router.push(`/manage/songs/${data.songId}`), 1500)
    } else {
      setError(data.error === 'Expired' ? '招待リンクの有効期限が切れています'
        : data.error === 'Already accepted' ? 'この招待はすでに承認済みです'
        : data.error === 'Owner cannot accept' ? '自分の楽曲には承認できません'
        : '承認に失敗しました')
      setAccepting(false)
    }
  }

  if (loading) return <div className={s.pageCenter}><div className={`${s.card} ${s.cardSm}`}>読み込み中...</div></div>

  if (error) return (
    <div className={s.pageCenter}>
      <div className={`${s.card} ${s.cardSm}`}>
        <h1 className={s.cardTitle} style={{ color: error.includes('登録済み') ? '#FF69B4' : '#FF4444' }}>
          {error.includes('登録済み') ? 'ℹ️ すでに登録済み' : '⚠️ エラー'}
        </h1>
        <p className={s.cardSub}>{error}</p>
        {error.includes('登録済み') && invite?.song_id && (
          <a href={`/manage/songs/${invite.song_id}`} className={s.btnPrimary}>→ 編集ページへ</a>
        )}
        <Link href="/songs" className={s.linkSub}>← 一覧に戻る</Link>
      </div>
    </div>
  )

  if (invite?.error) return (
    <div className={s.pageCenter}>
      <div className={`${s.card} ${s.cardSm}`}>
        <h1 className={`${s.cardTitle} ${s.textDanger}`}>⚠️ 無効なリンク</h1>
        <p className={s.cardSub}>この招待リンクは存在しないか、有効期限が切れています。</p>
        <Link href="/songs" className={s.linkSub}>← 一覧に戻る</Link>
      </div>
    </div>
  )

  if (done) return (
    <div className={s.pageCenter}>
      <div className={`${s.card} ${s.cardSm}`}>
        <h1 className={`${s.cardTitle} ${s.textSuccess}`}>✓ 承認しました</h1>
        <p className={s.cardSub}>編集ページに移動します...</p>
      </div>
    </div>
  )

  return (
    <div className={s.pageCenter}>
      <div className={`${s.card} ${s.cardSm}`}>
        <h1 className={s.cardTitle}>🎨 共同編集への招待</h1>
        <div className={s.infoBox}>
          <div className={s.infoBoxTitle}>{invite.title}</div>
          {invite.artist && <div className={s.infoBoxSub}>{invite.artist}</div>}
          {invite.invited_by_name && <div className={s.infoBoxMeta}>招待者: {invite.invited_by_name}</div>}
        </div>
        <p className={s.metaText}>
          有効期限: {new Date(invite.expires_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </p>
        {status === 'unauthenticated' ? (
          <>
            <p className={s.cardSub}>承認するにはログインが必要です。</p>
            <Link href={`/auth/signin?callbackUrl=/invite/${token}`} className={s.btnPrimary}>
              Googleでログインして承認
            </Link>
          </>
        ) : (
          <button className={s.btnPrimary} onClick={handleAccept} disabled={accepting}>
            {accepting ? '承認中...' : '✓ 共同編集を承認する'}
          </button>
        )}
        <Link href="/songs" className={s.linkSub}>キャンセル</Link>
      </div>
    </div>
  )
}
