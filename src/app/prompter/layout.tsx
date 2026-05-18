import Link from 'next/link'
import PrompterMenu from '@/components/PrompterMenu'
import styles from './layout.module.css'

export default function PrompterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/prompter" className={styles.logo}>PART-PROMPTER</Link>
        <PrompterMenu />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
