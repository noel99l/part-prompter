import type { MetadataRoute } from 'next'

// Web App Manifest。
// scope / start_url を "/" にすることで、iOS の「ホーム画面に追加」した standalone 表示でも
// アプリ内の同一スコープ遷移（例: /songs → /manage/songs）が別 WebView に飛ばず、
// standalone ウィンドウ内で完結するようにする。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PART-PROMPTER',
    short_name: 'PART-PROMPTER',
    description: '歌詞パート分け管理・プロンプターアプリ',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'ja',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
