import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { requireBearer, syncErrorResponse } from '@/lib/sync/errors'
import { getDeviceSnapshot } from '@/lib/sync/session'

type Context = { params: Promise<{ deviceId: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const reconnectToken = requireBearer(request)
    const { deviceId } = await params
    return NextResponse.json(
      await getDeviceSnapshot(deviceId, reconnectToken),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}
