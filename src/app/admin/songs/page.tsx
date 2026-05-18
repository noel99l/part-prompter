'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import skStyles from '@/components/skeleton.module.css'
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
  const [step, setStep] = useState<'search' | 'input'>('search')
  const [newTitle, setNewTitle] = useState('')
  const [newArtist, setNewArtist] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<LrcResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [selectedLyrics, setSelectedLyrics] = useState<string | null>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { loadSongs() }, [])

  const loadSongs = async () => {
    setLoading(true)
    const res = await fetch('/api/songs?mine=1')
    const data = await res.json()
    setSongs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setSuggestions([])
    setSearched(false)
  }, [])

  const handleSearch = useCallback(async (value: string) => {
    if (!value.trim()) return
    setSearching(true)
    setSearched(false)
    try {
      const res = await fetch(`/api/lrclib?q=${encodeURIComponent(value)}`)
      const data: LrcResult[] = await res.json()
      setSuggestions(Array.isArray(data) ? data.filter(item => item.syncedLyrics).slice(0, 10) : [])
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }, [])

  const selectSuggestion = (item: LrcResult) => {
    setNewTitle(item.trackName)
    setNewArtist(item.artistName)
    setSelectedLyrics(item.syncedLyrics ?? null)
    setStep('input')
  }

  const goManualInput = () => {
    setNewTitle(searchQuery)
    setNewArtist('')
    setSelectedLyrics(null)
    setStep('input')
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

    await fetch(`/api/songs/${song.id}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { name: '', color: '#FF4444', sort_order: 0 },
        { name: '', color: '#1E90FF', sort_order: 1 },
      ]),
    })

    setCreating(false)
    setShowModal(false)
    setNewTitle('')
    setNewArtist('')
    setSelectedLyrics(null)
    router.push(`/admin/${song.id}`)
  }

  const closeModal = () => {
    setShowModal(false)
    setStep('search')
    setSearchQuery('')
    setSearched(false)
    setNewTitle('')
    setNewArtist('')
    setSuggestions([])
    setSelectedLyrics(null)
  }

  const deleteSong = async (id: number) => {
    if (!confirm('この曲を削除しますか？歌詞・メンバーも全て削除されます。')) return
    setDeletingId(id)
    await fetch(`/api/songs/${id}`, { method: 'DELETE' })
    setSongs(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={skStyles.sk} style={{ width: 140, height: 28 }} />
        <div className={skStyles.sk} style={{ width: 100, height: 36, borderRadius: 8, marginLeft: 'auto' }} />
      </div>
      <div className={styles.list}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardInfo}>
              <div className={skStyles.sk} style={{ width: '55%', height: 18, marginBottom: 6 }} />
              <div className={skStyles.sk} style={{ width: '35%', height: 13, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <div className={skStyles.sk} style={{ width: 52, height: 18, borderRadius: 99 }} />
                <div className={skStyles.sk} style={{ width: 36, height: 18, borderRadius: 99 }} />
              </div>
            </div>
            <div className={styles.cardActions}>
              <div className={skStyles.sk} style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div className={skStyles.sk} style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div className={skStyles.sk} style={{ width: 32, height: 32, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🎤 楽曲管理</h1>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>＋ 曲を追加</button>
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
                <div className={styles.tagRow}>
                  {parseInt(s.lyric_count) === 0 && <span className={styles.tagGray}>歌詞なし</span>}
                  {parseInt(s.lyric_count) > 0 && parseInt(s.timestamp_count) === 0 && <span className={styles.tagBlue}>テキスト</span>}
                  {parseInt(s.timestamp_count) > 0 && <span className={styles.tagGreen}>タイムスタンプ付き</span>}
                  {parseInt(s.member_count) > 0 && <span className={styles.tagPink}>👥 {s.member_count}</span>}
                </div>
              </div>
              <div className={styles.cardActions}>
                <Link href={`/admin/${s.id}`} className={styles.editBtn}><span className={styles.btnIcon}>✏️</span><span className={styles.btnLabel}> 編集</span></Link>
                <Link href={`/prompter/${s.id}`} className={styles.viewBtn} target="_blank"><span className={styles.btnIcon}>▶</span><span className={styles.btnLabel}> 表示</span></Link>
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
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {step === 'search' ? (
              <>
                <h2 className={styles.modalTitle}>曲を追加</h2>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                  <a href="https://lrclib.net" target="_blank" rel="noreferrer" style={{ color: '#888', textDecoration: 'underline' }}>LRCLIB</a> で曲名を検索して歌詞を取得できます
                </p>
                <div className={styles.modalSearchRow}>
                  <input
                    className={styles.input}
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                    placeholder="曲名で検索..."
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    className={styles.modalSearchBtn}
                    onClick={() => handleSearch(searchQuery)}
                    disabled={!searchQuery.trim() || searching}
                  >
                    {searching
                      ? <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
                      : '🔍'
                    }
                  </button>
                </div>
                {searched && !searching && suggestions.length === 0 && (
                  <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>見つかりません</p>
                )}
                {suggestions.length > 0 && (
                  <div className={styles.suggestionList}>
                    {suggestions.map(item => (
                      <button key={item.id} className={styles.suggestionItem} onClick={() => selectSuggestion(item)}>
                        <span className={styles.suggestionTrack}>{item.trackName}</span>
                        <span className={styles.suggestionMeta}>{item.artistName}{item.albumName ? ` / ${item.albumName}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.modalDivider}>
                  <span>または</span>
                </div>
                <button className={styles.manualBtn} onClick={goManualInput}>
                  手動で曲名・アーティストを入力する
                </button>
                <button className={styles.cancelBtn} onClick={closeModal} style={{ alignSelf: 'stretch', fontSize: '0.9rem', textAlign: 'center' }}>キャンセル</button>
              </>
            ) : (
              <>
                <h2 className={styles.modalTitle}>曲の情報を確認</h2>
                {selectedLyrics && <p className={styles.lyricsReady}>✅ 歌詞データあり（作成時に自動保存）</p>}
                <input
                  className={styles.input}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="曲名（必須）"
                  autoFocus
                />
                <input
                  className={styles.input}
                  value={newArtist}
                  onChange={e => setNewArtist(e.target.value)}
                  placeholder="アーティスト名"
                />
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setStep('search')}>← 戻る</button>
                  <button
                    className={styles.submitBtn}
                    onClick={createSong}
                    disabled={!newTitle.trim() || creating}
                  >
                    {creating ? '作成中...' : '作成して編集'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
