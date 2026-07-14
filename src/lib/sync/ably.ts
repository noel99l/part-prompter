import 'server-only'
import { Rest, type TokenRequest } from 'ably'
import { SyncHttpError } from './errors'
import { calculateAblyTtl, syncChannelName } from './tokens'
import type { SyncState } from './types'

let client: Rest | null = null

function getClient(): Rest {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    throw new SyncHttpError(503, '同期サービスを利用できません。管理者へお問い合わせください。')
  }
  const separator = apiKey.indexOf(':')
  const keyName = separator > 0 ? apiKey.slice(0, separator) : ''
  const malformed = apiKey.trim() !== apiKey
    || apiKey.startsWith('ABLY_API_KEY=')
    || separator <= 0
    || separator === apiKey.length - 1
    || !keyName.includes('.')
    || /[\s"']/.test(apiKey)
  if (malformed) {
    throw new SyncHttpError(
      503,
      'ABLY_API_KEYの値の形式が不正です。環境変数名や引用符を含めず、Ably APIキー本体だけを設定してください。'
    )
  }
  client ??= new Rest({ key: apiKey })
  return client
}

export function assertAblyConfigured(): void {
  getClient()
}

async function ablyOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SyncHttpError) throw error
    // SDK由来のエラーをそのままログ/レスポンスへ出さず、APIキー露出を防ぐ。
    throw new SyncHttpError(503, '同期サービスへの接続に失敗しました。再試行してください。')
  }
}

export async function createSessionTokenRequest(
  sessionId: string,
  expiresAt: Date,
  clientId: string
): Promise<TokenRequest> {
  const channel = syncChannelName(sessionId)
  return ablyOperation(() => getClient().auth.createTokenRequest({
    capability: { [channel]: ['subscribe', 'presence'] },
    clientId,
    ttl: calculateAblyTtl(expiresAt),
  }))
}

export async function publishState(state: SyncState): Promise<void> {
  await ablyOperation(() => getClient().channels
    .get(syncChannelName(state.sessionId)).publish('state.updated', state))
}

export async function publishSessionEnded(sessionId: string, endedAt: string): Promise<void> {
  await ablyOperation(() => getClient().channels.get(syncChannelName(sessionId)).publish(
    'session.ended',
    { sessionId, endedAt }
  ))
}
