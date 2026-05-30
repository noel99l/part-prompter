export default function DetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        header { display: flex !important; }
        @media (min-width: 768px) {
          aside { display: block !important; }
          .hamburger { display: none !important; }
        }
      `}</style>
      {children}
    </>
  )
}
