import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'part-prompter',
  description: 'Lyrics prompter with part assignment',
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
