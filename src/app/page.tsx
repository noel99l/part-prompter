import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'PART-PROMPTER | 歌詞パート分け・プロンプターアプリ',
  description: '歌詞をメンバーごとに色分けし、iPadや外部モニターへプロンプター表示。練習から本番までを支える歌詞パート分け管理アプリです。',
}

const steps = [
  { number: '01', title: '歌詞を取り込む', text: 'LRCLIBから検索するか、LRC・テキストファイルを読み込んで楽曲を作成します。' },
  { number: '02', title: 'パートを色分け', text: 'メンバーを選んで歌詞をなぞるだけ。文字単位の割り当てやハモリにも対応します。' },
  { number: '03', title: 'iPad・モニターへ表示', text: '作成したパート分けをiPadの横向き画面や外部モニターに大きく表示できます。' },
]

const features = [
  { icon: '🎨', title: '細かなパート分け', text: '最大20名。文字・行単位、複数担当、上ハモ・下ハモまで色分けできます。' },
  { icon: '⏱', title: 'タイムスタンプ再生', text: 'LRCのタイムスタンプに合わせて、プロンプターを自動進行できます。' },
  { icon: '▰', title: '大画面プロンプター', text: 'iPadの横向き表示やPCに接続した外部モニターで、歌詞を大きく確認できます。' },
  { icon: '🎵', title: 'セットリスト', text: '本番の曲順に並べて、プロンプターから前後の楽曲へスムーズに移動できます。' },
  { icon: '🤝', title: '共同編集', text: '招待リンクを共有して、グループのメンバーと同じ楽曲を編集できます。' },
  { icon: '↗', title: '共有・出力', text: '公開URLの共有に加えて、PPTX・PDF・テキスト形式でも利用できます。' },
]

const faqs = [
  ['利用にはログインが必要ですか？', '公開されているパート分けの閲覧やプロンプター表示は、ログインせずに利用できます。作成・編集にはGoogleログインが必要です。'],
  ['作成した楽曲は全員に公開されますか？', '公開・非公開を楽曲ごとに設定できます。非公開の楽曲は公開一覧には表示されません。'],
  ['プロンプターはどの端末で表示できますか？', '本番ではiPadの横向き表示、またはPCに接続した外部モニターでの表示を想定しています。スマートフォンやPC単体でも利用できます。'],
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
        <Link href="/manage/songs" className={styles.headerCta}>パート分けを作成</Link>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>歌詞パート分け・ライブプロンプター</p>
            <h1>歌う人が、<br /><em>迷わない。</em></h1>
            <p className={styles.lead}>歌詞をメンバーごとに色分けし、iPadや外部モニターへ大きく表示。練習から本番まで、ひとつの画面で。</p>
            <div className={styles.ctaRow}>
              <Link href="/manage/songs" className={styles.primaryCta}>パート分けを作成 <span>→</span></Link>
              <Link href="/songs" className={styles.secondaryCta}>公開パート分けを見る</Link>
            </div>
            <p className={styles.heroNote}>公開楽曲の閲覧はログイン不要</p>
          </div>

          <div className={styles.productVisual} aria-label="実際のパート分け編集画面とiPadプロンプターのプレビュー">
            <div className={styles.glow} />
            <figure className={styles.editorPreview}>
              <figcaption><span>パート分け編集画面</span><small>現在のUIに合わせたプレビュー</small></figcaption>
              <Image src="/how-to-use/assign.svg" alt="実際のパート分け編集画面に合わせたプレビュー" width={1440} height={900} sizes="(max-width: 800px) 92vw, 570px" unoptimized />
            </figure>
            <div className={styles.ipadHero} aria-label="iPad横向きのプロンプター表示">
              <span className={styles.ipadCamera} />
              <div className={styles.ipadScreen}><Image src="/how-to-use/prompter.svg" alt="iPad横向きで表示したプロンプター" width={1440} height={900} sizes="(max-width: 800px) 72vw, 360px" unoptimized /></div>
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
          <div className={styles.liveCopy}><p className={styles.sectionLabel}>LIVE PROMPTER</p><h2>iPadでも、<br /><em>外部モニターでも。</em></h2><p>現在の歌詞を大きく、次のブロックを画面下部に表示。ステージ上の距離からでも担当パートを確認しやすい横向きレイアウトです。</p><ul><li>iPadを横向きにして手元のプロンプターに</li><li>PCから外部モニターやプロジェクターへ表示</li><li>タップ・キーボード・タイムスタンプ自動進行</li><li>セットリストの前後曲へすぐ移動</li></ul></div>
          <div className={styles.deviceShowcase} aria-label="外部モニターとiPadでのプロンプター表示例">
            <div className={styles.monitorDevice}><div className={styles.monitorScreen}><Image src="/how-to-use/prompter.svg" alt="外部モニターに表示したプロンプター" width={1440} height={900} sizes="(max-width: 800px) 92vw, 540px" unoptimized /></div><div className={styles.monitorStand}><i /></div><span>EXTERNAL MONITOR</span></div>
            <div className={styles.ipadDevice}><span className={styles.ipadCamera} /><div className={styles.ipadScreen}><Image src="/how-to-use/prompter.svg" alt="iPad横向きに表示したプロンプター" width={1440} height={900} sizes="(max-width: 800px) 56vw, 280px" unoptimized /></div><small>iPad</small></div>
          </div>
        </section>

        <section className={styles.shareSection}><div><p className={styles.sectionLabel}>CREATE TOGETHER</p><h2>一人で作って、みんなで使う。<br />必要なら、みんなで編集する。</h2></div><p>公開URLで手軽に共有。招待リンクを使えば、グループのメンバーと同じ楽曲を共同編集できます。非公開の楽曲は公開一覧には表示されません。</p></section>

        <section className={styles.demoSection}><p className={styles.sectionLabel}>TRY IT NOW</p><h2>まずは実際の<br />パート分けを見てみる。</h2><p>公開されている楽曲は、ログインせずにパート分けやプロンプターを確認できます。</p><Link href="/songs" className={styles.secondaryCta}>公開パート分けを探す <span>→</span></Link></section>

        <section className={styles.faqSection}><div><p className={styles.sectionLabel}>FAQ</p><h2>よくある質問</h2></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section>

        <section className={styles.finalCta}><p className={styles.sectionLabel}>READY TO SING?</p><h2>次の練習曲から、<br /><em>パート分けをもっと簡単に。</em></h2><p>歌詞の準備から本番のプロンプターまで、まとめて管理できます。</p><div className={styles.ctaRow}><Link href="/manage/songs" className={styles.primaryCta}>パート分けを作成 <span>→</span></Link><Link href="/how-to-use" className={styles.secondaryCta}>使い方を見る</Link></div></section>
      </main>

      <footer className={styles.footer}><BrandLogo href="/" /><div><Link href="/songs">公開パート分け</Link><Link href="/how-to-use">HOW TO USE</Link><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシーポリシー</Link><a href="https://x.com/noel99l" target="_blank" rel="noreferrer">お問い合わせ</a></div><small>© PART-PROMPTER</small></footer>
    </div>
  )
}

