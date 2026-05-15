import styles from './Loading.module.css'

export default function Loading({ label }: { label: string }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} />
      <p className={styles.label}>{label}を読み込み中...</p>
    </div>
  )
}
