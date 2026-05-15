import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { loginAdmin, generateToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  await initDb()
  const { email, password } = await req.json()
  const admin = await loginAdmin(email, password)
  if (!admin) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  const token = generateToken(admin)
  return NextResponse.json({ user: { id: admin.id, email: admin.email }, token })
}
