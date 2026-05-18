export default function DetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        header { display: flex !important; }
      `}</style>
      {children}
    </>
  )
}
