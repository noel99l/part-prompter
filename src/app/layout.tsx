import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'PART-PROMPTER',
  description: 'PART-PROMPTER',
  // ホーム画面追加時に standalone 表示にし、スコープ内遷移を WebView に飛ばさない
  manifest: '/manifest.webmanifest',
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
