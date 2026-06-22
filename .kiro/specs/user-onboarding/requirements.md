# Requirements Document

## Introduction

本機能は、Part Prompter（歌詞プロンプター＆パート分けアプリ）に「ユーザーオンボーディング」を追加するものである。Google OAuth でログインした新規ユーザーが、アカウント名設定（`/auth/setup`）を完了した直後に、アプリの主要機能を理解し、最初の操作にスムーズに着手できるようにすることを目的とする。

オンボーディングは「ウェルカム画面」「主要機能の紹介ツアー」「最初のアクションへの誘導」で構成し、ユーザーが任意のタイミングでスキップできる。完了状態はデータベースに永続化し、複数デバイス間で重複表示されないようにする。既存ユーザー（本機能提供開始より前からアカウントを保有するユーザー）の体験を妨げないことを前提とする。

本要件は「何を実現するか（What）」を定義し、UI 実装方法やルーティング構成などの「どう実現するか（How）」は設計フェーズで決定する。

### 想定する前提・統合ポイント（参考情報）

- 認証は Google OAuth（NextAuth v5）。`signIn` コールバックで `users` レコードを作成する。
- `/manage/*` は middleware で認証保護される。`account_name` 未設定の場合、管理レイアウトが `/auth/setup` へリダイレクトする。
- アカウント名設定完了後の主要遷移先は `/manage/songs`。
- `users` テーブルには `id, google_id, email, account_name, created_at` が存在する。オンボーディング完了状態を保持するカラムは現状存在しない。
- DB マイグレーションは `lib/db.ts` の `initDb()` による `CREATE TABLE IF NOT EXISTS` ＋ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` で冪等に行う。

## Glossary

- **オンボーディング (Onboarding)**: 新規ユーザーがアプリの主要機能を理解し、最初の操作に着手するまでの一連の案内体験。
- **Onboarding_Service**: オンボーディングの表示要否判定、完了状態の記録・取得を担うサーバー側のロジック。
- **Onboarding_UI**: ウェルカム画面・機能紹介ツアー・誘導を表示するクライアント側の画面要素（画面またはオーバーレイ）。
- **Welcome_Step**: オンボーディングの最初に表示する、歓迎メッセージとアプリ概要を提示する画面要素。
- **Feature_Tour**: アプリの主要機能を順番に紹介する複数ステップの案内。
- **Tour_Step**: Feature_Tour を構成する個々の紹介ステップ。
- **New_User**: `account_name` を設定済み（空文字でも NULL でもない）で、かつ `onboarding_completed_at` が NULL のユーザー。
- **Existing_User**: 本オンボーディング機能のリリース日時より前に作成されたアカウントを持つユーザー。
- **onboarding_completed_at**: `users` テーブルに追加する、オンボーディング完了日時を保持するカラム（NULL は未完了、NULL 以外の日時は完了済みを表す）。
- **完了 (Complete)**: ユーザーがオンボーディングを最後まで進める、またはスキップした結果として `onboarding_completed_at` が記録された状態。
- **アカウント名設定 (Account Setup)**: `/auth/setup` でアカウント名と規約同意を登録する既存フロー。

## Requirements

### Requirement 1: オンボーディング表示の判定

**User Story:** 新規ユーザーとして、ログイン後の最初のタイミングでオンボーディングを受け取りたい。アプリの使い方を最初に把握したいからである。

#### Acceptance Criteria

1. WHEN ユーザーがアカウント名設定を完了して管理画面に到達したとき、THE Onboarding_Service SHALL 当該ユーザーの `onboarding_completed_at` が NULL（未完了）であるか NULL 以外の日時（完了済み）であるかを判定する。
2. WHEN 判定の結果 `onboarding_completed_at` が NULL であり、かつ `account_name` が空文字でも NULL でもないとき、THE Onboarding_Service SHALL 管理画面到達後 3 秒以内に Onboarding_UI の表示を要求する。
3. IF ユーザーの `account_name` が空文字または NULL である場合、THEN THE Onboarding_Service SHALL Onboarding_UI を表示せず、アカウント名設定フローを優先する。
4. IF ユーザーの `onboarding_completed_at` に NULL 以外の日時が記録されている場合、THEN THE Onboarding_Service SHALL Onboarding_UI を表示しない。
5. IF ユーザーが Existing_User（本機能のリリース日時より前に作成されたアカウント）である場合、THEN THE Onboarding_Service SHALL Onboarding_UI を表示しない。
6. IF `onboarding_completed_at` の読み取りに失敗した場合、THEN THE Onboarding_Service SHALL Onboarding_UI を表示せず、エラーの記録を試み、`onboarding_completed_at` の値を変更しない。

### Requirement 2: ウェルカム画面の表示

**User Story:** 新規ユーザーとして、最初に歓迎メッセージとアプリの概要を見たい。これから使うアプリの目的を理解したいからである。

#### Acceptance Criteria

1. WHEN Onboarding_UI が起動されたとき、THE Onboarding_UI SHALL 起動完了から 2 秒以内に、最初のステップとして Welcome_Step を表示する。
2. WHEN Welcome_Step が表示されたとき、THE Welcome_Step SHALL 歓迎メッセージ（1 文字以上 200 文字以下）、アプリ名の文字列「Part Prompter」、およびアプリの目的を説明する文章（1 文字以上 500 文字以下）の 3 要素をすべて同時に表示する。
3. WHEN Welcome_Step が表示されたとき、THE Welcome_Step SHALL Feature_Tour へ進むための操作要素を 1 つ表示する。
4. WHEN Welcome_Step が表示されたとき、THE Welcome_Step SHALL オンボーディングをスキップするための操作要素を 1 つ表示する。
5. WHEN ユーザーが Welcome_Step で進む操作要素を操作したとき、THE Onboarding_UI SHALL Feature_Tour の最初の Tour_Step を表示する。
6. WHEN ユーザーが Welcome_Step でスキップする操作要素を操作したとき、THE Onboarding_UI SHALL オンボーディングを終了し、オンボーディング完了状態を記録したうえでパート分け管理画面（`/manage/songs`）へ遷移する。
7. IF ユーザーが進む操作要素を操作した時点で表示可能な Tour_Step が 1 つも存在しないとき、THEN THE Onboarding_UI SHALL オンボーディングを終了して管理画面へ遷移し、Tour を表示できない旨を示すエラー表示を行う。

### Requirement 3: 主要機能の紹介ツアー

**User Story:** 新規ユーザーとして、主要機能を順番に紹介してほしい。何ができるアプリかを短時間で把握したいからである。

#### Acceptance Criteria

1. THE Feature_Tour SHALL 次の 5 つの Tour_Step を、(1) 楽曲の追加（LRCLIB による歌詞取得を含む）、(2) パート分けの作成、(3) プロンプター表示、(4) セットリスト管理、(5) 楽曲の出力（PPTX・印刷/PDF）の順序で含む。
2. WHILE Feature_Tour を表示しているとき、THE Onboarding_UI SHALL 現在の Tour_Step 番号（1 から始まる連番）と Tour_Step の総数（5）を「現在/総数」形式で表示する。
3. WHEN ユーザーが最終以外の Tour_Step で次へ進む操作を行ったとき、THE Onboarding_UI SHALL 次の Tour_Step を表示する。
4. WHEN ユーザーが最後の Tour_Step で次へ進む操作を行ったとき、THE Onboarding_UI SHALL Requirement 4 で定義する最初のアクションへの誘導を表示する。
5. WHILE 2 番目以降の Tour_Step を表示しているとき、THE Onboarding_UI SHALL 直前の Tour_Step に戻る操作要素を表示する。
6. WHEN ユーザーが 2 番目以降の Tour_Step で戻る操作を行ったとき、THE Onboarding_UI SHALL 直前の Tour_Step を表示する。
7. WHILE 最初の Tour_Step を表示しているとき、THE Onboarding_UI SHALL 直前の Tour_Step に戻る操作要素を表示しない。
8. THE Onboarding_UI SHALL 詳細な使い方を参照できるよう、既存の使い方ページ（`/how-to-use`）への導線を表示する。

### Requirement 4: 最初のアクションへの誘導

**User Story:** 新規ユーザーとして、紹介の後に何をすればよいか分かるようにしてほしい。すぐに使い始めたいからである。

#### Acceptance Criteria

1. WHEN ユーザーが最後の Tour_Step に到達したとき、THE Onboarding_UI SHALL 最初のアクション（楽曲の追加）へ誘導する操作要素と、オンボーディングを完了する操作要素を、役割を識別できるラベル付きで表示する。
2. WHEN ユーザーが最初のアクションへの誘導操作を行ったとき、THE Onboarding_Service SHALL オンボーディング完了状態の記録を要求する。
3. WHEN ユーザーが最後の Tour_Step で完了操作を行ったとき、THE Onboarding_Service SHALL オンボーディング完了状態の記録を要求する。
4. WHEN オンボーディング完了状態の記録が要求されたとき、THE Onboarding_UI SHALL 記録要求の成否にかかわらず 3 秒以内にパート分け管理画面（`/manage/songs`）を表示する。

### Requirement 5: スキップと完了操作

**User Story:** ユーザーとして、必要のないときはオンボーディングをスキップしたい。早く本来の作業に移りたいからである。

#### Acceptance Criteria

1. WHILE Onboarding_UI を表示しているとき、THE Onboarding_UI SHALL すべてのステップ（最初から最後まで）で、スキップする操作要素を操作可能な状態で常時表示する。
2. WHEN ユーザーがスキップ操作を行ったとき、THE Onboarding_Service SHALL オンボーディング完了状態を永続化する。
3. WHEN ユーザーがスキップ操作を行ったとき、THE Onboarding_UI SHALL 3 秒以内にパート分け管理画面（`/manage/songs`）を表示する。
4. IF スキップ操作に伴う完了状態の永続化が失敗した場合、THEN THE Onboarding_UI SHALL Requirement 8 で定義するエラーハンドリング（保存失敗メッセージの表示と管理画面への遷移）に従う。
5. WHEN ユーザーがオンボーディングを完了またはスキップした後に管理画面へ再度アクセスしたとき、THE Onboarding_Service SHALL 完了状態を確認し、`onboarding_completed_at` が NULL 以外であれば Onboarding_UI を表示しない。

### Requirement 6: 完了状態の永続化

**User Story:** ユーザーとして、一度見たオンボーディングが別の端末でも繰り返し表示されないようにしてほしい。同じ案内を何度も見たくないからである。

#### Acceptance Criteria

1. WHEN ユーザーがオンボーディングを完了またはスキップしたとき、THE Onboarding_Service SHALL 当該ユーザーの `onboarding_completed_at` に、UTC・ISO 8601 形式・ミリ秒精度の完了日時を 3 秒以内に記録する。
2. WHEN アプリ起動時のマイグレーションが実行されたとき、THE Onboarding_Service SHALL `users` テーブルに `onboarding_completed_at` カラムを `ADD COLUMN IF NOT EXISTS` で追加する。
3. IF マイグレーション実行時に `onboarding_completed_at` カラムが既に存在する場合、THEN THE Onboarding_Service SHALL エラーを発生させず、既存の値を保持する。
4. WHEN 完了状態を記録した後に同一ユーザーが別の端末からログインしたとき、THE Onboarding_Service SHALL 記録済みの `onboarding_completed_at`（NULL 以外）を参照して Onboarding_UI を表示しない。
5. IF `onboarding_completed_at` の記録に失敗した場合、THEN THE Onboarding_Service SHALL `onboarding_completed_at` を NULL（未記録）のまま保持し、エラー応答を返す。
6. IF ログイン時に `onboarding_completed_at` の参照に失敗した場合、THEN THE Onboarding_Service SHALL Onboarding_UI を表示せず、エラー応答を返す。

### Requirement 7: オンボーディングの再表示

**User Story:** ユーザーとして、後からもう一度オンボーディングを見直したい。機能を改めて確認したいことがあるからである。

#### Acceptance Criteria

1. THE Onboarding_UI SHALL アカウント設定画面（`/manage/settings`）に、オンボーディングを再表示するための操作要素を常時表示する。
2. WHEN ユーザーが再表示操作要素を実行したとき、THE Onboarding_UI SHALL 1000 ミリ秒以内に Welcome_Step を最初のステップとして Onboarding_UI を表示する。
3. WHEN ユーザーが再表示したオンボーディングを完了またはスキップしたとき、THE Onboarding_Service SHALL `onboarding_completed_at` をサーバー基準の現在日時で更新する。
4. IF ユーザーが再表示したオンボーディングを完了またはスキップせずに離脱または閉じたとき、THEN THE Onboarding_Service SHALL `onboarding_completed_at` の既存値を変更せずに保持する。
5. IF `onboarding_completed_at` の更新に失敗したとき、THEN THE Onboarding_Service SHALL 更新が失敗したことを示すエラー表示を行い、かつ `onboarding_completed_at` の更新前の値を保持する。

### Requirement 8: 完了記録失敗時のエラーハンドリング

**User Story:** ユーザーとして、オンボーディングの保存に失敗してもアプリの利用が妨げられないようにしてほしい。作業を止めたくないからである。

#### Acceptance Criteria

1. IF オンボーディング完了状態の保存が 5 秒以内に完了しない、またはエラー応答を返した場合、THEN THE Onboarding_Service SHALL エラーの記録を試み、失敗確定から 3 秒以内にユーザーをパート分け管理画面（`/manage/songs`）へ遷移させる。
2. IF オンボーディング完了状態の保存が失敗した場合、THEN THE Onboarding_UI SHALL 管理画面への遷移完了後 1 秒以内に保存失敗を示すメッセージを表示し、ユーザーが閉じる操作を行うか最長 10 秒の経過でメッセージを消す。
3. IF オンボーディング完了状態の保存が失敗した場合、THEN THE Onboarding_Service SHALL 完了状態を永続化せず、次回オンボーディングを再実施可能な状態を保持する。
4. IF 完了状態の取得が 5 秒以内に完了しない、またはエラー応答を返した場合、THEN THE Onboarding_Service SHALL Onboarding_UI とエラーメッセージのいずれも表示せず、ユーザーが管理画面を通常どおり利用できる状態を維持する。

### Requirement 9: レスポンシブ表示とアクセシビリティ

**User Story:** ユーザーとして、PC でもスマートフォンでもオンボーディングを快適に操作したい。利用端末はさまざまだからである。

#### Acceptance Criteria

1. WHILE Onboarding_UI を表示幅 320px 以上 1920px 以下で表示しているとき、THE Onboarding_UI SHALL すべての操作要素を横スクロール操作なしで画面の表示領域内に収めて表示する。
2. THE Onboarding_UI SHALL すべての操作要素を Tab キーおよび Shift+Tab キーで到達可能とし、Enter キーまたは Space キーで実行可能とする。
3. WHEN Onboarding_UI を表示したとき、THE Onboarding_UI SHALL Onboarding_UI 内の最初の操作要素へキーボードフォーカスを移動する。
4. WHILE Onboarding_UI を表示しているとき、THE Onboarding_UI SHALL キーボードフォーカスを Onboarding_UI 内の操作要素に限定し、最後の操作要素で Tab キーを押下したとき最初の操作要素へ、最初の操作要素で Shift+Tab キーを押下したとき最後の操作要素へフォーカスを移動する。
5. WHEN キーボードフォーカスが操作要素へ移動したとき、THE Onboarding_UI SHALL フォーカスのある操作要素に視認可能なフォーカス表示を付与する。
6. WHILE スマートフォン表示（表示幅 320px 以上 767px 以下）のとき、THE Onboarding_UI SHALL すべての操作要素のタッチ操作対象領域を 44×44 CSS ピクセル以上で表示する。
7. WHEN ユーザーが Escape キーを押下したとき、THE Onboarding_UI SHALL オンボーディングを完了として記録し、Onboarding_UI を閉じ、Onboarding_UI を開く直前にフォーカスがあった要素へキーボードフォーカスを戻す。
