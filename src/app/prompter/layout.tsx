import Link from 'next/link'
import AppMenu from '@/components/AppMenu'
import styles from './layout.module.css'

export default function PrompterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/prompter" className={styles.logo}>PART-PROMPTER</Link>
        <AppMenu />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
