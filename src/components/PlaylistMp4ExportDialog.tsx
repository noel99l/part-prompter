'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPrompterMp4, type Mp4ExportOptions } from '@/lib/mp4Export.client'
import styles from './Mp4ExportMenuItem.module.css'

const FONT_SCALE_MIN = 0.6
const FONT_SCALE_MAX = 1.6
const DISPLAY_SETTINGS_KEY = 'prompter_display_settings'

export interface PlaylistMp4Song {
  id: string
  title: string
  lyricCount: number
  timestampCount: number
}

interface Props {
  open: boolean
  songs: PlaylistMp4Song[]
  onClose: () => void
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function PlaylistMp4ExportDialog({ open, songs, onClose }: Props) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTitle, setCurrentTitle] = useState('')
  const [completedCount, setCompletedCount] = useState(0)
  const [failures, setFailures] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [fontScale, setFontScale] = useState(1)
  const [showNext, setShowNext] = useState(true)
  const [autoSplit, setAutoSplit] = useState(true)
  const [displayMode, setDisplayMode] = useState<'slide' | 'scroll'>('slide')

  const eligibleSongs = useMemo(
    () => songs.filter(song => song.lyricCount > 0 && song.timestampCount > 0),
    [songs],
  )
  const skippedSongs = songs.length - eligibleSongs.length

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
    if (!open) return
    setProgress(0)
    setCurrentTitle('')
    setCompletedCount(0)
    setFailures([])
    setFinished(false)
  }, [open])

  if (!open) return null

  const startExport = async () => {
    if (generating || eligibleSongs.length === 0) return
    setGenerating(true)
    setProgress(0)
    setCompletedCount(0)
    setFailures([])
    setFinished(false)

    const options: Mp4ExportOptions = { fontScale, showNext, displayMode, autoSplit }
    const failed: string[] = []
    let downloaded = 0
    const digits = String(eligibleSongs.length).length

    for (let index = 0; index < eligibleSongs.length; index += 1) {
      const song = eligibleSongs[index]
      setCurrentTitle(song.title)
      try {
        const result = await createPrompterMp4(song.id, songProgress => {
          setProgress(Math.round(((index + songProgress / 100) / eligibleSongs.length) * 100))
        }, options)
        const prefix = String(index + 1).padStart(digits, '0')
        downloadBlob(result.blob, `${prefix}_${result.filename}`)
        downloaded += 1
        setCompletedCount(downloaded)
        await new Promise(resolve => window.setTimeout(resolve, 150))
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'MP4生成に失敗しました。'
        failed.push(`${song.title}: ${message}`)
        setFailures([...failed])
      }
    }

    setProgress(100)
    setCurrentTitle('')
    setFinished(true)
    setGenerating(false)
  }

  const close = () => {
    if (!generating) onClose()
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={event => event.stopPropagation()}>
        <h2 className={styles.title}>🎬 セットリストのMP4一括出力</h2>

        <div className={styles.settings}>
          <div className={styles.modeSetting}>
            <span>表示形式</span>
            <div className={styles.modeButtons} role="group" aria-label="動画の表示形式">
              <button
                type="button"
                className={`${styles.modeButton} ${displayMode === 'slide' ? styles.modeButtonActive : ''}`}
                disabled={generating}
                onClick={() => setDisplayMode('slide')}
              >スライド</button>
              <button
                type="button"
                className={`${styles.modeButton} ${displayMode === 'scroll' ? styles.modeButtonActive : ''}`}
                disabled={generating}
                onClick={() => setDisplayMode('scroll')}
              >連続スクロール</button>
            </div>
          </div>
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

        <p className={styles.message}>
          タイムスタンプ設定済みの {eligibleSongs.length} 曲を、セットリスト順に個別のMP4として出力します。
          {skippedSongs > 0 && ` タイムスタンプまたは歌詞がない ${skippedSongs} 曲はスキップします。`}
        </p>
        {generating && (
          <>
            <p className={styles.message}>生成中: {currentTitle}（{completedCount + 1} / {eligibleSongs.length}）</p>
            <div className={styles.progressTrack}>
              <span className={styles.progressBar} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.progressValue}>{progress}%</div>
          </>
        )}
        {finished && (
          <p className={styles.success}>✓ {completedCount} 曲のMP4をダウンロードしました</p>
        )}
        {failures.length > 0 && (
          <div className={styles.error}>
            <strong>出力できなかった曲</strong>
            {failures.map(failure => <div key={failure}>{failure}</div>)}
          </div>
        )}
        <p className={styles.note}>
          1920×1080・30fps。端末内で1曲ずつ生成します。ブラウザに複数ファイルのダウンロード許可を求められた場合は許可してください。
        </p>
        {!generating && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.exportButton}
              onClick={startExport}
              disabled={eligibleSongs.length === 0}
            >
              {finished ? '同じ設定で再生成' : '一括生成してダウンロード'}
            </button>
            <button type="button" className={styles.closeButton} onClick={close}>閉じる</button>
          </div>
        )}
      </div>
    </div>
  )
}
