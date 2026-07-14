import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { createSessionTokenRequest } from '@/lib/sync/ably'
import { syncErrorResponse } from '@/lib/sync/errors'
import { requireSyncMaster } from '@/lib/sync/master'
import { getMasterTokenContext } from '@/lib/sync/session'

type Context = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Context) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const { id } = await params
    const context = await getMasterTokenContext(id, master.id)
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
