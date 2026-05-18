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
        header { display: none !important; }
        aside { display: none !important; }
        main { flex: 1; }
      `}</style>
      {children}
    </>
  )
}
