'use client'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import styles from './page.module.css'

export default function AdminDashboard() {
  const { data: session } = useSession()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🎛️ 管理トップ</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {session?.user?.accountName && (
            <span style={{ color: '#888', fontSize: '0.9rem' }}>{session.user.accountName}</span>
          )}
          <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/' })}>ログアウト</button>
        </div>
      </div>

      <div className={styles.list}>
        <Link href="/admin/songs" className={styles.card}>
          <div className={styles.cardInfo}>
            <div className={styles.songTitle}>🎤 楽曲管理</div>
            <div className={styles.artist}>曲の追加・歌詞・パート分け編集</div>
          </div>
          <span className={styles.viewBtn}>開く →</span>
        </Link>

        <Link href="/admin/playlists" className={styles.card}>
          <div className={styles.cardInfo}>
            <div className={styles.songTitle}>📋 プレイリスト管理</div>
            <div className={styles.artist}>プレイリストの作成・曲の並び替え</div>
          </div>
          <span className={styles.viewBtn}>開く →</span>
        </Link>

        <Link href="/admin/settings" className={styles.card}>
          <div className={styles.cardInfo}>
            <div className={styles.songTitle}>⚙️ アカウント設定</div>
            <div className={styles.artist}>アカウント名の変更</div>
          </div>
          <span className={styles.viewBtn}>開く →</span>
        </Link>
      </div>
    </div>
  )
}
