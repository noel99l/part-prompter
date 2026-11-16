'use client'
import { useEffect, useRef, useState } from 'react'
import skStyles from '@/components/skeleton.module.css'
import { useAnnouncements } from '@/lib/announcementsClient'
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@/lib/announcementsShared'
import AnnouncementBody from './AnnouncementBody'
import styles from './NewsList.module.css'

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' }) : ''

export default function NewsList() {
  const { items, unread, loaded, markAllRead } = useAnnouncements()
  // 開いた時点で未読だったものに「NEW」を付ける。既読化した後も、このページを見ている間は残す
  const [newIds, setNewIds] = useState<number[]>([])
  const markedRef = useRef(false)

  useEffect(() => {
    if (!loaded || markedRef.current) return
    markedRef.current = true
    setNewIds(unread.map(item => item.id))
    if (unread.length > 0) markAllRead()
  }, [loaded, unread, markAllRead])

  if (!loaded) return (
    <div className={styles.list}>
      {[...Array(3)].map((_, i) => <div key={i} className={skStyles.sk} style={{ width: '100%', height: 96, borderRadius: 10 }} />)}
    </div>
  )

  if (items.length === 0) return <p className={styles.empty}>現在お知らせはありません。</p>

  return (
    <div className={styles.list}>
      {items.map(item => (
        <article key={item.id} className={styles.card}>
          <div className={styles.meta}>
            <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
            <span className={styles.category}>{ANNOUNCEMENT_CATEGORY_LABELS[item.category] ?? 'お知らせ'}</span>
            {item.is_important && <span className={styles.important}>重要</span>}
            {newIds.includes(item.id) && <span className={styles.new}>NEW</span>}
          </div>
          <h2 className={styles.title}>{item.title}</h2>
          <AnnouncementBody text={item.body} className={styles.body} />
        </article>
      ))}
    </div>
  )
}
