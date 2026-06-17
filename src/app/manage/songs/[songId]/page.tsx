'use client'
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import skStyles from '@/components/skeleton.module.css'
import styles from './page.module.css'

const PALETTE = [
  '#FF4444', '#FF8C00', '#FFD700', '#7CFC00', '#00CED1',
  '#1E90FF', '#9370DB', '#FF69B4', '#FFFFFF', '#AAAAAA',
]

interface Member { id: number; name: string; color: string; sort_order: number }

interface WordMember { text: string; member_ids: number[]; harmony_up_id?: number; harmony_down_id?: number }

interface FlatLine {
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members: WordMember[]
}

interface LyricLine {
  block_index: number
  line_index: number
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members?: WordMember[]
}

function parseLrc(lrc: string): { lines: FlatLine[]; breaks: Set<number> } {
  const lines: FlatLine[] = []
  const breaks = new Set<number>()
  let prevWasEmpty = true

  const rawLines = lrc.split('\n')
  const hasTimestamp = rawLines.some(l => /^\[\d+:\d+[.::]\d+\]/.test(l.trim()))

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    const match = trimmed.match(/^\[(\d+):(\d+)[.:](\d+)\](.*)$/)
    if (match) {
      const ms = parseInt(match[1]) * 60000 + parseInt(match[2]) * 1000 + Math.round(parseInt(match[3]) * 10)
      const text = match[4].trim()
      if (!text) { prevWasEmpty = true; continue }
      if (prevWasEmpty && lines.length > 0) breaks.add(lines.length)
      lines.push({ text, member_ids: [], timestamp_ms: ms, word_members: [] })
      prevWasEmpty = false
    } else if (!hasTimestamp) {
      // プレーンテキストモード
      if (trimmed === '') {
        prevWasEmpty = true
      } else {
        if (prevWasEmpty && lines.length > 0) breaks.add(lines.length)
        lines.push({ text: trimmed, member_ids: [], timestamp_ms: null, word_members: [] })
        prevWasEmpty = false
      }
    } else if (trimmed === '') {
      prevWasEmpty = true
    }
  }
  return { lines, breaks }
}

function toDbFormat(lines: FlatLine[], breaks: Set<number>): LyricLine[] {
  let blockIndex = 0, lineIndex = 0
  return lines.map((l, i) => {
    if (i > 0 && breaks.has(i)) { blockIndex++; lineIndex = 0 }
    const row = { ...l, block_index: blockIndex, line_index: lineIndex }
    lineIndex++
    return row
  })
}

function fromDbFormat(dbLines: LyricLine[]): { lines: FlatLine[]; breaks: Set<number> } {
  const sorted = [...dbLines].sort((a, b) =>
    a.block_index !== b.block_index ? a.block_index - b.block_index : a.line_index - b.line_index
  )
  const lines: FlatLine[] = sorted.map(l => ({
    text: l.text,
    member_ids: l.member_ids || [],
    timestamp_ms: l.timestamp_ms,
    word_members: l.word_members || [],
  }))
  const breaks = new Set<number>()
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].block_index !== sorted[i - 1].block_index) breaks.add(i)
  }
  return { lines, breaks }
}


// FlatLine[] + breaks → LRCテキストに変換
function toLrcText(lines: FlatLine[], breaks: Set<number>): string {
  return lines.map((l, i) => {
    const prefix = i > 0 && breaks.has(i) ? '\n' : ''
    if (l.timestamp_ms == null) return `${prefix}${l.text}`
    const m = Math.floor(l.timestamp_ms / 60000)
    const s = Math.floor((l.timestamp_ms % 60000) / 1000)
    const cs = Math.floor((l.timestamp_ms % 1000) / 10)
    const ts = `[${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}]`
    return `${prefix}${ts}${l.text}`
  }).join('\n')
}

export default function LyricsEditor() {
  const { songId } = useParams<{ songId: string }>()
  const router = useRouter()

  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lines, setLines] = useState<FlatLine[]>([])
  const [breaks, setBreaks] = useState<Set<number>>(new Set())
  const [checkedMemberIds, setCheckedMemberIds] = useState<number[]>([])
  const [harmonyMode, setHarmonyMode] = useState<'main' | 'up' | 'down'>('main')
  const harmonyDragRef = useRef<{ lineIdx: number; memberId: number; mode: 'up' | 'down' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'info' | 'lrc' | 'parts' | 'prompter'>('info')
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [coverText, setCoverText] = useState('')
  const [bgColor, setBgColor] = useState('#000000')
  const [savingMeta, setSavingMeta] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const [lrcText, setLrcText] = useState('') // 生のLRCテキスト
  const fileRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => {
      setSong(s); setEditTitle(s.title); setEditArtist(s.artist || ''); setEditDescription(s.description || ''); setIsPublic(s.is_public !== false); setCoverText(s.cover_text || ''); setBgColor(s.bg_color || '#000000'); setMembers(m)
      if (Array.isArray(l) && l.length > 0) {
        const { lines: fl, breaks: br } = fromDbFormat(l)
        setLines(fl); setBreaks(br)
        setLrcText(toLrcText(fl, br))
      }
    })
  }, [songId])

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  useEffect(() => {
    const validIds = new Set(members.map(m => m.id))
    setCheckedMemberIds(prev => prev.filter(id => validIds.has(id)))
    setLines(prev => prev.map(l => ({
      ...l,
      member_ids: l.member_ids.filter(id => validIds.has(id)),
      word_members: l.word_members.map(w => ({
        ...w,
        member_ids: w.member_ids.filter(id => validIds.has(id)),
        harmony_up_id: w.harmony_up_id && validIds.has(w.harmony_up_id) ? w.harmony_up_id : undefined,
        harmony_down_id: w.harmony_down_id && validIds.has(w.harmony_down_id) ? w.harmony_down_id : undefined,
      })),
    })))
  }, [members])

  // ---- メンバー操作 ----
  const saveMembersApi = async (newMembers: Member[], saveLyricsAfter = true) => {
    const res = await fetch(`/api/songs/${songId}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMembers.map((m, i) => ({ ...m, sort_order: i }))),
    })
    const saved: Member[] = await res.json()

    const idMap = new Map<number, number>()
    newMembers.forEach((old, i) => {
      if (old.id < 0 && saved[i]) idMap.set(old.id, saved[i].id)
    })
    const savedIds = new Set(saved.map(m => m.id))
    const remapIds = (ids: number[]) =>
      ids.map(id => idMap.get(id) ?? id).filter(id => savedIds.has(id))

    const remappedLines = lines.map(l => ({
      ...l,
      member_ids: remapIds(l.member_ids),
      word_members: l.word_members.map(w => ({ ...w, member_ids: remapIds(w.member_ids) })),
    }))

    setLines(remappedLines)
    setMembers(saved)

    if (saveLyricsAfter) {
      await fetch(`/api/songs/${songId}/lyrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toDbFormat(remappedLines, breaks)),
      })
    }

    return remappedLines
  }

  const addMember = () => {
    if (members.length >= 10) return
    setMembers(prev => [...prev, { id: -(Date.now()), name: '', color: PALETTE[prev.length % PALETTE.length], sort_order: prev.length }])
  }

  const updateMemberName = (idx: number, val: string) =>
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: val } : m))

  const updateMemberColor = (idx: number, val: string) =>
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, color: val } : m))

  const removeMember = (idx: number) =>
    setMembers(prev => prev.filter((_, i) => i !== idx))

  const saveAll = async () => {
    setSavingMeta(true)
    await fetch(`/api/songs/${songId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, artist: editArtist, is_public: isPublic, description: editDescription, cover_text: coverText, bg_color: bgColor }),
    })
    setSong((s: any) => ({ ...s, title: editTitle, artist: editArtist, is_public: isPublic, description: editDescription }))
    await saveMembersApi(members)
    setSavingMeta(false)
    showToast('保存しました')
  }

  // ---- LRCインポート ----
  const applyLrcText = (text: string) => {
    const { lines: fl, breaks: br } = parseLrc(text)
    if (br.size === 0 && fl.length > 0) for (let i = 4; i < fl.length; i += 4) br.add(i)

    // 既存の割り当てを引き継ぎ：textが一致する行は既存のmember_ids/word_membersを保持
    const existingMap = new Map<string, { member_ids: number[]; word_members: WordMember[] }>()
    lines.forEach(l => {
      if (!existingMap.has(l.text)) {
        existingMap.set(l.text, { member_ids: l.member_ids, word_members: l.word_members })
      }
    })

    const merged = fl.map(l => {
      const existing = existingMap.get(l.text)
      return existing
        ? { ...l, member_ids: existing.member_ids, word_members: existing.word_members }
        : l
    })

    setLines(merged); setBreaks(br); setLrcText(toLrcText(merged, br))
  }
  const handleLrcImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => applyLrcText(ev.target?.result as string)
    reader.readAsText(file, 'utf-8'); e.target.value = ''
  }

  // LRCテキストを直接編集して保存＆反映
  const saveLrcAndApply = async () => {
    setSaving(true)
    const strippedText = lrcText.split('\n').filter(l => l.trim() !== '').join('\n')
    const { lines: fl } = parseLrc(strippedText)

    // 既存行とタイムスタンプで対応させてmember_ids/word_membersを引き継ぐ
    const merged = fl.map((l, i) => {
      const existing = lines[i]
      return existing ? { ...l, member_ids: existing.member_ids, word_members: existing.word_members } : l
    })

    // breaksはインデックスが変わらないのでそのまま引き継ぎ
    setLines(merged); setBreaks(breaks)
    await fetch(`/api/songs/${songId}/lyrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toDbFormat(merged, breaks)),
    })
    setSaving(false)
  }

  // ---- ブロック区切り ----
  const toggleBreak = (i: number) => {
    setBreaks(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  // ---- 行ドラッグでメンバー割り当て ----
  const assignHarmonyChar = useCallback((lineIdx: number, ci: number, memberId: number, mode: 'up' | 'down') => {
    setLines(prev => prev.map((l, li) => {
      if (li !== lineIdx) return l
      const lChars = l.text.split('')
      let newWm: WordMember[] = l.word_members.length === lChars.length
        ? [...l.word_members]
        : lChars.map((c, idx) => ({ text: c, member_ids: [], harmony_up_id: l.word_members[idx]?.harmony_up_id, harmony_down_id: l.word_members[idx]?.harmony_down_id }))
      newWm = newWm.map((ww, wi) => wi !== ci ? ww : mode === 'up' ? { ...ww, harmony_up_id: memberId } : { ...ww, harmony_down_id: memberId })
      return { ...l, word_members: newWm }
    }))
  }, [])

  const assignMainChar = useCallback((lineIdx: number, ci: number, memberIds: number[]) => {
    setLines(prev => prev.map((l, li) => {
      if (li !== lineIdx) return l
      const lChars = l.text.split('')
      let newWm: WordMember[] = l.word_members.length === lChars.length
        ? [...l.word_members]
        : lChars.map((c, idx) => ({ text: c, member_ids: l.word_members[idx]?.member_ids || [], harmony_up_id: l.word_members[idx]?.harmony_up_id, harmony_down_id: l.word_members[idx]?.harmony_down_id }))
      newWm = newWm.map((ww, wi) => wi !== ci ? ww : { ...ww, member_ids: memberIds })
      return { ...l, word_members: newWm }
    }))
  }, [])

  const mainDragRef = useRef<{ lineIdx: number; memberIds: number[] } | null>(null)

  const assignMembers = useCallback((i: number) => {
    if (checkedMemberIds.length === 0) return
    const sorted = [...checkedMemberIds].sort((a, b) => a - b)
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, member_ids: sorted } : l))
  }, [checkedMemberIds])




  const handlePointerUp = useCallback(() => { harmonyDragRef.current = null; mainDragRef.current = null }, [])

  useEffect(() => {
    document.addEventListener('pointerup', handlePointerUp)
    return () => document.removeEventListener('pointerup', handlePointerUp)
  }, [handlePointerUp])

  // ---- 単語分割モード ----



  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ---- 歌詞保存 ----
  const saveLyrics = async () => {
    setSaving(true)
    const remappedLines = await saveMembersApi(members, false)
    await fetch(`/api/songs/${songId}/lyrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toDbFormat(remappedLines, breaks)),
    })
    setSaving(false); showToast('パート分けを保存しました')
  }

  // ---- 表示ヘルパー ----
  function lineGradient(memberIds: number[]): React.CSSProperties {
    if (!memberIds || memberIds.length === 0) return { color: '#fff' }
    if (memberIds.length === 1) return { color: memberMap[memberIds[0]]?.color || '#fff' }
    const stops = memberIds.map((id, i) => {
      const pct = 100 / memberIds.length
      const color = memberMap[id]?.color || '#fff'
      return `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%`
    }).join(', ')
    return { backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
  }

  function GradientText({ text, memberIds }: { text: string; memberIds: number[]; id?: string }) {
    const colors = memberIds.map(mid => memberMap[mid]?.color || '#fff')
    const stops = colors.map((c, i) => `${c} ${(i / colors.length) * 100}%, ${c} ${((i + 1) / colors.length) * 100}%`).join(', ')
    return (
      <span style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{text}</span>
    )
  }

  function renderLineText(line: FlatLine, lineIdx: number) {
    // ハモリモード時：1文字ずつクリック可能なボタンとして表示
    if (harmonyMode !== 'main') {
      const chars = line.text.split('')
      const currentChecked = checkedMemberIds
      const currentMode = harmonyMode
      const currentLine = lines[lineIdx]
      return (
        <span className={styles.lyricText}>
          {chars.map((ch, ci) => {
            const w = currentLine?.word_members.length === chars.length ? currentLine.word_members[ci] : undefined
            const decos: string[] = []
            if (w?.harmony_up_id) decos.push(`overline 2px ${memberMap[w.harmony_up_id]?.color || '#888'}`)
            if (w?.harmony_down_id) decos.push(`underline 2px ${memberMap[w.harmony_down_id]?.color || '#888'}`)
            const mainColor = w?.member_ids?.length === 1 ? memberMap[w.member_ids[0]]?.color : undefined
            const isSpace = ch === ' ' || ch === '　'
            return (
              <button
                key={ci}
                className={styles.harmonyCharBtn}
                disabled={isSpace}
                style={{
                  color: mainColor || '#fff',
                  ...(decos.length > 0 ? { textDecoration: decos.join(', '), textDecorationSkipInk: 'none' } as React.CSSProperties : {})
                }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  if (isSpace || currentChecked.length === 0) return
                  const memberId = currentChecked[0]
                  setLines(prev => prev.map((l, li) => {
                    if (li !== lineIdx) return l
                    const lChars = l.text.split('')
                    let newWm: WordMember[] = l.word_members.length === lChars.length
                      ? [...l.word_members]
                      : lChars.map((c, idx) => ({
                          text: c,
                          member_ids: l.word_members[idx]?.member_ids || [],
                          harmony_up_id: l.word_members[idx]?.harmony_up_id,
                          harmony_down_id: l.word_members[idx]?.harmony_down_id,
                        }))
                    newWm = newWm.map((ww, wi) => {
                      if (wi !== ci) return ww
                      return currentMode === 'up'
                        ? { ...ww, harmony_up_id: memberId }
                        : { ...ww, harmony_down_id: memberId }
                    })
                    return { ...l, word_members: newWm }
                  }))
                }}
              >
                {ch === ' ' || ch === '　' ? ' ' : ch}
              </button>
            )
          })}
        </span>
      )
    }
    // メインモード：常に1文字ずつボタンとして表示
    const chars = line.text.split('')
    return (
      <span className={styles.lyricText}>
        {chars.map((ch, ci) => {
          const w = line.word_members.length === chars.length ? line.word_members[ci] : undefined
          const mainIds = w?.member_ids?.length ? w.member_ids : (line.member_ids.length ? line.member_ids : [])
          const upColor = w?.harmony_up_id ? memberMap[w.harmony_up_id]?.color : null
          const downColor = w?.harmony_down_id ? memberMap[w.harmony_down_id]?.color : null
          let charContent: React.ReactNode
          const displayCh = ch === ' ' || ch === '　' ? ' ' : ch
          if (mainIds.length === 0) charContent = <span style={{ color: '#fff' }}>{displayCh}</span>
          else if (mainIds.length === 1) charContent = <span style={{ color: memberMap[mainIds[0]]?.color || '#fff' }}>{displayCh}</span>
          else { const stops = mainIds.map((id, idx) => { const pct = 100 / mainIds.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${idx * pct}%, ${color} ${(idx + 1) * pct}%` }).join(', '); charContent = <span style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{displayCh}</span> }
          if (downColor) charContent = <span style={{ textDecoration: `underline 2px ${downColor}`, textDecorationSkipInk: 'none' }}>{charContent}</span>
          if (upColor) charContent = <span style={{ textDecoration: `overline 2px ${upColor}`, textDecorationSkipInk: 'none' }}>{charContent}</span>
          const isSpace = ch === ' ' || ch === '　'
          return (
            <button
              key={ci}
              data-main-ci={ci}
              data-main-line={lineIdx}
              className={styles.harmonyCharBtn}
              disabled={isSpace}
              onPointerDown={e => {
                e.stopPropagation()
                if (isSpace || checkedMemberIds.length === 0 || harmonyMode !== 'main') return
                mainDragRef.current = { lineIdx, memberIds: [...checkedMemberIds].sort((a, b) => a - b) }
                assignMainChar(lineIdx, ci, [...checkedMemberIds].sort((a, b) => a - b))
              }}
              onPointerEnter={() => {
                if (isSpace || !mainDragRef.current || mainDragRef.current.lineIdx !== lineIdx) return
                assignMainChar(lineIdx, ci, mainDragRef.current.memberIds)
              }}
              onPointerUp={e => { e.stopPropagation(); mainDragRef.current = null }}
            >{charContent}</button>
          )
        })}
      </span>
    )
  }

  const hasTimestamp = useMemo(() => lines.some(l => l.timestamp_ms != null), [lines])

  const toggleMemberCheck = (id: number) => {
    if (harmonyMode !== 'main') {
      // ハモリモード時は単一選択
      setCheckedMemberIds(prev => prev[0] === id ? [] : [id])
    } else {
      setCheckedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }
  }

  const blockOf = (i: number) => {
    let b = 0
    for (let j = 1; j <= i; j++) if (breaks.has(j)) b++
    return b
  }

  function CopyUrlButton({ songId, inMenu, onClose }: { songId: string; inMenu?: boolean; onClose?: () => void }) {
    const [copied, setCopied] = React.useState(false)
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/songs/${songId}`
    const handleCopy = async () => {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose?.() }, 1500)
    }
    if (inMenu) return (
      <button onClick={handleCopy} className={styles.exportDropdownLink}>
        {copied ? '✓ コピー済み' : '📋 共有URLをコピー'}
      </button>
    )
    return (
      <div className={styles.urlCopyBox}>
        <code className={styles.urlCode}>{url}</code>
        <button className={`${styles.exportBtn} ${styles.exportBtnGray}`} onClick={handleCopy}>
          {copied ? '✓ コピー済み' : '📋 URLをコピー'}
        </button>
      </div>
    )
  }

  function LyricsTextExportMenuItem({ lines, breaks, members, onClose }: { lines: FlatLine[]; breaks: Set<number>; members: Member[]; onClose?: () => void }) {
    const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
    const getSymbol = (id: number) => { const idx = members.findIndex(m => m.id === id); return idx >= 0 ? String.fromCharCode(65 + idx) : '?' }
    const getLabel = (ids: number[]) => { if (!ids?.length || (ids.length === members.length && members.length > 0)) return '全員'; return ids.map(id => getSymbol(id)).join('') }
    const buildText = () => {
      const header: string[] = []
      if (song?.title) header.push(song.title)
      if (song?.artist) header.push(song.artist)
      const memberLine = members.map((m, i) => m.name ? `${String.fromCharCode(65 + i)}:${m.name}` : null).filter(Boolean).join(' ')
      const result: string[] = [...header, memberLine, '']
      let prevLabel = ''
      lines.forEach((line, i) => {
        if (i > 0 && breaks.has(i)) result.push('')
        if (line.word_members.length > 0) {
          let text = ''; let curLabel = ''
          line.word_members.forEach(w => { const isSpace = w.text === ' ' || w.text === '　'; if (!isSpace) { const label = getLabel(w.member_ids); if (label !== curLabel) { text += `(${label})`; curLabel = label } }; text += w.text })
          result.push(text); prevLabel = ''; return
        }
        const label = getLabel(line.member_ids)
        const prefix = label !== prevLabel ? `(${label})` : ''
        result.push(prefix ? `${prefix}${line.text}` : line.text)
        prevLabel = label
      })
      return result.join('\n')
    }
    return (
      <button onClick={() => {
        const text = buildText()
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${song?.title || 'parts'}.txt`
        a.click()
        URL.revokeObjectURL(url)
        onClose?.()
      }} className={styles.exportDropdownLink}>
        📝 パート分けテキスト
      </button>
    )
  }

  function PlaylistAddMenuItem({ songId, songTitle, onClose }: { songId: string; songTitle?: string; onClose: () => void }) {
    const [showModal, setShowModal] = React.useState(false)
    const [playlists, setPlaylists] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(false)
    const [added, setAdded] = React.useState<number | null>(null)

    const openModal = async () => {
      setShowModal(true)
      setLoading(true)
      const res = await fetch('/api/playlists')
      setPlaylists(await res.json())
      setLoading(false)
    }

    const addToPlaylist = async (playlistId: number) => {
      await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: Number(songId) }),
      })
      setAdded(playlistId)
      setTimeout(() => setAdded(null), 1500)
    }

    return (
      <>
        <button onClick={openModal} className={styles.exportDropdownLink}>📋 セットリストに追加</button>
        {showModal && (
          <div className={styles.collabOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.collabModal} onClick={e => e.stopPropagation()}>
              <div className={styles.collabModalHeader}>
                <h2 className={styles.collabModalTitle}>📋 セットリストに追加</h2>
                <button onClick={() => setShowModal(false)} className={styles.collabModalClose}>✕</button>
              </div>
              {songTitle && <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 0.5rem', padding: '0 0.1rem' }}>{songTitle}</p>}
              {loading ? (
                <p className={styles.collabSectionLabel}>読み込み中...</p>
              ) : playlists.length === 0 ? (
                <p className={styles.collabSectionLabel}>セットリストがありません</p>
              ) : (
                <div className={styles.collabSectionList}>
                  {playlists.map((p: any) => (
                    <div key={p.id} className={styles.collabRow}>
                      <span className={styles.collabRowInfo} style={{ fontSize: '0.9rem', color: '#fff' }}>{p.name}</span>
                      <button
                        onClick={() => addToPlaylist(p.id)}
                        className={styles.collabCopyBtn}
                        style={{ color: added === p.id ? '#7CFC00' : '#ccc' }}
                      >{added === p.id ? '✓ 追加済み' : '追加'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  function DeleteSongMenuItem({ songId, onClose, onDeleted }: { songId: string; onClose: () => void; onDeleted: () => void }) {
    const [confirm, setConfirm] = React.useState(false)
    const [deleting, setDeleting] = React.useState(false)

    const handleDelete = async () => {
      setDeleting(true)
      await fetch(`/api/songs/${songId}`, { method: 'DELETE' })
      onDeleted()
    }

    return (
      <>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className={`${styles.exportDropdownLink} ${styles.exportDropdownLinkDanger}`}>🗑️ 楽曲を削除</button>
        ) : (
          <div className={styles.collabOverlay} onClick={() => setConfirm(false)}>
            <div className={styles.collabModal} onClick={e => e.stopPropagation()}>
              <div className={styles.collabModalHeader}>
                <h2 className={styles.collabModalTitle} style={{ color: '#FF4444' }}>🗑️ 楽曲を削除</h2>
                <button onClick={() => setConfirm(false)} className={styles.collabModalClose}>✕</button>
              </div>
              <p className={styles.collabSectionLabel}>この曲を削除しますか？歌詞・メンバーも全て削除されます。</p>
              <div className={styles.collabRow}>
                <button onClick={handleDelete} disabled={deleting} className={styles.collabIconBtn} style={{ color: '#FF4444', borderColor: '#FF4444', flex: 1 }}>
                  {deleting ? '削除中...' : '削除する'}
                </button>
                <button onClick={() => setConfirm(false)} className={styles.collabIconBtn} style={{ flex: 1 }}>キャンセル</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  function CollaboratorMenuItem({ songId }: { songId: string }) {
    const [generating, setGenerating] = React.useState(false)
    const [copyToast, setCopyToast] = React.useState(false)
    const [showModal, setShowModal] = React.useState(false)
    const [links, setLinks] = React.useState<any[]>([])
    const [members, setMembers] = React.useState<any[]>([])
    const [expireMinutes, setExpireMinutes] = React.useState(10080)

    const loadCollabs = () => {
      fetch(`/api/songs/${songId}/collaborators`)
        .then(r => r.json())
        .then(data => {
          if (data.links) setLinks(data.links)
          if (data.members) setMembers(data.members)
        })
    }

    const generate = async () => {
      setGenerating(true)
      const res = await fetch(`/api/songs/${songId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expireMinutes }),
      })
      const data = await res.json()
      if (data.token) {
        await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.token}`)
        setCopyToast(true)
        setTimeout(() => setCopyToast(false), 2000)
        setLinks(prev => [{ ...data, expired: false }, ...prev])
      }
      setGenerating(false)
    }

    const remove = async (id: number) => {
      await fetch(`/api/songs/${songId}/collaborators`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setLinks(prev => prev.filter(c => c.id !== id))
    }

    const removeMember = async (memberId: number) => {
      await fetch(`/api/songs/${songId}/collaborators`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }

    const openModal = () => { loadCollabs(); setShowModal(true) }

    return (
      <>
        <button onClick={openModal} className={styles.exportDropdownLink}>
          👥 共同編集を管理
        </button>
        {showModal && (
          <div className={styles.collabOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.collabModal} onClick={e => e.stopPropagation()}>
              <div className={styles.collabModalHeader}>
                <h2 className={styles.collabModalTitle}>👥 共同編集管理</h2>
                <button onClick={() => setShowModal(false)} className={styles.collabModalClose}>✕</button>
              </div>
              <div className={styles.collabSectionLabel}>招待リンクを発行</div>
              <div className={styles.collabRow}>
                <div className={styles.collabRowInfo}>
                  <select
                    value={expireMinutes}
                    onChange={e => setExpireMinutes(Number(e.target.value))}
                    className={styles.collabSelect}
                  >
                    <option value={30}>30分有効</option>
                    <option value={60}>1時間有効</option>
                    <option value={360}>6時間有効</option>
                    <option value={720}>12時間有効</option>
                    <option value={1440}>1日有効</option>
                    <option value={4320}>3日有効</option>
                    <option value={10080}>7日有効</option>
                    <option value={20160}>14日有効</option>
                    <option value={43200}>30日有効</option>
                  </select>
                </div>
                <button onClick={generate} disabled={generating} style={{ background: '#444', border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: generating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: generating ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {generating ? '生成中...' : '🔗 発行'}
                </button>
              </div>
              {members.length > 0 && (
                <div className={styles.collabSectionList}>
                  <div className={styles.collabSectionLabel}>共同編集者</div>
                  {members.map((m: any, i: number) => (
                    <div key={i} className={styles.collabRow}>
                      <span className={styles.collabMemberName}>✓ {m.user_name || '不明'}</span>
                      <button onClick={() => removeMember(m.id)} className={styles.collabIconBtn}>削除</button>
                    </div>
                  ))}
                </div>
              )}
              {copyToast && (
                <div className={styles.collabToast}>✓ リンクをコピーしました</div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }


  if (!song) return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={skStyles.sk} style={{ width: 160, height: 28 }} />
        <div className={skStyles.sk} style={{ width: 140, height: 20, marginLeft: 'auto' }} />
      </div>
      <div className={styles.tabs}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={skStyles.sk} style={{ width: 90, height: 36, borderRadius: '6px 6px 0 0' }} />
        ))}
      </div>
      <div className={styles.skeletonList}>
        <div className={skStyles.sk} style={{ width: '60%', height: 36, borderRadius: 8 }} />
        <div className={skStyles.sk} style={{ width: '40%', height: 24, borderRadius: 8 }} />
        <div className={skStyles.sk} style={{ width: '100%', height: 1, borderRadius: 0 }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} className={skStyles.sk} style={{ width: '100%', height: 64, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      {toast && (
        <div className={styles.toastBar}>
          <span className={styles.toastIcon}>✓</span> {toast}
        </div>
      )}
      <div className={styles.header}>
        <h1 className={styles.title}>🎨 パート分け</h1>
        <div className={styles.headerActions}>
          <Link href={`/songs/${songId}/prompter`} className={styles.previewLink} target="_blank">▶ プロンプター表示 ↗</Link>
          <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
            <button className={`${styles.tab} ${styles.tabRound}`} onClick={() => setExportMenuOpen(v => !v)}>⋯</button>
            {exportMenuOpen && (
              <div className={styles.exportDropdown}>
                {isPublic && (
                  <CopyUrlButton songId={songId} inMenu onClose={() => setExportMenuOpen(false)} />
                )}
                <div className={styles.exportDropdownDivider} />
                <div className={styles.exportDropdownLabel}>ダウンロード</div>
                <a href={`/api/songs/${songId}/export/pptx`} download className={styles.exportDropdownLink} onClick={() => setExportMenuOpen(false)}>📥 PPTX</a>
                <a href={`/manage/songs/${songId}/print`} target="_blank" className={styles.exportDropdownLink} onClick={() => setExportMenuOpen(false)}>🖨️ PDF</a>
                <LyricsTextExportMenuItem lines={lines} breaks={breaks} members={members} onClose={() => setExportMenuOpen(false)} />
                <div className={styles.exportDropdownDivider} />
                <CollaboratorMenuItem songId={songId} />
                <PlaylistAddMenuItem songId={songId} songTitle={song?.title} onClose={() => setExportMenuOpen(false)} />
                <div className={styles.exportDropdownDivider} />
                <DeleteSongMenuItem songId={songId} onClose={() => setExportMenuOpen(false)} onDeleted={() => router.push('/manage/songs')} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'info' ? styles.tabActive : ''}`} onClick={() => setTab('info')}>
          <span className={styles.tabIcon}>📝</span><span className={styles.tabLabel}> 楽曲情報</span>
        </button>
        <button className={`${styles.tab} ${tab === 'lrc' ? styles.tabActive : ''}`} onClick={() => setTab('lrc')}>
          <span className={styles.tabIcon}>🎵</span><span className={styles.tabLabel}> 歌詞編集</span>
        </button>
        <button className={`${styles.tab} ${tab === 'parts' ? styles.tabActive : ''}`} onClick={() => setTab('parts')}>
          <span className={styles.tabIcon}>🎨</span><span className={styles.tabLabel}> パート分け</span>
        </button>
        <button className={`${styles.tab} ${tab === 'prompter' ? styles.tabActive : ''}`} onClick={() => setTab('prompter')}>
          <span className={styles.tabIcon}>▶</span><span className={styles.tabLabel}> プロンプター設定</span>
        </button>
      </div>

      {tab === 'info' && (
        <div className={styles.membersPanel}>
          {/* 楽曲情報 */}
          <div className={styles.infoForm}>
            <div className={styles.infoFormRow}>
              <label className={styles.infoFormLabel}>曲名</label>
              <input
                className={styles.metaInput}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="曲名"
              />
            </div>
            <div className={styles.infoFormRow}>
              <label className={styles.infoFormLabel}>アーティスト</label>
              <input
                className={styles.metaInput}
                value={editArtist}
                onChange={e => setEditArtist(e.target.value)}
                placeholder="アーティスト名"
              />
            </div>
            <div className={`${styles.infoFormRow} ${styles.infoFormRowTop}`}>
              <label className={`${styles.infoFormLabel} ${styles.infoFormLabelTop}`}>概要</label>
              <div className={styles.flex1}>
                <textarea
                  className={styles.descriptionInput}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value.slice(0, 200))}
                  placeholder="概要（200文字まで）"
                  rows={3}
                />
                <div className={`${styles.descriptionCountWrap} ${editDescription.length >= 200 ? styles.descriptionCountMax : styles.descriptionCountOk}`}>
                  {editDescription.length}/200
                </div>
              </div>
            </div>
            <div className={styles.infoFormRow}>
              <label className={styles.infoFormLabel}>公開</label>
              <label className={styles.toggleLabel}>
                <button
                  type="button"
                  onClick={() => setIsPublic(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: isPublic ? '#7CFC00' : '#444',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: isPublic ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
                <span className={styles.toggleHint}>
                  {isPublic ? '一覧に公開' : '一覧に表示しない'}
                </span>
              </label>
            </div>
          </div>
          <hr className={styles.divider} />
          {/* メンバー設定 */}
          <p className={styles.hint}>最大10名まで登録できます。色はパレットから選択してください。</p>
          <div className={styles.memberList}>
            {members.map((m, i) => (
              <div key={m.id} className={styles.memberRow}>
                <span className={styles.memberNum}>{i + 1}</span>
                <input
                  className={styles.memberNameInput}
                  value={m.name}
                  onChange={e => updateMemberName(i, e.target.value)}
                  placeholder={String.fromCharCode(65 + i)}
                />
                <div className={styles.palette}>
                  {PALETTE.map(color => (
                    <button key={color} className={`${styles.colorBtn} ${m.color === color ? styles.colorBtnActive : ''}`} style={{ background: color }} onClick={() => updateMemberColor(i, color)} title={color} />
                  ))}
                  <span className={styles.paletteDivider} />
                  <input type="color" className={`${styles.colorPicker} ${!PALETTE.includes(m.color) ? styles.colorPickerActive : ''}`} value={m.color} onChange={e => updateMemberColor(i, e.target.value)} title="カスタムカラー" />
                </div>
                <div className={styles.colorPreview} style={{ background: m.color }} />
                <button className={styles.removeBtn} onClick={() => removeMember(i)}>✕</button>
              </div>
            ))}
          </div>
          <div className={styles.memberActions}>
            <button className={styles.addBtn} onClick={addMember} disabled={members.length >= 10}>＋ メンバー追加</button>
          </div>
          <hr className={styles.divider} />
          <div className={styles.saveBtnRow}>
            <button className={styles.saveBtn} onClick={saveAll} disabled={savingMeta}>
              {savingMeta ? <><span className={styles.spinnerSm} />保存中</> : '💾 保存'}
            </button>
          </div>
        </div>
      )}

      {tab === 'lrc' && (
        <div className={styles.lyricsPanel}>
          <div className={styles.lyricsToolbar}>
            <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>📂 LRCインポート</button>
            <input ref={fileRef} type="file" accept=".lrc,.txt" className={styles.fileInputHidden} onChange={handleLrcImport} />
          </div>
          <p className={styles.hint}>LRC形式またはプレーンテキスト（空行でブロック区切り）を貼り付けて保存してください。</p>
          <textarea
            className={styles.lrcEditor}
            value={lrcText}
            onChange={e => setLrcText(e.target.value)}
            placeholder="LRC形式またはテキスト形式の歌詞を貼り付け..."
            spellCheck={false}
          />
          <div className={styles.saveBtnRow}>
            <button className={styles.saveBtn} onClick={saveLrcAndApply} disabled={saving}>
              {saving ? <><span className={styles.spinnerSm} />保存中</> : '💾 保存'}
            </button>
          </div>
        </div>
      )}

      {tab === 'parts' && (
        <div className={styles.lyricsPanel}>
          <div className={styles.saveBtnRow}>
            <button className={styles.saveBtn} onClick={saveLyrics} disabled={saving}>
              {saving ? <><span className={styles.spinnerSm} />保存中</> : '💾 保存'}
            </button>
          </div>
          <p className={styles.hint}>行間の「＋ 区切り追加」でブロックを分割。ダブルタップで行全体、長押しなぞりで文字単位に割り当てできます。</p>

          {lines.length === 0 ? (
            <p className={styles.hint}>LRCファイルをインポートして歌詞を読み込んでください。</p>
          ) : (
            <div className={styles.editorLayout}>
            <div className={`${styles.memberSelector} ${drawerOpen ? styles.memberSelectorOpen : ''}`}>
                <p className={styles.selectorTitle}>歌唱者を選択してから歌詞をなぞってください</p>
                <div className={styles.harmonyToggle}>
                  <button
                    className={`${styles.harmonyBtn} ${harmonyMode === 'up' ? styles.harmonyBtnActive : ''}`}
                    onClick={() => {
                      if (checkedMemberIds.length !== 1) setCheckedMemberIds([])
                      setHarmonyMode('up')
                    }}
                  >上ハモ</button>
                  <button
                    className={`${styles.harmonyBtn} ${harmonyMode === 'main' ? styles.harmonyBtnMain : ''}`}
                    onClick={() => setHarmonyMode('main')}
                  >メイン</button>
                  <button
                    className={`${styles.harmonyBtn} ${harmonyMode === 'down' ? styles.harmonyBtnActive : ''}`}
                    onClick={() => {
                      if (checkedMemberIds.length !== 1) setCheckedMemberIds([])
                      setHarmonyMode('down')
                    }}
                  >下ハモ</button>
                </div>
                {members.length === 0 ? (
                  <p className={styles.hint}>先にメンバーを登録してください</p>
                ) : (
                  <div className={styles.selectorList}>
                    {members.map(m => (
                      <label key={m.id} className={styles.selectorItem}>
                        <input type="checkbox" checked={checkedMemberIds.includes(m.id)} onChange={() => toggleMemberCheck(m.id)} />
                        <span className={styles.selectorDot} style={{ background: m.color }} />
                        <span className={styles.selectorName}>{m.name || String.fromCharCode(65 + m.sort_order)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className={styles.selectedPreview}>
                    選択中：
                    {checkedMemberIds.length > 0
                      ? checkedMemberIds.map(id => (
                          <span key={id} className={styles.selectedDot} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />
                        ))
                      : <span className={styles.collabSectionLabel}>なし</span>
                    }
                  </div>
                <button className={styles.clearBtn} onClick={() => setCheckedMemberIds([])}>選択解除</button>
              </div>

              <div className={styles.blocksArea}>
                <button
                  className={styles.drawerToggleBtn}
                  style={{ right: drawerOpen ? 220 : 0 }}
                  onClick={() => setDrawerOpen(v => !v)}
                >
                  {checkedMemberIds.length > 0 && (
                    <span className={styles.colorDotCol}>
                      {checkedMemberIds.map(id => (
                        <span key={id} style={{ width: 10, height: 10, borderRadius: '50%', background: memberMap[id]?.color, display: 'block', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.7)' }} />
                      ))}
                    </span>
                  )}
                  {drawerOpen ? '>' : '<'}
                </button>
                {lines.map((line, i) => (
                  <div key={i}>
                    {breaks.has(i) ? (
                      <div className={styles.breakRow}>
                        <div className={styles.breakLine} />
                        <span className={styles.breakLabel}>ブロック {blockOf(i) + 1}</span>
                        <button className={styles.removeBreakBtn} onClick={() => toggleBreak(i)}>━ 区切り削除</button>
                        <div className={styles.breakLine} />
                      </div>
                    ) : i > 0 ? (
                      <div className={styles.addBreakRow}>
                        <button className={styles.addBreakBtn} onClick={() => toggleBreak(i)}>＋ 区切り追加</button>
                      </div>
                    ) : null}

                    {i === 0 && <div className={styles.blockLabel}>ブロック 1</div>}

                    {/* 通常行 */}
                    <div
                      className={styles.lyricLine}
                      onPointerDown={e => {
                        // ハモリモードの長押しドラッグは文字ボタン側で処理するためここでは何もしない
                      }}
                      onPointerMove={e => {
                        if (harmonyDragRef.current) {
                          const els = document.elementsFromPoint(e.clientX, e.clientY)
                          for (const el of els) {
                            const ciStr = (el as HTMLElement).dataset?.harmonyCi
                            const liStr = (el as HTMLElement).dataset?.harmonyLine
                            if (ciStr !== undefined && liStr !== undefined) {
                              const { memberId, mode } = harmonyDragRef.current
                              assignHarmonyChar(Number(liStr), Number(ciStr), memberId, mode)
                              break
                            }
                          }
                          return
                        }
                        if (mainDragRef.current && mainDragRef.current.lineIdx === i) {
                          const els = document.elementsFromPoint(e.clientX, e.clientY)
                          for (const el of els) {
                            const ciStr = (el as HTMLElement).dataset?.mainCi
                            const liStr = (el as HTMLElement).dataset?.mainLine
                            if (ciStr !== undefined && liStr !== undefined) {
                              assignMainChar(Number(liStr), Number(ciStr), mainDragRef.current.memberIds)
                              break
                            }
                          }
                        }
                      }}
                      onPointerUp={e => {
                        mainDragRef.current = null
                        harmonyDragRef.current = null
                      }}
                      onDoubleClick={e => {
                        e.stopPropagation()
                        if (checkedMemberIds.length === 0) return
                        if (harmonyMode === 'main') {
                          const sorted = [...checkedMemberIds].sort((a, b) => a - b)
                          setLines(prev => prev.map((l, idx) => idx !== i ? l : {
                            ...l,
                            member_ids: sorted,
                            word_members: l.word_members.map(w => ({ ...w, member_ids: sorted }))
                          }))
                        } else {
                          const memberId = checkedMemberIds[0]
                          const mode = harmonyMode
                          setLines(prev => prev.map((l, idx) => {
                            if (idx !== i) return l
                            const lChars = l.text.split('')
                            const newWm: WordMember[] = l.word_members.length === lChars.length
                              ? l.word_members.map(w => mode === 'up' ? { ...w, harmony_up_id: memberId } : { ...w, harmony_down_id: memberId })
                              : lChars.map((c, ci) => ({
                                  text: c,
                                  member_ids: l.word_members[ci]?.member_ids || [],
                                  harmony_up_id: mode === 'up' ? memberId : l.word_members[ci]?.harmony_up_id,
                                  harmony_down_id: mode === 'down' ? memberId : l.word_members[ci]?.harmony_down_id,
                                }))
                            return { ...l, word_members: newWm }
                          }))
                        }
                      }}
                      onPointerCancel={() => {
                        mainDragRef.current = null
                        harmonyDragRef.current = null
                      }}
                    >
                      {hasTimestamp && (
                        <span className={styles.timestamp}>
                          {line.timestamp_ms != null
                            ? `${String(Math.floor(line.timestamp_ms / 60000)).padStart(2, '0')}:${String(Math.floor((line.timestamp_ms % 60000) / 1000)).padStart(2, '0')}`
                            : '--:--'}
                        </span>
                      )}
                      {harmonyMode !== 'main' ? (
                        <span className={styles.lyricText}>
                          {line.text.split('').map((ch, ci) => {
                            const w = line.word_members[ci]
                            const upColor = w?.harmony_up_id ? memberMap[w.harmony_up_id]?.color : null
                            const downColor = w?.harmony_down_id ? memberMap[w.harmony_down_id]?.color : null
                            // メインパートの色分け：word_membersがあればそちら、なければ行全体の member_ids
                            const mainIds = (w?.member_ids?.length ? w.member_ids : line.member_ids) || []
                            let charContent: React.ReactNode
                            if (mainIds.length === 0) {
                              charContent = <span style={{ color: '#fff' }}>{ch}</span>
                            } else if (mainIds.length === 1) {
                              charContent = <span style={{ color: memberMap[mainIds[0]]?.color || '#fff' }}>{ch}</span>
                            } else {
                              const stops = mainIds.map((id, idx) => { const pct = 100 / mainIds.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${idx * pct}%, ${color} ${(idx + 1) * pct}%` }).join(', ')
                              charContent = <span style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{ch}</span>
                            }
                            let content: React.ReactNode = charContent
                            if (downColor) content = <span style={{ textDecoration: `underline 2px ${downColor}`, textDecorationSkipInk: 'none' }}>{content}</span>
                            if (upColor) content = <span style={{ textDecoration: `overline 2px ${upColor}`, textDecorationSkipInk: 'none' }}>{content}</span>
                            return (
                              <button
                                key={ci}
                                data-harmony-ci={ci}
                                data-harmony-line={i}
                                className={styles.harmonyCharBtn}
                                style={{ }}
                                onPointerDown={e => {
                                  e.stopPropagation()
                                  if (checkedMemberIds.length === 0) return
                                  harmonyDragRef.current = { lineIdx: i, memberId: checkedMemberIds[0], mode: harmonyMode as 'up' | 'down' }
                                  assignHarmonyChar(i, ci, checkedMemberIds[0], harmonyMode as 'up' | 'down')
                                }}
                                onPointerEnter={e => {
                                  if (!harmonyDragRef.current || harmonyDragRef.current.lineIdx !== i) return
                                  const { memberId, mode } = harmonyDragRef.current
                                  assignHarmonyChar(i, ci, memberId, mode)
                                }}
                                onPointerUp={e => { e.stopPropagation(); harmonyDragRef.current = null }}
                              >{content}</button>
                            )
                          })}
                        </span>
                      ) : renderLineText(line, i)}
                      {(() => { const ids = line.word_members?.length ? [...new Set(line.word_members.flatMap(w => [...w.member_ids, ...(w.harmony_up_id ? [w.harmony_up_id] : []), ...(w.harmony_down_id ? [w.harmony_down_id] : [])]))] : line.member_ids; return ids?.length > 0 ? (<span className={styles.memberBadges}>{ids.map(id => (<span key={id} className={styles.memberBadge} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />))}</span>) : null })()} 
                      <button
                        className={styles.clearLineBtn}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation()
                          if (harmonyMode === 'main') {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, member_ids: [], word_members: l.word_members.map(w => ({ ...w, member_ids: [] })) } : l))
                          } else if (harmonyMode === 'up') {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, word_members: l.word_members.map(w => ({ ...w, harmony_up_id: undefined })) } : l))
                          } else {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, word_members: l.word_members.map(w => ({ ...w, harmony_down_id: undefined })) } : l))
                          }
                        }}
                        title="割り当て解除"
                      >✕</button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'prompter' && (
        <div className={styles.membersPanel}>
          <div className={styles.infoForm}>
            <div className={styles.infoFormRow} style={{ alignItems: 'flex-start' }}>
              <label className={`${styles.infoFormLabel} ${styles.infoFormLabelTop}`}>表紙テキスト</label>
              <div style={{ flex: 1 }}>
                <textarea
                  className={styles.descriptionInput}
                  value={coverText}
                  onChange={e => setCoverText(e.target.value.slice(0, 300))}
                  placeholder="スライド表紙に表示するテキスト（300文字まで）"
                  rows={4}
                />
                <div className={`${styles.descriptionCountWrap} ${coverText.length >= 300 ? styles.descriptionCountMax : styles.descriptionCountOk}`}>
                  {coverText.length}/300
                </div>
              </div>
            </div>
            <div className={styles.infoFormRow}>
              <label className={styles.infoFormLabel}>背景カラー</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="color"
                  value={bgColor}
                  onChange={e => setBgColor(e.target.value)}
                  className={styles.colorPicker}
                  style={{ width: 40, height: 40 }}
                />
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{bgColor}</span>
                <button
                  className={styles.addBtn}
                  onClick={() => setBgColor('#000000')}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                >
                  リセット
                </button>
              </div>
            </div>
          </div>
          <hr className={styles.divider} />
          <div className={styles.saveBtnRow}>
            <button className={styles.saveBtn} onClick={saveAll} disabled={savingMeta}>
              {savingMeta ? <><span className={styles.spinnerSm} />保存中</> : '💾 保存'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
