'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import styles from './AdminMenu.module.css'

const ADMIN_NAV = [
  { href: '/admin/songs', label: '🎤 パート分け管理' },
  { href: '/admin/playlists', label: '📋 セットリスト管理' },
  { href: '/admin/settings', label: '⚙️ アカウント設定' },
]

export default function AppMenu({ accountName }: { accountName?: string }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  const name = accountName ?? session?.user?.accountName ?? null

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isLoggedIn = !!(accountName || session)

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.hamburger} onClick={() => setOpen(v => !v)} aria-label="メニュー">
        <span className={`${styles.bar} ${open ? styles.bar1Open : ''}`} />
        <span className={`${styles.bar} ${open ? styles.bar2Open : ''}`} />
        <span className={`${styles.bar} ${open ? styles.bar3Open : ''}`} />
      </button>

      {open && (
        <div className={styles.drawer}>
          {name && <div className={styles.drawerAccount}>{name}</div>}

          <nav className={styles.nav}>
            <Link href="/prompter" className={`${styles.navItem} ${pathname === '/prompter' ? styles.navItemActive : ''}`} onClick={() => setOpen(false)}>
              🎵 パート分け一覧
            </Link>

            {isLoggedIn ? (
              <>
                <div className={styles.navDivider} />
                <div className={styles.navSectionHeader}>⚙️ 管理メニュー</div>
                {ADMIN_NAV.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            ) : (
              <Link href="/auth/signin" className={styles.navItem} onClick={() => setOpen(false)}>
                🔑 管理画面ログイン
              </Link>
            )}
          </nav>

          {isLoggedIn && (
            <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/prompter' })}>
              ログアウト
            </button>
          )}
        </div>
      )}
    </div>
  )
}
