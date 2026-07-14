import type { Metadata } from 'next'
import SyncViewer from '@/components/sync/SyncViewer'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function SyncJoinPage({
  params,
}: {
  params: Promise<{ joinToken: string }>
}) {
  const { joinToken } = await params
  return <SyncViewer joinToken={joinToken} />
}
