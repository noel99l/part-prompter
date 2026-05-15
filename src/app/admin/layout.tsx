import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import AdminMenu from '@/components/AdminMenu'
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
        <span className={styles.logo}>PART-PROMPTER</span>
        <AdminMenu accountName={accountName} />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
