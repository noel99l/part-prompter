import Link from 'next/link'

export const metadata = { title: 'プライバシーポリシー | PART-PROMPTER' }

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#ccc', fontFamily: "'Hiragino Sans', sans-serif", padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/prompter" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>← 一覧に戻る</Link>

        <h1 style={{ color: '#fff', fontSize: '1.6rem', margin: '1.5rem 0 0.5rem' }}>プライバシーポリシー</h1>
        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '2rem' }}>最終更新日：2025年6月</p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>1. 収集する情報</h2>
          <p style={p}>本サービス（PART-PROMPTER）は、Googleアカウントによるログイン時に以下の情報を取得します。</p>
          <ul style={ul}>
            <li>Googleアカウントのメールアドレス</li>
            <li>GoogleアカウントのユーザーID（内部識別用）</li>
            <li>ユーザーが設定したアカウント名</li>
          </ul>
          <p style={p}>また、ユーザーが登録した楽曲情報（曲名・アーティスト・歌詞・パート分けデータ）をデータベースに保存します。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>2. 情報の利用目的</h2>
          <ul style={ul}>
            <li>ユーザー認証および管理画面へのアクセス制御</li>
            <li>楽曲・歌詞・パート分けデータの保存・表示</li>
            <li>作成者名の表示（楽曲一覧への表示）</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>3. 第三者への提供</h2>
          <p style={p}>収集した個人情報は、法令に基づく場合を除き、第三者に提供・開示しません。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>4. 使用する外部サービス</h2>
          <ul style={ul}>
            <li><strong style={{ color: '#fff' }}>Google OAuth</strong> — ログイン認証に使用。<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={link}>Googleプライバシーポリシー</a></li>
            <li><strong style={{ color: '#fff' }}>Neon (PostgreSQL)</strong> — データベースホスティングに使用</li>
            <li><strong style={{ color: '#fff' }}>Vercel</strong> — アプリケーションのホスティングに使用</li>
            <li><strong style={{ color: '#fff' }}>LRCLIB</strong> — 歌詞検索機能に使用。<a href="https://lrclib.net" target="_blank" rel="noreferrer" style={link}>lrclib.net</a></li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>5. データの保管・削除</h2>
          <p style={p}>ユーザーデータはNeonのデータベースに保管されます。退会はアカウント設定ページから行えます。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>6. Cookieについて</h2>
          <p style={p}>本サービスはセッション管理のためにCookieを使用します。ブラウザの設定によりCookieを無効にすることができますが、その場合ログイン機能が利用できなくなります。</p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={h2}>7. ポリシーの変更</h2>
          <p style={p}>本ポリシーは予告なく変更される場合があります。変更後は本ページに掲載します。</p>
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
const link: React.CSSProperties = { color: '#FF69B4', textDecoration: 'none' }
