# Tech Stack & Conventions

## Stack

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19 |
| Styling | CSS Modules (`*.module.css`) + Tailwind CSS v4 (PostCSS) |
| Database | PostgreSQL (Neon), accessed via `pg` |
| Auth | NextAuth v5 (beta), Google OAuth, JWT sessions |
| Drag & drop | @dnd-kit |
| PPTX export | pptxgenjs |
| Lyrics | LRCLIB API (`lrclib-api`) |
| Tests | Vitest + Testing Library + fast-check |
| Hosting | Vercel |

## ⚠️ Next.js version note

Per `AGENTS.md`: this Next.js may differ from training data. APIs, conventions, and file structure can differ. When in doubt, check the installed docs under `node_modules/next/dist/docs/` and heed deprecation notices before writing code.

## Commands

```bash
npm run dev     # HTTPS dev server on :3000 (kills existing :3000 first, uses local certs)
npm run build   # next build
npm run start   # production server
npm run lint    # eslint
npm run test    # vitest run (single run, no watch)
```

- Dev runs over HTTPS at https://localhost:3000 using certs in `certificates/`.
- Do NOT start long-running dev/watch commands yourself; ask the user to run them.
- For tests, always use single-run (`vitest run`), never watch mode.
- Note: `next.config.js` sets `eslint.ignoreDuringBuilds: true`, so builds won't catch lint errors. Run `npm run lint` explicitly.

## Environment variables

Required in `.env.local` (see `.env.local.example`):
`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## Database patterns

- Use the helpers in `src/lib/db.ts`. Never instantiate `Pool` elsewhere.
  - `query(text, params?)` — single statements. Always parameterize (`$1`, `$2`); never interpolate user input into SQL.
  - `withTransaction(fn)` — multi-statement writes on one connection; auto BEGIN/COMMIT/ROLLBACK. Prefer this for bulk writes and batch multiple rows into a single `INSERT` to reduce round-trips.
- Call `await initDb()` at the start of API routes that touch the DB. Schema is created/migrated idempotently there (memoized once per process).
- Schema evolution uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Add new columns/indexes the same way inside `runInitDb`.
- `pg` is listed in `serverExternalPackages`; keep DB code server-side only.

## API routes

- Route handlers in `src/app/api/**/route.ts` export `GET`/`POST`/`PUT`/`DELETE` from `next/server`.
- Dynamic params are async: type as `{ params: Promise<{ id: string }> }` and `await params`.
- Return via `NextResponse.json(...)`; use appropriate status codes (e.g. `{ status: 400 }` for validation).
- Get the session with `auth()` from `@/auth`; resolve the app user by matching `session.user.email` to the `users` table.

## Auth

- `src/auth.ts` — full NextAuth config (Node runtime, DB access in callbacks).
- `src/auth.edge.ts` — edge-safe config used by `src/middleware.ts`.
- Middleware protects `/manage` and `/manage/:path*`, redirecting unauthenticated users to `/auth/signin` with a `callbackUrl`.

## Styling & assets

- Co-locate a `*.module.css` with each component/page; import as `styles`.
- SVGs are imported as React components via `@svgr/webpack` (see `src/components/icons`).
- Use the `@/*` path alias for imports from `src`.
