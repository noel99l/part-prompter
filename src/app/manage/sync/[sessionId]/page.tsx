'use client'

import { useParams } from 'next/navigation'
import SyncController from '@/components/sync/SyncController'

export default function SyncControllerPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  return <SyncController sessionId={sessionId} />
}
