'use client'
import { useEffect, useState } from 'react'
import skStyles from './skeleton.module.css'
import cardStyles from './SongCard.module.css'

interface Props {
  count?: number
  showActions?: boolean
  showMeta?: boolean
}

export default function SongCardSkeleton({ count = 5, showActions = false, showMeta = true }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={cardStyles.card} style={{ pointerEvents: 'none' }}>
          <div className={cardStyles.infoBlock}>
            <div className={cardStyles.info}>
              {/* タイトル行 */}
              <div className={cardStyles.titleRow}>
                <div className={skStyles.sk} style={{ width: isMobile ? '60%' : '40%', height: 16, borderRadius: 4 }} />
                <div className={skStyles.sk} style={{ width: 36, height: 18, borderRadius: 99 }} />
              </div>
              {/* アーティスト */}
              <div className={skStyles.sk} style={{ width: isMobile ? '40%' : '25%', height: 13, borderRadius: 4, marginTop: 4 }} />
              {/* meta */}
              {showMeta && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <div className={skStyles.sk} style={{ width: 80, height: 11, borderRadius: 4 }} />
                  <div className={skStyles.sk} style={{ width: 120, height: 11, borderRadius: 4 }} />
                </div>
              )}
            </div>
          </div>
          {/* アクション */}
          {showActions && !isMobile && (
            <div className={cardStyles.actions}>
              <div className={skStyles.sk} style={{ width: 28, height: 28, borderRadius: 4 }} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
