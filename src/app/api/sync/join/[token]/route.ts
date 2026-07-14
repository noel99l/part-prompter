import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { SyncHttpError, syncErrorResponse } from '@/lib/sync/errors'
import { assertOnlyKeys, readJsonObject } from '@/lib/sync/request'
import { joinSyncSession } from '@/lib/sync/session'

type Context = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const { token } = await params
    const body = await readJsonObject(request)
    assertOnlyKeys(body, ['reconnectToken'])
    if (body.reconnectToken !== undefined && typeof body.reconnectToken !== 'string') {
      throw new SyncHttpError(400, '再接続情報が不正です。')
    }
    const result = await joinSyncSession(token, body.reconnectToken as string | undefined)
    return NextResponse.json(result, {
      status: result.reconnectToken ? 201 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return syncErrorResponse(error)
  }
}
