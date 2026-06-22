// オンボーディングの純粋ロジック（副作用なし）。
// サーバー側の判定（service.ts / manage layout）とクライアント側 UI の双方から利用する。

/** 表示判定の入力（DB から取得した生の値を正規化したもの） */
export interface OnboardingUser {
  accountName: string | null
  onboardingCompletedAt: string | null
}

/** オーバーレイの表示状態 */
export type OnboardingView =
  | { kind: 'welcome' }
  | { kind: 'tour'; step: number } // step: 1..TOUR_TOTAL
  | { kind: 'finalAction' }

/** ツアーステップ総数 */
export const TOUR_TOTAL = 5

/** Tour_Step の内容定義 */
export interface TourStepContent {
  index: number // 1..TOUR_TOTAL
  emoji: string
  title: string
  body: string
  /** 詳細な使い方ページへの導線 (Requirement 3.8) */
  howToUseHref: string
}

/** 主要機能の紹介ツアー（Requirement 3.1 の固定順序） */
export const TOUR_STEPS: readonly TourStepContent[] = [
  {
    index: 1,
    emoji: '🎤',
    title: '楽曲を追加',
    body: 'LRCLIB検索で歌詞を自動取得、または手動入力で楽曲を追加できます。',
    howToUseHref: '/how-to-use',
  },
  {
    index: 2,
    emoji: '🎨',
    title: 'パート分けを作成',
    body: '歌詞をなぞって文字単位、ダブルタップで行単位にメンバーを割り当てます。',
    howToUseHref: '/how-to-use',
  },
  {
    index: 3,
    emoji: '▶️',
    title: 'プロンプター表示',
    body: 'パート色付きのスライドで歌詞を表示。タイムスタンプ歌詞は自動再生に対応します。',
    howToUseHref: '/how-to-use',
  },
  {
    index: 4,
    emoji: '📋',
    title: 'セットリスト管理',
    body: '公開楽曲を検索して追加し、ドラッグで並び替え。セットリスト単位で連続表示できます。',
    howToUseHref: '/how-to-use',
  },
  {
    index: 5,
    emoji: '📤',
    title: '楽曲の出力',
    body: 'PPTX出力や印刷/PDF保存、パート分けテキストのコピーができます。',
    howToUseHref: '/how-to-use',
  },
]

/**
 * 自動表示の判定。
 * account_name が設定済み（トリム後 1 文字以上）かつ onboarding_completed_at が NULL のときのみ true。
 * Requirements 1.2, 1.3, 1.4, 1.5, 5.5, 6.4
 */
export function shouldShowOnboarding(user: OnboardingUser): boolean {
  const hasAccountName = !!user.accountName && user.accountName.trim().length > 0
  const notCompleted = user.onboardingCompletedAt == null
  return hasAccountName && notCompleted
}

/**
 * 「次へ」遷移。
 * welcome → tour 1、tour n(<5) → tour n+1、tour 5 → finalAction、finalAction は不動点。
 * Requirements 2.5, 3.3, 3.4
 */
export function nextView(view: OnboardingView): OnboardingView {
  switch (view.kind) {
    case 'welcome':
      return { kind: 'tour', step: 1 }
    case 'tour':
      if (view.step < TOUR_TOTAL) return { kind: 'tour', step: view.step + 1 }
      return { kind: 'finalAction' }
    case 'finalAction':
      return view
  }
}

/**
 * 「戻る」遷移。
 * tour n(>=2) → tour n-1。welcome / tour 1 / finalAction は不動点。
 * Requirements 3.6, 3.7
 */
export function prevView(view: OnboardingView): OnboardingView {
  if (view.kind === 'tour' && view.step >= 2) {
    return { kind: 'tour', step: view.step - 1 }
  }
  return view
}

/**
 * 戻る操作要素を表示すべきか。tour n(>=2) のときのみ true。
 * Requirements 3.5, 3.7
 */
export function canGoBack(view: OnboardingView): boolean {
  return view.kind === 'tour' && view.step >= 2
}

/**
 * ツアー進捗の「現在/総数」表示用。tour のときのみ値を返し、それ以外は null。
 * Requirements 3.2
 */
export function tourProgress(
  view: OnboardingView
): { current: number; total: number } | null {
  if (view.kind === 'tour') {
    return { current: view.step, total: TOUR_TOTAL }
  }
  return null
}
