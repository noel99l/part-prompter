'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import skStyles from '@/components/skeleton.module.css'
import { getCachedJson } from '@/lib/clientCache'
import { harmonyIds } from '@/lib/harmony'
import styles from './page.module.css'

interface Member { id: number; name: string; color: string; sort_order: number }
interface LyricLine {
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: { text: string; member_ids: number[]; harmony_up_ids?: number[]; harmony_down_ids?: number[]; harmony_up_id?: number; harmony_down_id?: number }[]
}

export default function SongDetailPage() {
  const { songId } = useParams<{ songId: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showPartsCopy, setShowPartsCopy] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 歌詞コピー防止
  useEffect(() => {
    const preventCopy = (e: ClipboardEvent) => e.preventDefault()
    const preventContext = (e: MouseEvent) => e.preventDefault()
    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a')) {
        e.preventDefault()
      }
    }
    document.addEventListener('copy', preventCopy)
    document.addEventListener('contextmenu', preventContext)
    document.addEventListener('keydown', preventKeys)
    return () => {
      document.removeEventListener('copy', preventCopy)
      document.removeEventListener('contextmenu', preventContext)
      document.removeEventListener('keydown', preventKeys)
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      getCachedJson(`/api/songs/${songId}`, s => { if (alive) setSong(s) }),
      getCachedJson(`/api/songs/${songId}/members`, m => { if (alive) setMembers(m) }),
      getCachedJson(`/api/songs/${songId}/lyrics`, l => { if (alive) setLyrics(l) }),
    ]).then(([s, m, l]) => {
      if (!alive) return
      setSong(s); setMembers(m); setLyrics(l); setLoading(false)
    })
    getCachedJson('/api/master-settings', data => {
      if (alive) setShowPartsCopy(data.show_parts_copy === '1')
    }).then(data => {
      if (alive) setShowPartsCopy(data.show_parts_copy === '1')
    }).catch(() => {})
    return () => { alive = false }
  }, [songId])

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  const blocks = useMemo(() => {
    const map: LyricLine[][] = []
    for (const l of [...lyrics].sort((a, b) => a.block_index - b.block_index || a.line_index - b.line_index)) {
      if (!map[l.block_index]) map[l.block_index] = []
      map[l.block_index].push(l)
    }
    return map.filter(Boolean)
  }, [lyrics])

  function gradientStyle(ids: number[]): React.CSSProperties {
    if (!ids?.length) return { color: '#fff' }
    if (ids.length === 1) return { color: memberMap[ids[0]]?.color || '#fff' }
    const stops = ids.map((id, i) => { const pct = 100 / ids.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%` }).join(', ')
    return { backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
  }

  function renderLineText(line: LyricLine) {
    if (line.word_members?.length) {
      return (
        <span>
          {line.word_members.map((w, wi) => {
            if (!w.member_ids?.length) return <span key={wi} className={styles.textWhite}>{w.text}</span>
            return <span key={wi} style={gradientStyle(w.member_ids)}>{w.text}</span>
          })}
        </span>
      )
    }
    return <span style={gradientStyle(line.member_ids)}>{line.text}</span>
  }

  const buildCopyText = (): string => {
    const getSymbol = (id: number): string => {
      const idx = members.findIndex(m => m.id === id)
      return idx >= 0 ? String.fromCharCode(65 + idx) : '?'
    }
    const getLabel = (ids: number[]) => {
      if (!ids?.length) return '全員'
      if (ids.length === members.length && members.length > 0) return '全員'
      return ids.map(id => getSymbol(id)).join('')
    }
    // ヘッダー
    const header: string[] = []
    if (song?.title) header.push(song.title)
    if (song?.artist) header.push(song.artist)
    const memberLine = members
      .map((m, i) => m.name ? `${String.fromCharCode(65 + i)}:${m.name}` : null)
      .filter(Boolean)
      .join(' ')
    const result: string[] = [...header, memberLine, '']
    const lines = [...lyrics].sort((a, b) => a.block_index - b.block_index || a.line_index - b.line_index)
    let prevBlock = -1
    let prevLabel = ''
    lines.forEach(line => {
      if (line.block_index !== prevBlock && prevBlock !== -1) result.push('')
      prevBlock = line.block_index
      if (line.word_members?.length) {
        let text = ''
        let curLabel = ''
        line.word_members.forEach(w => {
          const isSpace = w.text === ' ' || w.text === '　'
          if (!isSpace) {
            const label = getLabel(w.member_ids)
            if (label !== curLabel) { text += `(${label})`; curLabel = label }
          }
          text += w.text
        })
        result.push(text); prevLabel = ''; return
      }
      const label = getLabel(line.member_ids)
      const prefix = label !== prevLabel ? `(${label})` : ''
      result.push(prefix ? `${prefix}${line.text}` : line.text)
      prevLabel = label
    })
    return result.join('\n')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildCopyText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/songs/${songId}/duplicate`, { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push(`/manage/songs/${data.id}`)
    else setDuplicating(false)
  }

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerCenter}>
            <div className={skStyles.sk} style={{ width: '60%', height: 28, marginBottom: 6, borderRadius: 6 }} />
            <div className={skStyles.sk} style={{ width: '35%', height: 16, borderRadius: 6 }} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={skStyles.sk} style={{ width: 100, height: 34, borderRadius: 8 }} />
          <div className={skStyles.sk} style={{ width: 36, height: 36, borderRadius: 8 }} />
        </div>
      </div>
      <div className={styles.infoSection}>
        <div className={skStyles.sk} style={{ width: '40%', height: 14, borderRadius: 4 }} />
        <div className={styles.skTagRow}>
          {[...Array(3)].map((_, i) => <div key={i} className={skStyles.sk} style={{ width: 56, height: 24, borderRadius: 20 }} />)}
        </div>
      </div>
      <div className={styles.lyrics}>
        {[...Array(4)].map((_, bi) => (
          <div key={bi} className={styles.block}>
            {[...Array(3)].map((_, li) => (
              <div key={li} className={skStyles.sk} style={{ width: `${[75, 85, 70][li % 3]}%`, height: 16, borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.headerActions}>
        <Link href={`/songs/${songId}/prompter`} className={styles.prompterBtn}>▶ プロンプター</Link>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(v => !v)}>⋯</button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              {showPartsCopy && (
                <button className={styles.menuItem} onClick={() => { handleCopy(); setMenuOpen(false) }}>
                  {copied ? '✓ コピー済み' : '📋 パート分けをコピー'}
                </button>
              )}
              {session && (
                <button className={styles.menuItem} onClick={() => { setMenuOpen(false); handleDuplicate() }} disabled={duplicating}>
                  {duplicating ? '複製中...' : '📋 複製して編集'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>{song.title}</h1>
            {song.artist && <p className={styles.artist}>{song.artist}</p>}
            <div className={styles.tagRow}>
              {lyrics.length === 0 && <span className={styles.tagGray}>歌詞なし</span>}
              {lyrics.length > 0 && !lyrics.some(l => l.timestamp_ms != null) && <span className={styles.tagBlue}>テキスト</span>}
              {lyrics.some(l => l.timestamp_ms != null) && <span className={styles.tagGreen}>タイムスタンプ</span>}
              {members.length > 0 && <span className={styles.tagPink}>👥 {members.length}</span>}
            </div>
            {song.description && (
              <p className={styles.description}>{song.description}</p>
            )}
            {members.length > 0 && (
              <div className={styles.memberList}>
                {members.map((m, i) => (
                  <span key={m.id} className={styles.memberBadge} style={{ borderColor: m.color, color: m.color }}>
                    {m.name || String.fromCharCode(65 + i)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 歌詞 */}
      <div className={styles.lyrics}>
        {blocks.map((block, bi) => (
          <div key={bi} className={styles.block}>
            {block.map((line, li) => (
              <div key={li} className={styles.line}>
                <span className={styles.timestamp}>
                  {line.timestamp_ms != null
                    ? `${String(Math.floor(line.timestamp_ms / 60000)).padStart(2, '0')}:${String(Math.floor((line.timestamp_ms % 60000) / 1000)).padStart(2, '0')}`
                    : ''}
                </span>
                {renderLineText(line)}
{(() => { const ids = line.word_members?.length ? [...new Set(line.word_members.flatMap(w => [...w.member_ids, ...harmonyIds(w, 'up'), ...harmonyIds(w, 'down')]))] : line.member_ids; return ids?.length > 0 ? (<span className={styles.lineBadges}>{ids.map(id => (<span key={id} className={styles.dot} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name || String.fromCharCode(65 + (memberMap[id]?.sort_order ?? 0))} />))}</span>) : null })()}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* フッター */}
      <div className={styles.footer}>
        {song.created_by_name && <span>✒️ {song.created_by_name}</span>}
        {song.updated_at && <span>🕒 {new Date(song.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>}
      </div>
    </div>
  )
}
