# part-prompter

歌詞プロンプター＆パート分けアプリ

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **DB**: Neon (PostgreSQL)
- **ホスティング**: Vercel
- **認証**: JWT（管理者のみ）

## URL構成

| URL | 説明 |
|---|---|
| `/prompter` | 曲一覧（認証不要） |
| `/prompter/[songId]` | プロンプター表示（認証不要） |
| `/admin` | 曲管理（JWT必須） |
| `/admin/[songId]` | 歌詞・パート分け編集（JWT必須） |

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.env.local` を作成：

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-jwt-secret-here
```

### 3. 起動

```bash
npm run dev
```

## Vercelデプロイ

1. GitHubリポジトリを作成してpush
2. Vercelでリポジトリをインポート
3. 環境変数に `DATABASE_URL` と `JWT_SECRET` を設定
4. デプロイ

DBテーブルは初回アクセス時に自動作成されます。

## 初期管理者アカウント

- メール: `admin@example.com`
- パスワード: `admin123`

※本番環境では必ず変更してください。
