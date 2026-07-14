import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { syncErrorResponse } from '@/lib/sync/errors'
import { requireSyncMaster } from '@/lib/sync/master'
import { rotateJoinToken } from '@/lib/sync/session'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const { id } = await params
    const token = await rotateJoinToken(id, master.id)
    const joinUrl = new URL(
      `/sync/${encodeURIComponent(token)}`,
      request.nextUrl.origin
    ).toString()
    return NextResponse.json(
      { sessionId: id, joinUrl },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}
