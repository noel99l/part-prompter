'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

const GROUPS = [
  {
    label: '🎵 一般画面',
    color: '#fff',
    pages: [
      {
        id: 'list',
        label: 'パート分け一覧',
        path: '/prompter',
        sections: [
          { title: '楽曲を探す', body: '曲名・アーティスト・作者名で絞り込み検索ができます。カードには歌詞の種類（テキスト / タイムスタンプ付き）とパート数・最終更新日時が表示されます。' },
          { title: 'カードをタップ', body: '楽曲カードをタップすると詳細ページに移動します。パート分けの内容・作者・メンバーを確認できます。' },
          { title: '管理画面ログイン', body: '右上のハンバーガーメニューから「管理画面ログイン」を選択するとGoogleアカウントでログインできます。' },
        ],
      },
      {
        id: 'detail',
        label: '楽曲詳細',
        path: '/prompter/[id]/detail',
        sections: [
          { title: 'パート・歌詞の確認', body: '作者・パートメンバー・パート分けの内容を閲覧できます。各行の右端にパートの色ドットが表示されます。' },
          { title: '⋯ メニュー', body: '右上の⋯ボタンからコピーや複製メニューを開けます。' },
          { title: '📋 パート分けをコピー', body: 'テキスト形式（(A)歌詞...）をクリップボードにコピーできます。' },
          { title: '複製して編集（ログイン時）', body: 'ログイン中は「複製して編集」が選択できます。この楽曲をベースに自分のパート分けを作成できます。複製した楽曲は非公開で作成されます。' },
          { title: '▶ プロンプター', body: 'プロンプターボタンでプロンプター表示に移動します。' },
        ],
      },
      {
        id: 'prompter',
        label: 'プロンプター',
        path: '/prompter/[id]',
        sections: [
          { title: 'SP操作（タップ）', body: '画面左半分タップで前のブロック、右半分タップで次のブロックに移動します。▶/⏸ボタンで再生/一時停止できます。' },
          { title: 'PC操作（キーボード）', body: '← / → キーでブロック移動、スペースキーで再生/一時停止ができます。◀ / ▶▶ ボタンも表示されます。' },
          { title: '▶ 再生', body: 'タイムスタンプ付き歌詞の場合、▶ボタンで自動再生できます。再生中も手動でブロック移動が可能です。' },
          { title: '⛶ 全画面', body: 'PCやAndroidでは全画面ボタンでブラウザUIを非表示にできます。iPhoneはホーム画面に追加することでフルスクリーン起動できます。' },
        ],
      },
    ],
  },
  {
    label: '⚙️ 管理画面',
    color: '#FF69B4',
    pages: [
      {
        id: 'admin',
        label: '管理トップ',
        path: '/admin',
        sections: [
          { title: 'ログイン', body: 'Googleアカウントでログインします。初回ログイン時にアカウント名を設定します。' },
          { title: 'メニュー構成', body: '管理トップから「楽曲管理」「プレイリスト管理」「アカウント設定」に移動できます。右上のハンバーガーメニューからも各ページに遷移できます。' },
        ],
      },
      {
        id: 'songs',
        label: '楽曲管理',
        path: '/admin/songs',
        sections: [
          { title: '楽曲追加', body: '「＋ 曲を追加」からLRCLIBで曲名検索して歌詞を自動取得するか、手動で曲名・アーティストを入力して追加できます。' },
          { title: '表示される楽曲', body: '自分が追加した楽曲のみ表示されます。他のユーザーの楽曲は表示されません。' },
        ],
      },
      {
        id: 'edit',
        label: 'パート分け編集',
        path: '/admin/[id]',
        tabs: [
          {
            name: '📝 楽曲情報',
            items: [
              { title: '曲名・アーティスト', body: '曲名・アーティスト名をクリックするとインライン編集できます。Enterで保存、✕でキャンセルです。' },
              { title: '一覧への公開', body: 'トグルで公開/非公開を切り替えられます。非公開にするとパート分け一覧に表示されなくなります。デフォルトは公開です。' },
              { title: 'パートメンバー', body: '最大10名まで登録できます。名前はフォーカスを外すと自動保存されます。色はパレットまたはカスタムカラーで設定できます。' },
            ],
          },
          {
            name: '🎵 歌詞編集',
            items: [
              { title: 'LRC形式', body: '[00:00.00]歌詞テキスト の形式で入力します。タイムスタンプ付きにするとプロンプターで自動再生が使えます。' },
              { title: 'テキスト形式', body: 'タイムスタンプなしのプレーンテキストも対応しています。空行でブロックが区切られます。' },
              { title: 'LRCインポート', body: '📂 LRCインポートボタンで.lrcファイルを読み込めます。' },
              { title: '💾 保存', body: '保存するとパート分けタブにも反映されます。既存のパート分けはテキストが一致する行に引き継がれます。' },
            ],
          },
          {
            name: '🎨 パート分け',
            items: [
              { title: 'メンバー選択', body: '左パネル（SPは右下ボタン）でパートメンバーを選択します。複数選択も可能です。選択中のパートはボタンに色チップで表示されます。' },
              { title: '行をなぞる', body: 'メンバーを選択した状態で歌詞行をタップ/ドラッグすると割り当てられます。' },
              { title: '単語分割（長押し）', body: '行を長押しすると単語ごとのパート分けモードになります。単語をタップして割り当て、右クリックで解除できます。' },
              { title: 'ブロック区切り', body: '行間の「＋ 区切り追加」でブロックを分割できます。プロンプターのスライド単位になります。' },
              { title: '💾 保存', body: 'パート分けを保存ボタンでDBに保存します。' },
            ],
          },
          {
            name: '📤 出力',
            items: [
              { title: 'PPTX出力', body: 'パート分けをPowerPointファイルとして出力します。各ブロックがスライドになります。' },
              { title: 'PDF出力', body: '印刷プレビューページが開きます。ブラウザの印刷ダイアログで「PDFに保存」を選択するとPDF出力できます。' },
              { title: 'テキストコピー', body: '(A)歌詞テキスト 形式でクリップボードにコピーできます。' },
            ],
          },
        ],
      },
      {
        id: 'playlist',
        label: 'プレイリスト管理',
        path: '/admin/playlists',
        sections: [
          { title: 'プレイリスト作成', body: '「＋ プレイリストを追加」からプレイリスト名を入力して作成します。作成後すぐに編集ページに移動します。' },
          { title: '楽曲の追加', body: '曲名・アーティスト・歌詞で横断検索してサジェストから追加できます。自分以外のユーザーの楽曲も追加可能です。' },
          { title: '並び替え', body: '各楽曲の左端の⠿ハンドルをドラッグして順番を変更できます。' },
        ],
      },
      {
        id: 'settings',
        label: 'アカウント設定',
        path: '/admin/settings',
        sections: [
          { title: 'アカウント名の変更', body: 'アカウント名を変更できます。変更した名前は楽曲の作者として一覧に表示されます。' },
        ],
      },
    ],
  },
]

const ALL_PAGES = GROUPS.flatMap(g => g.pages)

export default function HowToUsePage() {
  const [active, setActive] = useState('list')
  const page = ALL_PAGES.find(p => p.id === active)!
  const group = GROUPS.find(g => g.pages.some(p => p.id === active))!

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/prompter" className={styles.backLink}>← 一覧に戻る</Link>
        <h1 className={styles.title}>HOW TO USE</h1>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav}>
          {GROUPS.map(g => (
            <div key={g.label} className={styles.navGroup}>
              <div className={styles.navGroupLabel} style={{ color: g.color }}>{g.label}</div>
              {g.pages.map(p => (
                <button
                  key={p.id}
                  className={`${styles.navItem} ${active === p.id ? styles.navItemActive : ''}`}
                  style={active === p.id ? { borderLeftColor: group.color, color: group.color } : {}}
                  onClick={() => setActive(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.content}>
          <div className={styles.pageHeader} style={{ borderBottomColor: group.color + '44' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 className={styles.pageTitle}>{page.label}</h2>
              <span className={styles.groupBadge} style={{ background: group.color + '22', color: group.color, border: `1px solid ${group.color}44` }}>
                {group.label}
              </span>
            </div>
            <code className={styles.pagePath}>{page.path}</code>
          </div>

          {'tabs' in page ? (
            <PageWithTabs page={page as any} />
          ) : (
            <div className={styles.sections}>
              {(page as any).sections.map((s: any, i: number) => (
                <div key={i} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{s.title}</h3>
                  <p className={styles.sectionBody}>{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PageWithTabs({ page }: { page: { tabs: { name: string; items: { title: string; body: string }[] }[] } }) {
  const [tab, setTab] = useState(0)
  const current = page.tabs[tab]
  return (
    <div>
      <div className={styles.tabs}>
        {page.tabs.map((t, i) => (
          <button key={i} className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`} onClick={() => setTab(i)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className={styles.sections}>
        {current.items.map((item, i) => (
          <div key={i} className={styles.section}>
            <h3 className={styles.sectionTitle}>{item.title}</h3>
            <p className={styles.sectionBody}>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
