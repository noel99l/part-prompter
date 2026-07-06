'use client'
import Link from 'next/link'
import styles from './SongCard.module.css'

interface Tag {
  label: string
  type: 'blue' | 'green' | 'pink' | 'gray'
}

interface SongCardProps {
  title: string
  href?: string          // リンク先（指定時はタイトルエリアがリンクになる）
  artist?: string
  description?: string
  tags?: Tag[]
  meta?: string[]        // 作者・更新日など最下段に表示するテキスト
  actions?: React.ReactNode  // 右側のボタン群
  prefix?: React.ReactNode   // タイトル行の左側に表示する要素（番号など）
  skeleton?: boolean
  onHover?: () => void   // ホバー/フォーカス/タッチ開始時（遷移先データの先読み用）
}

export default function SongCard({ title, href, artist, description, tags, meta, actions, prefix, onHover }: SongCardProps) {
  const info = (
    <div className={styles.info}>
      <div className={styles.titleRow}>
        <span className={styles.title}>{title}</span>
        {tags?.map((t, i) => (
          <span key={i} className={`${styles.tag} ${styles[`tag_${t.type}`]}`}>{t.label}</span>
        ))}
      </div>
      {artist && <div className={styles.artist}>{artist}</div>}
      {description && <div className={styles.description}>{description}</div>}
      {meta && meta.length > 0 && (
        <div className={styles.meta}>
          {meta.map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
    </div>
  )

  return (
    <div className={styles.card}>
      {prefix && <div className={styles.prefix}>{prefix}</div>}
      {href ? (
        <Link href={href} className={styles.infoLink} onMouseEnter={onHover} onFocus={onHover} onTouchStart={onHover}>{info}</Link>
      ) : (
        <div className={styles.infoBlock}>{info}</div>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
