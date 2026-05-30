import Link from 'next/link'

export const metadata = { title: '利用規約 | PART-PROMPTER' }

export default function TermsPage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#ccc', fontFamily: "'Hiragino Sans', sans-serif", padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/songs" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>← 一覧に戻る</Link>

        <h1 style={{ color: '#fff', fontSize: '1.6rem', margin: '1.5rem 0 0.5rem' }}>利用規約</h1>
        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '2rem' }}>最終更新日：2025年6月</p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>1. 適用</h2>
          <p style={p}>本規約は、PART-PROMPTER（以下「本サービス」）の利用に関する条件を定めるものです。本サービスを利用することで、本規約に同意したものとみなします。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>2. サービスの内容</h2>
          <p style={p}>本サービスは、歌詞のパート分け管理およびプロンプター表示機能を提供します。ログインなしで公開されたパート分けの閲覧・プロンプター利用が可能です。Googleアカウントでログインすることで、パート分けの作成・編集・セットリスト管理が利用できます。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>3. 禁止事項</h2>
          <p style={p}>以下の行為を禁止します。</p>
          <ul style={ul}>
            <li>著作権その他の権利を侵害するコンテンツの登録・公開</li>
            <li>他のユーザーや第三者を誹謗中傷するコンテンツの投稿</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>不正アクセスやサーバーへの過度な負荷をかける行為</li>
            <li>その他、法令または公序良俗に反する行為</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>4. コンテンツの取り扱い</h2>
          <p style={p}>ユーザーが登録した楽曲情報・歌詞・パート分けデータの著作権はユーザー本人に帰属します。公開設定にしたコンテンツは、他のユーザーが閲覧・セットリストへの追加・複製して編集することができます。</p>
          <p style={p}>運営者は、禁止事項に該当すると判断したコンテンツを予告なく削除できるものとします。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>5. アカウントの管理</h2>
          <p style={p}>アカウントはGoogleアカウントと連携して管理されます。アカウントの不正利用による損害について、運営者は責任を負いません。アカウントの削除はアカウント設定ページから行えます。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>6. サービスの変更・停止</h2>
          <p style={p}>運営者は、予告なく本サービスの内容を変更・停止することがあります。これによりユーザーに生じた損害について、運営者は責任を負いません。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>7. 免責事項</h2>
          <p style={p}>本サービスは現状有姿で提供されます。運営者は、本サービスの利用により生じた損害について、一切の責任を負いません。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>8. 規約の変更</h2>
          <p style={p}>本規約は予告なく変更される場合があります。変更後は本ページに掲載します。変更後も本サービスを利用した場合、変更後の規約に同意したものとみなします。</p>
        </section>

        <p style={{ color: '#555', fontSize: '0.85rem', borderTop: '1px solid #222', paddingTop: '1.5rem', marginTop: '2rem' }}>
          PART-PROMPTER
        </p>
        <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          お問い合わせ：
          <a href="https://x.com/noel99l" target="_blank" rel="noreferrer" style={{ color: '#888', textDecoration: 'none', marginLeft: '0.5rem' }}>X @noel99l</a>
          <span style={{ margin: '0 0.5rem', color: '#333' }}>|</span>
          <a href="https://github.com/noel99l" target="_blank" rel="noreferrer" style={{ color: '#888', textDecoration: 'none' }}>GitHub @noel99l</a>
        </p>
      </div>
    </div>
  )
}

const h2: React.CSSProperties = { color: '#fff', fontSize: '1.05rem', marginBottom: '0.75rem', borderLeft: '3px solid #FF69B4', paddingLeft: '0.75rem' }
const p: React.CSSProperties = { lineHeight: 1.8, fontSize: '0.95rem', marginBottom: '0.5rem' }
const ul: React.CSSProperties = { paddingLeft: '1.5rem', lineHeight: 2, fontSize: '0.95rem' }
