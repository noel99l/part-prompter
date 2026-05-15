'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import styles from './AdminMenu.module.css'

const NAV = [
  { href: '/admin', label: '🎛️ 管理トップ' },
  { href: '/admin/songs', label: '🎤 楽曲管理' },
  { href: '/admin/playlists', label: '📋 プレイリスト管理' },
  { href: '/admin/settings', label: '⚙️ アカウント設定' },
]

export default function AdminMenu({ accountName }: { accountName: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.hamburger} onClick={() => setOpen(v => !v)} aria-label="メニュー">
        <span className={`${styles.bar} ${open ? styles.bar1Open : ''}`} />
        <span className={`${styles.bar} ${open ? styles.bar2Open : ''}`} />
        <span className={`${styles.bar} ${open ? styles.bar3Open : ''}`} />
      </button>

      {open && (
        <div className={styles.drawer}>
          <div className={styles.drawerAccount}>{accountName}</div>
          <nav className={styles.nav}>
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/' })}>
            ログアウト
          </button>
        </div>
      )}
    </div>
  )
}
