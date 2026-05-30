'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
import skStyles from '@/components/skeleton.module.css'

interface Song { id: number; title: string; artist: string; sort_order: number }
interface SearchResult {
  id: number; title: string; artist: string
  created_by_name?: string; updated_at?: string
  lyric_count?: string; timestamp_count?: string; member_count?: string
}

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
  const [description, setDescription] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.json())
      .then(data => { setName(data.name); setDescription(data.description || ''); setSongs(data.songs || []); setLoading(false) })
  }, [id])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(value)}`)
        const data: SearchResult[] = await res.json()
        const addedIds = new Set(songs.map(s => s.id))
        setSuggestions(data.filter(s => !addedIds.has(s.id)))
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
    setQuery(''); setSuggestions([]); setShowAddModal(false)
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
      body: JSON.stringify({ name, description }),
    })
    setSaving(false)
    setEditingName(false)
  }

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={skStyles.sk} style={{ width: 180, height: 28 }} />
        <div className={skStyles.sk} style={{ width: 80, height: 20, marginLeft: 'auto' }} />
      </div>
      <div className={skStyles.sk} style={{ width: 260, height: 36, marginBottom: 24, borderRadius: 8 }} />
      <div className={skStyles.sk} style={{ width: '100%', maxWidth: 700, height: 44, marginBottom: 24, borderRadius: 8 }} />
      <div className={styles.list}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={skStyles.sk} style={{ width: 20, height: 20, borderRadius: 4 }} />
            <div className={skStyles.sk} style={{ width: 24, height: 18, borderRadius: 4 }} />
            <div className={styles.cardInfo}>
              <div className={skStyles.sk} style={{ width: '50%', height: 18, marginBottom: 8 }} />
              <div className={skStyles.sk} style={{ width: '30%', height: 14 }} />
            </div>
            <div className={styles.cardActions}>
              <div className={skStyles.sk} style={{ width: 60, height: 32, borderRadius: 6 }} />
              <div className={skStyles.sk} style={{ width: 36, height: 32, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📋 セットリスト編集</h1>
        <Link href={`/prompter/playlist/${id}`} className={styles.previewLink} target="_blank">▶ 表示 ↗</Link>
      </div>

      <div className={styles.nameRow}>
        {editingName ? (
          <>
            <input
              ref={nameInputRef}
              className={`${styles.metaInput} ${styles.flex1}`}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              placeholder="セットリスト名"
              autoFocus
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

      <div className={styles.descriptionWrap}>
        <textarea
          className={styles.descriptionInput}
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, 200))}
          onBlur={saveName}
          placeholder="概要（200文字まで）"
          rows={2}
        />
        <div className={`${styles.descriptionCount} ${description.length >= 200 ? styles.descriptionCountMax : styles.descriptionCountOk}`}>
          {description.length}/200
        </div>
      </div>

      <div className={styles.addBtnRow}>
        <button className={styles.createBtn} onClick={() => { setShowAddModal(true); setQuery(''); setSuggestions([]) }}>＋ 曲を追加</button>
      </div>

      {showAddModal && (
        <div className={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>曲を追加</h2>
            <div className={styles.modalSearchRow}>
              <input
                className={styles.input}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="曲名・アーティスト・歌詞で検索..."
                autoComplete="off"
                autoFocus
              />
              {searching && (
                <span className={styles.spinner} />
              )}
            </div>
            {suggestions.length > 0 ? (
              <div className={styles.suggestionList}>
                {suggestions.map(s => (
                  <button key={s.id} className={styles.suggestionItem} onClick={() => addSong(s.id)}>
                    <div className={styles.modalSearchResult}>
                      <span className={styles.suggestionTrack}>{s.title}</span>
                      {parseInt(s.member_count ?? '0') > 0 && <span className={styles.tagPink}>👥 {s.member_count}</span>}
                    </div>
                    {s.artist && <span className={styles.suggestionMeta}>{s.artist}</span>}
                    <div className={styles.modalSearchMeta}>
                      {s.created_by_name && <span className={styles.suggestionMeta}>✍️ {s.created_by_name}</span>}
                      {s.updated_at && <span className={styles.suggestionMeta}>🕒 {new Date(s.updated_at).toLocaleString('ja-JP')}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() && !searching ? (
              <p className={styles.modalEmpty}>該当する曲が見つかりません</p>
            ) : null}
            <button className={`${styles.cancelBtn} ${styles.cancelBtnFull}`} onClick={() => setShowAddModal(false)}>キャンセル</button>
          </div>
        </div>
      )}

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
