import type { Metadata } from 'next'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'PART-PROMPTER | 歌詞パート分け・プロンプターアプリ',
  description: '歌詞をメンバーごとに色分けし、そのまま共有・プロンプター表示。練習から本番までを支える歌詞パート分け管理アプリです。',
}

const steps = [
  { number: '01', title: '歌詞を取り込む', text: 'LRCLIBから検索するか、LRC・テキストファイルを読み込んで楽曲を作成します。' },
  { number: '02', title: 'パートを色分け', text: 'メンバーを選んで歌詞をなぞるだけ。文字単位の割り当てやハモリにも対応します。' },
  { number: '03', title: 'そのまま本番へ', text: '作成した内容をスマートフォンやPCのプロンプターで、すぐに表示できます。' },
]

const features = [
  { icon: '🎨', title: '細かなパート分け', text: '最大10名。文字・行単位、複数担当、上ハモ・下ハモまで色分けできます。' },
  { icon: '⏱', title: 'タイムスタンプ再生', text: 'LRCのタイムスタンプに合わせて、プロンプターを自動進行できます。' },
  { icon: '▶', title: 'ライブプロンプター', text: '全画面、タップ、キーボード操作に対応。縦向きでも横向きでも使えます。' },
  { icon: '🎵', title: 'セットリスト', text: '本番の曲順に並べて、プロンプターから前後の楽曲へスムーズに移動できます。' },
  { icon: '🤝', title: '共同編集', text: '招待リンクを共有して、グループのメンバーと同じ楽曲を編集できます。' },
  { icon: '↗', title: '共有・出力', text: '公開URLの共有に加えて、PPTX・PDF・テキスト形式でも利用できます。' },
]

const faqs = [
  ['利用にはログインが必要ですか？', '公開されているパート分けの閲覧やプロンプター表示は、ログインせずに利用できます。作成・編集にはGoogleログインが必要です。'],
  ['作成した楽曲は全員に公開されますか？', '公開・非公開を楽曲ごとに設定できます。非公開の楽曲は公開一覧には表示されません。'],
  ['スマートフォンだけでも使えますか？', 'はい。パート分けの編集からプロンプター表示まで、スマートフォン・タブレット・PCに対応しています。'],
  ['歌詞を自動で取得できますか？', 'LRCLIBから歌詞を検索できるほか、LRC・TXTファイルの読み込みや直接入力にも対応しています。'],
  ['他のメンバーと編集できますか？', '招待リンクを発行することで、グループのメンバーと同じ楽曲を共同編集できます。'],
]

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BrandLogo href="/" />
        <nav className={styles.nav} aria-label="メインナビゲーション">
          <a href="#features">機能</a><a href="#how-it-works">使い方</a><Link href="/songs">公開パート分け</Link>
        </nav>
        <Link href="/auth/signin?callbackUrl=/manage/songs" className={styles.headerCta}>パート分けを作成</Link>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>歌詞パート分け・ライブプロンプター</p>
            <h1>歌う人が、<br /><em>迷わない。</em></h1>
            <p className={styles.lead}>歌詞をメンバーごとに色分けし、そのまま共有・プロンプター表示。練習から本番まで、ひとつの画面で。</p>
            <div className={styles.ctaRow}>
              <Link href="/auth/signin?callbackUrl=/manage/songs" className={styles.primaryCta}>Googleでログインして作成 <span>→</span></Link>
              <Link href="/songs" className={styles.secondaryCta}>公開パート分けを見る</Link>
            </div>
            <p className={styles.heroNote}>公開楽曲の閲覧はログイン不要</p>
          </div>

          <div className={styles.productVisual} aria-label="パート分け編集画面とプロンプター画面のイメージ">
            <div className={styles.glow} />
            <div className={styles.editorMock}>
              <div className={styles.windowBar}><i /><i /><i /><span>パート分け編集</span></div>
              <div className={styles.editorBody}>
                <div className={styles.memberPanel}>
                  <p>MEMBERS</p><span className={styles.memberPink}>A</span><span className={styles.memberBlue}>B</span><span className={styles.memberGreen}>C</span>
                </div>
                <div className={styles.lyricsPanel}>
                  <small>🎨 パート分け</small>
                  <p><b className={styles.pink}>それぞれの声が</b></p>
                  <p><b className={styles.blue}>ひとつに重なって</b></p>
                  <p><b className={styles.green}>新しい景色になる</b></p>
                  <p><b className={styles.pink}>さあ、次のステージへ</b></p>
                </div>
              </div>
            </div>
            <div className={styles.prompterMock}>
              <div className={styles.prompterTop}><span>LIVE</span><small>01:24</small></div>
              <p className={styles.mockCurrent}>それぞれの声が<br />ひとつに重なって</p>
              <p className={styles.mockNext}>新しい景色になる</p>
              <div className={styles.progress}><i /></div>
            </div>
          </div>
        </section>

        <section className={styles.problemSection}>
          <p className={styles.sectionLabel}>FOR YOUR PERFORMANCE</p>
          <h2>パート分けの準備を、<br />もっとシンプルに。</h2>
          <div className={styles.problemGrid}>
            <article><span>01</span><h3>資料作りに時間がかかる</h3><p>色付き歌詞を毎回手作業で作る必要はありません。</p></article>
            <article><span>02</span><h3>最新版が分からなくなる</h3><p>編集内容は共有画面とプロンプターにすぐ反映されます。</p></article>
            <article><span>03</span><h3>本番用に作り直している</h3><p>練習で使ったパート分けを、そのまま本番で表示できます。</p></article>
          </div>
        </section>

        <section className={styles.stepsSection} id="how-it-works">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>HOW IT WORKS</p><h2>3ステップで、<br />本番の準備が整う。</h2></div><Link href="/how-to-use">詳しい使い方を見る →</Link></div>
          <div className={styles.stepGrid}>{steps.map(step => <article key={step.number}><span>{step.number}</span><div className={styles.stepIcon}>{step.number === '01' ? '＋' : step.number === '02' ? '◒' : '▶'}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        </section>

        <section className={styles.featuresSection} id="features">
          <div className={styles.centerHeading}><p className={styles.sectionLabel}>FEATURES</p><h2>練習にも、本番にも。<br />必要な機能をひとつに。</h2></div>
          <div className={styles.featureGrid}>{features.map(feature => <article key={feature.title}><span>{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section className={styles.liveSection}>
          <div className={styles.liveCopy}><p className={styles.sectionLabel}>LIVE PROMPTER</p><h2>作ったパート分けが、<br /><em>そのまま本番の画面に。</em></h2><p>現在の歌詞と次のブロックを見やすく表示。タイムスタンプによる自動進行にも、手動操作にも対応しています。</p><ul><li>スマートフォン・タブレット・PC対応</li><li>縦向き・横向きの表示に対応</li><li>セットリストの前後曲へすぐ移動</li></ul></div>
          <div className={styles.stageMock}><div className={styles.stageBadge}>● LIVE PROMPTER</div><p><span>それぞれの声が</span><br /><b>ひとつに重なって</b></p><small>NEXT</small><div>新しい景色になる</div><i /></div>
        </section>

        <section className={styles.shareSection}><div><p className={styles.sectionLabel}>CREATE TOGETHER</p><h2>一人で作って、みんなで使う。<br />必要なら、みんなで編集する。</h2></div><p>公開URLで手軽に共有。招待リンクを使えば、グループのメンバーと同じ楽曲を共同編集できます。非公開の楽曲は公開一覧には表示されません。</p></section>

        <section className={styles.demoSection}><p className={styles.sectionLabel}>TRY IT NOW</p><h2>まずは実際の<br />パート分けを見てみる。</h2><p>公開されている楽曲は、ログインせずにパート分けやプロンプターを確認できます。</p><Link href="/songs" className={styles.secondaryCta}>公開パート分けを探す <span>→</span></Link></section>

        <section className={styles.faqSection}><div><p className={styles.sectionLabel}>FAQ</p><h2>よくある質問</h2></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section>

        <section className={styles.finalCta}><p className={styles.sectionLabel}>READY TO SING?</p><h2>次の練習曲から、<br /><em>パート分けをもっと簡単に。</em></h2><p>歌詞の準備から本番のプロンプターまで、まとめて管理できます。</p><div className={styles.ctaRow}><Link href="/auth/signin?callbackUrl=/manage/songs" className={styles.primaryCta}>Googleでログインして作成 <span>→</span></Link><Link href="/how-to-use" className={styles.secondaryCta}>使い方を見る</Link></div></section>
      </main>

      <footer className={styles.footer}><BrandLogo href="/" /><div><Link href="/songs">公開パート分け</Link><Link href="/how-to-use">HOW TO USE</Link><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシーポリシー</Link><a href="https://x.com/noel99l" target="_blank" rel="noreferrer">お問い合わせ</a></div><small>© PART-PROMPTER</small></footer>
    </div>
  )
}

