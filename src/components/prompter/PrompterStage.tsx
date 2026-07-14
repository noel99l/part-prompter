'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import type { DisplayChunk, PromptLine } from '@/lib/prompterBlocks'
import { memberDisplayName } from '@/lib/memberDisplayName'
import styles from './PrompterStage.module.css'

export interface PrompterStageMember {
  id: number
  name: string
  color: string
  sortOrder?: number
}

interface PrompterStageProps<Line extends PromptLine> {
  title: string
  artist?: string | null
  coverText?: string | null
  members: PrompterStageMember[]
  displayBlocks: DisplayChunk<Line>[]
  currentBlock: number
  isPortrait: boolean
  showNext?: boolean
  renderLine: (line: Line) => ReactNode
  lineKey: (line: Line) => string | number
  onSelectBlock?: (index: number) => void
  embedded?: boolean
  scrollBlockAlign?: ScrollLogicalPosition
}

export default function PrompterStage<Line extends PromptLine>({
  title,
  artist,
  coverText,
  members,
  displayBlocks,
  currentBlock,
  isPortrait,
  showNext = true,
  renderLine,
  lineKey,
  onSelectBlock,
  embedded = false,
  scrollBlockAlign = 'center',
}: PrompterStageProps<Line>) {
  const blockRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!isPortrait || currentBlock < 0) return
    blockRefs.current[currentBlock]?.scrollIntoView({ behavior: 'smooth', block: scrollBlockAlign })
  }, [currentBlock, isPortrait, scrollBlockAlign])

  const cover = (
    <div className={`${isPortrait ? styles.scrollCover : styles.cover} ${embedded ? styles.coverEmbedded : ''}`}>
      <div className={styles.coverTitle}>{title}</div>
      {artist && <div className={styles.coverArtist}>{artist}</div>}
      {coverText && <div className={styles.coverText}>{coverText}</div>}
      {!isPortrait && <div className={styles.coverSeparator} />}
      {members.length > 0 && (
        <div className={styles.coverMembers}>
          {members.map((member, index) => (
            <div key={member.id} className={styles.coverMember}>
              <span className={styles.coverMemberDot} style={{ background: member.color }} />
              <span className={styles.coverMemberName} style={{ color: member.color }}>
                {memberDisplayName(member, index)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (isPortrait) {
    return (
      <div className={styles.scrollView}>
        {cover}
        {displayBlocks.map((block, blockIndex) => (
          <div
            key={blockIndex}
            ref={element => { blockRefs.current[blockIndex] = element }}
            className={`${styles.scrollBlock} ${blockIndex === currentBlock ? styles.scrollBlockActive : ''}`}
            onClick={onSelectBlock ? () => onSelectBlock(blockIndex) : undefined}
          >
            {block.lines.map(line => (
              <div key={lineKey(line)} className={styles.scrollLine}>{renderLine(line)}</div>
            ))}
          </div>
        ))}
        <div className={styles.scrollEnd}>― End ―</div>
        <div className={styles.scrollSpacer} />
      </div>
    )
  }

  if (currentBlock === -1) {
    return (
      <>
        {cover}
        {showNext && displayBlocks[0] && (
          <div className={`${styles.nextBlock} ${embedded ? styles.nextBlockEmbedded : ''}`}>
            {displayBlocks[0].lines.slice(0, 2).map(line => (
              <div key={lineKey(line)} className={styles.nextLine}>{renderLine(line)}</div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className={`${styles.currentBlock} ${embedded ? styles.currentBlockEmbedded : ''}`}>
        {(displayBlocks[currentBlock]?.lines ?? []).map(line => (
          <div key={lineKey(line)} className={styles.line}>{renderLine(line)}</div>
        ))}
      </div>
      {showNext && (
        <div className={`${styles.nextBlock} ${embedded ? styles.nextBlockEmbedded : ''}`} data-end={currentBlock === displayBlocks.length - 1}>
          {currentBlock === displayBlocks.length - 1 ? (
            <div className={styles.nextLine}>― End ―</div>
          ) : displayBlocks[currentBlock + 1]?.lines.slice(0, 2).map(line => (
            <div key={lineKey(line)} className={styles.nextLine}>{renderLine(line)}</div>
          ))}
        </div>
      )}
    </>
  )
}
