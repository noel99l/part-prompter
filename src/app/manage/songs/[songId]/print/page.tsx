'use client'
import { useEffect, useState, useMemo, CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import { harmonyIds, harmonyBandStyle } from '@/lib/harmony'

interface Member { id: number; name: string; color: string; sort_order: number }
interface LyricLine {
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: { text: string; member_ids: number[]; harmony_up_ids?: number[]; harmony_down_ids?: number[]; harmony_up_id?: number; harmony_down_id?: number }[]
}

export default function PrintPage() {
  const { songId } = useParams<{ songId: string }>()
  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lyrics, setLyrics] = useState<LyricLine[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => { setSong(s); setMembers(m); setLyrics(l) })
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

  useEffect(() => {
    if (song && members.length >= 0 && lyrics.length >= 0) {
      setTimeout(() => window.print(), 500)
    }
  }, [song, members, lyrics])

  if (!song) return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>読み込み中...</div>

  const getPrintColor = (color: string) => {
    if (!color) return '#000'
    // 白・明るすぎる色は黒に置き換え
    const c = color.replace('#', '').toLowerCase()
    if (c === 'ffffff' || c === 'fff') return '#000'
    // RGB値で明度チェック
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.85 ? '#000' : color
  }

  const getColor = (ids: number[]) => {
    if (!ids?.length) return '#000'
    return getPrintColor(memberMap[ids[0]]?.color || '#000')
  }

  const renderWord = (text: string, ids: number[], key: number, upIds: number[], downIds: number[]) => {
    const band = harmonyBandStyle(
      upIds.map(id => getPrintColor(memberMap[id]?.color || '#000')),
      downIds.map(id => getPrintColor(memberMap[id]?.color || '#000')),
      '0.12em'
    )
    const decoStyle: CSSProperties = {
      ...(band || {}),
      display: 'inline',
    }
    if (!ids?.length) return <span key={key} style={decoStyle}>{text}</span>
    if (ids.length === 1) return <span key={key} style={{ color: getPrintColor(memberMap[ids[0]]?.color || '#000'), ...decoStyle }}>{text}</span>
    return (
      <span key={key} style={decoStyle}>
        {text.split('').map((char, ci) => (
          <span key={ci} style={{ color: getPrintColor(memberMap[ids[ci % ids.length]]?.color || '#000') }}>{char}</span>
        ))}
      </span>
    )
  }

  const renderLine = (line: LyricLine) => {
    if (line.word_members?.length) {
      return <>{line.word_members.map((w, wi) => renderWord(w.text, w.member_ids, wi, harmonyIds(w, 'up'), harmonyIds(w, 'down')))}</>
    }
    if (!line.member_ids?.length) return <span>{line.text}</span>
    if (line.member_ids.length === 1) return <span style={{ color: getColor(line.member_ids) }}>{line.text}</span>
    // 複数パートは1文字ずつ交互に色分け
    return (
      <span>
        {line.text.split('').map((char, ci) => (
          <span key={ci} style={{ color: getPrintColor(memberMap[line.member_ids[ci % line.member_ids.length]]?.color || '#000') }}>{char}</span>
        ))}
      </span>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
        body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; background: #fff; color: #000; }
      `}</style>

      <div className="no-print" style={{ padding: '1rem', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={() => window.print()} style={{ background: '#FF69B4', border: 'none', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          🖨️ 印刷 / PDFで保存
        </button>
        <button onClick={() => window.close()} style={{ background: 'none', border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
          閉じる
        </button>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>印刷ダイアログで「PDFに保存」を選択するとPDF出力できます</span>
      </div>

      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{song.title}</h1>
        {song.artist && <p style={{ color: '#666', marginBottom: '1rem' }}>{song.artist}</p>}

        {/* メンバー凡例 */}
        {members.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '6px' }}>
            {members.map(m => (
              <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: getPrintColor(m.color), display: 'inline-block', border: '1px solid #ccc' }} />
                <span style={{ color: getPrintColor(m.color), fontWeight: 'bold' }}>{m.name || String.fromCharCode(65 + m.sort_order)}</span>
              </span>
            ))}
          </div>
        )}

        {/* 歌詞 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {blocks.map((block, bi) => (
            <div key={bi} style={{ borderLeft: '3px solid #FF69B4', paddingLeft: '0.75rem' }}>
              {block.map((line, li) => (
                <div key={li} style={{ fontSize: '1rem', lineHeight: '1.8' }}>
                  {renderLine(line)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
