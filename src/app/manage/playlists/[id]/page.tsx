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

interface PlaylistItem {
  item_id: number
  item_type: 'song' | 'mc'
  mc_title: string | null
  mc_body: string | null
  id: number | null; title: string | null; artist: string | null
  sort_order: number; can_edit?: boolean
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

function SortableItem({ item, songNumber, playlistId, onRemove, onEditMc }: {
  item: PlaylistItem
  songNumber: number
  playlistId: string
  onRemove: (item: PlaylistItem) => void
  onEditMc: (item: PlaylistItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.item_id })

  const dragHandle = (
    <span
      className={styles.dragHandle}
      {...attributes}
      {...listeners}
      title="ドラッグして並び替え"
    >⠿</span>
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {item.item_type === 'mc' ? (
        <SongCard
          title={item.mc_title || 'MC'}
          artist={(item.mc_body || '').split('\n')[0] || undefined}
          tags={[{ label: '🎤 MC', type: 'gray' }]}
          prefix={
            <>
              {dragHandle}
              <span className={styles.orderNum}>🎤</span>
            </>
          }
          actions={
            <div className={styles.cardActions}>
              <button className={styles.viewBtn} onClick={() => onEditMc(item)} title="MCスライドを編集">✏️</button>
              <Link href={`/playlists/${playlistId}/mc/${item.item_id}`} className={styles.viewBtn} target="_blank" title="スライドを表示">▶</Link>
              <button className={styles.deleteBtn} onClick={() => onRemove(item)} title="セットリストから削除">🗑️</button>
            </div>
          }
        />
      ) : (
        <SongCard
          title={item.title || ''}
          artist={item.artist || undefined}
          tags={buildTags(item)}
          prefix={
            <>
              {dragHandle}
              <span className={styles.orderNum}>{songNumber}</span>
            </>
          }
          actions={
            <div className={styles.cardActions}>
              {item.can_edit && (
                <Link href={`/manage/songs/${item.id}`} className={styles.viewBtn} title="楽曲を編集">✏️</Link>
              )}
              <Link href={`/songs/${item.id}/prompter`} className={styles.viewBtn} target="_blank" title="プロンプターを表示">▶</Link>
              <button className={styles.deleteBtn} onClick={() => onRemove(item)} title="セットリストから削除">🗑️</button>
            </div>
          }
        />
      )}
    </div>
  )
}

export default function PlaylistEditPage() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<PlaylistItem[]>([])
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

  // ヘッダーの「＋ 追加」「⋯」ドロップダウンの開閉状態
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false)
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // プロンプターURLコピーのフィードバック表示
  const [prompterUrlCopied, setPrompterUrlCopied] = useState(false)

  const copyPrompterUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/playlists/${id}/prompter`)
      setPrompterUrlCopied(true)
      setTimeout(() => { setPrompterUrlCopied(false); setMoreMenuOpen(false) }, 1200)
    } catch {
      setMoreMenuOpen(false)
    }
  }

  // ⋯メニューの中身。共同編集モーダルの開閉関数はオーナーのときだけ渡される。
  const renderMoreMenu = (openCollab?: () => void) => (
    moreMenuOpen ? (
      <div className={styles.menuDropdown}>
        <button className={styles.menuItem} onClick={copyPrompterUrl}>
          {prompterUrlCopied ? '✓ コピーしました' : '📋 プロンプターURLをコピー'}
        </button>
        {openCollab && (
          <button className={styles.menuItem} onClick={() => { setMoreMenuOpen(false); openCollab() }}>👥 共同編集を管理</button>
        )}
        {isOwner && canUseSyncPrompter && songCount > 0 && (
          <Link href={`/manage/sync?playlistId=${id}`} className={styles.menuItem} onClick={() => setMoreMenuOpen(false)}>📡 同期プロンプターを開始</Link>
        )}
      </div>
    ) : null
  )

  // MCスライド追加・編集モーダル。editingMcItemId=nullなら新規追加。
  const [showMcModal, setShowMcModal] = useState(false)
  const [editingMcItemId, setEditingMcItemId] = useState<number | null>(null)
  const [mcTitle, setMcTitle] = useState('')
  const [mcBody, setMcBody] = useState('')
  const [mcSaving, setMcSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetch(`/api/playlists/${id}?access=1`)
      .then(r => r.json())
      .then(data => {
        setName(data.name)
        setDescription(data.description || '')
        setItems(data.items || [])
        setIsOwner(data.is_owner === true)
        setLoading(false)
      })
  }, [id])

  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  const songCount = items.filter(it => it.item_type === 'song').length

  const handleQueryChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(value)}`)
        const data: SearchResult[] = await res.json()
        const addedIds = new Set(itemsRef.current.filter(it => it.item_type === 'song').map(it => it.id))
        setSuggestions(data.filter(s => !addedIds.has(s.id)))
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const refreshItems = async () => {
    const res = await fetch(`/api/playlists/${id}?access=1`)
    const data = await res.json()
    setItems(data.items || [])
  }

  const addSong = async (songId: number) => {
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    })
    await refreshItems()
    setSearchQuery(''); setSuggestions([]); setShowAddModal(false)
  }

  const removeItem = async (item: PlaylistItem) => {
    if (item.item_type === 'mc') {
      await fetch(`/api/playlists/${id}/mc`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.item_id }),
      })
      setItems(prev => prev.filter(it => it.item_id !== item.item_id))
    } else {
      // 同じ曲が複数入っている場合に他の行を巻き添えにしないよう、行ID単位で削除する
      await fetch(`/api/playlists/${id}/songs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.item_id }),
      })
      setItems(prev => prev.filter(it => it.item_id !== item.item_id))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(it => it.item_id === active.id)
    const newIndex = items.findIndex(it => it.item_id === over.id)
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    await fetch(`/api/playlists/${id}/songs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: next.map(it => it.item_id) }),
    })
  }

  const openMcModal = (item?: PlaylistItem) => {
    setEditingMcItemId(item?.item_id ?? null)
    setMcTitle(item?.mc_title ?? '')
    setMcBody(item?.mc_body ?? '')
    setShowMcModal(true)
  }

  const saveMc = async () => {
    if (!mcTitle.trim() && !mcBody.trim()) return
    setMcSaving(true)
    try {
      if (editingMcItemId == null) {
        await fetch(`/api/playlists/${id}/mc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: mcTitle, body: mcBody }),
        })
      } else {
        await fetch(`/api/playlists/${id}/mc`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: editingMcItemId, title: mcTitle, body: mcBody }),
        })
      }
      await refreshItems()
      setShowMcModal(false)
    } finally {
      setMcSaving(false)
    }
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

  let songNumber = 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📋 セットリスト</h1>
        <div className={styles.headerActions}>
          <div className={styles.menuWrapper} ref={addMenuRef}>
            <button className={styles.createBtn} onClick={() => setAddMenuOpen(v => !v)} title="追加">＋ 追加</button>
            {addMenuOpen && (
              <div className={styles.menuDropdown}>
                <button className={styles.menuItem} onClick={() => { setAddMenuOpen(false); setShowAddModal(true); setSearchQuery(''); setSuggestions([]) }}>🎵 曲を追加</button>
                <button className={styles.menuItem} onClick={() => { setAddMenuOpen(false); openMcModal() }}>🎤 MCスライドを追加</button>
              </div>
            )}
          </div>
          <Link href={`/playlists/${id}/prompter`} className={styles.previewLink} target="_blank" title="プロンプターを表示">▶ 表示 ↗</Link>
          <div className={styles.menuWrapper} ref={moreMenuRef}>
            <button className={styles.menuBtn} onClick={() => setMoreMenuOpen(v => !v)} title="メニュー">⋯</button>
            {/* モーダルの状態を保持するため、ドロップダウンの開閉に関わらず常時マウントし、
                メニュー本体は trigger 経由で描画する */}
            {isOwner ? (
              <PlaylistCollaboratorManager playlistId={id} trigger={open => renderMoreMenu(open)} />
            ) : renderMoreMenu()}
          </div>
        </div>
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

      {items.length === 0 ? (
        <p className={styles.empty}>曲が追加されていません。</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(it => it.item_id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {items.map(it => {
                if (it.item_type === 'song') songNumber++
                return (
                  <SortableItem
                    key={it.item_id}
                    item={it}
                    songNumber={songNumber}
                    playlistId={id}
                    onRemove={removeItem}
                    onEditMc={openMcModal}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

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

      {showMcModal && (
        <div className={styles.overlay} onClick={() => setShowMcModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingMcItemId == null ? '🎤 MCスライドを追加' : '🎤 MCスライドを編集'}</h2>
            <input
              className={styles.input}
              value={mcTitle}
              onChange={e => setMcTitle(e.target.value.slice(0, 100))}
              placeholder="タイトル（例: MC①、メンバー紹介）"
              autoComplete="off"
              autoFocus
            />
            <textarea
              className={styles.descriptionInput}
              value={mcBody}
              onChange={e => setMcBody(e.target.value.slice(0, 2000))}
              placeholder={'話す内容やメモ（2000文字まで）\nプロンプターにそのまま表示されます'}
              rows={8}
              style={{ width: '100%', marginTop: 8 }}
            />
            {editingMcItemId == null && (
              <p className={styles.modalEmpty} style={{ textAlign: 'left' }}>末尾に追加されます。位置はドラッグで調整してください。</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className={styles.saveBtn}
                style={{ flex: 1 }}
                onClick={saveMc}
                disabled={mcSaving || (!mcTitle.trim() && !mcBody.trim())}
              >{mcSaving ? '...' : '保存'}</button>
              <button className={styles.cancelBtn} style={{ flex: 1 }} onClick={() => setShowMcModal(false)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
