'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from '../../page.module.css'

interface Song { id: number; title: string; artist: string; sort_order: number }
interface SearchResult { id: number; title: string; artist: string }

function SortableItem({ song, index, total, onRemove }: {
  song: Song
  index: number
  total: number
  onRemove: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={styles.card}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        title="ドラッグして並び替え"
      >
        ⠿
      </div>
      <span className={styles.orderNum}>{index + 1}</span>
      <div className={styles.cardInfo}>
        <div className={styles.songTitle}>{song.title}</div>
        {song.artist && <div className={styles.artist}>{song.artist}</div>}
      </div>
      <div className={styles.cardActions}>
        <Link href={`/prompter/${song.id}`} className={styles.viewBtn} target="_blank">▶ 表示</Link>
        <button className={styles.deleteBtn} onClick={() => onRemove(song.id)}>🗑️</button>
      </div>
    </div>
  )
}

export default function PlaylistEditPage() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)
  const suggestRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.json())
      .then(data => { setName(data.name); setSongs(data.songs || []); setLoading(false) })
  }, [id])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(value)}`)
        const data: SearchResult[] = await res.json()
        const addedIds = new Set(songs.map(s => s.id))
        setSuggestions(data.filter(s => !addedIds.has(s.id)))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [songs])

  const addSong = async (songId: number) => {
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    const res = await fetch(`/api/playlists/${id}`)
    const data = await res.json()
    setSongs(data.songs || [])
    setQuery(''); setSuggestions([]); setShowSuggestions(false)
  }

  const removeSong = async (songId: number) => {
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    setSongs(prev => prev.filter(s => s.id !== songId))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex(s => s.id === active.id)
    const newIndex = songs.findIndex(s => s.id === over.id)
    const next = arrayMove(songs, oldIndex, newIndex)
    setSongs(next)
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds: next.map(s => s.id) }),
    })
  }

  const saveName = async () => {
    setSaving(true)
    await fetch(`/api/playlists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    setEditingName(false)
  }

  if (loading) return <Loading label="プレイリスト" />

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/playlists" className={styles.backLink}>← プレイリスト一覧</Link>
        <h1 className={styles.title}>📋 プレイリスト編集</h1>
        <Link href={`/prompter/playlist/${id}`} className={styles.previewLink} target="_blank">▶ 表示 ↗</Link>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {editingName ? (
          <>
            <input
              ref={nameInputRef}
              className={styles.metaInput}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              placeholder="プレイリスト名"
              autoFocus
              style={{ flex: 1 }}
            />
            <button className={styles.saveBtn} onClick={saveName} disabled={saving}>{saving ? '保存中...' : '✓ 保存'}</button>
            <button className={styles.cancelBtn} onClick={() => setEditingName(false)}>✕</button>
          </>
        ) : (
          <button
            className={styles.inlineEditBtn}
            onClick={() => setEditingName(true)}
            title="クリックして編集"
          >
            {name} ✎
          </button>
        )}
      </div>

      <div className={styles.inputWrapper} ref={suggestRef} style={{ marginBottom: '24px', maxWidth: '700px' }}>
        <input
          className={styles.input}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="曲名・アーティスト・歌詞で検索して追加..."
          autoComplete="off"
        />
        {searching && <span className={styles.searchingIndicator}>検索中...</span>}
        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {suggestions.map(s => (
              <button key={s.id} className={styles.suggestionItem} onMouseDown={() => addSong(s.id)}>
                <span className={styles.suggestionTrack}>{s.title}</span>
                {s.artist && <span className={styles.suggestionMeta}>{s.artist}</span>}
              </button>
            ))}
          </div>
        )}
        {showSuggestions && suggestions.length === 0 && !searching && (
          <div className={styles.suggestions}>
            <div className={styles.suggestionItem} style={{ color: '#666', cursor: 'default' }}>
              <span className={styles.suggestionTrack}>該当する曲が見つかりません</span>
            </div>
          </div>
        )}
      </div>

      {songs.length === 0 ? (
        <p className={styles.empty}>曲が追加されていません。</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {songs.map((s, i) => (
                <SortableItem key={s.id} song={s} index={i} total={songs.length} onRemove={removeSong} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
