'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Loading from '@/components/Loading'
import skStyles from '@/components/skeleton.module.css'
import styles from './page.module.css'

interface Member { id: number; name: string; color: string; sort_order: number }
interface LyricLine {
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: { text: string; member_ids: number[] }[]
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => {
      setSong(s); setMembers(m); setLyrics(l); setLoading(false)
    })
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

  function lineColor(memberIds: number[]): React.CSSProperties {
    if (!memberIds?.length) return { color: '#fff' }
    if (memberIds.length === 1) return { color: memberMap[memberIds[0]]?.color || '#fff' }
    const stops = memberIds.map((id, i) => {
      const pct = 100 / memberIds.length
      const color = memberMap[id]?.color || '#fff'
      return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%`
    }).join(', ')
    return { backgroundImage: `linear-gradient(to right, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
  }

  function renderLineText(line: LyricLine) {
    if (line.word_members?.length) {
      return (
        <span>
          {line.word_members.map((w, wi) => {
            if (!w.member_ids?.length) return <span key={wi} style={{ color: '#fff' }}>{w.text}</span>
            return <span key={wi} style={lineColor(w.member_ids)}>{w.text}</span>
          })}
        </span>
      )
    }
    return <span style={lineColor(line.member_ids)}>{line.text}</span>
  }

  const buildCopyText = (): string => {
    const getLabel = (ids: number[]) => {
      if (!ids?.length) return '全員'
      if (ids.length === members.length && members.length > 0) return '全員'
      return ids.map(id => memberMap[id]?.name || String.fromCharCode(65 + (memberMap[id]?.sort_order ?? 0))).join('')
    }
    const lines = [...lyrics].sort((a, b) => a.block_index - b.block_index || a.line_index - b.line_index)
    const result: string[] = []
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
    if (data.id) router.push(`/admin/${data.id}`)
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {[...Array(3)].map((_, i) => <div key={i} className={skStyles.sk} style={{ width: 56, height: 24, borderRadius: 20 }} />)}
        </div>
      </div>
      <div className={styles.lyrics}>
        {[...Array(4)].map((_, bi) => (
          <div key={bi} className={styles.block}>
            {[...Array(3)].map((_, li) => (
              <div key={li} className={skStyles.sk} style={{ width: `${70 + Math.random() * 25}%`, height: 16, borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>{song.title}</h1>
            {song.artist && <p className={styles.artist}>{song.artist}</p>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/prompter/${songId}`} className={styles.prompterBtn}>▶ プロンプター</Link>
          <div className={styles.menuWrapper} ref={menuRef}>
            <button className={styles.menuBtn} onClick={() => setMenuOpen(v => !v)}>⋯</button>
            {menuOpen && (
              <div className={styles.menuDropdown}>
                <button className={styles.menuItem} onClick={() => { handleCopy(); setMenuOpen(false) }}>
                  {copied ? '✓ コピー済み' : '📋 歌詞分けをコピー'}
                </button>
                {session && (
                  <button className={styles.menuItem} onClick={() => { setMenuOpen(false); handleDuplicate() }} disabled={duplicating}>
                    {duplicating ? '複製中...' : '📋 複製して編集'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 作者・メンバー */}
      <div className={styles.infoSection}>
        {song.created_by_name && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>作者</span>
            <span className={styles.infoValue}>{song.created_by_name}</span>
          </div>
        )}
        {members.length > 0 && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>パート</span>
            <div className={styles.memberList}>
              {members.map(m => (
                <span key={m.id} className={styles.memberBadge} style={{ borderColor: m.color, color: m.color }}>
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}
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
                {line.member_ids?.length > 0 && line.word_members?.length === 0 && (
                  <span className={styles.lineBadges}>
                    {line.member_ids.map(id => (
                      <span key={id} className={styles.dot} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
