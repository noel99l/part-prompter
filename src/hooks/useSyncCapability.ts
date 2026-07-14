'use client'

import { useEffect, useState } from 'react'

export function useSyncCapability(): boolean {
  const [canUseSyncPrompter, setCanUseSyncPrompter] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCapability() {
      try {
        const response = await fetch('/api/sync/capability', { signal: controller.signal })
        if (!response.ok) throw new Error('同期プロンプター権限の取得に失敗しました')
        const data: unknown = await response.json()
        setCanUseSyncPrompter(
          typeof data === 'object' && data !== null
          && (data as { canUseSyncPrompter?: unknown }).canUseSyncPrompter === true
        )
      } catch {
        if (!controller.signal.aborted) setCanUseSyncPrompter(false)
      }
    }

    loadCapability()
    return () => controller.abort()
  }, [])

  return canUseSyncPrompter
}
