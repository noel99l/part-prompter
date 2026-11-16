import { describe, it, expect } from 'vitest'
import { buildMasterSettingsResponse, canDownload, parseDownloadWhitelist } from './masterSettingsPublic'

const all = {
  show_download: '0',
  show_parts_copy: '1',
  contact_email: 'support@example.com',
  download_whitelist: 'alice@example.com, Bob@Example.com',
  internal_note: '将来追加されるかもしれない非公開の値',
}

describe('parseDownloadWhitelist', () => {
  it('空白と大文字小文字を正規化し、空要素を捨てる', () => {
    expect(parseDownloadWhitelist(' Alice@Example.com ,, bob@example.com ')).toEqual(['alice@example.com', 'bob@example.com'])
    expect(parseDownloadWhitelist('')).toEqual([])
    expect(parseDownloadWhitelist(undefined)).toEqual([])
  })
})

describe('canDownload', () => {
  it('全体ONなら未ログインでも表示できる', () => {
    expect(canDownload({ ...all, show_download: '1' }, null)).toBe(true)
  })

  it('全体OFFなら、許可リストに入っている本人だけ表示できる', () => {
    expect(canDownload(all, 'alice@example.com')).toBe(true)
    expect(canDownload(all, 'BOB@example.com')).toBe(true)
    expect(canDownload(all, 'carol@example.com')).toBe(false)
    expect(canDownload(all, null)).toBe(false)
  })
})

describe('buildMasterSettingsResponse', () => {
  it('未ログインには許可リストのメールアドレスを一切返さない', () => {
    const response = buildMasterSettingsResponse(all, { email: null, isMaster: false })
    expect(response).toEqual({ show_download: '0', show_parts_copy: '1', contact_email: 'support@example.com', can_download: false })
    expect(JSON.stringify(response)).not.toContain('alice@example.com')
    expect(JSON.stringify(response)).not.toContain('bob@example.com')
  })

  it('許可リストに入っている一般ユーザーには判定結果だけを返し、リスト本体は返さない', () => {
    const response = buildMasterSettingsResponse(all, { email: 'alice@example.com', isMaster: false })
    expect(response.can_download).toBe(true)
    expect(response).not.toHaveProperty('download_whitelist')
    expect(JSON.stringify(response)).not.toContain('bob@example.com')
  })

  it('マスターには編集用に許可リスト本体も返す', () => {
    const response = buildMasterSettingsResponse(all, { email: 'master@example.com', isMaster: true })
    expect(response.download_whitelist).toBe('alice@example.com, Bob@Example.com')
  })

  it('公開対象として列挙していない項目は返さない', () => {
    const response = buildMasterSettingsResponse(all, { email: null, isMaster: false })
    expect(response).not.toHaveProperty('internal_note')
  })

  it('未設定の項目はキーごと省き、許可リスト未登録のマスターには空文字を返す', () => {
    const response = buildMasterSettingsResponse({}, { email: 'master@example.com', isMaster: true })
    expect(response).toEqual({ can_download: false, download_whitelist: '' })
  })
})
