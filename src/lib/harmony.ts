import type { CSSProperties } from 'react'

export interface HarmonyWordLike {
  harmony_up_ids?: number[]
  harmony_down_ids?: number[]
  // 旧形式（1名のみ）。既存データ読み込み時のフォールバックとして残す
  harmony_up_id?: number
  harmony_down_id?: number
}

// 新旧どちらの形式でも「メンバーID配列」として取り出す
export function harmonyIds(w: HarmonyWordLike | undefined | null, dir: 'up' | 'down'): number[] {
  if (!w) return []
  const plural = dir === 'up' ? w.harmony_up_ids : w.harmony_down_ids
  if (Array.isArray(plural)) return plural
  const single = dir === 'up' ? w.harmony_up_id : w.harmony_down_id
  return single != null ? [single] : []
}

const stripes = (colors: string[]) => {
  const pct = 100 / colors.length
  return `linear-gradient(to bottom, ${colors.map((c, i) => `${c} ${i * pct}%, ${c} ${(i + 1) * pct}%`).join(', ')})`
}

// 上ハモ＝文字の上端、下ハモ＝文字の下端に、メンバー数ぶんの色帯を積んで描く。
// text-decoration は1色しか指定できないため background の帯で表現する。
// stripeSize は1名分の帯の太さ（'0.07em' のようにフォント比例のem指定を推奨）。
export function harmonyBandStyle(upColors: string[], downColors: string[], stripeSize: string): CSSProperties | null {
  if (upColors.length === 0 && downColors.length === 0) return null
  const images: string[] = []
  const sizes: string[] = []
  const positions: string[] = []
  if (upColors.length > 0) {
    images.push(stripes(upColors))
    sizes.push(`100% calc(${stripeSize} * ${upColors.length})`)
    positions.push('left top')
  }
  if (downColors.length > 0) {
    images.push(stripes(downColors))
    sizes.push(`100% calc(${stripeSize} * ${downColors.length})`)
    positions.push('left bottom')
  }
  return {
    backgroundImage: images.join(', '),
    backgroundSize: sizes.join(', '),
    backgroundPosition: positions.join(', '),
    backgroundRepeat: 'no-repeat',
  }
}
