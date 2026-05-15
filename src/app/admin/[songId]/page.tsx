'use client'
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/components/Loading'
import styles from './page.module.css'

const PALETTE = [
  '#FF4444', '#FF8C00', '#FFD700', '#7CFC00', '#00CED1',
  '#1E90FF', '#9370DB', '#FF69B4', '#FFFFFF', '#AAAAAA',
]

interface Member { id: number; name: string; color: string; sort_order: number }

interface WordMember { text: string; member_ids: number[] }

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
  for (const raw of lrc.split('\n')) {
    const trimmed = raw.trim()
    const match = trimmed.match(/^\[(\d+):(\d+)[.:](\d+)\](.*)$/)
    if (match) {
      const ms = parseInt(match[1]) * 60000 + parseInt(match[2]) * 1000 + Math.round(parseInt(match[3]) * 10)
      const text = match[4].trim()
      if (!text) { prevWasEmpty = true; continue }
      if (prevWasEmpty && lines.length > 0) breaks.add(lines.length)
      lines.push({ text, member_ids: [], timestamp_ms: ms, word_members: [] })
      prevWasEmpty = false
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

// テキストをトークン（文字列＋スペース）に分割
function tokenize(text: string): string[] {
  const tokens: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ch === ' ' || ch === '　') {
      if (cur) { tokens.push(cur); cur = '' }
      tokens.push(ch)
    } else {
      cur += ch
    }
  }
  if (cur) tokens.push(cur)
  return tokens
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

  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lines, setLines] = useState<FlatLine[]>([])
  const [breaks, setBreaks] = useState<Set<number>>(new Set())
  const [checkedMemberIds, setCheckedMemberIds] = useState<number[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'info' | 'lrc' | 'parts'>('info')
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [lrcText, setLrcText] = useState('') // 生のLRCテキスト
  const [expandedLine, setExpandedLine] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isDraggingRef = useRef(false)


  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => {
      setSong(s); setEditTitle(s.title); setEditArtist(s.artist || ''); setMembers(m)
      if (Array.isArray(l) && l.length > 0) {
        const { lines: fl, breaks: br } = fromDbFormat(l)
        setLines(fl); setBreaks(br)
        setLrcText(toLrcText(fl, br))
      }
    })
  }, [songId])

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  // ---- メンバー操作 ----
  const addMember = () => {
    if (members.length >= 10) return
    setMembers(prev => [...prev, { id: -(Date.now()), name: '', color: PALETTE[prev.length % PALETTE.length], sort_order: prev.length }])
  }
  const updateMember = (idx: number, field: 'name' | 'color', val: string) =>
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  const removeMember = (idx: number) =>
    setMembers(prev => prev.filter((_, i) => i !== idx))

  const saveMembers = async () => {
    setSaving(true)
    const res = await fetch(`/api/songs/${songId}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(members.map((m, i) => ({ ...m, sort_order: i }))),
    })
    const saved: Member[] = await res.json()

    // 旧ID→新IDのマッピングを作成（同じsort_orderで対応）
    const oldMembers = members
    const idMap = new Map<number, number>()
    oldMembers.forEach((old, i) => {
      if (saved[i]) idMap.set(old.id, saved[i].id)
    })

    // linesのmember_ids / word_membersを新IDに更新
    const remapIds = (ids: number[]) =>
      ids.map(id => idMap.get(id) ?? id).filter(id => saved.some(m => m.id === id))

    setLines(prev => prev.map(l => ({
      ...l,
      member_ids: remapIds(l.member_ids),
      word_members: l.word_members.map(w => ({ ...w, member_ids: remapIds(w.member_ids) })),
    })))

    setMembers(saved)
    setSaving(false)
    alert('メンバーを保存しました')
  }

  const saveMeta = async () => {
    setSavingMeta(true)
    await fetch(`/api/songs/${songId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, artist: editArtist }),
    })
    setSong((s: any) => ({ ...s, title: editTitle, artist: editArtist }))
    setSavingMeta(false); alert('曲情報を保存しました')
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

  // LRCテキストを直接編集して適用
  const applyLrcTextFromEditor = () => {
    applyLrcText(lrcText)
    alert('歌詞を反映しました')
  }

  // ---- ブロック区切り ----
  const toggleBreak = (i: number) => {
    setBreaks(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  // ---- 行ドラッグでメンバー割り当て ----
  const assignMembers = useCallback((i: number) => {
    if (checkedMemberIds.length === 0) return
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, member_ids: [...checkedMemberIds] } : l))
  }, [checkedMemberIds])

  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  const handleLineLongPressStart = (e: React.PointerEvent, i: number) => {
    // 展開済みの行はドラッグ割り当てのみ
    if (expandedLine === i) {
      if (checkedMemberIds.length === 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      isDraggingRef.current = true; setIsDragging(true); assignMembers(i)
      return
    }
    // 長押タイマー開始
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      toggleExpand(i)
    }, 500)
    // 通常のドラッグも並行して開始
    if (checkedMemberIds.length > 0) {
      e.currentTarget.setPointerCapture(e.pointerId)
      isDraggingRef.current = true; setIsDragging(true); assignMembers(i)
    }
  }

  const handleLineLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  const handleLinePointerEnter = (i: number) => {
    if (!isDraggingRef.current || expandedLine === i) return
    assignMembers(i)
  }
  const handlePointerUp = () => { isDraggingRef.current = false; setIsDragging(false) }

  // ---- 単語分割モード ----
  const wordMembersSnapshot = useRef<WordMember[]>([])

  const toggleExpand = (i: number) => {
    if (expandedLine === i) {
      // 閉じる時、全て未割り当てならスナップショットに戻す
      setLines(prev => prev.map((l, idx) => {
        if (idx !== i) return l
        const allEmpty = l.word_members.every(w => w.member_ids.length === 0)
        return allEmpty ? { ...l, word_members: wordMembersSnapshot.current } : l
      }))
      setExpandedLine(null)
      return
    }
    // 展開時に現在のword_membersをスナップショットとして保持
    const currentLine = lines[i]
    wordMembersSnapshot.current = currentLine.word_members
    // word_membersが空なら初期化（既存の場合はそのまま）
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      if (l.word_members.length > 0) return l
      const tokens = tokenize(l.text)
      return { ...l, word_members: tokens.map(t => ({ text: t, member_ids: [] })) }
    }))
    setExpandedLine(i)
  }

  const assignWordMember = (lineIdx: number, wordIdx: number) => {
    if (checkedMemberIds.length === 0) return
    setLines(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      const wm = l.word_members.map((w, wi) =>
        wi === wordIdx ? { ...w, member_ids: [...checkedMemberIds] } : w
      )
      return { ...l, word_members: wm }
    }))
  }

  const clearWordMembers = (lineIdx: number) => {
    setLines(prev => prev.map((l, i) =>
      i === lineIdx ? { ...l, word_members: [] } : l
    ))
    setExpandedLine(null)
  }

  // ---- 歌詞保存 ----
  const saveLyrics = async () => {
    setSaving(true)
    await fetch(`/api/songs/${songId}/lyrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toDbFormat(lines, breaks)),
    })
    setSaving(false); alert('歌詞を保存しました')
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

  function GradientText({ text, memberIds, id }: { text: string; memberIds: number[]; id: string }) {
    const colors = memberIds.map(mid => memberMap[mid]?.color || '#fff')
    const gradientId = `grad-${id}`
    const fontSize = 17, height = fontSize * 2.2
    return (
      <svg className={styles.lyricSvg} height={height} style={{ overflow: 'visible', flex: 1 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
            {colors.map((color, i) => (
              <React.Fragment key={i}>
                <stop offset={`${(i / colors.length) * 100}%`} stopColor={color} />
                <stop offset={`${((i + 1) / colors.length) * 100}%`} stopColor={color} />
              </React.Fragment>
            ))}
          </linearGradient>
        </defs>
        <text x="0" y={fontSize * 1.4} fontSize={fontSize} fontFamily="'Hiragino Sans', sans-serif" fill={`url(#${gradientId})`}>{text}</text>
      </svg>
    )
  }

  // 単語分割モードのテキスト表示
  function renderLineText(line: FlatLine, lineIdx: number) {
    if (line.word_members.length > 0) {
      return (
        <span className={styles.lyricText}>
          {line.word_members.map((w, wi) => {
            const isSpace = w.text === ' ' || w.text === '　'
            if (isSpace) return <span key={wi} style={{ color: 'transparent' }}>{w.text}</span>
            if (w.member_ids.length === 0) return <span key={wi} style={{ color: '#fff' }}>{w.text}</span>
            if (w.member_ids.length === 1) return <span key={wi} style={{ color: memberMap[w.member_ids[0]]?.color || '#fff' }}>{w.text}</span>
            return <GradientText key={wi} text={w.text} memberIds={w.member_ids} id={`w-${lineIdx}-${wi}`} />
          })}
        </span>
      )
    }
    if (line.member_ids.length > 1) {
      return (
        <span className={styles.lyricText}>
          <GradientText text={line.text} memberIds={line.member_ids} id={`${lineIdx}`} />
        </span>
      )
    }
    return <span className={styles.lyricText} style={lineGradient(line.member_ids)}>{line.text}</span>
  }

  const toggleMemberCheck = (id: number) =>
    setCheckedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const blockOf = (i: number) => {
    let b = 0
    for (let j = 1; j <= i; j++) if (breaks.has(j)) b++
    return b
  }

  if (!song) return <Loading label="歌詞編集" />

  return (
    <div className={styles.container} onPointerUp={handlePointerUp}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.backLink}>← 管理画面</Link>
        <h1 className={styles.title}>🎤 歌詞編集</h1>
        <div className={styles.headerActions}>
          <Link href={`/prompter/${songId}`} className={styles.previewLink} target="_blank">▶ プロンプター表示 ↗</Link>
          <a href={`/api/songs/${songId}/export/pptx`} className={styles.exportBtn} download>📥 PPTX出力</a>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'info' ? styles.tabActive : ''}`} onClick={() => setTab('info')}>📝 楽曲情報</button>
        <button className={`${styles.tab} ${tab === 'lrc' ? styles.tabActive : ''}`} onClick={() => setTab('lrc')}>🎵 歌詞編集</button>
        <button className={`${styles.tab} ${tab === 'parts' ? styles.tabActive : ''}`} onClick={() => setTab('parts')}>🎨 パート分け</button>
      </div>

      {tab === 'info' && (
        <div className={styles.membersPanel}>
          {/* 楽曲情報 */}
          <div className={styles.metaSection}>
            <input className={styles.metaInput} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="曲名" />
            <input className={styles.metaInput} value={editArtist} onChange={e => setEditArtist(e.target.value)} placeholder="アーティスト" />
            <button className={styles.saveBtn} onClick={saveMeta} disabled={savingMeta}>{savingMeta ? '保存中...' : '楽曲情報を保存'}</button>
          </div>
          <hr className={styles.divider} />
          {/* メンバー設定 */}
          <p className={styles.hint}>最大10名まで登録できます。色はパレットから選択してください。</p>
          <div className={styles.memberList}>
            {members.map((m, i) => (
              <div key={m.id} className={styles.memberRow}>
                <span className={styles.memberNum}>{i + 1}</span>
                <input className={styles.memberNameInput} value={m.name} onChange={e => updateMember(i, 'name', e.target.value)} placeholder={`メンバー${i + 1}`} />
                <div className={styles.palette}>
                  {PALETTE.map(color => (
                    <button key={color} className={`${styles.colorBtn} ${m.color === color ? styles.colorBtnActive : ''}`} style={{ background: color }} onClick={() => updateMember(i, 'color', color)} title={color} />
                  ))}
                  <span className={styles.paletteDivider} />
                  <input type="color" className={`${styles.colorPicker} ${!PALETTE.includes(m.color) ? styles.colorPickerActive : ''}`} value={m.color} onChange={e => updateMember(i, 'color', e.target.value)} title="カスタムカラー" />
                </div>
                <div className={styles.colorPreview} style={{ background: m.color }} />
                <button className={styles.removeBtn} onClick={() => removeMember(i)}>✕</button>
              </div>
            ))}
          </div>
          <div className={styles.memberActions}>
            <button className={styles.addBtn} onClick={addMember} disabled={members.length >= 10}>＋ メンバー追加</button>
            <button className={styles.saveBtn} onClick={saveMembers} disabled={saving}>{saving ? '保存中...' : '💾 保存'}</button>
          </div>
        </div>
      )}

      {tab === 'lrc' && (
        <div className={styles.lyricsPanel}>
          <div className={styles.lyricsToolbar}>
            <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>📂 LRCインポート</button>
            <input ref={fileRef} type="file" accept=".lrc,.txt" style={{ display: 'none' }} onChange={handleLrcImport} />
            <button className={styles.saveBtn} onClick={applyLrcTextFromEditor}>🔄 パート分けに反映</button>
            <button className={styles.saveBtn} onClick={saveLyrics} disabled={saving}>{saving ? '保存中...' : '💾 DB保存'}</button>
          </div>
          <p className={styles.hint}>LRCテキストを直接編集できます。「パート分けに反映」でパート分けタブに反映されます。</p>
          <textarea
            className={styles.lrcEditor}
            value={lrcText}
            onChange={e => setLrcText(e.target.value)}
            placeholder="[00:00.00]歌詞テキストをここに貼り付け..."
            spellCheck={false}
          />
        </div>
      )}

      {tab === 'parts' && (
        <div className={styles.lyricsPanel}>
          <div className={styles.lyricsToolbar}>
            <button className={styles.saveBtn} onClick={saveLyrics} disabled={saving}>{saving ? '保存中...' : '💾 パート分けを保存'}</button>
          </div>
          <p className={styles.hint}>行間の「＋ 区切り追加」でブロックを分割。行を長押しで単語ごとのパート分けができます。</p>

          {lines.length === 0 ? (
            <p className={styles.hint}>LRCファイルをインポートして歌詞を読み込んでください。</p>
          ) : (
            <div className={styles.editorLayout}>
              <div className={styles.memberSelector}>
                <p className={styles.selectorTitle}>歌唱者を選択してから歌詞をなぞってください</p>
                {members.length === 0 ? (
                  <p className={styles.hint}>先にメンバーを登録してください</p>
                ) : (
                  <div className={styles.selectorList}>
                    {members.map(m => (
                      <label key={m.id} className={styles.selectorItem}>
                        <input type="checkbox" checked={checkedMemberIds.includes(m.id)} onChange={() => toggleMemberCheck(m.id)} />
                        <span className={styles.selectorDot} style={{ background: m.color }} />
                        <span className={styles.selectorName}>{m.name || `メンバー${m.sort_order + 1}`}</span>
                      </label>
                    ))}
                  </div>
                )}
                {checkedMemberIds.length > 0 && (
                  <div className={styles.selectedPreview}>
                    選択中：
                    {checkedMemberIds.map(id => (
                      <span key={id} className={styles.selectedDot} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />
                    ))}
                  </div>
                )}
                <button className={styles.clearBtn} onClick={() => setCheckedMemberIds([])}>選択解除</button>
              </div>

              <div className={styles.blocksArea}>
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
                      className={`${styles.lyricLine} ${isDragging && checkedMemberIds.length > 0 ? styles.lyricLineDragging : ''} ${expandedLine === i ? styles.lyricLineExpanded : ''}`}
                      onPointerDown={e => handleLineLongPressStart(e, i)}
                      onPointerUp={handleLineLongPressEnd}
                      onPointerCancel={handleLineLongPressEnd}
                      onPointerEnter={() => handleLinePointerEnter(i)}
                    >
                      <span className={styles.timestamp}>
                        {line.timestamp_ms != null
                          ? `${String(Math.floor(line.timestamp_ms / 60000)).padStart(2, '0')}:${String(Math.floor((line.timestamp_ms % 60000) / 1000)).padStart(2, '0')}`
                          : '--:--'}
                      </span>
                      {renderLineText(line, i)}
                      {line.word_members.length > 0 && (
                        <span className={styles.wordModeIndicator} title="単語分割設定あり">✂</span>
                      )}
                      {line.member_ids.length > 0 && line.word_members.length === 0 && (
                        <span className={styles.memberBadges}>
                          {line.member_ids.map(id => (
                            <span key={id} className={styles.memberBadge} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />
                          ))}
                        </span>
                      )}
                      <button
                        className={styles.clearLineBtn}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation()
                          setLines(prev => prev.map((l, idx) => idx === i ? { ...l, member_ids: [], word_members: [] } : l))
                          if (expandedLine === i) setExpandedLine(null)
                        }}
                        title="割り当て解除"
                      >✕</button>
                    </div>

                    {/* 単語分割モード展開パネル */}
                    {expandedLine === i && (
                      <div className={styles.wordPanel}>
                        <div className={styles.wordPanelHint}>
                          <span>メンバーを選択して単語をクリックで割り当て</span>
                          <div className={styles.wordPanelActions}>
                            <button className={styles.wordPanelClose} onClick={() => toggleExpand(i)}>✕ 閉じる</button>
                            <button className={styles.wordPanelClear} onClick={() => clearWordMembers(i)}>単語分割を解除</button>
                          </div>
                        </div>
                        <div className={styles.wordTokens}>
                          {line.word_members.map((w, wi) => {
                            const isSpace = w.text === ' ' || w.text === '　'
                            if (isSpace) return <span key={wi} className={styles.wordSpace}>{w.text}</span>
                            const color = w.member_ids.length > 0 ? (memberMap[w.member_ids[0]]?.color || '#888') : '#444'
                            const hasAssign = w.member_ids.length > 0
                            return (
                              <button
                                key={wi}
                                className={`${styles.wordToken} ${hasAssign ? styles.wordTokenAssigned : ''}`}
                                style={{ borderColor: color, color: hasAssign ? color : '#aaa' }}
                                onClick={e => { e.stopPropagation(); assignWordMember(i, wi) }}
                                onContextMenu={e => {
                                  e.preventDefault(); e.stopPropagation()
                                  setLines(prev => prev.map((l, li) =>
                                    li !== i ? l : { ...l, word_members: l.word_members.map((ww, wii) => wii === wi ? { ...ww, member_ids: [] } : ww) }
                                  ))
                                }}
                                title={hasAssign ? `${w.member_ids.map(id => memberMap[id]?.name).join('+')}（右クリックで解除）` : 'クリックで割り当て'}
                              >
                                {w.text}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
