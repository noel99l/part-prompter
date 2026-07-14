import { Pool, type PoolClient } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requires SSL
      connectionTimeoutMillis: 30000,
      // Neonへの新規TLS接続は約1秒かかるため、人間のページ遷移間隔（数十秒）では
      // 接続を維持して再接続ペナルティを避ける。60秒で手放せばNeonのautosuspendは妨げない。
      idleTimeoutMillis: 60000,
      keepAlive: true,
      max: 5,
      min: 0,
    })
    // アイドル接続がネットワーク変化やNeon側の切断でエラーになると、リスナーが
    // 無い場合 uncaughtException でプロセスごと落ちる。壊れたクライアントは
    // プールが自動破棄するので、ここではログだけ残す。
    pool.on('error', (err) => {
      console.warn('pg pool idle client error:', err.message)
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

/**
 * 単一接続上で複数ステートメントをトランザクション実行する。
 * 接続をステートメントごとに取り直さないため、N 件の書き込みを高速化できる。
 * コールバック内で例外が起きた場合は ROLLBACK する。
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | undefined
    let commitStarted = false
    try {
      client = await getPool().connect()
      await client.query('BEGIN')
      const result = await fn(client)
      // COMMIT送信後の接続断は成否が不明なため、callbackを再実行してはならない。
      commitStarted = true
      await client.query('COMMIT')
      return result
    } catch (error: unknown) {
      if (client && !commitStarted) {
        try { await client.query('ROLLBACK') } catch {}
      }
      if (commitStarted || attempt === retries) throw error
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Connection terminated') || message.includes('timeout')) {
        pool?.end().catch(() => {})
        pool = null
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      } else {
        // トランザクション内のロジックエラーはリトライしても無意味なので即時 throw
        throw error
      }
    } finally {
      if (client) { try { client.release() } catch {} }
    }
  }
  throw new Error('Transaction failed')
}

let initDbPromise: Promise<void> | null = null

/**
 * スキーマ初期化（テーブル・カラム・インデックス）。プロセス内で1回だけ実行する。
 * 毎リクエストで多数の DDL を Neon へ往復させないようメモ化している。
 */
export function initDb(): Promise<void> {
  if (!initDbPromise) {
    // 失敗した場合は次回再試行できるよう promise をリセットする
    initDbPromise = runInitDb().catch((error) => {
      initDbPromise = null
      throw error
    })
  }
  return initDbPromise
}

async function runInitDb() {
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

    // オンボーディング完了状態カラム。NULL=未完了、日時=完了済み。
    // カラムが今回初めて追加された場合のみ、既存ユーザー（Existing_User）を完了扱いにバックフィルする。
    const onboardingCol = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'onboarding_completed_at'`
    )
    const onboardingColExists = (onboardingCol.rowCount ?? 0) > 0
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP`)
    if (!onboardingColExists) {
      await query(
        `UPDATE users SET onboarding_completed_at = CURRENT_TIMESTAMP
         WHERE onboarding_completed_at IS NULL`
      )
    }

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

    // 一覧取得の集計サブクエリ・結合を高速化するインデックス（冪等）
    await query(`CREATE INDEX IF NOT EXISTS idx_prompter_members_song_id ON prompter_members(song_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_prompter_lyrics_song_id ON prompter_lyrics(song_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_prompter_songs_created_by ON prompter_songs(created_by)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_prompter_songs_is_public ON prompter_songs(is_public)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs(song_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_song_collaborators_song_id ON song_collaborators(song_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scm_collaborator_id ON song_collaborator_members(collaborator_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scm_user_id ON song_collaborator_members(user_id)`)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_sync_sessions (
        id UUID PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL CHECK (status IN ('active', 'ended', 'expired')),
        join_token_hash TEXT NOT NULL UNIQUE,
        playlist_snapshot JSONB NOT NULL,
        current_song_index INTEGER NOT NULL DEFAULT 0,
        current_block INTEGER NOT NULL DEFAULT -1,
        is_playing BOOLEAN NOT NULL DEFAULT false,
        position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
        started_at TIMESTAMPTZ,
        version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
        last_command_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ
      )
    `)
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_active_creator
      ON prompter_sync_sessions(created_by) WHERE status = 'active'
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_sync_sessions_join_hash ON prompter_sync_sessions(join_token_hash)`)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_sync_commands (
        session_id UUID NOT NULL REFERENCES prompter_sync_sessions(id) ON DELETE CASCADE,
        command_id UUID NOT NULL,
        resulting_state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, command_id)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS prompter_sync_devices (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES prompter_sync_sessions(id) ON DELETE CASCADE,
        device_number INTEGER NOT NULL CHECK (device_number > 0),
        display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 20),
        configured_at TIMESTAMPTZ,
        reconnect_token_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMPTZ,
        UNIQUE(session_id, device_number),
        UNIQUE(session_id, reconnect_token_hash)
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_sync_devices_session ON prompter_sync_devices(session_id)`)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sync_devices_configured
      ON prompter_sync_devices(session_id, configured_at)
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS master_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}
