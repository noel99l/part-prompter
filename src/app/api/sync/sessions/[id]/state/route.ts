import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { publishState } from '@/lib/sync/ably'
import { syncErrorResponse } from '@/lib/sync/errors'
import { requireSyncMaster } from '@/lib/sync/master'
import { readJsonObject } from '@/lib/sync/request'
import { parseSyncCommand } from '@/lib/sync/state'
import { updateSyncState } from '@/lib/sync/state-store'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    await initDb()
    const master = await requireSyncMaster()
    const { id } = await params
    const command = parseSyncCommand(await readJsonObject(request))
    const result = await updateSyncState(id, master.id, command)
    await publishState(result.state)
    return NextResponse.json(result)
  } catch (error) {
    return syncErrorResponse(error)
  }
}
