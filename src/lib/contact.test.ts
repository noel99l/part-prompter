import { describe, it, expect } from 'vitest'
import { buildContactMailBody, buildContactMailto, CONTACT_MAIL_SUBJECT, isValidContactEmail } from './contact'

describe('isValidContactEmail', () => {
  it('一般的なメールアドレスを受け付ける', () => {
    expect(isValidContactEmail('support@example.com')).toBe(true)
    expect(isValidContactEmail('first.last+tag@mail.example.co.jp')).toBe(true)
  })

  it('形式が崩れたものは拒否する', () => {
    for (const value of ['', 'support', 'support@', '@example.com', 'support@example', 'a b@example.com', 'support@@example.com']) {
      expect(isValidContactEmail(value)).toBe(false)
    }
  })

  it('mailto の宛先や件名を書き換えられる記号を含むものは拒否する', () => {
    expect(isValidContactEmail('a@example.com?cc=other@example.com')).toBe(false)
    expect(isValidContactEmail('a@example.com&bcc=other@example.com')).toBe(false)
    expect(isValidContactEmail('a@example.com,b@example.com')).toBe(false)
    expect(isValidContactEmail('a@example.com\nBcc: b@example.com')).toBe(false)
  })

  it('文字列以外は拒否する', () => {
    expect(isValidContactEmail(null)).toBe(false)
    expect(isValidContactEmail(undefined)).toBe(false)
    expect(isValidContactEmail(123)).toBe(false)
  })
})

describe('buildContactMailBody', () => {
  it('調査用の情報がなければ記入欄だけになる', () => {
    expect(buildContactMailBody()).not.toContain('調査用の情報')
  })

  it('ページURLとブラウザ情報を、消せることを明記して添える', () => {
    const body = buildContactMailBody({ pageUrl: 'https://example.com/songs/1', userAgent: 'TestBrowser/1.0' })
    expect(body).toContain('削除しても送信できます')
    expect(body).toContain('ページ: https://example.com/songs/1')
    expect(body).toContain('ブラウザ: TestBrowser/1.0')
  })
})

describe('buildContactMailto', () => {
  it('宛先・件名・本文を持つ mailto リンクになる', () => {
    const href = buildContactMailto('support@example.com', { pageUrl: 'https://example.com/songs/1?a=1&b=2' })
    expect(href.startsWith('mailto:support@example.com?subject=')).toBe(true)
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1))
    expect(params.get('subject')).toBe(CONTACT_MAIL_SUBJECT)
    // URL内の & や ? がリンクの区切りと混ざらず、本文としてそのまま復元できる
    expect(params.get('body')).toContain('ページ: https://example.com/songs/1?a=1&b=2')
    expect([...params.keys()]).toEqual(['subject', 'body'])
  })
})
