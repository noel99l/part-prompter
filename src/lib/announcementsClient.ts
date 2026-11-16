'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCachedJson, invalidateJson } from './clientCache'
import { latestReadAt, unreadAnnouncements, type Announcement } from './announcementsShared'

export const ANNOUNCEMENTS_API_URL = '/api/announcements'
// 端末側に保存する既読日時（未ログインでも未読バッジを消せるようにするため）
const READ_KEY = 'announcements_read_at'
// 「重要」バナーを閉じたお知らせのID
const DISMISSED_KEY = 'announcements_dismissed'
// 既読・バナーを閉じた・投稿が変わった、を同じ画面内の各部品へ伝えるイベント
const CHANGED_EVENT = 'announcements:changed'

function readLocalReadAt(): string | null {
  try { return localStorage.getItem(READ_KEY) } catch { return null }
}

function readDismissed(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

/** お知らせの内容が変わったことを、表示中のバッジ・バナー・一覧へ伝える。 */
export function notifyAnnouncementsChanged() {
  invalidateJson(ANNOUNCEMENTS_API_URL)
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/**
 * 公開中のお知らせと未読状態。サイドナビのバッジ、重要バナー、一覧ページで共有する。
 * 既読日時は「サーバー保存分（ログイン中）」と「端末保存分」の新しい方を使う。
 */
export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [serverReadAt, setServerReadAt] = useState<string | null>(null)
  const [localReadAt, setLocalReadAt] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<number[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    const apply = (data: { items?: Announcement[]; readAt?: string | null } | null) => {
      if (!alive) return
      setItems(Array.isArray(data?.items) ? data.items : [])
      setServerReadAt(data?.readAt ?? null)
      setLoaded(true)
    }
    const syncLocal = () => {
      setLocalReadAt(readLocalReadAt())
      setDismissed(readDismissed())
    }
    const load = () => {
      // 取得に失敗してもバッジやバナーを出さないだけで、画面は通常どおり使える
      getCachedJson(ANNOUNCEMENTS_API_URL, apply).then(apply).catch(() => { if (alive) setLoaded(true) })
    }
    syncLocal()
    load()
    const onChanged = () => { syncLocal(); load() }
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => {
      alive = false
      window.removeEventListener(CHANGED_EVENT, onChanged)
    }
  }, [])

  const readAt = latestReadAt(serverReadAt, localReadAt)
  const unread = useMemo(() => unreadAnnouncements(items, readAt), [items, readAt])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    try { localStorage.setItem(READ_KEY, now) } catch {}
    try { await fetch('/api/announcements/read', { method: 'POST' }) } catch {}
    notifyAnnouncementsChanged()
  }, [])

  const dismiss = useCallback((id: number) => {
    const next = [...new Set([...readDismissed(), id])].slice(-50)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)) } catch {}
    window.dispatchEvent(new Event(CHANGED_EVENT))
  }, [])

  return { items, unread, unreadCount: unread.length, dismissed, loaded, markAllRead, dismiss }
}
