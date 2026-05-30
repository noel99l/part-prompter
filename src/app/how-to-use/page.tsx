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
        path: '/songs',
        sections: [
          { title: '楽曲を探す', body: '曲名・アーティスト・作者名で絞り込み検索ができます。カードには歌詞の種類（テキスト / タイムスタンプ）・パート数・作者・最終更新日時が表示されます。' },
          { title: 'カードをタップ', body: '楽曲カードをタップすると詳細ページに移動します。パート分けの内容・メンバーを確認できます。' },
          { title: '⋯ メニュー', body: 'カード右端の⋯ボタンからセットリストへの追加ができます（ログイン時のみ）。' },
          { title: 'サイドメニュー（PC）', body: 'PC表示時は左側にサイドメニューが常時表示されます。管理画面・セットリスト管理などに移動できます。' },
          { title: 'ハンバーガーメニュー（SP）', body: 'スマートフォンでは右上のハンバーガーメニューからナビゲーションを開けます。' },
        ],
      },
      {
        id: 'detail',
        label: '楽曲詳細',
        path: '/songs/[id]',
        sections: [
          { title: 'パート・歌詞の確認', body: 'パートメンバー・パート分けの内容を閲覧できます。各行の右端にパートの色ドットが表示されます。複数パートの行はグラデーションで色分けされます。' },
          { title: 'タグ表示', body: '曲名の下にテキスト / タイムスタンプ / 👥パート数のタグが表示されます。' },
          { title: '⋯ メニュー', body: '右上の⋯ボタンからパート分けのコピーや複製メニューを開けます。' },
          { title: '📋 パート分けをコピー', body: '曲名・アーティスト・メンバー一覧（A:名前 B:名前...）＋(AB)歌詞... 形式でクリップボードにコピーできます。' },
          { title: '複製して編集（ログイン時）', body: 'ログイン中は「複製して編集」が選択できます。この楽曲をベースに自分のパート分けを作成できます。複製した楽曲は非公開で作成されます。' },
          { title: '▶ プロンプター', body: 'プロンプターボタンでプロンプター表示に移動します。' },
          { title: '作者・更新日', body: 'ページ最下部に作者名と最終更新日時が表示されます。' },
        ],
      },
      {
        id: 'prompter',
        label: 'プロンプター',
        path: '/songs/[id]/prompter',
        sections: [
          { title: 'SP操作（タップ）', body: '画面左半分タップで前のブロック、右半分タップで次のブロックに移動します。縦向き時は全ブロックをスクロール表示します。' },
          { title: 'PC操作（キーボード）', body: '← / → キーまたはスペースキーでブロック移動・再生/一時停止ができます。' },
          { title: 'Auto 再生', body: 'タイムスタンプ歌詞の場合、Autoボタンで自動再生できます。再生中も手動でブロック移動が可能です。' },
          { title: '⛶ 全画面', body: 'PCやAndroidでは全画面ボタンでブラウザUIを非表示にできます。iPhoneはホーム画面に追加することでフルスクリーン起動できます。' },
          { title: '⏮⏭ 前後の曲（セットリスト経由）', body: 'セットリストからプロンプターを開いた場合、⏮⏭ボタンで前後の曲に移動できます。先頭・末尾の曲ではボタンが薄く表示されます。' },
        ],
      },
      {
        id: 'playlist-prompter',
        label: 'セットリスト',
        path: '/playlists/[id]/prompter',
        sections: [
          { title: '曲一覧', body: 'セットリストに登録された曲が番号付きで表示されます。曲をタップするとプロンプター表示に移動します。' },
          { title: '前後の曲移動', body: 'プロンプター表示中に⏮⏭ボタンで前後の曲に移動できます。' },
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
        path: '/manage/songs',
        sections: [
          { title: 'ログイン', body: 'Googleアカウントでログインします。初回ログイン時にアカウント名を設定します。' },
          { title: 'サイドメニュー（PC）', body: 'PC表示時は左側にサイドメニューが常時表示されます。各管理ページに移動できます。' },
          { title: 'ハンバーガーメニュー（SP）', body: 'スマートフォンでは右上のハンバーガーメニューから各ページに遷移できます。' },
        ],
      },
      {
        id: 'songs',
        label: 'パート分け管理',
        path: '/manage/songs',
        sections: [
          { title: '楽曲追加', body: '「＋ 曲を追加」からLRCLIBで曲名検索して歌詞を自動取得するか、手動で曲名・アーティストを入力して追加できます。' },
          { title: '表示される楽曲', body: '自分が追加した楽曲のみ表示されます。他のユーザーの楽曲は表示されません。' },
          { title: '⋯ メニュー', body: 'カード右端の⋯ボタンからセットリストへの追加・楽曲の削除ができます。' },
        ],
      },
      {
        id: 'edit',
        label: 'パート分け編集',
        path: '/manage/songs/[id]',
        tabs: [
          {
            name: '📝 楽曲情報',
            items: [
              { title: '曲名・アーティスト・概要', body: '各フィールドを直接編集できます。概要は200文字まで入力できます。' },
              { title: '一覧への公開', body: 'トグルで公開/非公開を切り替えられます。非公開にするとパート分け一覧に表示されなくなります。デフォルトは公開です。' },
              { title: 'パートメンバー', body: '最大10名まで登録できます。名前が空欄の場合はA・B・C...で表示されます。色はパレットまたはカスタムカラーで設定できます。' },
            ],
          },
          {
            name: '🎵 歌詞編集',
            items: [
              { title: 'LRC形式', body: '[00:00.00]歌詞テキスト の形式で入力します。タイムスタンプにするとプロンプターで自動再生が使えます。' },
              { title: 'テキスト形式', body: 'タイムスタンプなしのプレーンテキストも対応しています。空行でブロックが区切られます。' },
              { title: 'LRCインポート', body: '📂 LRCインポートボタンで.lrcファイルを読み込めます。' },
              { title: '💾 保存', body: '保存するとパート分けタブにも反映されます。既存のパート分けはテキストが一致する行に引き継がれます。' },
            ],
          },
          {
            name: '🎨 パート分け',
            items: [
              { title: 'メンバー選択', body: '左パネル（SPは右下ボタン）でパートメンバーを選択します。複数選択も可能です。' },
              { title: '行をなぞる', body: 'メンバーを選択した状態で歌詞行をタップ/ドラッグすると割り当てられます。' },
              { title: '単語分割（長押し）', body: '行を長押しすると単語ごとのパート分けモードになります。単語をタップして割り当て、右クリックで解除できます。' },
              { title: 'ブロック区切り', body: '行間の「＋ 区切り追加」でブロックを分割できます。プロンプターのスライド単位になります。' },
              { title: '💾 保存', body: 'パート分けを保存ボタンでDBに保存します。' },
            ],
          },
          {
            name: '📤 出力',
            items: [
              { title: '🔗 共有URL（公開時のみ）', body: '楽曲が公開設定の場合、詳細ページのURLをコピーできます。非公開時は表示されません。' },
              { title: 'PPTX出力', body: 'パート分けをPowerPointファイルとして出力します。各ブロックがスライドになります。' },
              { title: 'PDF出力', body: '印刷プレビューページが開きます。ブラウザの印刷ダイアログで「PDFに保存」を選択するとPDF出力できます。' },
              { title: 'テキストコピー', body: '曲名・アーティスト・メンバー一覧（A:名前 B:名前...）＋(AB)歌詞... 形式でコピーできます。名前が空欄のメンバーは一覧に表示されません。' },
            ],
          },
        ],
      },
      {
        id: 'playlist',
        label: 'セットリスト管理',
        path: '/manage/playlists',
        sections: [
          { title: 'セットリスト作成', body: '「＋ セットリストを追加」からセットリスト名を入力して作成します。作成後すぐに編集ページに移動します。' },
          { title: '表示されるセットリスト', body: '自分が作成したセットリストのみ表示されます。' },
          { title: '概要', body: 'カードに概要が表示されます。編集ページから設定できます。' },
          { title: '⋯ メニュー', body: 'カード右端の⋯ボタンからセットリストの削除ができます。' },
        ],
      },
      {
        id: 'playlist-edit',
        label: 'セットリスト編集',
        path: '/manage/playlists/[id]',
        sections: [
          { title: 'セットリスト名・概要', body: 'セットリスト名をクリックするとインライン編集できます。概要はテキストエリアに入力し、フォーカスを外すと自動保存されます（200文字まで）。' },
          { title: '曲を追加', body: '右上の「＋ 曲を追加」ボタンからモーダルを開き、曲名・アーティスト・歌詞で検索して追加できます。自分以外のユーザーの公開楽曲も追加可能です。' },
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
        <Link href="/songs" className={styles.backLink}>← 一覧に戻る</Link>
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
