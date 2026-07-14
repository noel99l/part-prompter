import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import styles from './page.module.css'

const addSongImage = '/how-to-use/create.svg'
const editImage = '/how-to-use/edit.svg'
const assignImage = '/how-to-use/assign.svg'
const prompterImage = '/how-to-use/prompter.svg'
const playlistImage = '/how-to-use/setlist.svg'
const mobileEditImage = '/how-to-use/mobile-edit.svg'
const mobilePrompterImage = '/how-to-use/mobile-prompter.svg'

export const metadata: Metadata = {
  title: '操作マニュアル | PART-PROMPTER',
  description: 'PART-PROMPTERの楽曲追加、歌詞編集、パート分け、プロンプター、セットリストの操作方法を画像付きで説明します。',
}

const navGroups = [
  { label: 'はじめに', links: [['概要', 'overview'], ['基本の流れ', 'flow']] },
  { label: '楽曲を作成する', links: [['1. 楽曲を追加', 'create'], ['2. 楽曲情報・歌詞', 'editing'], ['3. パート分け', 'assign'], ['4. 変更を保存', 'save']] },
  { label: '本番で使う', links: [['5. プロンプター', 'prompter'], ['6. セットリスト', 'setlist']] },
  { label: '補足', links: [['スマートフォン', 'mobile'], ['よくある質問', 'faq']] },
]

function ManualNav() {
  return <nav aria-label="操作マニュアル目次">{navGroups.map(group => <div className={styles.navGroup} key={group.label}><p>{group.label}</p>{group.links.map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</div>)}</nav>
}

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return <figure className={styles.screenshot}><Image src={src} alt={alt} width={1440} height={900} sizes="(max-width: 900px) 100vw, 780px" unoptimized /><figcaption>{caption}</figcaption></figure>
}

export default function HowToUsePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}><BrandLogo href="/" /><div><Link href="/songs">公開パート分け</Link><Link href="/manage/songs" className={styles.manageLink}>管理画面を開く</Link></div></header>
      <div className={styles.manualLayout}>
        <aside className={styles.sidebar}><p className={styles.sidebarTitle}>操作マニュアル</p><ManualNav /></aside>
        <main className={styles.content}>
          <details className={styles.mobileToc}><summary>目次を表示</summary><ManualNav /></details>
          <div className={styles.breadcrumb}><Link href="/">トップ</Link><span>/</span><span>操作マニュアル</span></div>
          <article>
            <header className={styles.articleHeader} id="overview"><p>PART-PROMPTER USER GUIDE</p><h1>PART-PROMPTER 操作マニュアル</h1><p>楽曲の登録からパート分け、本番でのプロンプター表示まで、基本的な操作を順番に説明します。</p></header>
            <div className={styles.infoBox}><strong>このマニュアルについて</strong><p>公開楽曲の閲覧とプロンプター表示はログイン不要です。楽曲の作成・編集・セットリスト管理にはGoogleログインが必要です。</p></div>
            <section id="flow"><h2><span>0</span>基本の操作フロー</h2><ol className={styles.flow}><li><b>楽曲を追加</b><small>歌詞を検索または入力</small></li><li><b>メンバーを登録</b><small>名前とカラーを設定</small></li><li><b>パート分け</b><small>歌詞に担当を割り当て</small></li><li><b>保存・確認</b><small>プロンプターでプレビュー</small></li></ol></section>
            <section id="create"><h2><span>1</span>楽曲を追加する</h2><p>ログイン後、パート分け管理画面の「＋ 曲を追加」から楽曲を作成します。</p><h3>操作手順</h3><ol className={styles.steps}><li>ヘッダーまたはメニューから「パート分け管理」を開きます。</li><li>「＋ 曲を追加」を押します。</li><li>LRCLIBで曲名を検索するか、「手動で追加」を選択します。</li><li>対象の楽曲を選択して作成します。</li></ol><div className={styles.note}><strong>補足</strong><p>歌詞が見つからない場合でも、曲名とアーティストを手動入力して作成できます。LRC・TXTファイルは作成後の歌詞編集画面から読み込めます。</p></div><Screenshot src={addSongImage} alt="楽曲追加機能の案内" caption="楽曲追加：LRCLIB検索または手動入力で楽曲を作成します。" /></section>
            <section id="editing"><h2><span>2</span>楽曲情報・歌詞を編集する</h2><p>作成した楽曲を開き、最初に楽曲情報、メンバー、歌詞を設定します。</p><div className={styles.tabTable}><div><b>📝 楽曲情報</b><p>曲名・アーティスト・概要・公開設定を編集し、最大10名のメンバー名とカラーを設定します。</p></div><div><b>🎵 歌詞編集</b><p>プレーンテキストまたはLRC形式で歌詞を編集します。LRC・TXTファイルのインポートにも対応しています。</p></div><div><b>▶ プロンプター設定</b><p>表紙テキスト、背景色、進捗バー、BPM変換など、本番での表示を調整します。</p></div></div><div className={styles.note}><strong>LRC形式</strong><p><code>[00:12.34]歌詞テキスト</code>の形式で入力すると、タイムスタンプに合わせた自動再生を利用できます。タイムスタンプなしでも手動操作のプロンプターは利用可能です。</p></div><Screenshot src={editImage} alt="楽曲情報とメンバーの編集画面" caption="楽曲情報：曲名・アーティスト・メンバー名・カラーを設定します。" /></section>
            <section id="assign"><h2><span>3</span>歌詞をパート分けする</h2><p>「🎨 パート分け」タブで担当メンバーを選び、歌詞へ割り当てます。</p><h3>操作手順</h3><ol className={styles.steps}><li>メンバー一覧から割り当てたいメンバーを選択します。複数選択も可能です。</li><li>行全体へ割り当てる場合は、対象の歌詞行をダブルタップします。</li><li>文字単位で割り当てる場合は、対象箇所を長押ししてからなぞります。</li><li>ハモリを設定する場合は、上ハモまたは下ハモのモードを選択して割り当てます。</li><li>行間の「＋ 区切り追加」で、プロンプターの表示ブロックを調整します。</li></ol><Screenshot src={assignImage} alt="パート分け機能の案内" caption="パート分け：メンバーを選択して歌詞へ担当を割り当てます。" /></section>
            <section id="save"><h2><span>4</span>変更を保存する</h2><p>編集が完了したら、画面下部の保存バーから変更を保存します。</p><div className={styles.important}><strong>💾 「すべて保存」を押してください</strong><p>楽曲情報・メンバー・歌詞・パート分けは、タブごとではなく一度に保存されます。「✓ すべて保存済み」と表示されたことを確認してから画面を閉じてください。</p></div><ul className={styles.checkList}><li>「● 未保存の変更があります」が表示されていないか</li><li>タイムスタンプが時系列順になっているか</li><li>公開する場合は「一覧への公開」がオンになっているか</li></ul></section>
            <section id="prompter"><h2><span>5</span>プロンプターを使用する</h2><p>編集画面の「▶ プロンプター表示」または公開楽曲の詳細画面からプロンプターを開きます。</p><Screenshot src={prompterImage} alt="プロンプター機能の案内" caption="プロンプター：パートカラー付きの歌詞を本番向けに表示します。" /><h3>操作方法</h3><div className={styles.tableWrap}><table><thead><tr><th>環境</th><th>操作</th><th>動作</th></tr></thead><tbody><tr><td>PC</td><td><kbd>←</kbd> / <kbd>→</kbd></td><td>前後のブロックへ移動</td></tr><tr><td>PC</td><td><kbd>Space</kbd></td><td>自動再生・一時停止</td></tr><tr><td>スマートフォン</td><td>画面左側をタップ</td><td>前のブロックへ移動</td></tr><tr><td>スマートフォン</td><td>画面右側をタップ</td><td>次のブロックへ移動</td></tr><tr><td>共通</td><td>Auto</td><td>タイムスタンプに合わせて自動進行</td></tr></tbody></table></div><div className={styles.note}><strong>画面の向き</strong><p>横向きでは現在のブロックと次のブロックを表示します。スマートフォンの縦向きでは、全ブロックをスクロールして確認できます。</p></div></section>
            <section id="setlist"><h2><span>6</span>セットリストを作成する</h2><p>複数の楽曲を本番の曲順にまとめ、連続してプロンプターを使用できます。</p><ol className={styles.steps}><li>「セットリスト管理」から新しいセットリストを作成します。</li><li>「＋ 曲を追加」から楽曲を検索して追加します。</li><li>左側のハンドルをドラッグして曲順を変更します。</li><li>セットリストのプロンプターを開き、<b>⏮ / ⏭</b>で前後の曲へ移動します。</li></ol><Screenshot src={playlistImage} alt="セットリスト管理機能の案内" caption="セットリスト：楽曲を追加し、ドラッグ＆ドロップで曲順を変更します。" /></section>
            <section id="mobile"><h2>スマートフォンでの利用</h2><p>管理画面とプロンプターはスマートフォン表示に対応しています。メニューは右上のハンバーガーボタン、パート分けのメンバー選択は画面右下のボタンから開きます。</p><div className={styles.mobileImages}><figure><Image src={mobileEditImage} alt="スマートフォン版の楽曲編集画面" width={390} height={844} sizes="(max-width: 600px) 45vw, 240px" unoptimized /><figcaption>楽曲情報・メンバー編集</figcaption></figure><figure><Image src={mobilePrompterImage} alt="スマートフォン版のプロンプター画面" width={390} height={844} sizes="(max-width: 600px) 45vw, 240px" unoptimized /><figcaption>縦向きプロンプター</figcaption></figure></div><div className={styles.note}><strong>ホーム画面に追加</strong><p>iPhoneのSafariからホーム画面へ追加すると、ブラウザUIを抑えたstandalone表示で起動できます。</p></div></section>
            <section id="faq"><h2>よくある質問</h2><div className={styles.faqList}><details><summary>作成した楽曲は自動的に公開されますか？</summary><p>楽曲情報の「一覧への公開」で切り替えられます。非公開の楽曲は公開一覧に表示されません。</p></details><details><summary>歌詞を編集すると既存のパート分けは消えますか？</summary><p>保存時に同じテキストの行へ既存のパート分けを可能な範囲で引き継ぎます。大きく変更した場合は、保存前にパート分けタブで内容を確認してください。</p></details><details><summary>オンボーディングをもう一度表示できますか？</summary><p>アカウント設定の「オンボーディングをもう一度見る」から再表示できます。</p></details></div></section>
            <section className={styles.related}><h2>関連ページ</h2><div><Link href="/songs">公開パート分けを見る</Link><Link href="/manage/songs">管理画面を開く</Link><Link href="/privacy">プライバシーポリシー</Link><Link href="/terms">利用規約</Link></div></section>
          </article>
        </main>
      </div>
      <footer className={styles.footer}><BrandLogo href="/" /><small>© PART-PROMPTER</small></footer>
    </div>
  )
}
