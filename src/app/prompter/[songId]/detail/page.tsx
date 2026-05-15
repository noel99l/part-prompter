'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
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
  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <Loading label="楽曲詳細" />

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/prompter" className={styles.backLink}>← 一覧</Link>
        <div className={styles.headerCenter}>
          <h1 className={styles.title}>{song.title}</h1>
          {song.artist && <p className={styles.artist}>{song.artist}</p>}
        </div>
        <div className={styles.headerActions}>
          <Link href={`/prompter/${songId}`} className={styles.prompterBtn}>▶ プロンプター</Link>
          <Link href={`/admin/${songId}`} className={styles.editBtn}>✏️ 編集</Link>
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
