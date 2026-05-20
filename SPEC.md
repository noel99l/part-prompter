# Part Prompter 仕様書

## システム概要

歌詞プロンプター＆パート分けアプリ。楽曲の歌詞をメンバーごとに色分けし、プロンプター表示・PPTX出力ができる。

---

## URL構成

```mermaid
graph TD
  ROOT["/"] --> PROMPTER["/prompter"]
  ROOT --> ADMIN["/admin"]
  ROOT --> AUTH["/auth/signin"]

  PROMPTER --> PROMPTER_DETAIL["/prompter/[songId]/detail\n楽曲詳細・歌詞一覧"]
  PROMPTER --> PROMPTER_VIEW["/prompter/[songId]\nプロンプター表示"]
  PROMPTER --> PROMPTER_PLAYLIST["/prompter/playlist/[id]\nセットリストプロンプター"]

  ADMIN --> ADMIN_TOP["/admin\n管理トップ"]
  ADMIN_TOP --> ADMIN_SONGS["/admin/songs\nパート分け管理"]
  ADMIN_TOP --> ADMIN_PLAYLISTS["/admin/playlists\nセットリスト管理"]
  ADMIN_TOP --> ADMIN_SETTINGS["/admin/settings\nアカウント設定"]
  ADMIN_SONGS --> ADMIN_SONG_EDIT["/admin/[songId]\n楽曲編集"]
  ADMIN_PLAYLISTS --> ADMIN_PLAYLIST_EDIT["/admin/playlists/[id]\nセットリスト編集"]

  AUTH --> AUTH_SETUP["/auth/setup\nアカウント名設定"]
```

---

## 認証フロー

```mermaid
sequenceDiagram
  actor User
  participant Middleware
  participant NextAuth
  participant Google
  participant DB

  User->>Middleware: /admin/* アクセス
  Middleware->>Middleware: セッション確認
  alt 未認証
    Middleware-->>User: /auth/signin へリダイレクト
    User->>NextAuth: Googleログインボタン押下
    NextAuth->>Google: OAuth認証
    Google-->>NextAuth: 認証成功
    NextAuth->>DB: users テーブルにUPSERT
    alt account_name 未設定
      NextAuth-->>User: /auth/setup へリダイレクト
      User->>DB: account_name 登録
    end
    NextAuth-->>User: /admin へリダイレクト
  else 認証済み
    Middleware-->>User: アクセス許可
  end
```

---

## データモデル

```mermaid
erDiagram
  users {
    int id PK
    text google_id UK
    text email
    text account_name
    timestamp created_at
  }

  prompter_songs {
    int id PK
    text title
    text artist
    int created_by FK
    timestamp created_at
  }

  prompter_members {
    int id PK
    int song_id FK
    text name
    text color
    int sort_order
  }

  prompter_lyrics {
    int id PK
    int song_id FK
    int block_index
    int line_index
    text text
    int[] member_ids
    int timestamp_ms
    jsonb word_members
  }

  playlists {
    int id PK
    text name
    int created_by FK
    timestamp created_at
  }

  playlist_songs {
    int id PK
    int playlist_id FK
    int song_id FK
    int sort_order
  }

  users ||--o{ prompter_songs : "作成"
  users ||--o{ playlists : "作成"
  prompter_songs ||--o{ prompter_members : "持つ"
  prompter_songs ||--o{ prompter_lyrics : "持つ"
  playlists ||--o{ playlist_songs : "含む"
  prompter_songs ||--o{ playlist_songs : "含まれる"
```

---

## API一覧

```mermaid
graph LR
  subgraph songs["/api/songs"]
    S1["GET / POST\n楽曲一覧取得・作成"]
    S2["GET /[id]\n楽曲取得"]
    S3["PUT /[id]\n楽曲更新"]
    S4["DELETE /[id]\n楽曲削除"]
    S5["GET/PUT /[id]/lyrics\n歌詞取得・保存"]
    S6["GET/PUT /[id]/members\nメンバー取得・保存(UPSERT)"]
    S7["GET /[id]/export/pptx\nPPTX出力"]
    S8["GET /search\n楽曲検索"]
  end

  subgraph playlists["/api/playlists"]
    P1["GET / POST\nセットリスト一覧・作成"]
    P2["GET/PUT/DELETE /[id]\nセットリスト操作"]
    P3["POST/PUT/DELETE /[id]/songs\n曲の追加・並び替え・削除"]
  end

  subgraph other["その他"]
    O1["GET /api/lrclib\nLRCLIB歌詞検索"]
    O2["PUT /api/user\nアカウント名更新"]
    O3["/api/auth/[...nextauth]\nNextAuth"]
  end
```

---

## 楽曲編集フロー（/admin/[songId]）

```mermaid
stateDiagram-v2
  [*] --> 楽曲情報タブ

  楽曲情報タブ --> 歌詞編集タブ : タブ切替
  楽曲情報タブ --> パート分けタブ : タブ切替
  楽曲情報タブ --> 出力タブ : タブ切替

  state 楽曲情報タブ {
    [*] --> 曲名アーティスト編集
    曲名アーティスト編集 --> 保存
    [*] --> メンバー追加削除
    メンバー追加削除 --> 名前色設定
    名前色設定 --> メンバー保存
    note right of メンバー保存 : UPSERT方式\nIDを保持してパート分けを維持
  }

  state 歌詞編集タブ {
    [*] --> LRCテキスト編集
    LRCテキスト編集 --> 保存
    [*] --> LRCファイルインポート
    LRCファイルインポート --> 保存
    note right of 保存 : 既存パート分けを\nテキスト一致で引き継ぎ
  }

  state パート分けタブ {
    [*] --> メンバー選択
    メンバー選択 --> 歌詞行をなぞる
    歌詞行をなぞる --> パート割り当て
    パート割り当て --> 単語分割モード : 長押し
    単語分割モード --> 単語ごとに割り当て
    [*] --> ブロック区切り追加削除
    note right of パート割り当て : 複数選択時はIDを昇順ソートして保存\nCB=BCとして同一扱い
  }

  state 出力タブ {
    [*] --> PPTX出力
    [*] --> テキストコピー
  }
```

---

## プロンプター表示フロー（/prompter/[songId]）

```mermaid
sequenceDiagram
  participant User
  participant Prompter

  User->>Prompter: ページ表示
  Prompter->>Prompter: カバー画面表示\n(曲名・アーティスト・メンバー一覧)

  loop 操作
    alt タップ左半分 / ←キー
      User->>Prompter: 前のブロックへ
    else タップ右半分 / →キー
      User->>Prompter: 次のブロックへ
    else スペースキー / ▶ボタン
      User->>Prompter: タイムスタンプ自動再生
      Prompter->>Prompter: requestAnimationFrameで\nタイムスタンプに合わせてブロック進行
    else ⛶ボタン
      User->>Prompter: フルスクリーン切替
    end
    Prompter-->>User: 現在ブロック(大) + 次ブロック(小)を表示
  end
```

---

## コンポーネント構成

```mermaid
graph TD
  Layout["app/layout.tsx"]
  AdminLayout["admin/layout.tsx\n認証チェック・ヘッダー"]
  AdminMenu["AdminMenu.tsx\nハンバーガーメニュー"]
  Loading["Loading.tsx\nスケルトンスクリーン"]
  Skeleton["skeleton.module.css\nシマーアニメーション"]

  AdminLayout --> AdminMenu
  AdminLayout --> Loading
  Loading --> Skeleton

  subgraph Pages
    AdminTop["admin/page.tsx"]
    AdminSongs["admin/songs/page.tsx"]
    AdminSongEdit["admin/[songId]/page.tsx\n4タブ構成"]
    AdminPlaylists["admin/playlists/page.tsx"]
    AdminPlaylistEdit["admin/playlists/[id]/page.tsx\nDnDソート"]
    AdminSettings["admin/settings/page.tsx"]
    PrompterList["prompter/page.tsx"]
    PrompterDetail["prompter/[songId]/detail/page.tsx"]
    PrompterView["prompter/[songId]/page.tsx"]
  end

  AdminLayout --> Pages
```
