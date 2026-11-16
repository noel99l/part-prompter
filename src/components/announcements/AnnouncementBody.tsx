import { splitTextWithLinks } from '@/lib/announcementsShared'

/**
 * お知らせ本文。HTMLとしては解釈せずテキストとして出力し、http(s) のURLだけリンクにする。
 */
export default function AnnouncementBody({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>
      {splitTextWithLinks(text).map((part, index) =>
        part.type === 'link' ? (
          <a key={index} href={part.value} target="_blank" rel="noreferrer noopener" style={{ color: '#FF69B4' }}>{part.value}</a>
        ) : (
          <span key={index}>{part.value}</span>
        )
      )}
    </p>
  )
}
