'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Loading from '@/components/Loading'
import { IconPrevSong, IconNextSong, IconPrev, IconNext, IconFullscreen } from '@/components/icons'
import { getCachedJson } from '@/lib/clientCache'
import { buildDisplayBlocks, type PromptLine } from '@/lib/prompterBlocks'
import styles from './page.module.css'

interface PlaylistItem {
  item_id: number
  item_type: 'song' | 'mc'
  mc_title: string | null
  mc_body: string | null
  id: number | null; title: string | null
}

export default function McSlidePage() {
  const { id, itemId } = useParams<{ id: string; itemId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  // セットリスト一覧のどちらの画面から来たかで曲プロンプターの遷移先を切り替える
  const from = searchParams.get('from') === 'prompter' ? 'prompter' : 'songs'
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [fullscreenSupported, setFullscreenSupported] = useState(true)

  useEffect(() => {
    let alive = true
    getCachedJson(`/api/playlists/${id}`, data => { if (alive) setItems(data.items || []) })
      .then(data => {
        if (!alive) return
        setItems(data.items || [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    // iPhone Safariなどページの全画面表示APIに非対応のブラウザではボタン自体を出さない
    setFullscreenSupported(typeof document.documentElement.requestFullscreen === 'function')
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const { current, prevSongUrl, nextSongUrl } = useMemo(() => {
    const songTotal = items.filter(it => it.item_type === 'song').length
    const idx = items.findIndex(it => String(it.item_id) === String(itemId))
    const songUrlFor = (target: PlaylistItem, targetIdx: number): string => {
      const songIndex = items.slice(0, targetIdx).filter(it => it.item_type === 'song').length
      const query = `playlist=${id}&index=${songIndex}&total=${songTotal}`
      return from === 'prompter'
        ? `/prompter/${target.id}?${query}`
        : `/songs/${target.id}/prompter?${query}`
    }

    let prevSongIdx = -1
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (items[i].item_type === 'song') { prevSongIdx = i; break }
    }
    let nextSongIdx = -1
    for (let i = idx + 1; i < items.length; i += 1) {
      if (items[i].item_type === 'song') { nextSongIdx = i; break }
    }

    return {
      current: idx >= 0 ? items[idx] : null,
      prevSongUrl: prevSongIdx >= 0 ? songUrlFor(items[prevSongIdx], prevSongIdx) : null,
      nextSongUrl: nextSongIdx >= 0 ? songUrlFor(items[nextSongIdx], nextSongIdx) : null,
    }
  }, [items, itemId, id, from])

  // MC本文を空行区切りの段落ブロックへ分解する。段落境界は必ずページ境界になる
  const bodyBlocks = useMemo(() => {
    const body = current?.mc_body ?? ''
    const blocks: PromptLine[][] = []
    let cur: PromptLine[] = []
    for (const raw of body.split('\n')) {
      const text = raw.trimEnd()
      if (text.trim() === '') {
        if (cur.length > 0) { blocks.push(cur); cur = [] }
      } else {
        cur.push({ text, timestamp_ms: null })
      }
    }
    if (cur.length > 0) blocks.push(cur)
    return blocks
  }, [current?.mc_body])

  // page.module.css の .badge / .title / .body のサイズ定義を数値でなぞった概算レイアウト
  const layout = useMemo(() => {
    const { w, h } = viewport
    if (!w || !h) return null
    const rem = 16
    const vmin = Math.min(w, h)
    const clampCalc = (min: number, val: number, max: number) => Math.min(Math.max(min, val), max)
    const bodyFont = clampCalc(1.5 * rem, 0.06 * vmin, 3.8 * rem)
    const titleFont = clampCalc(2 * rem, 0.07 * vmin, 4.5 * rem)
    const badgeFont = clampCalc(1 * rem, 0.03 * vmin, 1.6 * rem)
    const overhead =
      4 * rem                                                    // container 上下 padding
      + badgeFont + rem                                          // バッジ + margin-bottom
      + (current?.mc_title ? titleFont * 1.4 + 1.5 * rem : 0)    // タイトル + margin-bottom
      + 5 * rem                                                  // 下部の操作ボタン・ページ表示の領域
    // .body は max-height: 60vh なので、その中に収まる行数で切る
    const available = Math.min(h - overhead, 0.6 * h)
    return {
      maxRows: Math.max(1, Math.floor(available / (bodyFont * 1.7))),
      lineFont: bodyFont,
      contentW: w * 0.9, // .body の max-width 90vw
    }
  }, [viewport, current?.mc_title])

  const pages = useMemo(() => buildDisplayBlocks(bodyBlocks, layout, true), [bodyBlocks, layout])

  // アイテムが変わったら1ページ目へ。リサイズでページ数が減ったら末尾へ丸める
  useEffect(() => { setPage(0) }, [itemId])
  useEffect(() => {
    if (pages.length > 0 && page >= pages.length) setPage(pages.length - 1)
  }, [pages.length, page])

  const hasPrevPage = page > 0
  const hasNextPage = page < pages.length - 1
  const goPrevPage = () => {
    if (hasPrevPage) setPage(p => p - 1)
  }
  const goNextPage = () => {
    if (hasNextPage) setPage(p => p + 1)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) {
          if (nextSongUrl) router.push(nextSongUrl)
        } else {
          goNextPage()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) {
          if (prevSongUrl) router.push(prevSongUrl)
        } else {
          goPrevPage()
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        goNextPage()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        goPrevPage()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (loading) return <Loading label="MCスライド" />

  if (!current || current.item_type !== 'mc') return (
    <div className={styles.container}>
      <p style={{ color: '#888' }}>スライドが見つかりません</p>
    </div>
  )

  const currentLines = pages[page]?.lines ?? []

  return (
    <div className={styles.container}>
      <div className={styles.badge}>🎤 MC</div>
      {current.mc_title && <h1 className={styles.title}>{current.mc_title}</h1>}
      {currentLines.length > 0 && (
        <div className={styles.body}>
          {currentLines.map((l, i) => (
            <div key={i}>{l.text}</div>
          ))}
        </div>
      )}
      {pages.length > 1 && (
        <div className={styles.pageIndicator}>{page + 1} / {pages.length}</div>
      )}
      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${prevSongUrl ? '' : styles.btnDisabled}`}
          onClick={() => prevSongUrl && router.push(prevSongUrl)}
          title="前の曲 (Shift+←)"
          aria-label="前の曲"
        ><IconPrevSong /></button>
        <button
          className={`${styles.btn} ${hasPrevPage ? '' : styles.btnDisabled}`}
          onClick={goPrevPage}
          title="前のMCスライド (←)"
          aria-label="前のMCスライド"
        ><IconPrev /></button>
        <button
          className={`${styles.btn} ${hasNextPage ? '' : styles.btnDisabled}`}
          onClick={goNextPage}
          title="次のMCスライド (→)"
          aria-label="次のMCスライド"
        ><IconNext /></button>
        <button
          className={`${styles.btn} ${nextSongUrl ? '' : styles.btnDisabled}`}
          onClick={() => nextSongUrl && router.push(nextSongUrl)}
          title="次の曲 (Shift+→)"
          aria-label="次の曲"
        ><IconNextSong /></button>
        {fullscreenSupported && (
          <button
            className={styles.btn}
            onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
              else document.exitFullscreen?.()
            }}
            title="全画面表示"
            aria-label="全画面表示"
          ><IconFullscreen /></button>
        )}
      </div>
    </div>
  )
}
