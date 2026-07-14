import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'PART-PROMPTER',
  description: '歌詞をメンバーごとに色分けし、そのまま共有・プロンプター表示。練習から本番までを支える歌詞パート分け管理アプリです。',
  applicationName: 'PART-PROMPTER',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'PART-PROMPTER',
    title: 'PART-PROMPTER | 歌詞パート分け・プロンプターアプリ',
    description: '歌詞をメンバーごとに色分けし、共有・プロンプター表示までまとめて管理できます。',
  },
  twitter: {
    card: 'summary',
    title: 'PART-PROMPTER | 歌詞パート分け・プロンプターアプリ',
    description: '歌詞をメンバーごとに色分けし、共有・プロンプター表示までまとめて管理できます。',
  },
  // ホーム画面追加時に standalone 表示にし、スコープ内遷移を WebView に飛ばさない
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PART-PROMPTER',
  },
  other: {
    // iOS が standalone 判定に用いるレガシー meta（明示的に付与）
    'apple-mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
