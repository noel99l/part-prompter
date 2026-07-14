'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import type { SyncSessionInfo } from '@/lib/sync/types'
import styles from './page.module.css'

interface PlaylistSummary { id: number; name: string }
interface PlaylistDetail extends PlaylistSummary { songs?: { id: number }[] }

async function errorMessage(response: Response): Promise<string> {
  const value = await response.json().catch(() => null) as { error?: string } | null
  return value?.error ?? '同期サービスとの通信に失敗しました。'
}

function SyncStartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedId = searchParams.get('playlistId') ?? ''
  const [active, setActive] = useState<SyncSessionInfo | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [selectedId, setSelectedId] = useState(requestedId)
  const [detail, setDetail] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([fetch('/api/sync/sessions'), fetch('/api/playlists')])
      .then(async ([sessionResponse, playlistResponse]) => {
        if (!sessionResponse.ok) throw new Error(await errorMessage(sessionResponse))
        if (!playlistResponse.ok) throw new Error('セットリストを取得できませんでした。')
        const sessionData = await sessionResponse.json() as { activeSession: SyncSessionInfo | null }
        const playlistData = await playlistResponse.json() as PlaylistSummary[]
        if (alive) { setActive(sessionData.activeSession); setPlaylists(playlistData) }
      })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : '読み込みに失敗しました。') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let alive = true
    fetch(`/api/playlists/${encodeURIComponent(selectedId)}`)
      .then(async response => {
        if (!response.ok) throw new Error('セットリストの内容を取得できませんでした。')
        const value = await response.json() as PlaylistDetail
        if (alive) setDetail(value)
      })
      .catch((reason: unknown) => { if (alive) { setDetail(null); setError(reason instanceof Error ? reason.message : '読み込みに失敗しました。') } })
    return () => { alive = false }
  }, [selectedId])

  const createSession = useCallback(async () => {
    const playlistId = Number(selectedId)
    if (!Number.isInteger(playlistId) || !detail?.songs?.length) return
    setCreating(true); setError('')
    try {
      const response = await fetch('/api/sync/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId }),
      })
      const data = await response.json() as { session?: SyncSessionInfo; joinUrl?: string; error?: string; activeSessionId?: string }
      if (response.status === 409 && data.activeSessionId) {
        router.push(`/manage/sync/${data.activeSessionId}`); return
      }
      if (!response.ok || !data.session || !data.joinUrl) throw new Error(data.error ?? '同期セッションを作成できませんでした。')
      sessionStorage.setItem(`part-prompter:sync:join:${data.session.id}`, data.joinUrl)
      router.push(`/manage/sync/${data.session.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '同期セッションを作成できませんでした。')
      setCreating(false)
    }
  }, [detail, router, selectedId])

  if (loading) return <main className={styles.page}><p className={styles.status}>読み込み中...</p></main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>MASTER CONTROLLER</p><h1>📡 同期プロンプター</h1></div>
        <Link className={styles.back} href="/manage/playlists">セットリスト管理へ</Link>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {active ? (
        <section className={styles.card}>
          <span className={styles.live}>● 進行中</span>
          <h2>進行中の同期セッションがあります</h2>
          <p>新しいセッションを開始する前に、現在のセッションへ戻ってください。</p>
          <Link className={styles.primary} href={`/manage/sync/${active.id}`}>コントローラーへ戻る</Link>
        </section>
      ) : (
        <section className={styles.card}>
          <h2>同期するセットリスト</h2>
          {!requestedId && (
            <label className={styles.field}>セットリスト
              <select value={selectedId} onChange={event => { setSelectedId(event.target.value); setError('') }}>
                <option value="">選択してください</option>
                {playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
              </select>
            </label>
          )}
          {detail && <div className={styles.summary}><strong>{detail.name}</strong><span>{detail.songs?.length ?? 0}曲</span></div>}
          <ul className={styles.notes}>
            <li>予定台数の設定はありません。必要な端末でQRコードを読み取ります。</li>
            <li>セッションは作成から24時間有効です。</li>
            <li>セットリストと歌詞は作成時のスナップショットに固定されます。</li>
          </ul>
          <button className={styles.primary} onClick={createSession} disabled={creating || !detail?.songs?.length}>
            {creating ? '作成中...' : '📡 同期プロンプターを開始'}
          </button>
          {detail && !detail.songs?.length && <p className={styles.error}>曲が1件以上あるセットリストを指定してください。</p>}
        </section>
      )}
    </main>
  )
}

export default function SyncStartPage() {
  return <Suspense fallback={<main className={styles.page}><p className={styles.status}>読み込み中...</p></main>}><SyncStartContent /></Suspense>
}
