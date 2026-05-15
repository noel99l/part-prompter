import { Pool } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requires SSL
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 10000,
      max: 3,
      min: 0,
    })
  }
  return pool
}

export async function query(text: string, params?: any[], retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client
    try {
      client = await getPool().connect()
      const result = await client.query(text, params)
      return result
    } catch (error: any) {
      if (client) { try { client.release() } catch {} }
      if (attempt === retries) throw error
      if (error.message.includes('Connection terminated') || error.message.includes('timeout')) {
        pool?.end().catch(() => {})
        pool = null
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    } finally {
      if (client) { try { client.release() } catch {} }
    }
  }
}

export async function initDb() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_songs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_members (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES prompter_songs(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_lyrics (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES prompter_songs(id) ON DELETE CASCADE,
        block_index INTEGER NOT NULL,
        line_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        member_ids INTEGER[] DEFAULT '{}',
        timestamp_ms INTEGER,
        word_members JSONB DEFAULT '[]'
      )
    `)

    await query(`ALTER TABLE prompter_lyrics ADD COLUMN IF NOT EXISTS word_members JSONB DEFAULT '[]'`)

    await query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS playlist_songs (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES prompter_songs(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0
      )
    `)

    // デフォルト管理者（パスワード: admin123）
    const bcrypt = require('bcrypt')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await query(
      `INSERT INTO admins (email, password) VALUES ('admin@example.com', $1) ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    )
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}
