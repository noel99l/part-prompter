import { createHash, randomBytes } from 'node:crypto'
import { SyncHttpError } from './errors'

const MAX_ABLY_TTL_MS = 60 * 60 * 1000

export function generateSecretToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSecretToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function syncChannelName(sessionId: string): string {
  return `part-prompter:session:${sessionId}`
}

export function calculateAblyTtl(expiresAt: Date, now = new Date()): number {
  const remaining = expiresAt.getTime() - now.getTime()
  if (remaining <= 0) {
    throw new SyncHttpError(410, '同期セッションの有効期限が切れています。')
  }
  return Math.min(MAX_ABLY_TTL_MS, remaining)
}
