import { Pool, type PoolClient } from 'pg'

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

export async function query(
  text: string,
  params?: unknown[],
  retries = 2
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | undefined
    try {
      client = await getPool().connect()
      const result = await client.query(text, params)
      return result
    } catch (error: unknown) {
      if (client) { try { client.release() } catch {} }
      if (attempt === retries) throw error
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Connection terminated') || message.includes('timeout')) {
        pool?.end().catch(() => {})
        pool = null
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    } finally {
      if (client) { try { client.release() } catch {} }
    }
  }
  throw new Error('Query failed')
}

export async function initDb() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT,
        account_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_songs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT,
        description TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        is_public BOOLEAN DEFAULT true,
        cover_text TEXT DEFAULT '',
        bg_color TEXT DEFAULT '#000000',
        original_bpm INTEGER,
        playback_bpm INTEGER,
        show_progress_bar BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
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
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS cover_text TEXT DEFAULT ''`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS bg_color TEXT DEFAULT '#000000'`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS original_bpm INTEGER`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS playback_bpm INTEGER`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS show_progress_bar BOOLEAN DEFAULT true`)
    await query(`ALTER TABLE prompter_songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await query(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`)
    await query(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS description TEXT`)
    await query(`
      CREATE TABLE IF NOT EXISTS song_collaborators (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES prompter_songs(id) ON DELETE CASCADE,
        invited_by INTEGER REFERENCES users(id),
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS song_collaborator_members (
        id SERIAL PRIMARY KEY,
        collaborator_id INTEGER NOT NULL REFERENCES song_collaborators(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(collaborator_id, user_id)
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

  } catch (error) {
    console.error('Database initialization error:', error)
  }
}
