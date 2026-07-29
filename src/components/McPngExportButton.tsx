'use client'

import { useState } from 'react'
import { createMcSlidePngs } from '@/lib/mcSlideExport.client'

interface Props {
  title?: string | null
  body?: string | null
  itemOrder: number
  className?: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function McPngExportButton({ title, body, itemOrder, className }: Props) {
  const [exporting, setExporting] = useState(false)

  const exportPng = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const slides = await createMcSlidePngs({ title, body, itemOrder })
      for (const slide of slides) {
        downloadBlob(slide.blob, slide.filename)
        // 複数ページでもブラウザが各ダウンロードを処理できるよう制御を戻す。
        await new Promise(resolve => window.setTimeout(resolve, 100))
      }
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'PNG出力に失敗しました。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={exportPng}
      disabled={exporting}
      title="PNGスライドを書き出し"
    >
      {exporting ? '...' : 'PNG'}
    </button>
  )
}
