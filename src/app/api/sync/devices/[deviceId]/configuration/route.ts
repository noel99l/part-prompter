import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { SyncHttpError, requireBearer, syncErrorResponse } from '@/lib/sync/errors'
import { assertOnlyKeys, readJsonObject } from '@/lib/sync/request'
import { configureSyncDevice } from '@/lib/sync/session'

type Context = { params: Promise<{ deviceId: string }> }

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const reconnectToken = requireBearer(request)
    const { deviceId } = await params
    const body = await readJsonObject(request)
    assertOnlyKeys(body, ['displayName', 'configured'])
    if (body.configured !== true || typeof body.displayName !== 'string') {
      throw new SyncHttpError(400, '端末名と設定完了状態を指定してください。')
    }
    const displayName = body.displayName.trim()
    const length = Array.from(displayName).length
    if (length < 1 || length > 20) {
      throw new SyncHttpError(400, '端末名は1〜20文字で入力してください。')
    }
    const device = await configureSyncDevice(deviceId, reconnectToken, displayName)
    return NextResponse.json(
      { device },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}
