# Part Prompter

歌詞プロンプター＆パート分けアプリ

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| DB | Neon (PostgreSQL) |
| ホスティング | Vercel |
| 認証 | NextAuth v5 (Google OAuth) |
| ドラッグ&ドロップ | @dnd-kit |
| PPTX出力 | pptxgenjs |

## URL構成

| URL | 認証 | 説明 |
|---|---|---|
| `/prompter` | 不要 | 楽曲一覧 |
| `/prompter/[songId]/detail` | 不要 | 楽曲詳細・歌詞一覧 |
| `/prompter/[songId]` | 不要 | プロンプター表示 |
| `/prompter/playlist/[id]` | 不要 | プレイリストプロンプター |
| `/admin` | 必要 | 管理トップ |
| `/admin/songs` | 必要 | 楽曲管理 |
| `/admin/[songId]` | 必要 | 楽曲編集（歌詞・パート分け） |
| `/admin/playlists` | 必要 | プレイリスト管理 |
| `/admin/playlists/[id]` | 必要 | プレイリスト編集 |
| `/admin/settings` | 必要 | アカウント設定 |
| `/auth/signin` | - | Googleログイン |
| `/auth/setup` | - | アカウント名初期設定 |

## 主な機能

### プロンプター
- 楽曲一覧・検索
- メンバーカラーによる歌詞の色分け表示
- タイムスタンプ連動の自動再生（requestAnimationFrame）
- ブロック単位での手動送り（タップ左右 / キーボード矢印）
- フルスクリーン対応
- SP横向き推奨表示

### 楽曲編集（4タブ）
1. **楽曲情報** — 曲名・アーティスト編集、メンバー登録（最大10名・カラーパレット）
2. **歌詞編集** — LRCテキスト直接編集・ファイルインポート、パート分け引き継ぎ
3. **パート分け** — メンバー選択→歌詞行をなぞって割り当て、単語分割モード（長押し）、ブロック区切り管理
4. **出力** — PPTX出力、テキストコピー

### プレイリスト
- プレイリスト作成・編集
- 楽曲の追加・削除・ドラッグ&ドロップ並び替え
- プレイリスト単位でのプロンプター表示

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.env.local` を作成：

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
AUTH_SECRET=your-auth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. 起動

```bash
npm run dev
```

HTTPS（自己署名証明書）で https://localhost:3000 で起動します。

> 初回アクセス時にDBテーブルが自動作成されます。

## Vercelデプロイ

1. GitHubリポジトリを作成してpush
2. Vercelでリポジトリをインポート
3. 環境変数に `DATABASE_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定
4. デプロイ

## 仕様書

詳細な仕様（URL構成・データモデル・APIフロー・コンポーネント構成）は [SPEC.md](./SPEC.md) を参照してください。
