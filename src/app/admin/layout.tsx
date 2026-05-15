import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/auth/signin')

  const result = await query(`SELECT account_name FROM users WHERE email = $1`, [session.user.email])
  const accountName = result.rows[0]?.account_name

  if (!accountName) redirect('/auth/setup')

  return <>{children}</>
}
