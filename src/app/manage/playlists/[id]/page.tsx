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
import styles from '@/app/manage/page.module.css'
import skStyles from '@/components/skeleton.module.css'
import SongCard from '@/components/SongCard'
import PlaylistCollaboratorManager from '@/components/PlaylistCollaboratorManager'
import { useSyncCapability } from '@/hooks/useSyncCapability'

interface Song {
  id: number; title: string; artist: string; sort_order: number
  lyric_count?: string; timestamp_count?: string; member_count?: string
}
interface SearchResult {
  id: number; title: string; artist: string
  created_by_name?: string; updated_at?: string
  lyric_count?: string; timestamp_count?: string; member_count?: string
}

function buildTags(s: { lyric_count?: string; timestamp_count?: string; member_count?: string }) {
  const tags: { label: string; type: 'blue' | 'green' | 'pink' | 'gray' }[] = []
  if (parseInt(s.member_count ?? '0') > 0) tags.push({ label: `👥 ${s.member_count}`, type: 'pink' })
  if (parseInt(s.lyric_count ?? '0') > 0 && parseInt(s.timestamp_count ?? '0') === 0) tags.push({ label: 'テキスト', type: 'blue' })
  if (parseInt(s.timestamp_count ?? '0') > 0) tags.push({ label: 'タイムスタンプ', type: 'green' })
  if (parseInt(s.lyric_count ?? '0') === 0) tags.push({ label: '歌詞なし', type: 'gray' })
  return tags
}

function SortableItem({ song, index, onRemove }: {
  song: Song
  index: number
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
    >
      <SongCard
        title={song.title}
        artist={song.artist}
        tags={buildTags(song)}
        prefix={
          <>
            <span
              className={styles.dragHandle}
              {...attributes}
              {...listeners}
              title="ドラッグして並び替え"
            >⠿</span>
            <span className={styles.orderNum}>{index + 1}</span>
          </>
        }
        actions={
          <div className={styles.cardActions}>
            <Link href={`/songs/${song.id}/prompter`} className={styles.viewBtn} target="_blank">▶</Link>
            <button className={styles.deleteBtn} onClick={() => onRemove(song.id)}>🗑️</button>
          </div>
        }
      />
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
  const [isOwner, setIsOwner] = useState(false)
  const canUseSyncPrompter = useSyncCapability()

  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetch(`/api/playlists/${id}?access=1`)
      .then(r => r.json())
      .then(data => {
        setName(data.name)
        setDescription(data.description || '')
        setSongs(data.songs || [])
        setIsOwner(data.is_owner === true)
        setLoading(false)
      })
  }, [id])

  const songsRef = useRef(songs)
  useEffect(() => { songsRef.current = songs }, [songs])

  const handleQueryChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(value)}`)
        const data: SearchResult[] = await res.json()
        const addedIds = new Set(songsRef.current.map(s => s.id))
        setSuggestions(data.filter(s => !addedIds.has(s.id)))
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const addSong = async (songId: number) => {
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    const res = await fetch(`/api/playlists/${id}`)
    const data = await res.json()
    setSongs(data.songs || [])
    setSearchQuery(''); setSuggestions([]); setShowAddModal(false)
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
      <div className={styles.list}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={skStyles.sk} style={{ width: '100%', height: 52, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📋 セットリスト</h1>
        {isOwner && <PlaylistCollaboratorManager playlistId={id} />}
        <Link href={`/playlists/${id}/prompter`} className={styles.previewLink} target="_blank">▶ 表示 ↗</Link>
        {isOwner && canUseSyncPrompter && songs.length > 0 && (
          <Link href={`/manage/sync?playlistId=${id}`} className={styles.previewLink}>📡 同期プロンプターを開始</Link>
        )}
      </div>

      <div className={styles.nameRow}>
        {editingName ? (
          <>
            <input
              className={`${styles.metaInput} ${styles.flex1}`}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              placeholder="セットリスト名"
              autoFocus
            />
            <button className={styles.saveBtn} onClick={saveName} disabled={saving}>{saving ? '...' : '✓'}</button>
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

      {(editingName || description) && (
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
      )}

      {songs.length === 0 ? (
        <p className={styles.empty}>曲が追加されていません。</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {songs.map((s, i) => (
                <SortableItem key={s.id} song={s} index={i} onRemove={removeSong} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className={styles.addBtnRow}>
        <button className={styles.createBtn} onClick={() => { setShowAddModal(true); setSearchQuery(''); setSuggestions([]) }}>＋ 曲を追加</button>
      </div>

      {showAddModal && (
        <div className={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>曲を追加</h2>
            <div className={styles.modalSearchRow}>
              <input
                className={styles.input}
                value={searchQuery}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="曲名・アーティスト・歌詞で検索..."
                autoComplete="off"
                autoFocus
              />
              {searching && <span className={styles.spinner} />}
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
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() && !searching ? (
              <p className={styles.modalEmpty}>該当する曲が見つかりません</p>
            ) : null}
            <button className={`${styles.cancelBtn} ${styles.cancelBtnFull}`} onClick={() => setShowAddModal(false)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  )
}
