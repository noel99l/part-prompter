'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Loading from '@/components/Loading'
import { IconPrevSong, IconNextSong } from '@/components/icons'
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

  useEffect(() => {
    fetch(`/api/playlists/${id}`)
      .then(r => r.json())
      .then(data => {
        setItems(data.items || [])
        setLoading(false)
      })
  }, [id])

  const { current, prevUrl, nextUrl } = useMemo(() => {
    const songTotal = items.filter(it => it.item_type === 'song').length
    const idx = items.findIndex(it => String(it.item_id) === String(itemId))
    const urlFor = (target: PlaylistItem, targetIdx: number): string => {
      if (target.item_type === 'mc') {
        return `/playlists/${id}/mc/${target.item_id}${from === 'prompter' ? '?from=prompter' : ''}`
      }
      const songIndex = items.slice(0, targetIdx).filter(it => it.item_type === 'song').length
      const query = `playlist=${id}&index=${songIndex}&total=${songTotal}`
      return from === 'prompter'
        ? `/prompter/${target.id}?${query}`
        : `/songs/${target.id}/prompter?${query}`
    }
    return {
      current: idx >= 0 ? items[idx] : null,
      prevUrl: idx > 0 ? urlFor(items[idx - 1], idx - 1) : null,
      nextUrl: idx >= 0 && idx < items.length - 1 ? urlFor(items[idx + 1], idx + 1) : null,
    }
  }, [items, itemId, id, from])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (nextUrl) router.push(nextUrl)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (prevUrl) router.push(prevUrl)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prevUrl, nextUrl, router])

  if (loading) return <Loading label="MCスライド" />

  if (!current || current.item_type !== 'mc') return (
    <div className={styles.container}>
      <p style={{ color: '#888' }}>スライドが見つかりません</p>
    </div>
  )

  const listUrl = from === 'prompter' ? `/prompter/playlist/${id}` : `/playlists/${id}/prompter`

  return (
    <div className={styles.container}>
      <button className={styles.closeBtn} onClick={() => router.push(listUrl)}>✕ 一覧へ</button>
      <div className={styles.badge}>🎤 MC</div>
      {current.mc_title && <h1 className={styles.title}>{current.mc_title}</h1>}
      {current.mc_body && <div className={styles.body}>{current.mc_body}</div>}
      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${prevUrl ? '' : styles.btnDisabled}`}
          onClick={() => prevUrl && router.push(prevUrl)}
          title="前へ"
        ><IconPrevSong /></button>
        <button
          className={`${styles.btn} ${nextUrl ? '' : styles.btnDisabled}`}
          onClick={() => nextUrl && router.push(nextUrl)}
          title="次へ"
        ><IconNextSong /></button>
      </div>
    </div>
  )
}
