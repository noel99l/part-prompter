'use client'
import styles from './Pagination.module.css'

interface Props {
  page: number
  total: number
  perPage: number
  onChange: (page: number) => void
}

export default function Pagination({ page, total, perPage, onChange }: Props) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  return (
    <div className={styles.wrapper}>
      <button className={styles.btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>←</button>
      <span className={styles.info}>{page} / {totalPages}</span>
      <button className={styles.btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}
