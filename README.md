# PART-PROMPTER

歌詞パート分け管理・プロンプターアプリ

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
| 歌詞取得 | LRCLIB API |

## URL構成

| URL | 認証 | 説明 |
|---|---|---|
| `/prompter` | 不要 | パート分け一覧・検索 |
| `/prompter/[songId]/detail` | 不要 | 楽曲詳細・パート分け閲覧 |
| `/prompter/[songId]` | 不要 | プロンプター表示 |
| `/prompter/playlist/[id]` | 不要 | プレイリストプロンプター |
| `/how-to-use` | 不要 | 使い方 |
| `/privacy` | 不要 | プライバシーポリシー |
| `/admin` | 必要 | 管理トップ |
| `/admin/songs` | 必要 | パート分け管理（自分の楽曲のみ） |
| `/admin/[songId]` | 必要 | パート分け編集（作成者のみ） |
| `/admin/playlists` | 必要 | プレイリスト管理（自分のプレイリストのみ） |
| `/admin/playlists/[id]` | 必要 | プレイリスト編集 |
| `/admin/settings` | 必要 | アカウント設定 |
| `/auth/signin` | - | Googleログイン |
| `/auth/setup` | - | アカウント名初期設定 |

## 主な機能

### パート分け一覧（/prompter）
- 楽曲一覧・検索（曲名・アーティスト・作者）
- タグ表示（歌詞なし / テキスト / タイムスタンプ付き / 👥パート数）
- 作者・最終更新日時表示（JST）
- 公開/非公開設定（非公開は一覧に表示されない）
- PC表示時はサイドメニューを常時表示、SPはハンバーガーメニュー
- 各カードの⋯メニューからプレイリストに追加可能

### 楽曲詳細（/prompter/[songId]/detail）
- パートメンバー・パート分けの閲覧
- タグ表示（テキスト / タイムスタンプ付き / 👥パート数）
- パート分けテキストのコピー（曲名・アーティスト・メンバー一覧＋(A)歌詞... 形式）
- ログイン中は「複製して編集」で自分のパート分けを作成可能
- 最下部に作者・最終更新日を表示

### プロンプター（/prompter/[songId]）
- スライド形式（現在ブロック＋次ブロックプレビュー）
- SP：画面左半分タップで前、右半分タップで次
- PC：← / → キー・スペースキーで操作
- タイムスタンプ付き歌詞で自動再生対応（requestAnimationFrame）
- 全画面ボタン（PC/Android対応）
- SP縦向き時はスクロール表示
- プレイリスト経由の場合は⏮⏭で前後の曲に移動可能

### パート分け管理（/admin/songs）
- 自分が追加した楽曲のみ表示
- LRCLIB検索で歌詞を自動取得、または手動入力
- 楽曲追加時にデフォルト2名のメンバーを自動登録
- ⋯メニューからプレイリスト追加・削除

### パート分け編集（/admin/[songId]）— 4タブ
1. **楽曲情報** — 曲名・アーティスト・概要のインライン編集、メンバー登録（最大10名・カラーパレット・カスタムカラー）、公開/非公開トグル
2. **歌詞編集** — LRC形式またはプレーンテキスト対応、直接編集・LRCファイルインポート、保存時にパート分けを引き継ぎ
3. **パート分け** — メンバー選択→歌詞行をなぞって割り当て、単語分割モード（長押し）、ブロック区切り管理、SP時は右ドロワーでメンバー選択
4. **出力** — 共有URL（公開時のみ）・PPTX出力・PDF出力・テキストコピー

### プレイリスト（/admin/playlists）
- 自分が作成したプレイリストのみ表示・管理
- プレイリスト名・概要の編集
- モーダルから曲名・アーティスト・歌詞で横断検索して追加（他ユーザーの公開楽曲も追加可能）
- ドラッグ&ドロップ並び替え
- プレイリスト単位でのプロンプター表示（前後曲ボタン付き）

### アカウント
- アカウント名の変更
- 初回ログイン時にアカウント名を設定

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 証明書生成（HTTPS用・mkcert推奨）

```bash
brew install mkcert
mkcert -install
mkdir -p certificates
mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1
```

### 3. 環境変数設定

`.env.local` を作成：

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
AUTH_SECRET=your-auth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. 起動

```bash
npm run dev
```

HTTPS で https://localhost:3000 で起動します。

> 初回アクセス時にDBテーブルが自動作成されます。

## Vercelデプロイ

1. GitHubリポジトリを作成してpush
2. Vercelでリポジトリをインポート
3. 環境変数に `DATABASE_URL` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定
4. デプロイ

## 開発者

| | |
|---|---|
| GitHub | [@noel99l](https://github.com/noel99l) |
| X (Twitter) | [@noel99l](https://x.com/noel99l) |
