'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './ItemMenu.module.css'

interface MenuItem { label: string; href: string; target?: string }

export default function ItemMenu({ onDelete, menuItems }: { onDelete: () => void; menuItems?: MenuItem[] }) {
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
          {menuItems?.map((item, i) => (
            <Link key={i} href={item.href} target={item.target} className={styles.item} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {menuItems && menuItems.length > 0 && <div className={styles.divider} />}
          <button className={`${styles.item} ${styles.itemDanger}`} onClick={handleDelete}>
            🗑️ 削除
          </button>
        </div>
      )}
    </div>
  )
}
