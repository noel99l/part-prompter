'use client'

import { useState } from 'react'
import { createPrompterMp4 } from '@/lib/mp4Export.client'
import styles from './Mp4ExportMenuItem.module.css'

interface Props {
  songId: string
  className?: string
  onClose?: () => void
}

export default function Mp4ExportMenuItem({ songId, className, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  const startExport = async () => {
    if (generating) return
    setOpen(true)
    setGenerating(true)
    setProgress(0)
    setError(null)
    setCompleted(false)
    try {
      const result = await createPrompterMp4(songId, setProgress)
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
      <button type="button" className={className} onClick={startExport} disabled={generating}>
        🎬 MP4（無音）
      </button>
      {open && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={event => event.stopPropagation()}>
            <h2 className={styles.title}>🎬 MP4書き出し</h2>
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
            <p className={styles.note}>1920×1080・30fps・無音／最後のスライドは5秒間表示されます。保存済みのデータから生成します。</p>
            {!generating && (
              <div className={styles.actions}>
                {error && (
                  <button type="button" className={styles.retryButton} onClick={startExport}>再試行</button>
                )}
                <button type="button" className={styles.closeButton} onClick={close}>閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
