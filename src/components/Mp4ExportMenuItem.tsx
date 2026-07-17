'use client'

import { useEffect, useState } from 'react'
import { createPrompterMp4, createPrompterMp4Preview } from '@/lib/mp4Export.client'
import { IconNext, IconPrev } from '@/components/icons'
import styles from './Mp4ExportMenuItem.module.css'

const FONT_SCALE_MIN = 0.6
const FONT_SCALE_MAX = 1.6
const DISPLAY_SETTINGS_KEY = 'prompter_display_settings'

interface Props {
  songId: string
  backgroundColor?: string
  className?: string
  onClose?: () => void
}

export default function Mp4ExportMenuItem({ songId, backgroundColor, className, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [fontScale, setFontScale] = useState(1)
  const [showNext, setShowNext] = useState(true)
  const [autoSplit, setAutoSplit] = useState(true)
  const [displayMode, setDisplayMode] = useState<'slide' | 'scroll'>('slide')
  const [previewPage, setPreviewPage] = useState(0)
  const [previewPageCount, setPreviewPageCount] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY) || 'null')
      if (typeof saved?.fontScale === 'number') {
        setFontScale(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, saved.fontScale)))
      }
      if (typeof saved?.showNext === 'boolean') setShowNext(saved.showNext)
      if (typeof saved?.autoSplit === 'boolean') setAutoSplit(saved.autoSplit)
      if (saved?.displayMode === 'slide' || saved?.displayMode === 'scroll') {
        setDisplayMode(saved.displayMode)
      }
    } catch {}
  }, [])

  useEffect(() => {
    setPreviewPage(0)
  }, [fontScale, showNext, displayMode, autoSplit, backgroundColor])

  useEffect(() => {
    if (!open) return
    let active = true
    setPreviewLoading(true)
    setPreviewError(null)
    const timer = window.setTimeout(async () => {
      try {
        const result = await createPrompterMp4Preview(
          songId,
          { fontScale, showNext, displayMode, autoSplit, backgroundColor },
          previewPage,
        )
        if (active) {
          setPreviewUrl(result.dataUrl)
          setPreviewPageCount(result.pageCount)
          if (result.pageIndex !== previewPage) setPreviewPage(result.pageIndex)
        }
      } catch (cause) {
        if (!active) return
        setPreviewError(cause instanceof Error ? cause.message : 'プレビューの生成に失敗しました。')
      } finally {
        if (active) setPreviewLoading(false)
      }
    }, 150)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, songId, fontScale, showNext, displayMode, autoSplit, backgroundColor, previewPage])

  const openDialog = () => {
    setOpen(true)
    setPreviewPage(0)
    setProgress(0)
    setError(null)
    setCompleted(false)
  }

  const startExport = async () => {
    if (generating) return
    setGenerating(true)
    setProgress(0)
    setError(null)
    setCompleted(false)
    try {
      const result = await createPrompterMp4(songId, setProgress, {
        fontScale,
        showNext,
        displayMode,
        autoSplit,
        backgroundColor,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setCompleted(true)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'MP4生成に失敗しました。'
      setError(message.includes('Encoder') || message.includes('codec')
        ? 'このブラウザではH.264のMP4生成を利用できません。最新版のChromeまたはEdgeをご利用ください。'
        : message)
    } finally {
      setGenerating(false)
    }
  }

  const close = () => {
    if (generating) return
    setOpen(false)
    onClose?.()
  }

  return (
    <>
      <button type="button" className={className} onClick={openDialog} disabled={generating}>
        🎬 MP4
      </button>
      {open && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={event => event.stopPropagation()}>
            <h2 className={styles.title}>🎬 MP4書き出し</h2>

            <div className={styles.settings}>
              <div className={styles.modeSetting}>
                <span>表示形式</span>
                <div className={styles.modeButtons} role="group" aria-label="動画の表示形式">
                  <button
                    type="button"
                    className={`${styles.modeButton} ${displayMode === 'slide' ? styles.modeButtonActive : ''}`}
                    disabled={generating}
                    onClick={() => setDisplayMode('slide')}
                  >
                    スライド
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeButton} ${displayMode === 'scroll' ? styles.modeButtonActive : ''}`}
                    disabled={generating}
                    onClick={() => setDisplayMode('scroll')}
                  >
                    連続スクロール
                  </button>
                </div>
              </div>
              {backgroundColor && (
                <div className={styles.settingRow}>
                  <span>背景カラー</span>
                  <span className={styles.colorValue}>
                    <i style={{ backgroundColor }} />
                    {backgroundColor.toUpperCase()}
                  </span>
                </div>
              )}
              <label className={styles.settingRow}>
                <span>文字サイズ</span>
                <strong>{Math.round(fontScale * 100)}%</strong>
              </label>
              <input
                type="range"
                className={styles.slider}
                min={FONT_SCALE_MIN * 100}
                max={FONT_SCALE_MAX * 100}
                step={1}
                value={Math.round(fontScale * 100)}
                disabled={generating}
                onChange={event => setFontScale(Number(event.target.value) / 100)}
                aria-label="動画の歌詞文字サイズ"
              />
              {displayMode === 'slide' && (
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={showNext}
                    disabled={generating}
                    onChange={event => setShowNext(event.target.checked)}
                  />
                  次のセクションを表示
                </label>
              )}
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={autoSplit}
                  disabled={generating}
                  onChange={event => setAutoSplit(event.target.checked)}
                />
                自動ブロック分け（Auto）
              </label>
            </div>

            <div className={styles.previewSection}>
              <div className={styles.previewHeading}>
                <span>出力サンプル</span>
                <small>{previewPageCount > 0 ? `${previewPage + 1} / ${previewPageCount}` : '読み込み中'}</small>
              </div>
              <div className={styles.previewFrame} aria-live="polite">
                {previewUrl && (
                  <div
                    className={styles.previewImage}
                    style={{ backgroundImage: `url(${previewUrl})` }}
                    role="img"
                    aria-label={`MP4出力サンプル ${previewPage + 1}ページ目`}
                  />
                )}
                {previewLoading && <div className={styles.previewStatus}>更新中...</div>}
                {previewError && !previewLoading && (
                  <div className={styles.previewError}>{previewError}</div>
                )}
              </div>
              <div className={styles.previewControls}>
                <button
                  type="button"
                  disabled={generating || previewLoading || previewPage <= 0}
                  onClick={() => setPreviewPage(page => Math.max(0, page - 1))}
                  title="前のページ"
                  aria-label="前のページ"
                >
                  <IconPrev />
                </button>
                <span>{displayMode === 'scroll' ? 'スクロール位置' : 'スライド'}</span>
                <button
                  type="button"
                  disabled={generating || previewLoading || previewPage >= previewPageCount - 1}
                  onClick={() => setPreviewPage(page => Math.min(previewPageCount - 1, page + 1))}
                  title="次のページ"
                  aria-label="次のページ"
                >
                  <IconNext />
                </button>
              </div>
            </div>

            {generating && (
              <>
                <p className={styles.message}>端末内で動画を生成しています。画面を閉じずにお待ちください。</p>
                <div className={styles.progressTrack}>
                  <span className={styles.progressBar} style={{ width: `${progress}%` }} />
                </div>
                <div className={styles.progressValue}>{progress}%</div>
              </>
            )}
            {completed && (
              <p className={styles.success}>✓ MP4をダウンロードしました</p>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <p className={styles.note}>1920×1080・30fps／最後のスライドは5秒間表示されます。保存済みのデータから生成します。</p>
            {!generating && (
              <div className={styles.actions}>
                <button type="button" className={styles.exportButton} onClick={startExport}>
                  {completed ? 'この設定で再生成' : error ? '再試行' : '生成してダウンロード'}
                </button>
                <button type="button" className={styles.closeButton} onClick={close}>閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
