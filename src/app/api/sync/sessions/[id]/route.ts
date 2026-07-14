import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { publishSessionEnded } from '@/lib/sync/ably'
import { syncErrorResponse } from '@/lib/sync/errors'
import { requireSyncMaster } from '@/lib/sync/master'
import { endSyncSession, getMasterSnapshot } from '@/lib/sync/session'

type Context = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Context) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const { id } = await params
    return NextResponse.json(
      await getMasterSnapshot(id, master.id),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return syncErrorResponse(error)
  }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const { id } = await params
    const result = await endSyncSession(id, master.id)
    if (result.snapshot.session.endedAt) {
      await publishSessionEnded(id, result.snapshot.session.endedAt)
    }
    return NextResponse.json(result.snapshot)
  } catch (error) {
    return syncErrorResponse(error)
  }
}
