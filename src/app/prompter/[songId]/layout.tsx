import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'PART-PROMPTER',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function PrompterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media (max-width: 768px) and (orientation: portrait) {
          body {
            transform: rotate(90deg);
            transform-origin: left top;
            width: 100vh;
            height: 100vw;
            overflow-x: hidden;
            position: absolute;
            top: 0;
            left: 100%;
          }
        }
      `}</style>
      {children}
    </>
  )
}
