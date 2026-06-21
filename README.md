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
| `/` | 不要 | `/songs` へリダイレクト |
| `/songs` | 不要 | 公開パート分け一覧・検索 |
| `/songs/[songId]` | 不要 | 楽曲詳細・パート分け閲覧 |
| `/songs/[songId]/prompter` | 不要 | 単曲プロンプター表示 |
| `/playlists/[id]/prompter` | 不要 | セットリストプロンプター |
| `/how-to-use` | 不要 | 使い方 |
| `/privacy` | 不要 | プライバシーポリシー |
| `/terms` | 不要 | 利用規約 |
| `/invite/[token]` | 必要 | 共同編集招待の確認・承認 |
| `/manage/songs` | 必要 | パート分け管理（自分の楽曲・共同編集楽曲） |
| `/manage/songs/[songId]` | 必要 | パート分け編集（作成者・共同編集者のみ） |
| `/manage/songs/[songId]/print` | 必要 | 印刷・PDF保存用ページ |
| `/manage/playlists` | 必要 | セットリスト管理（自分のセットリストのみ） |
| `/manage/playlists/[id]` | 必要 | セットリスト編集 |
| `/manage/settings` | 必要 | アカウント設定 |
| `/auth/signin` | - | Googleログイン |
| `/auth/setup` | - | アカウント名初期設定 |

旧URLの `/prompter/*` と `/admin/*` は `next.config.js` で現行URLへリダイレクトされます。`/admin` 単体は `/songs` へリダイレクトされます。

## 主な機能

### パート分け一覧（/songs）
- 公開楽曲の一覧・検索（曲名・アーティスト・作者）
- タグ表示（歌詞なし / テキスト / タイムスタンプ / パート数）
- 作者・最終更新日時表示（JST）
- 公開/非公開設定（非公開は一覧に表示されない）
- PC表示時はサイドメニューを常時表示、SPはハンバーガーメニュー
- 各カードのメニューからセットリスト追加・プロンプター起動が可能

### 楽曲詳細（/songs/[songId]）
- パートメンバー・パート分けの閲覧
- タグ表示（テキスト / タイムスタンプ / パート数）
- パート分けテキストのコピー（曲名・アーティスト・メンバー一覧＋`(A)歌詞...` 形式）
- ログイン中は「複製して編集」で自分の非公開コピーを作成可能
- 最下部に作者・最終更新日を表示

### プロンプター（/songs/[songId]/prompter）
- スライド形式（表紙、現在ブロック、次ブロックプレビュー）
- SP横向き：画面左半分タップで前、右半分タップで次
- SP縦向き：全ブロックのスクロール表示
- PC：← / → / ↑ / ↓ キー、スペースキーで操作
- タイムスタンプ歌詞で自動再生対応（requestAnimationFrame）
- BPM変換による自動送り速度調整
- 進捗バーの表示/非表示設定
- 全画面ボタン（PC/Android対応）
- セットリスト経由の場合は前後曲へ移動可能

### パート分け管理（/manage/songs）
- 自分が作成した楽曲と共同編集に参加した楽曲を表示
- LRCLIB検索で歌詞を自動取得、または手動入力
- 楽曲追加時にデフォルト2名のメンバーを自動登録
- メニューから編集、プロンプター表示、共有URLコピー、PPTX/PDF出力、セットリスト追加、削除が可能

### パート分け編集（/manage/songs/[songId]）— 4タブ
1. **楽曲情報** — 曲名・アーティスト・概要編集、メンバー登録（最大10名・カラーパレット・カスタムカラー）、公開/非公開トグル
2. **歌詞編集** — LRC形式またはプレーンテキスト対応、直接編集・LRC/TXTファイルインポート、保存時に既存パート分けを引き継ぎ
3. **パート分け** — メンバー選択後に歌詞をなぞって文字単位で割り当て、ダブルタップで行全体割り当て、ブロック区切り管理、上ハモ/下ハモ指定、SP時は右ドロワーでメンバー選択
4. **プロンプター設定** — 表紙テキスト、背景色、進捗バー、BPM変換を設定

編集画面のメニューから、共有URL（公開時のみ）、PPTX出力、印刷/PDF保存、パート分けテキスト出力、共同編集招待、セットリスト追加、楽曲削除を実行できます。

### 共同編集
- 楽曲編集画面から有効期限付き招待リンクを発行
- 招待リンクを承認したユーザーは対象楽曲を編集可能
- 作成者または既存共同編集者が、招待リンクや共同編集者を削除可能

### セットリスト（/manage/playlists）
- 自分が作成したセットリストのみ表示・管理
- セットリスト名・概要の編集
- モーダルから曲名・アーティスト・歌詞で横断検索して追加（他ユーザーの公開楽曲も追加可能）
- ドラッグ&ドロップ並び替え
- セットリスト単位でのプロンプター表示（前後曲ボタン付き）

### アカウント
- 初回ログイン時にアカウント名を設定
- アカウント名の変更
- 退会時に自分のアカウント情報・作成楽曲・作成セットリストを削除

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
