import AppMenu from '@/components/AppMenu'
import BrandLogo from '@/components/BrandLogo'
import SideNav from '@/components/SideNav'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import styles from './layout.module.css'

export default async function PrompterLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  let accountName: string | undefined
  if (session?.user?.email) {
    const result = await query(`SELECT account_name FROM users WHERE email = $1`, [session.user.email])
    accountName = result.rows[0]?.account_name ?? undefined
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <BrandLogo href="/songs" size="compact" ariaLabel="公開パート分け一覧へ" />
        <AppMenu accountName={accountName} />
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
