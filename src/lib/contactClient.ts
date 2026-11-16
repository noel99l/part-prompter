'use client'
import { useEffect, useState } from 'react'
import { getCachedJson } from './clientCache'
import { CONTACT_EMAIL_SETTING_KEY, isValidContactEmail } from './contact'

export const MASTER_SETTINGS_API_URL = '/api/master-settings'

/** マスタ設定で指定された連絡用メールアドレス。未設定・不正な値なら null（リンクを出さない）。 */
export function useContactEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const apply = (data: Record<string, string> | null) => {
      if (!alive) return
      const value = data?.[CONTACT_EMAIL_SETTING_KEY]
      setEmail(isValidContactEmail(value) ? value : null)
    }
    getCachedJson(MASTER_SETTINGS_API_URL, apply).then(apply).catch(() => {})
    return () => { alive = false }
  }, [])

  return email
}
