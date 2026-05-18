export default function DetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        header { display: flex !important; }
        aside { display: block !important; }
      `}</style>
      {children}
    </>
  )
}
