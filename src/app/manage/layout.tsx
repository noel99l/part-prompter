import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { query } from '@/lib/db'
import { shouldShowOnboarding } from '@/lib/onboarding/state'
import AdminMenu from '@/components/AppMenu'
import SideNav from '@/components/SideNav'
import OnboardingGate from '@/components/onboarding/OnboardingGate'
import styles from './layout.module.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  let accountName: string | undefined
  let initialShouldShow = false
  let lookupFailed = false
  try {
    const result = await query(
      `SELECT account_name, onboarding_completed_at FROM users WHERE email = $1`,
      [session.user.email]
    )
    accountName = result.rows[0]?.account_name
    const completedAtRaw = result.rows[0]?.onboarding_completed_at ?? null
    const onboardingCompletedAt =
      completedAtRaw instanceof Date ? completedAtRaw.toISOString() : completedAtRaw
    if (accountName) {
      initialShouldShow = shouldShowOnboarding({ accountName, onboardingCompletedAt })
    }
  } catch {
    // 取得失敗時はフェイルセーフ: オンボーディングを表示せず通常画面を維持する
    lookupFailed = true
    initialShouldShow = false
  }

  // redirect は内部例外を投げるため try/catch の外で行う
  if (!lookupFailed && !accountName) redirect('/auth/setup')

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
      <OnboardingGate initialShouldShow={initialShouldShow} />
    </div>
  )
}
