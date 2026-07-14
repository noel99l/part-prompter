import { SyncHttpError } from './errors'

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown
  try {
    const text = await request.text()
    value = text ? JSON.parse(text) : {}
  } catch {
    throw new SyncHttpError(400, 'JSONリクエストが不正です。')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyncHttpError(400, 'JSONオブジェクトを指定してください。')
  }
  return value as Record<string, unknown>
}

export function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new SyncHttpError(400, 'リクエストに未対応の項目が含まれています。')
  }
}
