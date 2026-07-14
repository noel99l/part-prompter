import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { assertAblyConfigured } from '@/lib/sync/ably'
import { SyncHttpError, syncErrorResponse } from '@/lib/sync/errors'
import { requireSyncMaster } from '@/lib/sync/master'
import { assertOnlyKeys, readJsonObject } from '@/lib/sync/request'
import { createSyncSession, getActiveSession } from '@/lib/sync/session'

export async function GET() {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const activeSession = await getActiveSession(master.id)
    return NextResponse.json({ activeSession, canCreate: activeSession === null })
  } catch (error) {
    return syncErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    assertAblyConfigured()
    const body = await readJsonObject(request)
    assertOnlyKeys(body, ['playlistId'])
    if (!Number.isInteger(body.playlistId) || (body.playlistId as number) <= 0) {
      throw new SyncHttpError(400, 'セットリストを指定してください。')
    }
    const result = await createSyncSession(master.id, body.playlistId as number)
    const joinUrl = new URL(
      `/sync/${encodeURIComponent(result.joinToken)}`,
      request.nextUrl.origin
    ).toString()
    return NextResponse.json(
      { ...result.snapshot, joinUrl },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}
