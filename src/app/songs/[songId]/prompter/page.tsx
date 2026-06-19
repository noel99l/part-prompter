'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import skStyles from '@/components/skeleton.module.css'
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
interface Member { id: number; name: string; color: string; sort_order?: number }

export default function PrompterView() {
  const { songId } = useParams<{ songId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const playlistId = searchParams.get('playlist')
  const playlistIndex = parseInt(searchParams.get('index') ?? '-1')
  const playlistTotal = parseInt(searchParams.get('total') ?? '0')
  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [currentBlock, setCurrentBlock] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const progressRef = useRef(0)
  const pausedElapsedRef = useRef<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [playlistSongs, setPlaylistSongs] = useState<{id:number;title:string}[]>([])
  const blockRefs = useRef<(HTMLDivElement | null)[]>([])

  const [flashBtn, setFlashBtn] = useState<'prev' | 'next' | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = (btn: 'prev' | 'next') => {
    setFlashBtn(btn)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashBtn(null), 300)
  }
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => {
    showControls()
    window.addEventListener('mousemove', showControls)
    window.addEventListener('touchstart', showControls)
    window.addEventListener('keydown', showControls)
    return () => {
      window.removeEventListener('mousemove', showControls)
      window.removeEventListener('touchstart', showControls)
      window.removeEventListener('keydown', showControls)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showControls])

  useEffect(() => {
    setIsMobile(/iphone|ipad|ipod|android/i.test(navigator.userAgent))
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const cached = playlistId
      ? (() => { try { return JSON.parse(sessionStorage.getItem(`playlist_cache_${playlistId}`) || 'null') } catch { return null } })()
      : null
    const cachedSong = cached?.[songId]

    if (cachedSong) {
      setSong(cachedSong.song)
      setMembers(cachedSong.members || [])
      setLyrics(cachedSong.lyrics || [])
      // playlistSongsもキャッシュから復元
      const allSongs = Object.values(cached).map((v: any) => v.song)
      allSongs.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setPlaylistSongs(allSongs)
    } else {
      Promise.all([
        fetch(`/api/songs/${songId}`).then(r => r.json()),
        fetch(`/api/songs/${songId}/members`).then(r => r.json()),
        fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
      ]).then(([s, m, l]) => { setSong(s); setMembers(m); setLyrics(l) })
      if (playlistId) {
        fetch(`/api/playlists/${playlistId}`).then(r => r.json()).then(data => setPlaylistSongs(data.songs || []))
      }
    }
  }, [songId, playlistId])

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

  const hasTimestamp = useMemo(() => lyrics.some(l => l.timestamp_ms != null), [lyrics])

  const bpmRate = useMemo(() => {
    const orig = song?.original_bpm
    const play = song?.playback_bpm
    if (orig && play && orig > 0) return orig / play
    return 1
  }, [song])

  const playlistRef = useRef({ playlistSongs: [] as {id:number;title:string}[], playlistIndex: -1, playlistTotal: 0, playlistId: null as string|null })
  useEffect(() => {
    playlistRef.current = { playlistSongs, playlistIndex, playlistTotal, playlistId }
  }, [playlistSongs, playlistIndex, playlistTotal, playlistId])

  const stateRef = useRef({ currentBlock: -1, isPlaying: false, blocks: [] as LyricLine[][], startTime: null as number | null, bpmRate: 1 })
  useEffect(() => { stateRef.current.blocks = blocks }, [blocks])
  useEffect(() => { stateRef.current.currentBlock = currentBlock }, [currentBlock])
  useEffect(() => { stateRef.current.bpmRate = bpmRate }, [bpmRate])

  useEffect(() => {
    if (!isPortrait || currentBlock < 0) return
    blockRefs.current[currentBlock]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentBlock, isPortrait])

  const stopLoop = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }

  const startLoop = (fromBlock: number, resumeElapsed?: number) => {
    stopLoop()
    const startFrom = fromBlock
    const bl = stateRef.current.blocks
    const rate = stateRef.current.bpmRate
    const rawTs = bl[Math.max(0, fromBlock)]?.[0]?.timestamp_ms ?? 0
    const ts = resumeElapsed != null ? resumeElapsed
      : fromBlock < 0 ? 0
      : rawTs * rate
    startTimeRef.current = Date.now() - ts
    stateRef.current.isPlaying = true
    stateRef.current.startTime = startTimeRef.current
    stateRef.current.currentBlock = startFrom
    if (startFrom >= 0) setCurrentBlock(startFrom)
    const tick = () => {
      if (!stateRef.current.isPlaying) return
      const elapsed = Date.now() - (stateRef.current.startTime ?? 0)
      const bl2 = stateRef.current.blocks
      const r = stateRef.current.bpmRate
      const firstTs = (bl2[0]?.[0]?.timestamp_ms ?? 0) * r
      if (elapsed < firstTs) {
        const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
        if (firstTs > 0) {
          const progress = Math.max(0, Math.min(1, elapsed / firstTs))
          progressRef.current = progress
          if (el) { el.style.width = `${progress * 100}%`; el.style.opacity = '1' }; if (gel) { gel.style.width = `${progress * 100}%`; gel.style.opacity = '1' }
        }
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      let next = 0
      for (let i = 0; i < bl2.length; i++) {
        const t = bl2[i]?.[0]?.timestamp_ms
        if (t != null && elapsed >= t * r) next = i
      }
      stateRef.current.currentBlock = next
      setCurrentBlock(next)
      const curTs = (bl2[next]?.[0]?.timestamp_ms ?? 0) * r
      const nextTs = bl2[next + 1]?.[0]?.timestamp_ms
      const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
      if (nextTs != null && nextTs * r > curTs) {
        const progress = Math.max(0, Math.min(1, (elapsed - curTs) / (nextTs * r - curTs)))
        progressRef.current = progress
        if (el) { el.style.width = `${progress * 100}%`; el.style.opacity = '1' }; if (gel) { gel.style.width = `${progress * 100}%`; gel.style.opacity = '1' }
      } else {
        progressRef.current = 0
        if (el) { el.style.width = '0%'; el.style.opacity = '0' }; if (gel) { gel.style.width = '0%'; gel.style.opacity = '0' }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePlay = () => {
    setIsPlaying(true)
    const elapsed = pausedElapsedRef.current
    pausedElapsedRef.current = null
    startLoop(stateRef.current.currentBlock, elapsed ?? undefined)
  }
  const handlePause = () => {
    pausedElapsedRef.current = Date.now() - (stateRef.current.startTime ?? 0)
    stateRef.current.isPlaying = false; setIsPlaying(false); stopLoop()
  }
  const handlePrev = () => {
    const next = Math.max(-1, stateRef.current.currentBlock - 1)
    stateRef.current.currentBlock = next; setCurrentBlock(next)
    if (stateRef.current.isPlaying) startLoop(next)
    else {
      pausedElapsedRef.current = null
      const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
      if (el) { el.style.width = '0%'; el.style.opacity = '0' }; if (gel) { gel.style.width = '0%'; gel.style.opacity = '0' }
    }
  }
  const handleNext = () => {
    const next = Math.min(stateRef.current.blocks.length - 1, stateRef.current.currentBlock + 1)
    stateRef.current.currentBlock = next
    setCurrentBlock(next)
    if (stateRef.current.isPlaying) startLoop(next)
    else {
      pausedElapsedRef.current = null
      const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
      if (el) { el.style.width = '0%'; el.style.opacity = '0' }; if (gel) { gel.style.width = '0%'; gel.style.opacity = '0' }
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey && playlistId) handleNextSong()
        else { handleNext(); flash('next') }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey && playlistId) handlePrevSong()
        else { handlePrev(); flash('prev') }
      } else if (e.key === ' ') { e.preventDefault(); stateRef.current.isPlaying ? handlePause() : handlePlay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePrevSong = () => {
    const { playlistSongs: ps, playlistId: pid, playlistTotal: pt } = playlistRef.current
    if (!pid || ps.length === 0) return
    const currentIdx = ps.findIndex((s: any) => String(s.id) === String(songId))
    if (currentIdx <= 0) return
    const prev = ps[currentIdx - 1]
    if (!prev) return
    stopLoop()
    stateRef.current.isPlaying = false
    setIsPlaying(false)
    progressRef.current = 0
    pausedElapsedRef.current = null
    const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
    if (el) { el.style.width = '0%'; el.style.opacity = '0' }; if (gel) { gel.style.width = '0%'; gel.style.opacity = '0' }
    router.push(`/songs/${prev.id}/prompter?playlist=${pid}&index=${currentIdx - 1}&total=${pt}`)
  }

  const handleNextSong = () => {
    const { playlistSongs: ps, playlistId: pid, playlistTotal: pt } = playlistRef.current
    if (!pid || ps.length === 0) return
    const currentIdx = ps.findIndex((s: any) => String(s.id) === String(songId))
    if (currentIdx < 0 || currentIdx >= ps.length - 1) return
    const next = ps[currentIdx + 1]
    if (!next) return
    stopLoop()
    stateRef.current.isPlaying = false
    setIsPlaying(false)
    progressRef.current = 0
    pausedElapsedRef.current = null
    const el = document.getElementById('auto-progress-bar'); const gel = document.getElementById('global-progress-bar')
    if (el) { el.style.width = '0%'; el.style.opacity = '0' }; if (gel) { gel.style.width = '0%'; gel.style.opacity = '0' }
    router.push(`/songs/${next.id}/prompter?playlist=${pid}&index=${currentIdx + 1}&total=${pt}`)
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const x = e.clientX
    const w = window.innerWidth
    if (x < w / 2) handlePrev()
    else handleNext()
  }

  function renderLine(line: LyricLine) {
    if (line.word_members && line.word_members.length > 0) {
      return (
        <>
          {line.word_members.map((w, wi) => {
            const isSpace = w.text === ' ' || w.text === '　'
            if (isSpace) return <span key={wi} className={styles.textTransparent}>{w.text}</span>
            const ids: number[] = (w as any).member_ids ?? ((w as any).member_id ? [(w as any).member_id] : [])
            const upId = (w as any).harmony_up_id as number | undefined
            const downId = (w as any).harmony_down_id as number | undefined
            const wrapHarmony = (node: React.ReactNode) => {
              let result = node
              if (downId) result = <span style={{ textDecoration: `underline 5px ${memberMap[downId]?.color || '#888'}`, textDecorationSkipInk: 'none' }}>{result}</span>
              if (upId) result = <span style={{ textDecoration: `overline 5px ${memberMap[upId]?.color || '#888'}`, textDecorationSkipInk: 'none' }}>{result}</span>
              return result
            }
            if (ids.length === 0) return <span key={wi} className={styles.textWhite}>{wrapHarmony(w.text)}</span>
            if (ids.length === 1) return <span key={wi} style={{ color: memberMap[ids[0]]?.color || '#fff' }}>{wrapHarmony(w.text)}</span>
            const stops = ids.map((id, i) => { const pct = 100 / ids.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%` }).join(', ')
            return <span key={wi} style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{wrapHarmony(w.text)}</span>
          })}
        </>
      )
    }
    const ids = line.member_ids || []
    if (ids.length === 0) return <span className={styles.textWhite}>{line.text}</span>
    if (ids.length === 1) return <span style={{ color: memberMap[ids[0]]?.color || '#fff' }}>{line.text}</span>
    const stops = ids.map((id, i) => { const pct = 100 / ids.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%` }).join(', ')
    return <span style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{line.text}</span>
  }

  if (!song) return (
    <div className={styles.skeletonWrap}>
      <div className={skStyles.sk} style={{ width: '60%', height: 'clamp(2.5rem, 6vw, 5rem)', borderRadius: 8 }} />
      <div className={skStyles.sk} style={{ width: '35%', height: 'clamp(1.2rem, 3vw, 2rem)', borderRadius: 6 }} />
      <div className={skStyles.sk} style={{ width: '100%', height: 4, borderRadius: 2, margin: '0.5rem 0' }} />
      <div className={styles.skMemberRow}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.skMemberItem}>
            <div className={skStyles.sk} style={{ width: 18, height: 18, borderRadius: 4 }} />
            <div className={skStyles.sk} style={{ width: 80, height: 'clamp(1.2rem, 2.5vw, 1.8rem)', borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <span id="global-progress-bar" className={styles.globalProgress} style={{ display: song?.show_progress_bar === false ? 'none' : 'block' }} />
      <div className={styles.rotatePrompt}>
        <div className={styles.rotateIcon}>↺</div>
        <p className={styles.rotateText}>端末を横向きにしてください</p>
      </div>
      <div className={styles.container} style={{ background: song?.bg_color || '#000' }} onClick={isMobile && !isPortrait ? handleTap : undefined}>
        {isPortrait ? (
          // 縦表示：全ブロックをスクロール表示
          <div className={styles.scrollView}>
            <div className={styles.scrollCover}>
              <div className={styles.coverTitle}>{song.title}</div>
              {song.artist && <div className={styles.coverArtist}>{song.artist}</div>}
              {song.cover_text && <div className={styles.coverText}>{song.cover_text}</div>}
              {members.length > 0 && (
                <div className={styles.coverMembers}>
                  {members.map((m, i) => (
                    <div key={m.id} className={styles.coverMember}>
                      <span className={styles.coverMemberDot} style={{ background: m.color }} />
                      <span className={styles.coverMemberName} style={{ color: m.color }}>{m.name || String.fromCharCode(65 + (m.sort_order ?? i))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {blocks.map((block, bi) => (
              <div
                key={bi}
                ref={el => { blockRefs.current[bi] = el }}
                className={`${styles.scrollBlock} ${bi === currentBlock ? styles.scrollBlockActive : ''}`}
                onClick={() => {
                  if (isPlaying) {
                    startLoop(bi)
                  } else {
                    setCurrentBlock(bi)
                  }
                }}
              >
                {block.map(line => (
                  <div key={line.id} className={styles.scrollLine}>{renderLine(line)}</div>
                ))}
              </div>
            ))}
            <div className={styles.scrollEnd}>― End ―</div>
            <div className={styles.scrollSpacer} />
          </div>
        ) : (
          // 横表示：スライド表示
          currentBlock === -1 ? (
            <>
              <div className={styles.cover}>
                <div className={styles.coverTitle}>{song.title}</div>
                {song.artist && <div className={styles.coverArtist}>{song.artist}</div>}
                {song.cover_text && <div className={styles.coverText}>{song.cover_text}</div>}
                <div className={styles.coverSeparator} />
                <div className={styles.coverMembers}>
                  {members.map((m, i) => (
                    <div key={m.id} className={styles.coverMember}>
                      <span className={styles.coverMemberDot} style={{ background: m.color }} />
                      <span className={styles.coverMemberName} style={{ color: m.color }}>{m.name || String.fromCharCode(65 + (m.sort_order ?? i))}</span>
                    </div>
                  ))}
                </div>
              </div>
              {blocks[0] && (
                <div className={styles.nextBlock}>
                  {blocks[0].slice(0, 2).map(line => (
                    <div key={line.id} className={styles.nextLine}>{renderLine(line)}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.currentBlock}>
                {(blocks[currentBlock] || []).map(line => (
                  <div key={line.id} className={styles.line}>{renderLine(line)}</div>
                ))}
              </div>
              {currentBlock === blocks.length - 1 ? (
                <div className={styles.nextBlock} style={{ opacity: 0.4, fontStyle: 'italic' }}>
                  <div className={styles.nextLine}>― End ―</div>
                </div>
              ) : (
                <div className={styles.nextBlock}>
                  {(blocks[currentBlock + 1] || []).slice(0, 2).map(line => (
                    <div key={line.id} className={styles.nextLine}>{renderLine(line)}</div>
                  ))}
                </div>
              )}
            </>
          )
        )}

        <div className={`${styles.controls} ${controlsVisible ? '' : styles.controlsHidden}`} onClick={e => e.stopPropagation()}>
          {playlistId && (
            <button className={styles.btn} disabled={playlistIndex <= 0} style={{ opacity: playlistIndex <= 0 ? 0.3 : 1 }} onClick={handlePrevSong} title="前の曲 (Shift+←)">⏮</button>
          )}
          <button className={`${styles.btn} ${flashBtn === 'prev' ? styles.btnFlash : ''}`} onClick={() => { handlePrev(); flash('prev') }} disabled={currentBlock <= -1} style={{ opacity: currentBlock <= -1 ? 0.3 : 1 }}>◀</button>
          {hasTimestamp && (
            <button className={`${styles.btn} ${styles.btnAuto}`} onClick={isPlaying ? handlePause : handlePlay}>
              <span id="auto-progress-bar" className={styles.autoProgress} />
              <span className={styles.autoLabel}>{isPlaying ? '⏸' : 'Auto'}</span>
            </button>
          )}
          <button className={`${styles.btn} ${flashBtn === 'next' ? styles.btnFlash : ''}`} onClick={() => { handleNext(); flash('next') }} disabled={currentBlock >= blocks.length - 1} style={{ opacity: currentBlock >= blocks.length - 1 ? 0.3 : 1 }}>▶</button>
          {playlistId && (
            <button className={styles.btn} disabled={playlistIndex >= playlistTotal - 1} style={{ opacity: playlistIndex >= playlistTotal - 1 ? 0.3 : 1 }} onClick={handleNextSong} title="次の曲 (Shift+→)">⏭</button>
          )}
          {!isPortrait && <button className={styles.btn} onClick={e => { e.stopPropagation(); if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.() }}>⛶</button>}
        </div>
      </div>
    </>
  )
}
