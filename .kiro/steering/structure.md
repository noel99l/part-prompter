# Project Structure

## Top level

```
src/                  Application code
certificates/         Local HTTPS certs for dev (mkcert)
docs/                 Onboarding docs and images
scripts/              Utility scripts
server.js             Custom server entry
SPEC.md               Feature/behavior spec
README.md             Full feature + setup reference (Japanese)
AGENTS.md / CLAUDE.md Agent guidance (CLAUDE.md includes AGENTS.md)
```

## `src/` layout

```
src/
  auth.ts             NextAuth config (Node runtime, DB-backed callbacks)
  auth.edge.ts        Edge-safe NextAuth config for middleware
  middleware.ts       Protects /manage/* routes
  app/                App Router pages + API routes
  components/         Shared React components (+ co-located *.module.css)
  lib/                Framework-agnostic logic and DB access
  types/              Ambient type declarations (next-auth.d.ts, svg.d.ts)
```

## Routing (`src/app`)

- Public: `page.tsx` (redirects to `/songs`), `songs/`, `prompter/`, `playlists/`, `how-to-use/`, `privacy/`, `terms/`.
- Authenticated: everything under `manage/` (songs, playlists, settings, master-settings) with its own `layout.tsx`.
- Auth flow: `auth/signin`, `auth/setup` (account-name setup).
- Invites: `invite/[token]`.
- APIs under `app/api/`: `auth/[...nextauth]`, `songs/`, `playlists/`, `invite/[token]`, `lrclib/`, `onboarding/`, `master-settings/`, `user/`.
  - Song sub-resources: `songs/[id]/{lyrics,members,collaborators,duplicate,export/pptx}`.
- `admin/` and legacy `prompter/*` route names are redirect targets only (see `next.config.js`); build new features under `songs/`, `playlists/`, and `manage/`.

## `src/lib`

- `db.ts` — Postgres pool + `query`, `withTransaction`, `initDb`. Single source of DB access.
- `harmony.ts` — harmony (上ハモ/下ハモ) logic.
- `prompterBlocks.ts` — prompter block computation.
- `lyrics/merge.ts` — merging edited lyrics with existing part assignments.
- `onboarding/` — onboarding state, service, focus, and time helpers.
- `clientCache.ts` — client-side caching.

## Conventions

- Business logic lives in `src/lib` (pure and unit-testable); route handlers and components stay thin.
- Tests are co-located as `*.test.ts` next to their source; run with `npm run test`.
- One CSS Module per component/page, named to match the file it styles.
- Import from `src` using the `@/*` alias.
