'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import skStyles from '@/components/skeleton.module.css'
import styles from './page.module.css'
import { getCachedJson } from '@/lib/clientCache'
import { buildDisplayBlocks, type DisplayChunk } from '@/lib/prompterBlocks'
import { displayBlockAtPosition, prompterBpmRate } from '@/lib/prompterTimeline'
import { harmonyIds, harmonyBandStyle } from '@/lib/harmony'
import PrompterStage from '@/components/prompter/PrompterStage'
import { IconPrevSong, IconNextSong, IconPrev, IconNext, IconPause, IconFullscreen, IconPlay, IconSettings } from '@/components/icons'

const DISPLAY_SETTINGS_KEY = 'prompter_display_settings'
const FONT_SCALE_MIN = 0.6
const FONT_SCALE_MAX = 1.6
const FONT_SCALE_STEP = 0.01

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
// 表示用ブロック。自動分割で1つの歌詞ブロックが複数チャンクに分かれることがある
type DisplayBlock = DisplayChunk<LyricLine>

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
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [fullscreenSupported, setFullscreenSupported] = useState(true)
  const [playlistSongs, setPlaylistSongs] = useState<{id:number;title:string}[]>([])

  const [flashBtn, setFlashBtn] = useState<'prev' | 'next' | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = (btn: 'prev' | 'next') => {
    setFlashBtn(btn)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashBtn(null), 300)
  }
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fontScale, setFontScale] = useState(1)
  const [showNext, setShowNext] = useState(true)
  const [autoSplit, setAutoSplit] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY) || 'null')
      if (saved && typeof saved.fontScale === 'number') setFontScale(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, saved.fontScale)))
      if (saved && typeof saved.showNext === 'boolean') setShowNext(saved.showNext)
      if (saved && typeof saved.autoSplit === 'boolean') setAutoSplit(saved.autoSplit)
    } catch {}
  }, [])

  const persistDisplaySettings = (fs: number, sn: boolean, as: boolean) => {
    try { localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify({ fontScale: fs, showNext: sn, autoSplit: as })) } catch {}
  }
  const changeFontScale = (delta: number) => {
    setFontScale(prev => {
      const next = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, +(prev + delta).toFixed(2)))
      persistDisplaySettings(next, showNext, autoSplit)
      return next
    })
  }
  const setFontScaleValue = (value: number) => {
    const next = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, +value.toFixed(2)))
    setFontScale(next)
    persistDisplaySettings(next, showNext, autoSplit)
  }
  const toggleShowNext = () => {
    setShowNext(prev => {
      persistDisplaySettings(fontScale, !prev, autoSplit)
      return !prev
    })
  }
  const toggleAutoSplit = () => {
    setAutoSplit(prev => {
      persistDisplaySettings(fontScale, showNext, !prev)
      return !prev
    })
  }
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
    // iPhone Safariなどページの全画面表示APIに非対応のブラウザではボタン自体を出さない
    setFullscreenSupported(typeof document.documentElement.requestFullscreen === 'function')
    const update = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
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
      let alive = true
      Promise.all([
        getCachedJson(`/api/songs/${songId}`, s => { if (alive) setSong(s) }),
        getCachedJson(`/api/songs/${songId}/members`, m => { if (alive) setMembers(m) }),
        getCachedJson(`/api/songs/${songId}/lyrics`, l => { if (alive) setLyrics(l) }),
      ]).then(([s, m, l]) => {
        if (!alive) return
        setSong(s); setMembers(m); setLyrics(l)
      })
      if (playlistId) {
        fetch(`/api/playlists/${playlistId}`).then(r => r.json()).then(data => { if (alive) setPlaylistSongs(data.songs || []) })
      }
      return () => { alive = false }
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

  // 横画面スライド表示のレイアウト概算。page.module.css の
  // .container / .line / .nextLine のサイズ定義を数値でなぞっている。
  // 縦横どちらで見ていても「横画面にしたときの寸法」で計算するため、
  // 回転してもブロックの区切りとインデックスが変わらない。
  const layout = useMemo(() => {
    const W = Math.max(viewport.w, viewport.h)
    const H = Math.min(viewport.w, viewport.h)
    if (!W || !H) return null
    const rem = 16
    const clampCalc = (min: number, val: number, max: number) => Math.min(Math.max(min, val), max)
    const small = W <= 768
    const lineFont = (small ? clampCalc(rem, 0.03 * W, 2 * rem) : clampCalc(2 * rem, 0.06 * W, 6 * rem)) * fontScale
    const nextFont = (small ? clampCalc(0.75 * rem, 0.022 * W, 1.4 * rem) : clampCalc(1.5 * rem, 0.045 * W, 4 * rem)) * fontScale
    // 視覚1行分: line-height 1.3 + margin-bottom 0.3em = 1.6em
    const lineHeight = lineFont * 1.6
    // flexbox gap: 行間のみ（最後の行には入らない）
    const gap = 0.4 * rem
    const padTop = 0.03 * W
    // 次セクションプレビュー（fixed bottom 5rem ＋ CSSで2行分にクリップした高さ）または操作ボタン分の余白
    const nextArea = showNext
      ? 5 * rem + nextFont * 2.6 + 1.25 * rem
      : 5.5 * rem
    const available = H - padTop - nextArea
    // N行のとき高さ = N * lineHeight + (N-1) * gap
    // available + gap >= N * (lineHeight + gap) を解く
    return {
      maxRows: Math.max(1, Math.floor((available + gap) / (lineHeight + gap))),
      lineFont,
      contentW: W * 0.92, // padding 左右 4vw ずつ
    }
  }, [viewport, fontScale, showNext])

  // 自動ブロック分け：画面に収まらないブロックだけを均等なチャンクに分割する。
  // パート分けの元ブロック境界は必ずページ境界になる（詳細は lib/prompterBlocks.ts）。
  const displayBlocks = useMemo<DisplayBlock[]>(
    () => buildDisplayBlocks(blocks, layout, autoSplit),
    [blocks, layout, autoSplit]
  )

  // 分割数が変わって現在位置が範囲外になったら末尾に丸める
  useEffect(() => {
    if (displayBlocks.length > 0 && currentBlock >= displayBlocks.length) {
      setCurrentBlock(displayBlocks.length - 1)
    }
  }, [displayBlocks.length, currentBlock])

  const bpmRate = useMemo(
    () => prompterBpmRate(song?.original_bpm, song?.playback_bpm),
    [song]
  )

  const playlistRef = useRef({ playlistSongs: [] as {id:number;title:string}[], playlistIndex: -1, playlistTotal: 0, playlistId: null as string|null })
  useEffect(() => {
    playlistRef.current = { playlistSongs, playlistIndex, playlistTotal, playlistId }
  }, [playlistSongs, playlistIndex, playlistTotal, playlistId])

  const stateRef = useRef({ currentBlock: -1, isPlaying: false, blocks: [] as DisplayBlock[], startTime: null as number | null, bpmRate: 1 })
  useEffect(() => { stateRef.current.blocks = displayBlocks }, [displayBlocks])
  useEffect(() => { stateRef.current.currentBlock = currentBlock }, [currentBlock])
  useEffect(() => { stateRef.current.bpmRate = bpmRate }, [bpmRate])

  const stopLoop = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }

  const startLoop = (fromBlock: number, resumeElapsed?: number) => {
    stopLoop()
    const startFrom = fromBlock
    const bl = stateRef.current.blocks
    const rate = stateRef.current.bpmRate
    const rawTs = bl[Math.max(0, fromBlock)]?.startMs ?? 0
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
      const firstTs = (bl2[0]?.startMs ?? 0) * r
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
      const next = displayBlockAtPosition(bl2, elapsed, 0, r)
      stateRef.current.currentBlock = next
      setCurrentBlock(next)
      const curTs = (bl2[next]?.startMs ?? 0) * r
      const nextTs = bl2[next + 1]?.startMs
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
      } else if (e.key === ' ') {
        e.preventDefault()
        if (stateRef.current.isPlaying) handlePause()
        else handlePlay()
      }
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
            const band = harmonyBandStyle(
              harmonyIds(w as any, 'up').map(id => memberMap[id]?.color || '#888'),
              harmonyIds(w as any, 'down').map(id => memberMap[id]?.color || '#888'),
              '0.07em'
            )
            const wrapHarmony = (node: React.ReactNode) => band ? <span style={band}>{node}</span> : node
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
      <div className={styles.container} style={{ background: song?.bg_color || '#000', '--fontScale': fontScale } as React.CSSProperties} onClick={isMobile && !isPortrait ? handleTap : undefined}>
        <PrompterStage
          title={song.title}
          artist={song.artist}
          coverText={song.cover_text}
          members={members.map(member => ({
            id: member.id,
            name: member.name,
            color: member.color,
            sortOrder: member.sort_order,
          }))}
          displayBlocks={displayBlocks}
          currentBlock={currentBlock}
          isPortrait={isPortrait}
          showNext={showNext}
          renderLine={renderLine}
          lineKey={line => line.id}
          onSelectBlock={blockIndex => {
            if (isPlaying) startLoop(blockIndex)
            else setCurrentBlock(blockIndex)
          }}
        />

        {settingsOpen && (
          <div className={`${styles.settingsPanel} ${isPortrait ? (fullscreenSupported ? styles.settingsPanelPortrait : styles.settingsPanelPortraitSingle) : ''}`} onClick={e => e.stopPropagation()}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>文字サイズ</span>
              <div className={styles.fontSizeControls}>
                <button className={styles.fontBtn} onClick={() => changeFontScale(-FONT_SCALE_STEP)} disabled={fontScale <= FONT_SCALE_MIN} aria-label="文字を小さく">A−</button>
                <span className={styles.fontValue}>{Math.round(fontScale * 100)}%</span>
                <button className={styles.fontBtn} onClick={() => changeFontScale(FONT_SCALE_STEP)} disabled={fontScale >= FONT_SCALE_MAX} aria-label="文字を大きく">A＋</button>
              </div>
            </div>
            <input
              type="range"
              className={styles.fontSlider}
              min={Math.round(FONT_SCALE_MIN * 100)}
              max={Math.round(FONT_SCALE_MAX * 100)}
              step={1}
              value={Math.round(fontScale * 100)}
              onChange={e => setFontScaleValue(Number(e.target.value) / 100)}
              aria-label="文字サイズ"
            />
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>次のセクションを表示</span>
              <button
                role="switch"
                aria-checked={showNext}
                className={`${styles.switch} ${showNext ? styles.switchOn : ''}`}
                onClick={toggleShowNext}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>自動ブロック分け</span>
              <button
                role="switch"
                aria-checked={autoSplit}
                className={`${styles.switch} ${autoSplit ? styles.switchOn : ''}`}
                onClick={toggleAutoSplit}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
          </div>
        )}

        <div className={`${styles.controls} ${controlsVisible || settingsOpen ? '' : styles.controlsHidden}`} onClick={e => e.stopPropagation()}>
          {playlistId && (
            <button className={styles.btn} disabled={playlistIndex <= 0} style={{ opacity: playlistIndex <= 0 ? 0.3 : 1 }} onClick={handlePrevSong} title="前の曲 (Shift+←)"><IconPrevSong /></button>
          )}
          <button className={`${styles.btn} ${flashBtn === 'prev' ? styles.btnFlash : ''}`} onClick={() => { handlePrev(); flash('prev') }} disabled={currentBlock <= -1} style={{ opacity: currentBlock <= -1 ? 0.3 : 1 }}><IconPrev /></button>
          {hasTimestamp && (
            <button className={`${styles.btn} ${styles.btnAuto}`} onClick={isPlaying ? handlePause : handlePlay}>
              <span id="auto-progress-bar" className={styles.autoProgress} />
              <span className={styles.autoLabel}>{isPlaying ? <IconPause /> : <IconPlay />}</span>
            </button>
          )}
          <button className={`${styles.btn} ${flashBtn === 'next' ? styles.btnFlash : ''}`} onClick={() => { handleNext(); flash('next') }} disabled={currentBlock >= displayBlocks.length - 1} style={{ opacity: currentBlock >= displayBlocks.length - 1 ? 0.3 : 1 }}><IconNext /></button>
          {playlistId && (
            <button className={styles.btn} disabled={playlistIndex >= playlistTotal - 1} style={{ opacity: playlistIndex >= playlistTotal - 1 ? 0.3 : 1 }} onClick={handleNextSong} title="次の曲 (Shift+→)"><IconNextSong /></button>
          )}
          {!isPortrait && (
            <>
              <button className={`${styles.btn} ${settingsOpen ? styles.btnActive : ''}`} onClick={() => setSettingsOpen(v => !v)} title="表示設定" aria-label="表示設定"><IconSettings /></button>
              {fullscreenSupported && <button className={styles.btn} onClick={e => { e.stopPropagation(); if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.() }}><IconFullscreen /></button>}
            </>
          )}
        </div>

        {/* 縦画面：設定・全画面ボタンは右下に縦積みで配置（設定が全画面の真上）。
            全画面API非対応ブラウザでは全画面ボタンを出さず設定を詰める */}
        {isPortrait && (
          <div className={`${styles.cornerControls} ${controlsVisible || settingsOpen ? '' : styles.controlsHidden}`} onClick={e => e.stopPropagation()}>
            <button className={`${styles.btn} ${settingsOpen ? styles.btnActive : ''}`} onClick={() => setSettingsOpen(v => !v)} title="表示設定" aria-label="表示設定"><IconSettings /></button>
            {fullscreenSupported && <button className={styles.btn} onClick={e => { e.stopPropagation(); if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.() }} title="全画面表示" aria-label="全画面表示"><IconFullscreen /></button>}
          </div>
        )}
      </div>
    </>
  )
}
