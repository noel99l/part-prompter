export default function McSlideLayout({ children }: { children: React.ReactNode }) {
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
