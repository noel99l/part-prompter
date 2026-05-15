import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PART-PROMPTER',
}

export default function PrompterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
