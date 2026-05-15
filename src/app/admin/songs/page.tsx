'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from '../page.module.css'

interface LrcResult {
  id: number
  trackName: string
  artistName: string
  albumName: string
  syncedLyrics: string | null
}

interface DbLyric {
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
}

function parseLrcToDb(lrc: string): DbLyric[] {
  const flatLines: { text: string; timestamp_ms: number }[] = []
  const breaks = new Set<number>()
  let prevWasEmpty = true

  for (const raw of lrc.split('\n')) {
    const trimmed = raw.trim()
    const match = trimmed.match(/^\[(\d+):(\d+)[.:](\d+)\](.*)$/)
    if (match) {
      const ms = parseInt(match[1]) * 60000 + parseInt(match[2]) * 1000 + Math.round(parseInt(match[3]) * 10)
      const text = match[4].trim()
      if (!text) { prevWasEmpty = true; continue }
      if (prevWasEmpty && flatLines.length > 0) breaks.add(flatLines.length)
      flatLines.push({ text, timestamp_ms: ms })
      prevWasEmpty = false
    } else if (trimmed === '') {
      prevWasEmpty = true
    }
  }

  if (breaks.size === 0 && flatLines.length > 0) {
    for (let i = 4; i < flatLines.length; i += 4) breaks.add(i)
  }

  let blockIndex = 0
  let lineIndex = 0
  return flatLines.map((l, i) => {
    if (i > 0 && breaks.has(i)) { blockIndex++; lineIndex = 0 }
    const row: DbLyric = { ...l, block_index: blockIndex, line_index: lineIndex, member_ids: [] }
    lineIndex++
    return row
  })
}

export default function AdminSongsPage() {
  const router = useRouter()
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newArtist, setNewArtist] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<LrcResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedLyrics, setSelectedLyrics] = useState<string | null>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)
  const suggestRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSongs() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadSongs = async () => {
    setLoading(true)
    const res = await fetch('/api/songs')
    const data = await res.json()
    setSongs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const handleTitleChange = useCallback((value: string) => {
    setNewTitle(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/lrclib?q=${encodeURIComponent(value)}`)
        const data: LrcResult[] = await res.json()
        setSuggestions(Array.isArray(data) ? data.filter(item => item.syncedLyrics).slice(0, 8) : [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [])

  const selectSuggestion = (item: LrcResult) => {
    setNewTitle(item.trackName)
    setNewArtist(item.artistName)
    setSelectedLyrics(item.syncedLyrics ?? null)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const createSong = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), artist: newArtist.trim() }),
    })
    const song = await res.json()

    if (selectedLyrics && song.id) {
      const lyrics = parseLrcToDb(selectedLyrics)
      await fetch(`/api/songs/${song.id}/lyrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lyrics),
      })
    }

    setCreating(false)
    setShowModal(false)
    setNewTitle('')
    setNewArtist('')
    setSelectedLyrics(null)
    router.push(`/admin/${song.id}`)
  }

  const closeModal = () => {
    setShowModal(false)
    setNewTitle('')
    setNewArtist('')
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedLyrics(null)
  }

  const deleteSong = async (id: number) => {
    if (!confirm('この曲を削除しますか？歌詞・メンバーも全て削除されます。')) return
    setDeletingId(id)
    await fetch(`/api/songs/${id}`, { method: 'DELETE' })
    setSongs(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  if (loading) return <Loading label="楽曲一覧" />

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.backLink}>← 管理トップ</Link>
        <h1 className={styles.title}>🎤 楽曲管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.createBtn} onClick={() => setShowModal(true)}>＋ 曲を追加</button>
          <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/' })}>ログアウト</button>
        </div>
      </div>

      {songs.length === 0 ? (
        <p className={styles.empty}>曲が登録されていません。「曲を追加」から登録してください。</p>
      ) : (
        <div className={styles.list}>
          {songs.map(s => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <div className={styles.songTitle}>{s.title}</div>
                {s.artist && <div className={styles.artist}>{s.artist}</div>}
                {s.created_by_name && <div className={styles.artist}>作成者: {s.created_by_name}</div>}
              </div>
              <div className={styles.cardActions}>
                <Link href={`/admin/${s.id}`} className={styles.editBtn}>✏️ 編集</Link>
                <Link href={`/prompter/${s.id}`} className={styles.viewBtn} target="_blank">▶ 表示</Link>
                <button
                  className={styles.deleteBtn}
                  onClick={() => deleteSong(s.id)}
                  disabled={deletingId === s.id}
                >
                  {deletingId === s.id ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>曲を追加</h2>
            <div className={styles.inputWrapper} ref={suggestRef}>
              <input
                className={styles.input}
                value={newTitle}
                onChange={e => handleTitleChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="曲名（必須）"
                autoFocus
                autoComplete="off"
              />
              {searching && <span className={styles.searchingIndicator}>検索中...</span>}
              {showSuggestions && suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map(item => (
                    <button
                      key={item.id}
                      className={styles.suggestionItem}
                      onMouseDown={() => selectSuggestion(item)}
                    >
                      <span className={styles.suggestionTrack}>{item.trackName}</span>
                      <span className={styles.suggestionMeta}>{item.artistName}{item.albumName ? ` / ${item.albumName}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              className={styles.input}
              value={newArtist}
              onChange={e => setNewArtist(e.target.value)}
              placeholder="アーティスト名"
            />
            {selectedLyrics && (
              <p className={styles.lyricsReady}>✅ 歌詞データあり（作成時に自動保存されます）</p>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={closeModal}>キャンセル</button>
              <button
                className={styles.submitBtn}
                onClick={createSong}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? '作成中...' : '作成して編集'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
