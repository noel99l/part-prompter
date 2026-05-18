'use client'
import { useState, useEffect, useRef } from 'react'
import styles from './ItemMenu.module.css'

export default function ItemMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    onDelete()
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setOpen(v => !v) }} title="メニュー">⋯</button>
      {open && (
        <div className={styles.dropdown}>
          <button className={`${styles.item} ${styles.itemDanger}`} onClick={handleDelete}>
            🗑️ 削除
          </button>
        </div>
      )}
    </div>
  )
}
