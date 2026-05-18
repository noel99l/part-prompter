import Link from 'next/link'
import AppMenu from '@/components/AppMenu'
import SideNav from '@/components/SideNav'
import styles from './layout.module.css'

export default function PrompterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/prompter" className={styles.logo}>PART-PROMPTER</Link>
        <AppMenu />
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <SideNav />
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
