'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Loading from '@/components/Loading'
import styles from './page.module.css'

interface LyricLine {
  id: number
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: { text: string; member_id: number | null }[]
}
interface Member { id: number; name: string; color: string }

export default function PrompterView() {
  const { songId } = useParams<{ songId: string }>()
  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [currentBlock, setCurrentBlock] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => { setSong(s); setMembers(m); setLyrics(l) })
  }, [songId])

  const blocks = useMemo(() => {
    const map: LyricLine[][] = []
    for (const l of lyrics) {
      if (!map[l.block_index]) map[l.block_index] = []
      map[l.block_index].push(l)
    }
    return map.filter(Boolean)
  }, [lyrics])

  const memberMap = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members]
  )

  // --- 再生ループ（stateを直接使わずrefで管理）---
  const stateRef = useRef({ currentBlock: -1, isPlaying: false, blocks: [] as LyricLine[][], startTime: null as number | null })

  useEffect(() => {
    stateRef.current.blocks = blocks
  }, [blocks])

  useEffect(() => {
    stateRef.current.currentBlock = currentBlock
  }, [currentBlock])

  const stopLoop = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }

  const startLoop = (fromBlock: number, resetTime = false) => {
    stopLoop()
    const startFrom = Math.max(0, fromBlock)
    const bl = stateRef.current.blocks
    // 表紙から再生 or resetTime指定時は00:00基準
    const ts = (fromBlock < 0 || resetTime) ? 0 : (bl[startFrom]?.[0]?.timestamp_ms ?? 0)
    startTimeRef.current = Date.now() - ts
    stateRef.current.isPlaying = true
    stateRef.current.startTime = startTimeRef.current
    stateRef.current.currentBlock = startFrom
    setCurrentBlock(startFrom)

    const tick = () => {
      if (!stateRef.current.isPlaying) return
      const elapsed = Date.now() - (stateRef.current.startTime ?? 0)
      const bl2 = stateRef.current.blocks
      let next = 0
      for (let i = 0; i < bl2.length; i++) {
        const t = bl2[i]?.[0]?.timestamp_ms
        if (t != null && elapsed >= t) next = i
      }
      stateRef.current.currentBlock = next
      setCurrentBlock(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePlay = () => {
    setIsPlaying(true)
    startLoop(stateRef.current.currentBlock)
  }

  const handlePause = () => {
    stateRef.current.isPlaying = false
    setIsPlaying(false)
    stopLoop()
  }

  const handlePrev = () => {
    stateRef.current.isPlaying = false
    setIsPlaying(false)
    stopLoop()
    const next = Math.max(-1, stateRef.current.currentBlock - 1)
    stateRef.current.currentBlock = next
    setCurrentBlock(next)
  }

  const handleNext = () => {
    // 再生中は停止せず次のブロックに移動
    const next = Math.min(stateRef.current.blocks.length - 1, stateRef.current.currentBlock + 1)
    stateRef.current.currentBlock = next
    setCurrentBlock(next)
    // 再生中ならそのまま継続（停止しない）
  }

  // キーボード
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); handleNext() }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); handlePrev() }
      else if (e.key === ' ') { e.preventDefault(); stateRef.current.isPlaying ? handlePause() : handlePlay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function renderLine(line: LyricLine) {
    // word_membersがある場合は単語ごとに色分け
    if (line.word_members && line.word_members.length > 0) {
      return (
        <>
          {line.word_members.map((w, wi) => {
            const isSpace = w.text === ' ' || w.text === '　'
            if (isSpace) return <span key={wi} style={{ color: 'transparent' }}>{w.text}</span>
            const ids: number[] = (w as any).member_ids ?? ((w as any).member_id ? [(w as any).member_id] : [])
            if (ids.length === 0) return <span key={wi} style={{ color: '#fff' }}>{w.text}</span>
            if (ids.length === 1) return <span key={wi} style={{ color: memberMap[ids[0]]?.color || '#fff' }}>{w.text}</span>
            const stops = ids.map((id, i) => {
              const pct = 100 / ids.length
              const color = memberMap[id]?.color || '#fff'
              return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%`
            }).join(', ')
            return <span key={wi} style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{w.text}</span>
          })}
        </>
      )
    }
    const ids = line.member_ids || []
    if (ids.length === 0) return <span style={{ color: '#fff' }}>{line.text}</span>
    if (ids.length === 1) return <span style={{ color: memberMap[ids[0]]?.color || '#fff' }}>{line.text}</span>
    const stops = ids.map((id, i) => {
      const pct = 100 / ids.length
      const color = memberMap[id]?.color || '#fff'
      return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%`
    }).join(', ')
    return (
      <span style={{
        backgroundImage: `linear-gradient(to bottom, ${stops})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>{line.text}</span>
    )
  }

  if (!song) return <Loading label="プロンプター" />

  return (
    <>
      <div className={styles.rotatePrompt}>
        <div style={{ fontSize: '3rem' }}>&#x21BA;</div>
        <p style={{ fontSize: '1.1rem' }}>端末を横向きにしてください</p>
      </div>
      <div className={styles.container}>
      {/* 表紙：currentBlock === -1 */}
      {currentBlock === -1 ? (
        <div className={styles.cover}>
          <div className={styles.coverTitle}>{song.title}</div>
          {song.artist && <div className={styles.coverArtist}>{song.artist}</div>}
          <div className={styles.coverSeparator} />
          <div className={styles.coverMembers}>
            {members.map(m => (
              <div key={m.id} className={styles.coverMember}>
                <span className={styles.coverMemberDot} style={{ background: m.color }} />
                <span className={styles.coverMemberName} style={{ color: m.color }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.currentBlock}>
            {(blocks[currentBlock] || []).map(line => (
              <div key={line.id} className={styles.line}>{renderLine(line)}</div>
            ))}
          </div>
          <div className={styles.separator} />
          <div className={styles.nextBlock}>
            {(blocks[currentBlock + 1] || []).slice(0, 2).map(line => (
              <div key={line.id} className={styles.nextLine}>{renderLine(line)}</div>
            ))}
          </div>
        </>
      )}

      <div className={styles.controls}>
        <button className={styles.btn} onClick={handlePrev}>◀</button>
        <button className={styles.btn} onClick={isPlaying ? handlePause : handlePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className={styles.btn} onClick={handleNext}>▶▶</button>
      </div>
    </div>
    </>
  )
}
