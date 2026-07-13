# Product

PART-PROMPTER is a web app for managing song lyric part assignments (歌詞パート分け) and displaying them as a live prompter/teleprompter for vocal groups.

## Core concepts

- **Song (楽曲)** — A song with title, artist, description, and lyrics. Has a creator and can be public or private. Private songs never appear in public listings.
- **Member (メンバー)** — A vocalist assigned to a song (max 10). Each has a name and color. Lyrics are assigned to members at the character level, with optional upper/lower harmony (上ハモ / 下ハモ).
- **Lyrics** — Stored per line within blocks. Supports plain text or LRC (timestamped) format. Timestamps drive auto-scroll playback.
- **Prompter** — Slide-style live display (cover, current block, next-block preview) with keyboard/tap controls, BPM-based auto-advance, and fullscreen.
- **Playlist / Setlist (セットリスト)** — An ordered, drag-and-drop collection of songs. Owned privately; can include other users' public songs. Has its own prompter with prev/next-song navigation.
- **Collaboration (共同編集)** — Song editors can issue expiring invite links; accepted users gain edit rights to that song.

## Access model

- Public/unauthenticated pages: browsing, viewing, and running prompters (`/songs`, `/songs/[songId]`, prompter routes).
- Authenticated pages live under `/manage/*` and cover editing songs, playlists, settings, and collaboration.
- Editing a song is restricted to its creator and accepted collaborators.
- New users set an account name on first login; onboarding state is tracked per user.

## Conventions

- User-facing copy and most code comments are in Japanese. Match the existing language when editing UI text or comments.
- Timestamps shown to users are in JST.
- Old `/prompter/*` and `/admin/*` URLs are permanently redirected to current routes via `next.config.js`. Do not reintroduce those paths.
