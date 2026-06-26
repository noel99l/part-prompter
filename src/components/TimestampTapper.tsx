'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import styles from './TimestampTapper.module.css'

interface FlatLine {
  text: string
  member_ids: number[]
  timestamp_ms: number | null
  word_members: { text: string; member_ids: number[] }[]
}

interface Props {
  lines: FlatLine[]
  breaks: Set<number>
  onComplete: (updatedLines: FlatLine[]) => void
  onCancel: () => void
}

function formatMs(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export default function TimestampTapper({ lines, breaks, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'tapping' | 'paused' | 'done'>('ready')
  const [countdown, setCountdown] = useState(3)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [stampedLines, setStampedLines] = useState<FlatLine[]>(() =>
    lines.map(l => ({ ...l, timestamp_ms: null }))
  )

  const startTimeRef = useRef<number>(0)
  const pausedElapsedRef = useRef<number>(0) // 一時停止時の経過時間を保存
  const rafRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([])

  // タイマー更新
  const updateTimer = useCallback(() => {
    const now = performance.now()
    setElapsedMs(now - startTimeRef.current)
    rafRef.current = requestAnimationFrame(updateTimer)
  }, [])

  // カウントダウン開始
  const startCountdown = useCallback(() => {
    setPhase('countdown')
    setCountdown(3)
    let count = 3
    const interval = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(interval)
        setPhase('tapping')
        startTimeRef.current = performance.now()
        rafRef.current = requestAnimationFrame(updateTimer)
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [updateTimer])

  // 一時停止
  const handlePause = useCallback(() => {
    if (phase !== 'tapping') return
    cancelAnimationFrame(rafRef.current)
    pausedElapsedRef.current = performance.now() - startTimeRef.current
    setPhase('paused')
  }, [phase])

  // 再開
  const handleResume = useCallback(() => {
    if (phase !== 'paused') return
    // startTimeRefを再計算して経過時間を維持する
    startTimeRef.current = performance.now() - pausedElapsedRef.current
    setPhase('tapping')
    rafRef.current = requestAnimationFrame(updateTimer)
  }, [phase, updateTimer])

  // 10秒戻し
  const handleSeekBack = useCallback(() => {
    if (phase !== 'tapping' && phase !== 'paused') return
    const shift = 10000 // 10秒 = 10000ms
    if (phase === 'paused') {
      pausedElapsedRef.current = Math.max(0, pausedElapsedRef.current - shift)
      setElapsedMs(pausedElapsedRef.current)
    } else {
      // tapping中: startTimeRefを未来にずらす = 経過時間が減る
      startTimeRef.current += shift
      // 経過時間が負にならないよう制限
      if (performance.now() - startTimeRef.current < 0) {
        startTimeRef.current = performance.now()
      }
    }
    // 既にタイムスタンプを打った行で、新しい経過時間より後のものを取り消す
    const newElapsed = phase === 'paused'
      ? pausedElapsedRef.current
      : performance.now() - startTimeRef.current
    setStampedLines(prev => {
      let newIndex = currentIndex
      const updated = prev.map((l, i) => {
        if (l.timestamp_ms != null && l.timestamp_ms > newElapsed) {
          if (i < newIndex) newIndex = i
          return { ...l, timestamp_ms: null }
        }
        return l
      })
      setCurrentIndex(newIndex)
      return updated
    })
  }, [phase, currentIndex])

  // 10秒送り
  const handleSeekForward = useCallback(() => {
    if (phase !== 'tapping' && phase !== 'paused') return
    const shift = 10000 // 10秒 = 10000ms
    if (phase === 'paused') {
      pausedElapsedRef.current += shift
      setElapsedMs(pausedElapsedRef.current)
    } else {
      // tapping中: startTimeRefを過去にずらす = 経過時間が増える
      startTimeRef.current -= shift
    }
  }, [phase])

  // 行タップ
  const handleTap = useCallback(() => {
    if (phase !== 'tapping') return
    if (currentIndex >= lines.length) return

    const ms = performance.now() - startTimeRef.current

    setStampedLines(prev => prev.map((l, i) =>
      i === currentIndex ? { ...l, timestamp_ms: Math.round(ms) } : l
    ))

    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)

    if (nextIndex >= lines.length) {
      setPhase('done')
      cancelAnimationFrame(rafRef.current)
    }
  }, [phase, currentIndex, lines.length])

  // キーボードショートカット（スペースキーでタップ）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        if (phase === 'paused') {
          handleResume()
        } else {
          handleTap()
        }
      }
      if (e.code === 'Escape') {
        onCancel()
      }
      if (e.code === 'KeyP') {
        e.preventDefault()
        if (phase === 'tapping') handlePause()
        else if (phase === 'paused') handleResume()
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handleSeekBack()
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleSeekForward()
      }
    }
    if (phase === 'tapping' || phase === 'paused') {
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [phase, handleTap, handlePause, handleResume, handleSeekBack, handleSeekForward, onCancel])

  // 現在の行を表示範囲にスクロール
  useEffect(() => {
    if (phase === 'tapping' && lineRefs.current[currentIndex]) {
      lineRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex, phase])

  // クリーンアップ
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleComplete = () => {
    onComplete(stampedLines)
  }

  const handleReset = () => {
    setPhase('ready')
    setCurrentIndex(0)
    setElapsedMs(0)
    setStampedLines(lines.map(l => ({ ...l, timestamp_ms: null })))
    cancelAnimationFrame(rafRef.current)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.container} ref={containerRef}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <h2 className={styles.title}>⏱ タイムスタンプ作成</h2>
          <div className={styles.headerRight}>
            {(phase === 'tapping' || phase === 'paused') && (
              <span className={styles.timer}>{formatMs(elapsedMs)}</span>
            )}
            <button className={styles.cancelBtn} onClick={onCancel}>✕ 閉じる</button>
          </div>
        </div>

        {/* トランスポートコントロール */}
        {(phase === 'tapping' || phase === 'paused') && (
          <div className={styles.transport}>
            <button className={styles.transportBtn} onClick={handleSeekBack} title="10秒戻し (←)">
              ⏪ 10s
            </button>
            <button className={styles.transportBtn} onClick={phase === 'tapping' ? handlePause : handleResume} title="一時停止/再開 (P)">
              {phase === 'paused' ? '▶ 再開' : '⏸ 一時停止'}
            </button>
            <button className={styles.transportBtn} onClick={handleSeekForward} title="10秒送り (→)">
              10s ⏩
            </button>
          </div>
        )}
        {phase === 'paused' && (
          <div className={styles.pausedBanner}>⏸ 一時停止中 — スペースキーで再開</div>
        )}

        {/* カウントダウン */}
        {phase === 'countdown' && (
          <div className={styles.countdownOverlay}>
            <span className={styles.countdownNumber}>{countdown}</span>
            <p className={styles.countdownHint}>曲を再生してください</p>
          </div>
        )}

        {/* 準備画面 */}
        {phase === 'ready' && (
          <div className={styles.readyPanel}>
            <p className={styles.instruction}>
              スタートを押すとカウントダウン（3秒）が始まります。<br />
              カウント終了と同時に曲を再生し、歌詞の各行が始まるタイミングでタップしてください。
            </p>
            <p className={styles.instructionSub}>
              💡 スペースキーまたは画面タップでタイムスタンプを打てます<br />
              ⏸ P: 一時停止/再開　←→: 10秒戻し/送り
            </p>
            <button className={styles.startBtn} onClick={startCountdown}>
              ▶ スタート
            </button>
          </div>
        )}

        {/* タッピング中 / 完了 */}
        {(phase === 'tapping' || phase === 'done') && (
          <div className={styles.tappingArea}>
            <div className={styles.linesList}>
              {lines.map((line, i) => {
                const isActive = i === currentIndex && phase === 'tapping'
                const isDone = stampedLines[i]?.timestamp_ms != null
                const hasBreak = breaks.has(i)

                return (
                  <React.Fragment key={i}>
                    {hasBreak && <div className={styles.blockBreak} />}
                    <button
                      ref={el => { lineRefs.current[i] = el }}
                      className={`${styles.lineRow} ${isActive ? styles.lineActive : ''} ${isDone ? styles.lineDone : ''}`}
                      onClick={handleTap}
                      disabled={!isActive}
                    >
                      <span className={styles.lineTimestamp}>
                        {isDone ? formatMs(stampedLines[i].timestamp_ms!) : '--:--.--'}
                      </span>
                      <span className={styles.lineText}>{line.text}</span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>

            {/* タップエリア（モバイル向け大きなボタン） */}
            {phase === 'tapping' && (
              <button className={styles.tapButton} onClick={handleTap}>
                <span className={styles.tapButtonLabel}>タップ</span>
                <span className={styles.tapButtonHint}>スペースキーでもOK</span>
              </button>
            )}

            {/* 完了時のアクション */}
            {phase === 'done' && (
              <div className={styles.doneActions}>
                <p className={styles.doneMessage}>✓ 全{lines.length}行のタイムスタンプが完了しました</p>
                <div className={styles.doneButtons}>
                  <button className={styles.applyBtn} onClick={handleComplete}>✓ 適用する</button>
                  <button className={styles.retryBtn} onClick={handleReset}>↻ やり直す</button>
                  <button className={styles.cancelBtnSmall} onClick={onCancel}>キャンセル</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
