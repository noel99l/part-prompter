'use client'
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import skStyles from '@/components/skeleton.module.css'
import styles from './page.module.css'
import { mergeAssignments } from '@/lib/lyrics/merge'
import { harmonyIds, harmonyBandStyle } from '@/lib/harmony'
import TimestampTapper from '@/components/TimestampTapper'
import Mp4ExportMenuItem from '@/components/Mp4ExportMenuItem'

const PALETTE = [
  '#FF4444', '#FF8C00', '#FFD700', '#7CFC00', '#00CED1',
  '#1E90FF', '#9370DB', '#FF69B4', '#FFFFFF', '#AAAAAA',
]

interface Member { id: number; name: string; color: string; sort_order: number }

// 上ハモ・下ハモは複数名を登録できる。編集状態では常に配列形式で持ち、
// 旧形式（harmony_up_id / harmony_down_id）は読み込み時に配列へ正規化する
interface WordMember { text: string; member_ids: number[]; harmony_up_ids?: number[]; harmony_down_ids?: number[] }

function normalizeWordMember(w: any): WordMember {
  const up = harmonyIds(w, 'up')
  const down = harmonyIds(w, 'down')
  return {
    text: w.text,
    member_ids: w.member_ids || [],
    ...(up.length > 0 ? { harmony_up_ids: up } : {}),
    ...(down.length > 0 ? { harmony_down_ids: down } : {}),
  }
}

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
    word_members: (l.word_members || []).map(normalizeWordMember),
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

// 保存済みかどうかを判定するためのスナップショット文字列を生成する（全編集対象を直列化）。
interface SnapshotInput {
  title: string; artist: string; description: string; isPublic: boolean
  coverText: string; bgColor: string
  originalBpm: number | ''; playbackBpm: number | ''; showProgressBar: boolean
  members: Member[]; lines: FlatLine[]; breaks: Set<number>; lrcText: string
}
function snapshotOf(v: SnapshotInput): string {
  return JSON.stringify({
    title: v.title, artist: v.artist, description: v.description, isPublic: v.isPublic,
    coverText: v.coverText, bgColor: v.bgColor,
    originalBpm: v.originalBpm, playbackBpm: v.playbackBpm, showProgressBar: v.showProgressBar,
    members: v.members, lines: v.lines, breaks: [...v.breaks].sort((a, b) => a - b), lrcText: v.lrcText,
  })
}

/** タイムスタンプのバリデーション。異常があればエラーメッセージを返す（正常なら null）。 */
const MAX_TIMESTAMP_MS = 3600000 // 60分
function validateTimestamps(lines: FlatLine[]): string | null {
  const tsLines = lines.filter(l => l.timestamp_ms != null)
  if (tsLines.length === 0) return null // タイムスタンプ無し＝プレーンテキストで正常

  for (let i = 0; i < tsLines.length; i++) {
    const ts = tsLines[i].timestamp_ms!
    if (ts < 0) {
      return `タイムスタンプにマイナス値があります（行: ${tsLines[i].text.slice(0, 20)}…）`
    }
    if (ts > MAX_TIMESTAMP_MS) {
      return `タイムスタンプが60分を超えています（行: ${tsLines[i].text.slice(0, 20)}…）`
    }
  }

  // 順序チェック：タイムスタンプが前の行より小さい場合に警告
  for (let i = 1; i < tsLines.length; i++) {
    if (tsLines[i].timestamp_ms! < tsLines[i - 1].timestamp_ms!) {
      return `タイムスタンプが時系列順ではありません（行: ${tsLines[i].text.slice(0, 20)}…）。順序を確認してください`
    }
  }

  return null
}

export default function LyricsEditor() {
  const { songId } = useParams<{ songId: string }>()
  const router = useRouter()
  const { data: session } = useSession()

  const [song, setSong] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lines, setLines] = useState<FlatLine[]>([])
  const [breaks, setBreaks] = useState<Set<number>>(new Set())
  const [checkedMemberIds, setCheckedMemberIds] = useState<number[]>([])
  const [harmonyMode, setHarmonyMode] = useState<'main' | 'up' | 'down'>('main')
  const harmonyDragRef = useRef<{ lineIdx: number; memberIds: number[]; mode: 'up' | 'down'; op: 'add' | 'remove' } | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [dirty, setDirty] = useState(false)
  const savedSnapshotRef = useRef<string | null>(null)
  const [tab, setTab] = useState<'info' | 'lrc' | 'parts' | 'prompter'>('info')
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [coverText, setCoverText] = useState('')
  const [bgColor, setBgColor] = useState('#000000')
  const [originalBpm, setOriginalBpm] = useState<number | ''>('')
  const [playbackBpm, setPlaybackBpm] = useState<number | ''>('')
  const [showProgressBar, setShowProgressBar] = useState(true)
  const [editDescription, setEditDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = React.useRef<HTMLDivElement>(null)
  const [showDownload, setShowDownload] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const [lrcText, setLrcText] = useState('') // 生のLRCテキスト
  const fileRef = useRef<HTMLInputElement>(null)
  const [showTimestampTapper, setShowTimestampTapper] = useState(false)


  useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${songId}`).then(r => r.json()),
      fetch(`/api/songs/${songId}/members`).then(r => r.json()),
      fetch(`/api/songs/${songId}/lyrics`).then(r => r.json()),
    ]).then(([s, m, l]) => {
      setSong(s); setEditTitle(s.title); setEditArtist(s.artist || ''); setEditDescription(s.description || ''); setIsPublic(s.is_public !== false); setCoverText(s.cover_text || ''); setBgColor(s.bg_color || '#000000'); setOriginalBpm(s.original_bpm ?? ''); setPlaybackBpm(s.playback_bpm ?? ''); setShowProgressBar(s.show_progress_bar !== false); setMembers(m)
      let fl: FlatLine[] = []
      let br = new Set<number>()
      if (Array.isArray(l) && l.length > 0) {
        const parsed = fromDbFormat(l)
        fl = parsed.lines; br = parsed.breaks
        setLines(fl); setBreaks(br)
        setLrcText(toLrcText(fl, br))
      }
      // 読み込み直後を「保存済み」基準として記録する
      savedSnapshotRef.current = snapshotOf({
        title: s.title, artist: s.artist || '', description: s.description || '', isPublic: s.is_public !== false,
        coverText: s.cover_text || '', bgColor: s.bg_color || '#000000',
        originalBpm: s.original_bpm ?? '', playbackBpm: s.playback_bpm ?? '', showProgressBar: s.show_progress_bar !== false,
        members: m, lines: fl, breaks: br, lrcText: toLrcText(fl, br),
      })
      setDirty(false)
    })
    fetch('/api/master-settings').then(r => r.json()).then(data => {
      const globalOn = data.show_download === '1'
      const whitelist = (data.download_whitelist || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
      const userEmail = session?.user?.email?.toLowerCase() || ''
      setShowDownload(globalOn || whitelist.includes(userEmail))
    }).catch(() => {})
  }, [songId, session?.user?.email])

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  // 編集対象に変更があれば未保存(dirty)としてマークする（保存済みスナップショットと比較）
  useEffect(() => {
    if (savedSnapshotRef.current === null) return
    const cur = snapshotOf({
      title: editTitle, artist: editArtist, description: editDescription, isPublic,
      coverText, bgColor, originalBpm, playbackBpm, showProgressBar,
      members, lines, breaks, lrcText,
    })
    setDirty(cur !== savedSnapshotRef.current)
  }, [editTitle, editArtist, editDescription, isPublic, coverText, bgColor, originalBpm, playbackBpm, showProgressBar, members, lines, breaks, lrcText])

  // 未保存のままページを離れようとしたら警告する
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    const validIds = new Set(members.map(m => m.id))
    setCheckedMemberIds(prev => prev.filter(id => validIds.has(id)))
    setLines(prev => prev.map(l => ({
      ...l,
      member_ids: l.member_ids.filter(id => validIds.has(id)),
      word_members: l.word_members.map(w => {
        const up = (w.harmony_up_ids ?? []).filter(id => validIds.has(id))
        const down = (w.harmony_down_ids ?? []).filter(id => validIds.has(id))
        return {
          ...w,
          member_ids: w.member_ids.filter(id => validIds.has(id)),
          harmony_up_ids: up.length > 0 ? up : undefined,
          harmony_down_ids: down.length > 0 ? down : undefined,
        }
      }),
    })))
  }, [members])

  // ---- メンバー操作 ----
  // メンバーを保存し、新規IDのリマップを反映した行を返す（状態は呼び出し側で確定する）。
  const putMembersAndRemap = async (
    newMembers: Member[],
    linesToRemap: FlatLine[]
  ): Promise<{ savedMembers: Member[]; remapped: FlatLine[] }> => {
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

    const remapHarmony = (ids?: number[]) => {
      if (!ids || ids.length === 0) return undefined
      const r = remapIds(ids)
      return r.length > 0 ? r : undefined
    }
    const remapped = linesToRemap.map(l => ({
      ...l,
      member_ids: remapIds(l.member_ids),
      word_members: l.word_members.map(w => ({
        ...w,
        member_ids: remapIds(w.member_ids),
        harmony_up_ids: remapHarmony(w.harmony_up_ids),
        harmony_down_ids: remapHarmony(w.harmony_down_ids),
      })),
    }))

    return { savedMembers: saved, remapped }
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

  // タブ切替時に歌詞テキスト⇔行データを同期し、編集の取りこぼしを防ぐ
  const changeTab = (next: 'info' | 'lrc' | 'parts' | 'prompter') => {
    if (next === tab) return
    if (tab === 'lrc') {
      // 歌詞テキストの編集を行・区切りへ反映（lines/breaks を最新化）
      const { merged, br } = mergeLrcText(lrcText)
      setLines(merged); setBreaks(br); setLrcText(toLrcText(merged, br))
    }
    if (next === 'lrc') {
      // 最新の行・区切りからテキストを再生成
      setLrcText(toLrcText(lines, breaks))
    }
    setTab(next)
  }

  // タブに関係なく、曲情報・メンバー・歌詞（パート分け）をまとめて保存する
  const handleSave = async () => {
    // 歌詞編集タブ中ならテキストの編集を行・区切りへ反映してから保存する
    let curLines = lines
    let curBreaks = breaks
    if (tab === 'lrc') {
      const { merged, br } = mergeLrcText(lrcText)
      curLines = merged; curBreaks = br
    }

    // タイムスタンプのバリデーション（異常値があれば保存を中止して通知）
    const tsError = validateTimestamps(curLines)
    if (tsError) {
      showToast(tsError)
      return
    }

    setSavingAll(true)
    try {
      // 1) 楽曲情報
      await fetch(`/api/songs/${songId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, artist: editArtist, is_public: isPublic, description: editDescription, cover_text: coverText, bg_color: bgColor, original_bpm: originalBpm || null, playback_bpm: playbackBpm || null, show_progress_bar: showProgressBar }),
      })

      // 2) メンバー（新規IDのリマップ込み）
      const { savedMembers, remapped } = await putMembersAndRemap(members, curLines)

      // 3) 歌詞（パート分け）
      await fetch(`/api/songs/${songId}/lyrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toDbFormat(remapped, curBreaks)),
      })

      // ローカル状態を保存結果で確定
      const newLrcText = toLrcText(remapped, curBreaks)
      setSong((s: any) => ({ ...s, title: editTitle, artist: editArtist, is_public: isPublic, description: editDescription }))
      setMembers(savedMembers)
      setLines(remapped)
      setBreaks(curBreaks)
      setLrcText(newLrcText)

      savedSnapshotRef.current = snapshotOf({
        title: editTitle, artist: editArtist, description: editDescription, isPublic,
        coverText, bgColor, originalBpm, playbackBpm, showProgressBar,
        members: savedMembers, lines: remapped, breaks: curBreaks, lrcText: newLrcText,
      })
      setDirty(false)
      showToast('保存しました')
    } catch {
      showToast('保存に失敗しました')
    } finally {
      setSavingAll(false)
    }
  }

  // ---- LRCインポート ----
  // LRCテキストをパースし、テキスト一致・出現順で既存のmember_ids/word_membersを
  // 引き継いだ行と区切り(breaks)を返す。import・保存の双方で同じ方式を使う。
  // 引き継ぎロジックの詳細・パターンは src/lib/lyrics/merge.ts（テスト済み）を参照。
  const mergeLrcText = (text: string): { merged: FlatLine[]; br: Set<number> } => {
    const { lines: fl, breaks: br } = parseLrc(text)
    if (br.size === 0 && fl.length > 0) for (let i = 4; i < fl.length; i += 4) br.add(i)
    const merged = mergeAssignments(lines, fl) as FlatLine[]
    return { merged, br }
  }

  const applyLrcText = (text: string) => {
    const { merged, br } = mergeLrcText(text)
    setLines(merged); setBreaks(br); setLrcText(toLrcText(merged, br))
  }
  const handleLrcImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => applyLrcText(ev.target?.result as string)
    reader.readAsText(file, 'utf-8'); e.target.value = ''
  }

  // ---- ブロック区切り ----
  const toggleBreak = (i: number) => {
    setBreaks(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ---- 行ドラッグでメンバー割り当て ----
  // チェック中のメンバー全員（最大3名）を一括で適用する。
  // op はドラッグ開始時に決めて固定する（クリック＝トグル、ドラッグ＝塗り/消しの一方向）。
  // 毎回トグルするとポインタ移動のたびに付いたり消えたりしてしまうため。
  const assignHarmonyChar = useCallback((lineIdx: number, ci: number, memberIds: number[], mode: 'up' | 'down', op: 'add' | 'remove') => {
    setLines(prev => prev.map((l, li) => {
      if (li !== lineIdx) return l
      const lChars = l.text.split('')
      let newWm: WordMember[] = l.word_members.length === lChars.length
        ? [...l.word_members]
        : lChars.map((c, idx) => ({ text: c, member_ids: [], harmony_up_ids: l.word_members[idx]?.harmony_up_ids, harmony_down_ids: l.word_members[idx]?.harmony_down_ids }))
      newWm = newWm.map((ww, wi) => {
        if (wi !== ci) return ww
        const key = mode === 'up' ? 'harmony_up_ids' : 'harmony_down_ids'
        const cur = ww[key] ?? []
        const next = op === 'add'
          ? [...cur, ...memberIds.filter(id => !cur.includes(id))]
          : cur.filter(id => !memberIds.includes(id))
        return { ...ww, [key]: next.length > 0 ? next : undefined }
      })
      return { ...l, word_members: newWm }
    }))
  }, [])

  const assignMainChar = useCallback((lineIdx: number, ci: number, memberIds: number[]) => {
    setLines(prev => prev.map((l, li) => {
      if (li !== lineIdx) return l
      const lChars = l.text.split('')
      let newWm: WordMember[] = l.word_members.length === lChars.length
        ? [...l.word_members]
        : lChars.map((c, idx) => ({ text: c, member_ids: l.word_members[idx]?.member_ids || [], harmony_up_ids: l.word_members[idx]?.harmony_up_ids, harmony_down_ids: l.word_members[idx]?.harmony_down_ids }))
      newWm = newWm.map((ww, wi) => wi !== ci ? ww : { ...ww, member_ids: memberIds })
      return { ...l, word_members: newWm }
    }))
  }, [])

  const mainDragRef = useRef<{ lineIdx: number; memberIds: number[] } | null>(null)

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

  // ---- 複製して編集 ----
  // 現在の曲を複製し、複製先の編集画面へ遷移する。未保存の変更は複製に含まれない旨を確認する。
  const handleDuplicate = async () => {
    if (dirty && !window.confirm('未保存の変更は複製に含まれません。複製を続けますか？')) return
    setDuplicating(true)
    try {
      const res = await fetch(`/api/songs/${songId}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (data.id) {
        router.push(`/manage/songs/${data.id}`)
      } else {
        showToast('複製に失敗しました')
        setDuplicating(false)
      }
    } catch {
      showToast('複製に失敗しました')
      setDuplicating(false)
    }
  }

  // ---- 表示ヘルパー ----
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
            const band = harmonyBandStyle(
              harmonyIds(w, 'up').map(id => memberMap[id]?.color || '#888'),
              harmonyIds(w, 'down').map(id => memberMap[id]?.color || '#888'),
              '0.12em'
            )
            const mainColor = w?.member_ids?.length === 1 ? memberMap[w.member_ids[0]]?.color : undefined
            const isSpace = ch === ' ' || ch === '　'
            return (
              <button
                key={ci}
                className={styles.harmonyCharBtn}
                disabled={isSpace}
                style={{ color: mainColor || '#fff', ...(band || {}) }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  if (isSpace || currentChecked.length === 0) return
                  const memberIds = currentChecked
                  const mode = currentMode as 'up' | 'down'
                  const cur = harmonyIds(w, mode)
                  const op = memberIds.every(id => cur.includes(id)) ? 'remove' : 'add'
                  assignHarmonyChar(lineIdx, ci, memberIds, mode, op)
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
          const band = harmonyBandStyle(
            harmonyIds(w, 'up').map(id => memberMap[id]?.color || '#888'),
            harmonyIds(w, 'down').map(id => memberMap[id]?.color || '#888'),
            '0.12em'
          )
          let charContent: React.ReactNode
          const displayCh = ch === ' ' || ch === '　' ? ' ' : ch
          if (mainIds.length === 0) charContent = <span style={{ color: '#fff' }}>{displayCh}</span>
          else if (mainIds.length === 1) charContent = <span style={{ color: memberMap[mainIds[0]]?.color || '#fff' }}>{displayCh}</span>
          else { const stops = mainIds.map((id, idx) => { const pct = 100 / mainIds.length; const color = memberMap[id]?.color || '#fff'; return `${color} ${idx * pct}%, ${color} ${(idx + 1) * pct}%` }).join(', '); charContent = <span style={{ backgroundImage: `linear-gradient(to bottom, ${stops})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{displayCh}</span> }
          if (band) charContent = <span style={band}>{charContent}</span>
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
    setCheckedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
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

  function PlaylistAddMenuItem({ songId, songTitle }: { songId: string; songTitle?: string }) {
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

  function DeleteSongMenuItem({ songId, onDeleted }: { songId: string; onDeleted: () => void }) {
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
    const [members, setMembers] = React.useState<any[]>([])
    const [expireMinutes, setExpireMinutes] = React.useState(10080)

    const loadCollabs = () => {
      fetch(`/api/songs/${songId}/collaborators`)
        .then(r => r.json())
        .then(data => {
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
      }
      setGenerating(false)
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
                {showDownload && (
                  <>
                    <div className={styles.exportDropdownLabel}>ダウンロード</div>
                    <a href={`/api/songs/${songId}/export/pptx`} download className={styles.exportDropdownLink} onClick={() => setExportMenuOpen(false)}>📥 PPTX</a>
                    <Mp4ExportMenuItem
                      songId={songId}
                      className={styles.exportDropdownLink}
                      onClose={() => setExportMenuOpen(false)}
                    />
                    <a href={`/manage/songs/${songId}/print`} target="_blank" className={styles.exportDropdownLink} onClick={() => setExportMenuOpen(false)}>🖨️ PDF</a>
                    <LyricsTextExportMenuItem lines={lines} breaks={breaks} members={members} onClose={() => setExportMenuOpen(false)} />
                    <div className={styles.exportDropdownDivider} />
                  </>
                )}
                <CollaboratorMenuItem songId={songId} />
                <PlaylistAddMenuItem songId={songId} songTitle={song?.title} />
                <button
                  className={styles.exportDropdownLink}
                  onClick={() => { setExportMenuOpen(false); handleDuplicate() }}
                  disabled={duplicating}
                >
                  {duplicating ? '複製中...' : '📄 複製して編集'}
                </button>
                <div className={styles.exportDropdownDivider} />
                <DeleteSongMenuItem songId={songId} onDeleted={() => router.push('/manage/songs')} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'info' ? styles.tabActive : ''}`} onClick={() => changeTab('info')}>
          <span className={styles.tabIcon}>📝</span><span className={styles.tabLabel}> 楽曲情報</span>
        </button>
        <button className={`${styles.tab} ${tab === 'lrc' ? styles.tabActive : ''}`} onClick={() => changeTab('lrc')}>
          <span className={styles.tabIcon}>🎵</span><span className={styles.tabLabel}> 歌詞編集</span>
        </button>
        <button className={`${styles.tab} ${tab === 'parts' ? styles.tabActive : ''}`} onClick={() => changeTab('parts')}>
          <span className={styles.tabIcon}>🎨</span><span className={styles.tabLabel}> パート分け</span>
        </button>
        <button className={`${styles.tab} ${tab === 'prompter' ? styles.tabActive : ''}`} onClick={() => changeTab('prompter')}>
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
        </div>
      )}

      {tab === 'lrc' && (
        <div className={styles.lyricsPanel}>
          <div className={styles.lyricsToolbar}>
            <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>📂 LRCインポート</button>
            <input ref={fileRef} type="file" accept=".lrc,.txt" className={styles.fileInputHidden} onChange={handleLrcImport} />
            <button
              className={styles.importBtn}
              onClick={() => {
                // LRCテキストからlines/breaksを同期してからタッパーを開く
                const { merged, br } = mergeLrcText(lrcText)
                setLines(merged); setBreaks(br)
                setShowTimestampTapper(true)
              }}
              disabled={lines.length === 0 && lrcText.trim() === ''}
            >🎯 タイムスタンプ作成</button>
          </div>
          <p className={styles.hint}>LRC形式またはプレーンテキスト（空行でブロック区切り）を貼り付けて保存してください。</p>
          <textarea
            className={styles.lrcEditor}
            value={lrcText}
            onChange={e => setLrcText(e.target.value)}
            placeholder="LRC形式またはテキスト形式の歌詞を貼り付け..."
            spellCheck={false}
          />
        </div>
      )}

      {showTimestampTapper && (
        <TimestampTapper
          lines={lines.length > 0 ? lines : (() => { const { merged } = mergeLrcText(lrcText); return merged })()}
          breaks={breaks}
          onComplete={(updatedLines) => {
            setLines(updatedLines)
            setBreaks(breaks)
            setLrcText(toLrcText(updatedLines, breaks))
            setShowTimestampTapper(false)
          }}
          onCancel={() => setShowTimestampTapper(false)}
        />
      )}

      {tab === 'parts' && (
        <div className={styles.lyricsPanel}>
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
                    onClick={() => setHarmonyMode('up')}
                  >上ハモ</button>
                  <button
                    className={`${styles.harmonyBtn} ${harmonyMode === 'main' ? styles.harmonyBtnMain : ''}`}
                    onClick={() => setHarmonyMode('main')}
                  >メイン</button>
                  <button
                    className={`${styles.harmonyBtn} ${harmonyMode === 'down' ? styles.harmonyBtnActive : ''}`}
                    onClick={() => setHarmonyMode('down')}
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
                      onPointerDown={() => {
                        // ハモリモードの長押しドラッグは文字ボタン側で処理するためここでは何もしない
                      }}
                      onPointerMove={e => {
                        if (harmonyDragRef.current) {
                          const els = document.elementsFromPoint(e.clientX, e.clientY)
                          for (const el of els) {
                            const ciStr = (el as HTMLElement).dataset?.harmonyCi
                            const liStr = (el as HTMLElement).dataset?.harmonyLine
                            if (ciStr !== undefined && liStr !== undefined) {
                              const { memberIds, mode, op } = harmonyDragRef.current
                              assignHarmonyChar(Number(liStr), Number(ciStr), memberIds, mode, op)
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
                      onPointerUp={() => {
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
                          const memberIds = checkedMemberIds
                          const mode = harmonyMode
                          const key = mode === 'up' ? 'harmony_up_ids' as const : 'harmony_down_ids' as const
                          const addTo = (ids?: number[]) =>
                            [...(ids ?? []), ...memberIds.filter(id => !(ids ?? []).includes(id))]
                          setLines(prev => prev.map((l, idx) => {
                            if (idx !== i) return l
                            const lChars = l.text.split('')
                            const newWm: WordMember[] = l.word_members.length === lChars.length
                              ? l.word_members.map(w => ({ ...w, [key]: addTo(w[key]) }))
                              : lChars.map((c, ci) => ({
                                  text: c,
                                  member_ids: l.word_members[ci]?.member_ids || [],
                                  harmony_up_ids: mode === 'up' ? addTo(l.word_members[ci]?.harmony_up_ids) : l.word_members[ci]?.harmony_up_ids,
                                  harmony_down_ids: mode === 'down' ? addTo(l.word_members[ci]?.harmony_down_ids) : l.word_members[ci]?.harmony_down_ids,
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
                            const upColors = harmonyIds(w, 'up').map(id => memberMap[id]?.color || '#888')
                            const downColors = harmonyIds(w, 'down').map(id => memberMap[id]?.color || '#888')
                            const band = harmonyBandStyle(upColors, downColors, '0.12em')
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
                            const content: React.ReactNode = band ? <span style={band}>{charContent}</span> : charContent
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
                                  const memberIds = checkedMemberIds
                                  const mode = harmonyMode as 'up' | 'down'
                                  // 選択メンバーが全員割り当て済みの文字から始めたら「消す」ドラッグ、そうでなければ「塗る」ドラッグ
                                  const cur = harmonyIds(w, mode)
                                  const op = memberIds.every(id => cur.includes(id)) ? 'remove' : 'add'
                                  harmonyDragRef.current = { lineIdx: i, memberIds, mode, op }
                                  assignHarmonyChar(i, ci, memberIds, mode, op)
                                }}
                                onPointerEnter={() => {
                                  if (!harmonyDragRef.current || harmonyDragRef.current.lineIdx !== i) return
                                  const { memberIds, mode, op } = harmonyDragRef.current
                                  assignHarmonyChar(i, ci, memberIds, mode, op)
                                }}
                                onPointerUp={e => { e.stopPropagation(); harmonyDragRef.current = null }}
                              >{content}</button>
                            )
                          })}
                        </span>
                      ) : renderLineText(line, i)}
                      {(() => { const ids = line.word_members?.length ? [...new Set(line.word_members.flatMap(w => [...w.member_ids, ...harmonyIds(w, 'up'), ...harmonyIds(w, 'down')]))] : line.member_ids; return ids?.length > 0 ? (<span className={styles.memberBadges}>{ids.map(id => (<span key={id} className={styles.memberBadge} style={{ background: memberMap[id]?.color }} title={memberMap[id]?.name} />))}</span>) : null })()}
                      <button
                        className={styles.clearLineBtn}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation()
                          if (harmonyMode === 'main') {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, member_ids: [], word_members: l.word_members.map(w => ({ ...w, member_ids: [] })) } : l))
                          } else if (harmonyMode === 'up') {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, word_members: l.word_members.map(w => ({ ...w, harmony_up_ids: undefined })) } : l))
                          } else {
                            setLines(prev => prev.map((l, idx) => idx === i ? { ...l, word_members: l.word_members.map(w => ({ ...w, harmony_down_ids: undefined })) } : l))
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
            <hr className={styles.divider} style={{ marginTop: 0 }} />
            <p className={styles.hint}>表紙設定</p>
            <div className={styles.sectionIndent}>
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
            {hasTimestamp && (
              <>
                <hr className={styles.divider} />
                <p className={styles.hint}>Autoモード設定</p>
                <div className={styles.sectionIndent}>
                  <div className={styles.infoFormRow}>
                    <label className={styles.infoFormLabel}>シークバー</label>
                    <label className={styles.toggleLabel}>
                      <button
                        type="button"
                        onClick={() => setShowProgressBar(v => !v)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: showProgressBar ? '#7CFC00' : '#444',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2, left: showProgressBar ? 22 : 2,
                          width: 20, height: 20, borderRadius: '50%', background: '#fff',
                          transition: 'left 0.2s', display: 'block',
                        }} />
                      </button>
                      <span className={styles.toggleHint}>
                        {showProgressBar ? '表示' : '非表示'}
                      </span>
                    </label>
                  </div>
                  <div className={styles.infoFormRow}>
                    <label className={styles.infoFormLabel}>スライド送りスピード変更</label>
                  </div>
                  <div className={styles.sectionIndent}>
                    <div className={styles.infoFormRow}>
                      <label className={styles.infoFormLabel}>元BPM</label>
                      <input type="number" className={styles.metaInput} value={originalBpm} onChange={e => setOriginalBpm(e.target.value === '' ? '' : Number(e.target.value))} min={1} style={{ width: 80 }} />
                    </div>
                    <div className={styles.infoFormRow}>
                      <span className={styles.infoFormLabel} />
                      <span className={styles.bpmRate}>
                        {originalBpm && playbackBpm ? `↓ ${(Number(playbackBpm) / Number(originalBpm)).toFixed(3)}x` : '↓'}
                      </span>
                    </div>
                    <div className={styles.infoFormRow}>
                      <label className={styles.infoFormLabel}>変更後BPM</label>
                      <input type="number" className={styles.metaInput} value={playbackBpm} onChange={e => setPlaybackBpm(e.target.value === '' ? '' : Number(e.target.value))} min={1} style={{ width: 80 }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <hr className={styles.divider} />
        </div>
      )}

      <div className={styles.stickySaveBar}>
        <span className={dirty ? styles.dirtyHint : styles.savedHint}>
          {dirty ? '● 未保存の変更があります' : '✓ すべて保存済み'}
        </span>
        <button className={styles.saveBtnLg} onClick={handleSave} disabled={savingAll || !dirty}>
          {savingAll ? <><span className={styles.spinnerSm} />保存中…</> : '💾 すべて保存'}
        </button>
      </div>

    </div>
  )
}
