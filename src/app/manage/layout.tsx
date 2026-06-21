import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import AdminMenu from '@/components/AppMenu'
import SideNav from '@/components/SideNav'
import styles from './layout.module.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  const result = await query(`SELECT account_name FROM users WHERE email = $1`, [session.user.email])
  const accountName = result.rows[0]?.account_name

  if (!accountName) redirect('/auth/setup')

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/manage/songs" className={styles.logoWrap}>
          <span className={styles.logo}>PART-PROMPTER</span>
          <span className={styles.badge}>管理</span>
        </Link>
        <AdminMenu accountName={accountName} />
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <SideNav accountName={accountName} />
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
