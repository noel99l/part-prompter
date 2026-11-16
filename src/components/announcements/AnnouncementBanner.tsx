'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAnnouncements } from '@/lib/announcementsClient'
import styles from './AnnouncementBanner.module.css'

/**
 * 未読の「重要」なお知らせを、一覧系ページの上部に1件だけ表示する。
 * プロンプター画面は本番中に使うため表示しない。閉じた内容は端末に記憶する。
 */
export default function AnnouncementBanner() {
  const pathname = usePathname()
  const { unread, dismissed, dismiss } = useAnnouncements()

  if (pathname.includes('/prompter')) return null
  const target = unread.find(item => item.is_important && !dismissed.includes(item.id))
  if (!target) return null

  return (
    <div className={styles.banner} role="status">
      <span className={styles.tag}>重要</span>
      <Link href="/news" className={styles.title}>{target.title}</Link>
      <button className={styles.close} onClick={() => dismiss(target.id)} aria-label="お知らせを閉じる">✕</button>
    </div>
  )
}
