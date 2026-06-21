# Part Prompter 仕様書

## システム概要

歌詞プロンプター＆パート分けアプリ。楽曲の歌詞をメンバーごとに色分けし、詳細閲覧、プロンプター表示、セットリスト再生、PPTX出力、印刷/PDF保存、共同編集ができる。

---

## URL構成

```mermaid
graph TD
  ROOT["/"] --> SONGS["/songs\n公開パート分け一覧"]
  ROOT --> AUTH["/auth/signin"]

  SONGS --> SONG_DETAIL["/songs/[songId]\n楽曲詳細・歌詞一覧"]
  SONGS --> SONG_PROMPTER["/songs/[songId]/prompter\n単曲プロンプター"]
  SONGS --> PLAYLIST_PROMPTER["/playlists/[id]/prompter\nセットリストプロンプター"]

  AUTH --> SETUP["/auth/setup\nアカウント名設定"]
  INVITE["/invite/[token]\n共同編集招待"] --> SONG_EDIT

  MANAGE["管理セクション\n/manage/*"] --> MANAGE_SONGS["/manage/songs\nパート分け管理"]
  MANAGE --> MANAGE_PLAYLISTS["/manage/playlists\nセットリスト管理"]
  MANAGE --> MANAGE_SETTINGS["/manage/settings\nアカウント設定"]
  MANAGE_SONGS --> SONG_EDIT["/manage/songs/[songId]\n楽曲編集"]
  SONG_EDIT --> PRINT["/manage/songs/[songId]/print\n印刷・PDF保存"]
  MANAGE_PLAYLISTS --> PLAYLIST_EDIT["/manage/playlists/[id]\nセットリスト編集"]

  LEGACY_PROMPTER["/prompter/*"] -.redirect.-> SONGS
  LEGACY_ADMIN_ROOT["/admin"] -.redirect.-> SONGS
  LEGACY_ADMIN_CHILD["/admin/*"] -.redirect.-> MANAGE
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

  User->>Middleware: /manage/* アクセス
  Middleware->>Middleware: セッション確認
  alt 未認証
    Middleware-->>User: /auth/signin?callbackUrl=... へリダイレクト
    User->>NextAuth: Googleログインボタン押下
    NextAuth->>Google: OAuth認証
    Google-->>NextAuth: 認証成功
    NextAuth->>DB: users テーブルにUPSERT
    alt account_name 未設定
      NextAuth-->>User: /auth/setup へリダイレクト
      User->>DB: account_name 登録
    end
    NextAuth-->>User: callbackUrl または /manage/songs へ遷移
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
    text description
    int created_by FK
    boolean is_public
    text cover_text
    text bg_color
    int original_bpm
    int playback_bpm
    boolean show_progress_bar
    timestamp created_at
    timestamp updated_at
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
    text description
    int created_by FK
    timestamp created_at
  }

  playlist_songs {
    int id PK
    int playlist_id FK
    int song_id FK
    int sort_order
  }

  song_collaborators {
    int id PK
    int song_id FK
    int invited_by FK
    text token UK
    timestamp expires_at
    timestamp created_at
  }

  song_collaborator_members {
    int id PK
    int collaborator_id FK
    int user_id FK
    timestamp joined_at
  }

  users ||--o{ prompter_songs : "作成"
  users ||--o{ playlists : "作成"
  users ||--o{ song_collaborators : "招待"
  users ||--o{ song_collaborator_members : "参加"
  prompter_songs ||--o{ prompter_members : "持つ"
  prompter_songs ||--o{ prompter_lyrics : "持つ"
  prompter_songs ||--o{ song_collaborators : "招待リンク"
  playlists ||--o{ playlist_songs : "含む"
  prompter_songs ||--o{ playlist_songs : "含まれる"
  song_collaborators ||--o{ song_collaborator_members : "承認"
```

---

## API一覧

```mermaid
graph LR
  subgraph songs["/api/songs"]
    S1["GET / POST\n公開楽曲一覧・楽曲作成"]
    S2["GET /[id]\n楽曲取得"]
    S3["PUT /[id]\n楽曲更新"]
    S4["DELETE /[id]\n楽曲削除"]
    S5["GET/PUT /[id]/lyrics\n歌詞取得・保存"]
    S6["GET/PUT /[id]/members\nメンバー取得・保存"]
    S7["POST /[id]/duplicate\n楽曲複製"]
    S8["GET /[id]/export/pptx\nPPTX出力"]
    S9["GET/POST/DELETE /[id]/collaborators\n共同編集管理"]
    S10["GET /search\n公開楽曲検索"]
  end

  subgraph playlists["/api/playlists"]
    P1["GET / POST\n自分のセットリスト一覧・作成"]
    P2["GET/PUT/DELETE /[id]\nセットリスト取得・更新・削除"]
    P3["POST/PUT/DELETE /[id]/songs\n曲の追加・並び替え・削除"]
  end

  subgraph other["その他"]
    O1["GET /api/lrclib\nLRCLIB歌詞検索"]
    O2["GET/PUT/DELETE /api/user\nユーザー取得・更新・退会"]
    O3["GET/POST /api/invite/[token]\n共同編集招待確認・承認"]
    O4["/api/auth/[...nextauth]\nNextAuth"]
  end
```

---

## 楽曲編集フロー（/manage/songs/[songId]）

```mermaid
stateDiagram-v2
  [*] --> 楽曲情報タブ

  楽曲情報タブ --> 歌詞編集タブ : タブ切替
  楽曲情報タブ --> パート分けタブ : タブ切替
  楽曲情報タブ --> プロンプター設定タブ : タブ切替

  state 楽曲情報タブ {
    [*] --> 曲名アーティスト概要編集
    曲名アーティスト概要編集 --> 公開設定
    公開設定 --> 保存
    [*] --> メンバー追加削除
    メンバー追加削除 --> 名前色設定
    名前色設定 --> メンバー保存
    note right of メンバー保存 : PUT /members で保存\n新規IDを歌詞側へリマップ
  }

  state 歌詞編集タブ {
    [*] --> LRCテキスト編集
    LRCテキスト編集 --> 保存
    [*] --> LRC_TXTファイルインポート
    LRC_TXTファイルインポート --> 保存
    note right of 保存 : LRCまたはプレーンテキスト対応\n既存パート分けを可能な範囲で引き継ぎ
  }

  state パート分けタブ {
    [*] --> メンバー選択
    メンバー選択 --> 文字をなぞる
    文字をなぞる --> 文字単位パート割り当て
    メンバー選択 --> 行をダブルタップ
    行をダブルタップ --> 行全体パート割り当て
    [*] --> 上ハモ下ハモモード
    上ハモ下ハモモード --> 文字単位ハモリ指定
    [*] --> ブロック区切り追加削除
    note right of 文字単位パート割り当て : 複数選択時はIDを昇順ソートして保存\nCB=BCとして同一扱い
  }

  state プロンプター設定タブ {
    [*] --> 表紙テキスト編集
    [*] --> 背景色設定
    [*] --> 進捗バー表示設定
    [*] --> BPM変換設定
  }
```

---

## プロンプター表示フロー（/songs/[songId]/prompter）

```mermaid
sequenceDiagram
  participant User
  participant Prompter
  participant PlaylistCache

  User->>Prompter: ページ表示
  alt セットリスト経由
    Prompter->>PlaylistCache: sessionStorage のセットリストキャッシュ確認
    alt キャッシュあり
      PlaylistCache-->>Prompter: 楽曲・メンバー・歌詞を返す
    else キャッシュなし
      Prompter->>Prompter: APIから楽曲・メンバー・歌詞を取得
    end
  else 単曲表示
    Prompter->>Prompter: APIから楽曲・メンバー・歌詞を取得
  end
  Prompter->>Prompter: 表紙表示\n(曲名・アーティスト・メンバー一覧・表紙テキスト)

  loop 操作
    alt タップ左半分 / ←キー
      User->>Prompter: 前のブロックへ
    else タップ右半分 / →キー
      User->>Prompter: 次のブロックへ
    else Shift+← / Shift+→
      User->>Prompter: セットリスト内の前後曲へ移動
    else スペースキー / ▶ボタン
      User->>Prompter: タイムスタンプ自動再生
      Prompter->>Prompter: requestAnimationFrameで\nBPM補正済みタイムスタンプに合わせて進行
    else 全画面ボタン
      User->>Prompter: フルスクリーン切替
    end
    Prompter-->>User: 横向きは現在ブロック + 次ブロック\n縦向きはスクロール表示
  end
```

---

## セットリスト編集フロー（/manage/playlists/[id]）

```mermaid
stateDiagram-v2
  [*] --> セットリスト表示
  セットリスト表示 --> 名前概要編集
  名前概要編集 --> 保存
  セットリスト表示 --> 曲追加モーダル
  曲追加モーダル --> 公開楽曲検索
  公開楽曲検索 --> 曲追加
  セットリスト表示 --> DnD並び替え
  DnD並び替え --> 並び順保存
  セットリスト表示 --> 曲削除
  セットリスト表示 --> セットリストプロンプター起動
```

---

## 共同編集フロー

```mermaid
sequenceDiagram
  actor Owner
  actor Guest
  participant App
  participant DB

  Owner->>App: /manage/songs/[songId] で招待リンク発行
  App->>DB: song_collaborators に token と expires_at を保存
  App-->>Owner: /invite/[token] をコピー
  Guest->>App: /invite/[token] にアクセス
  App->>DB: token と期限を確認
  alt 未ログイン
    App-->>Guest: /auth/signin?callbackUrl=/invite/[token] へ誘導
  else ログイン済み
    Guest->>App: 招待を承認
    App->>DB: song_collaborator_members に登録
    App-->>Guest: /manage/songs/[songId] へ遷移
  end
```

---

## コンポーネント構成

```mermaid
graph TD
  Layout["app/layout.tsx"]
  PublicLayout["songs/layout.tsx\n公開画面ヘッダー・サイドナビ"]
  ManageLayout["manage/layout.tsx\n認証チェック・管理ヘッダー"]
  SongEditLayout["manage/songs/[songId]/layout.tsx\n編集権限チェック"]
  AppMenu["AppMenu.tsx\nハンバーガーメニュー"]
  SideNav["SideNav.tsx\nサイドナビ"]
  Loading["Loading.tsx\nスケルトンスクリーン"]
  SongCard["SongCard.tsx\n一覧カード"]
  AddToPlaylistMenu["AddToPlaylistMenu.tsx\n曲メニュー・セットリスト追加"]
  Skeleton["skeleton.module.css\nシマーアニメーション"]

  Layout --> PublicLayout
  Layout --> ManageLayout
  PublicLayout --> AppMenu
  PublicLayout --> SideNav
  ManageLayout --> AppMenu
  ManageLayout --> SideNav
  ManageLayout --> SongEditLayout
  Loading --> Skeleton

  subgraph Pages
    Home["page.tsx\n/songsへリダイレクト"]
    Songs["songs/page.tsx\n公開パート分け一覧"]
    SongDetail["songs/[songId]/page.tsx\n楽曲詳細"]
    SongPrompter["songs/[songId]/prompter/page.tsx\n単曲プロンプター"]
    PlaylistPrompter["playlists/[id]/prompter/page.tsx\nセットリストプロンプター"]
    ManageSongs["manage/songs/page.tsx\nパート分け管理"]
    ManageSongEdit["manage/songs/[songId]/page.tsx\n4タブ編集"]
    Print["manage/songs/[songId]/print/page.tsx\n印刷・PDF保存"]
    ManagePlaylists["manage/playlists/page.tsx\nセットリスト管理"]
    ManagePlaylistEdit["manage/playlists/[id]/page.tsx\nDnDソート"]
    ManageSettings["manage/settings/page.tsx\nアカウント設定"]
    Invite["invite/[token]/page.tsx\n共同編集招待"]
  end

  SongCard --> AddToPlaylistMenu
```
