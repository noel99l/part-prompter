'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import styles from './SideNav.module.css'

const ADMIN_NAV = [
  { href: '/admin/songs', label: '🎤 パート分け管理' },
  { href: '/admin/playlists', label: '📋 プレイリスト管理' },
  { href: '/admin/settings', label: '⚙️ アカウント設定' },
]

export default function SideNav({ accountName }: { accountName?: string }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isLoggedIn = !!session
  const name = accountName ?? session?.user?.accountName ?? null

  return (
    <nav className={styles.nav}>
      <Link href="/prompter" className={`${styles.item} ${pathname === '/prompter' ? styles.itemActive : ''}`}>
        🎵 パート分け一覧
      </Link>

      {isLoggedIn ? (
        <>
          <div className={styles.divider} />
          <div className={styles.sectionHeader}>⚙️ 管理メニュー</div>
          {name && <div className={styles.account}>{name}</div>}
          {ADMIN_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.item} ${pathname === item.href ? styles.itemActive : ''}`}
            >
              {item.label}
            </Link>
          ))}
          <div className={styles.divider} />
          <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/prompter' })}>
            ログアウト
          </button>
        </>
      ) : (
        <>
          <div className={styles.divider} />
          <Link href="/auth/signin" className={styles.item}>
            🔑 管理画面ログイン
          </Link>
        </>
      )}

      <div className={styles.divider} />
      <Link href="/how-to-use" className={styles.itemSub}>HOW TO USE</Link>
      <Link href="/terms" className={styles.itemSub}>利用規約</Link>
      <Link href="/privacy" className={styles.itemSub}>プライバシーポリシー</Link>
    </nav>
  )
}
