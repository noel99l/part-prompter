import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PART-PROMPTER',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PART-PROMPTER',
  },
}

export default function SongPrompterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* プロンプター表示時はヘッダーを非表示 */
        header { display: none !important; }
        main { flex: 1; }
      `}</style>
      {children}
    </>
  )
}
