'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import s from '@/app/common.module.css'

interface InviteData {
  title: string
  artist?: string | null
  invited_by_name?: string | null
  expires_at: string
  resourceType?: 'song' | 'playlist'
  resourceId?: number
  song_id?: number
  playlist_id?: number
  alreadyJoined?: boolean
  expired?: boolean
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { status } = useSession()
  const router = useRouter()
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const resourceType = invite?.resourceType ?? 'song'
  const resourceLabel = resourceType === 'playlist' ? 'セットリスト' : '楽曲'
  const resourceId = invite?.resourceId ?? invite?.playlist_id ?? invite?.song_id
  const editPath = resourceType === 'playlist'
    ? `/manage/playlists/${resourceId}`
    : `/manage/songs/${resourceId}`
  const listPath = resourceType === 'playlist' ? '/manage/playlists' : '/songs'

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async response => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error === 'Expired' ? '招待リンクの有効期限が切れています' : '招待リンクが無効です')
        else {
          setInvite(data)
          if (data.expired) setError('招待リンクの有効期限が切れています')
          else if (data.alreadyJoined) {
            const label = data.resourceType === 'playlist' ? 'セットリスト' : '楽曲'
            setError(`すでにこの${label}の共同編集者として登録済みです。`)
          }
        }
      })
      .catch(() => setError('招待リンクが無効です'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      const response = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const data = await response.json()
      if (data.ok && !data.alreadyJoined) {
        setDone(true)
        const destination = data.resourceType === 'playlist'
          ? `/manage/playlists/${data.playlistId}`
          : `/manage/songs/${data.songId}`
        setTimeout(() => router.push(destination), 1500)
        return
      }
      if (data.alreadyJoined) {
        setError(`すでにこの${resourceLabel}の共同編集者として登録済みです。`)
      } else {
        setError(data.error === 'Expired' ? '招待リンクの有効期限が切れています'
          : data.error === 'Owner cannot accept' ? `自分の${resourceLabel}には承認できません`
          : '承認に失敗しました')
      }
    } catch {
      setError('承認に失敗しました')
    } finally {
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
        {error.includes('登録済み') && resourceId && (
          <Link href={editPath} className={s.btnPrimary}>→ 編集ページへ</Link>
        )}
        <Link href={listPath} className={s.linkSub}>← 一覧に戻る</Link>
      </div>
    </div>
  )

  if (!invite) return null

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
        <h1 className={s.cardTitle}>👥 共同編集への招待</h1>
        <div className={s.infoBox}>
          <div className={s.infoBoxTitle}>{invite.title}</div>
          {invite.artist && <div className={s.infoBoxSub}>{invite.artist}</div>}
          <div className={s.infoBoxMeta}>対象: {resourceLabel}</div>
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
          <button className={s.btnPrimary} onClick={handleAccept} disabled={accepting || status === 'loading'}>
            {accepting ? '承認中...' : '✓ 共同編集を承認する'}
          </button>
        )}
        <Link href={listPath} className={s.linkSub}>キャンセル</Link>
      </div>
    </div>
  )
}
