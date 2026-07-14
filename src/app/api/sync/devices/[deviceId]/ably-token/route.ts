import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { createSessionTokenRequest } from '@/lib/sync/ably'
import { requireBearer, syncErrorResponse } from '@/lib/sync/errors'
import { getDeviceTokenContext } from '@/lib/sync/session'

type Context = { params: Promise<{ deviceId: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const reconnectToken = requireBearer(request)
    const { deviceId } = await params
    const context = await getDeviceTokenContext(deviceId, reconnectToken)
    const tokenRequest = await createSessionTokenRequest(
      context.sessionId,
      context.expiresAt,
      context.clientId
    )
    return NextResponse.json(
      { tokenRequest },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}
