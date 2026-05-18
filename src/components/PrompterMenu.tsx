'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import styles from './PrompterMenu.module.css'

export default function PrompterMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
          {session ? (
            <>
              {session.user?.accountName && (
                <div className={styles.account}>{session.user.accountName}</div>
              )}
              <Link href="/admin" className={styles.item} onClick={() => setOpen(false)}>
                ⚙️ 管理画面ログイン
              </Link>
            </>
          ) : (
            <Link href="/auth/signin" className={styles.item} onClick={() => setOpen(false)}>
              🔑 管理画面ログイン
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
