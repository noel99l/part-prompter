import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface Admin {
  id: number
  email: string
}

export function generateToken(admin: Admin): string {
  return jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): Admin | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Admin
  } catch {
    return null
  }
}

export async function loginAdmin(email: string, password: string): Promise<Admin | null> {
  try {
    const result = await query('SELECT id, email, password FROM admins WHERE email = $1', [email])
    if (result.rows.length === 0) return null
    const admin = result.rows[0]
    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) return null
    return { id: admin.id, email: admin.email }
  } catch {
    return null
  }
}
