import skStyles from '@/components/skeleton.module.css'

// セグメント遷移中に即座に表示するフォールバック（loading.tsx 用）。
// サーバー側のデータ取得を待たずにクリックへの視覚反応を返すのが目的。
export default function RouteLoading() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={skStyles.sk} style={{ width: '40%', height: 28, borderRadius: 6 }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} className={skStyles.sk} style={{ width: '100%', height: 72, borderRadius: 10 }} />
      ))}
    </div>
  )
}
