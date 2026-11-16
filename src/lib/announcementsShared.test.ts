import { describe, it, expect } from 'vitest'
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  latestReadAt,
  parseAnnouncementInput,
  splitTextWithLinks,
  unreadAnnouncements,
} from './announcementsShared'

const valid = { title: 'タイトル', body: '本文', category: 'update', is_important: false, status: 'draft' }

describe('parseAnnouncementInput', () => {
  it('正しい入力は前後の空白を除いて受け付ける', () => {
    const result = parseAnnouncementInput({ ...valid, title: '  タイトル  ', body: '\n本文\n' })
    expect(result).toEqual({ ok: true, value: { title: 'タイトル', body: '本文', category: 'update', is_important: false, status: 'draft' } })
  })

  it('タイトルと本文は必須', () => {
    expect(parseAnnouncementInput({ ...valid, title: '   ' }).ok).toBe(false)
    expect(parseAnnouncementInput({ ...valid, body: '' }).ok).toBe(false)
  })

  it('文字数の上限を超えると拒否する', () => {
    expect(parseAnnouncementInput({ ...valid, title: 'あ'.repeat(ANNOUNCEMENT_TITLE_MAX + 1) }).ok).toBe(false)
    expect(parseAnnouncementInput({ ...valid, body: 'あ'.repeat(ANNOUNCEMENT_BODY_MAX + 1) }).ok).toBe(false)
    expect(parseAnnouncementInput({ ...valid, title: 'あ'.repeat(ANNOUNCEMENT_TITLE_MAX) }).ok).toBe(true)
  })

  it('未知の種別・公開状態は拒否する', () => {
    expect(parseAnnouncementInput({ ...valid, category: 'other' }).ok).toBe(false)
    expect(parseAnnouncementInput({ ...valid, status: 'archived' }).ok).toBe(false)
  })

  it('重要フラグは true のときだけ有効（文字列などは false 扱い）', () => {
    const result = parseAnnouncementInput({ ...valid, is_important: 'true' })
    expect(result.ok && result.value.is_important).toBe(false)
  })

  it('オブジェクトでない入力は拒否する', () => {
    expect(parseAnnouncementInput(null).ok).toBe(false)
    expect(parseAnnouncementInput('text').ok).toBe(false)
  })
})

describe('unreadAnnouncements', () => {
  const items = [
    { id: 1, published_at: '2026-11-10T00:00:00.000Z' },
    { id: 2, published_at: '2026-11-15T00:00:00.000Z' },
    { id: 3, published_at: null },
  ]

  it('一度も読んでいなければ公開済みの全件が未読', () => {
    expect(unreadAnnouncements(items, null).map(i => i.id)).toEqual([1, 2])
  })

  it('既読日時より後に公開されたものだけが未読', () => {
    expect(unreadAnnouncements(items, '2026-11-12T00:00:00.000Z').map(i => i.id)).toEqual([2])
    expect(unreadAnnouncements(items, '2026-11-16T00:00:00.000Z')).toEqual([])
  })

  it('既読日時と同時刻に公開されたものは既読扱い', () => {
    expect(unreadAnnouncements(items, '2026-11-15T00:00:00.000Z')).toEqual([])
  })
})

describe('latestReadAt', () => {
  it('新しい方を返す', () => {
    expect(latestReadAt('2026-11-10T00:00:00.000Z', '2026-11-15T00:00:00.000Z')).toBe('2026-11-15T00:00:00.000Z')
    expect(latestReadAt('2026-11-15T00:00:00.000Z', '2026-11-10T00:00:00.000Z')).toBe('2026-11-15T00:00:00.000Z')
  })

  it('片方しかなければそれを、両方なければ null を返す', () => {
    expect(latestReadAt(null, '2026-11-10T00:00:00.000Z')).toBe('2026-11-10T00:00:00.000Z')
    expect(latestReadAt('2026-11-10T00:00:00.000Z', null)).toBe('2026-11-10T00:00:00.000Z')
    expect(latestReadAt(null, null)).toBeNull()
  })

  it('壊れた日時は無視する', () => {
    expect(latestReadAt('not a date', '2026-11-10T00:00:00.000Z')).toBe('2026-11-10T00:00:00.000Z')
  })
})

describe('splitTextWithLinks', () => {
  it('URLを含まない本文はそのまま1つの文字列になる', () => {
    expect(splitTextWithLinks('更新しました')).toEqual([{ type: 'text', value: '更新しました' }])
  })

  it('http(s) のURLだけをリンクとして切り出す', () => {
    expect(splitTextWithLinks('詳細は https://example.com/news をご覧ください')).toEqual([
      { type: 'text', value: '詳細は ' },
      { type: 'link', value: 'https://example.com/news' },
      { type: 'text', value: ' をご覧ください' },
    ])
  })

  it('URL直後の句読点や日本語はリンクに含めない', () => {
    expect(splitTextWithLinks('https://example.com/a。次の文')).toEqual([
      { type: 'link', value: 'https://example.com/a' },
      { type: 'text', value: '。次の文' },
    ])
    expect(splitTextWithLinks('(https://example.com/a).')).toEqual([
      { type: 'text', value: '(' },
      { type: 'link', value: 'https://example.com/a' },
      { type: 'text', value: ').' },
    ])
  })

  it('javascript: などhttp(s)以外はリンクにしない', () => {
    expect(splitTextWithLinks('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }])
  })

  it('HTMLタグはただの文字列として残る', () => {
    expect(splitTextWithLinks('<script>alert(1)</script>')).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }])
  })
})
