import { NextResponse } from 'next/server'

export class SyncHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SyncHttpError'
  }
}

export function syncErrorResponse(error: unknown) {
  if (error instanceof SyncHttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.details ?? {}) },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  console.error(
    '同期APIで予期しないエラーが発生しました:',
    error instanceof Error ? error.message : '不明なエラー'
  )
  return NextResponse.json(
    { error: '同期サービスでエラーが発生しました。しばらくしてから再試行してください。' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}

export function requireBearer(request: Request): string {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new SyncHttpError(401, '端末の認証情報がありません。')
  }
  const token = authorization.slice(7).trim()
  if (!token) throw new SyncHttpError(401, '端末の認証情報がありません。')
  return token
}
