import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { syncErrorResponse } from '@/lib/sync/errors'
import { getSyncMaster } from '@/lib/sync/master'

export async function GET() {
  try {
    await initDb()
    const result = await getSyncMaster()
    return NextResponse.json({ canUseSyncPrompter: result.kind === 'master' })
  } catch (error) {
    return syncErrorResponse(error)
  }
}
