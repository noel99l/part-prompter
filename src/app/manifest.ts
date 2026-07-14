import type { MetadataRoute } from 'next'

// ホーム画面からは公開楽曲一覧を開き、scope は全アプリ内遷移を含むルートに維持する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PART-PROMPTER',
    short_name: 'PART-PROMPTER',
    description: '歌詞パート分け管理・プロンプターアプリ',
    start_url: '/songs',
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
