'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SyncLyricLine, SyncMember } from '@/lib/sync/types'
import { memberDisplayName } from '@/lib/memberDisplayName'
import styles from './MemberSelector.module.css'

interface Props {
  members: SyncMember[]
  selectedIds: number[]
  initialDisplayName: string
  requireDisplayName: boolean
  canCancel: boolean
  reason: 'initial' | 'song-change' | 'manual'
  modal?: boolean
  songTitle?: string
  lyrics?: SyncLyricLine[]
  onConfirm: (displayName: string, selectedIds: number[]) => Promise<void>
  onCancel?: () => void
}

export default function MemberSelector({ members, selectedIds, initialDisplayName, requireDisplayName, canCancel, reason, modal = false, songTitle, lyrics, onConfirm, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [selected, setSelected] = useState<number[]>(selectedIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cardRef = useRef<HTMLElement>(null)
  const onCancelRef = useRef(onCancel)
  const validName = !requireDisplayName || (Array.from(displayName.trim()).length >= 1 && Array.from(displayName.trim()).length <= 20)
  const isDeviceSetup = reason === 'initial'
  const validSelection = isDeviceSetup || (selected.length > 0 && members.length > 0)

  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])

  useEffect(() => {
    if (!modal) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const card = cardRef.current
    const focusable = () => [...(card?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])]
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canCancel) { event.preventDefault(); onCancelRef.current?.(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus() }
  }, [canCancel, modal])

  const toggle = (id: number) => setSelected(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  const submit = async () => {
    if (!validName || !validSelection) return
    setSaving(true); setError('')
    try { await onConfirm(displayName.trim(), isDeviceSetup ? [] : selected) }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : '設定を保存できませんでした。'); setSaving(false) }
  }

  // 各メンバーのサンプル歌詞を抽出（最初に登場するソロまたはメイン担当行のテキスト）
  const memberSamples = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return new Map<number, string>()
    const samples = new Map<number, string>()
    for (const member of members) {
      for (const line of lyrics) {
        if (samples.has(member.id)) break
        if (line.memberIds.includes(member.id) && line.text.trim()) {
          samples.set(member.id, line.text.length > 30 ? line.text.slice(0, 30) + '…' : line.text)
        }
      }
    }
    return samples
  }, [lyrics, members])

  const title = reason === 'initial' ? '端末を設定' : reason === 'song-change' ? '表示歌唱パートを選択' : '担当を変更'
  const card = (
    <section ref={cardRef} className={`${styles.card} ${modal ? styles.modalCard : ''}`} aria-labelledby="member-selector-title" {...(modal ? { role: 'dialog', 'aria-modal': true } : {})}>
      <p className={styles.step}>{isDeviceSetup ? '端末設定' : '担当設定'}</p>
      <h1 id="member-selector-title">{title}</h1>
      {songTitle && !isDeviceSetup && <p className={styles.songTitle}>{songTitle}</p>}
      {requireDisplayName && <label className={styles.field}>端末名（1〜20文字）
        <input autoFocus={!modal} value={displayName} maxLength={20} onChange={event => setDisplayName(event.target.value)} placeholder="例：ステージ右 iPad" />
      </label>}
      {!isDeviceSetup && (
        <fieldset className={styles.members}>
          <legend>表示歌唱パート（1名以上）</legend>
          {members.length === 0 ? <p className={styles.warning}>この曲にはメンバーが登録されていません。</p> : members.map((member, index) => (
            <label key={member.id} className={`${styles.member} ${selected.includes(member.id) ? styles.selected : ''}`}>
              <input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} />
              <span className={styles.dot} style={{ background: member.color }} />
              <span className={styles.memberInfo}>
                <span className={styles.memberName}>{memberDisplayName(member, index)}</span>
                {memberSamples.get(member.id) && <span className={styles.memberSample}>{memberSamples.get(member.id)}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {isDeviceSetup && <p className={styles.hint}>端末名の設定後、現在曲の担当を選択します。</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {canCancel && <button className={styles.cancel} onClick={onCancel} disabled={saving}>キャンセル</button>}
        <button className={styles.confirm} onClick={submit} disabled={saving || !validName || !validSelection}>{saving ? '保存中...' : isDeviceSetup ? '端末設定を完了' : '担当を確定'}</button>
      </div>
    </section>
  )
  return modal
    ? <div className={styles.modalOverlay} onClick={event => event.stopPropagation()}>{card}</div>
    : <main className={styles.page}>{card}</main>
}
