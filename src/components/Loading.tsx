import styles from './Loading.module.css'

export default function Loading({ label }: { label: string }) {
  return (
    <div className={styles.wrapper}>
      <div className={`${styles.skeleton} ${styles.header}`} />
      {label === '曲一覧' || label === '楽曲一覧' || label === 'セットリスト' ? (
        <>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.card}`} />
          ))}
        </>
      ) : label === 'プロンプター' || label === '楽曲詳細' ? (
        <>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={styles.block}>
              {[...Array(4)].map((_, j) => (
                <div key={j} className={`${styles.skeleton} ${styles.line} ${j % 3 === 2 ? styles.lineShort : j % 2 === 0 ? styles.lineFull : styles.lineMedium}`} />
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <div className={styles.tabs}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`${styles.skeleton} ${styles.tab}`} />
            ))}
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.line} ${i % 2 === 0 ? styles.lineFull : styles.lineMedium}`} />
          ))}
        </>
      )}
    </div>
  )
}
