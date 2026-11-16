'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import skStyles from '@/components/skeleton.module.css'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'
import { notifyAnnouncementsChanged } from '@/lib/announcementsClient'
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_TITLE_MAX,
  parseAnnouncementInput,
  type Announcement,
  type AnnouncementCategory,
  type AnnouncementStatus,
} from '@/lib/announcementsShared'
import { isMasterSessionUserId } from '@/lib/masterUser'
import common from '@/app/manage/page.module.css'
import styles from './page.module.css'

interface FormState {
  id: number | null
  title: string
  body: string
  category: AnnouncementCategory
  is_important: boolean
}

const EMPTY_FORM: FormState = { id: null, title: '', body: '', category: 'update', is_important: false }

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }) : ''

export default function AnnouncementsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isMaster = isMasterSessionUserId(session?.user?.id)
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/announcements?all=1')
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      console.error('お知らせ一覧の取得に失敗しました', e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    // マスター以外は開けない（APIも403を返す）
    if (!isMaster) { router.replace('/manage/songs'); return }
    load()
  }, [status, isMaster, router, load])

  const save = async (nextStatus: AnnouncementStatus) => {
    if (!form || saving) return
    const payload = { title: form.title, body: form.body, category: form.category, is_important: form.is_important, status: nextStatus }
    const parsed = parseAnnouncementInput(payload)
    if (!parsed.ok) { setError(parsed.error); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(form.id == null ? '/api/announcements' : `/api/announcements/${form.id}`, {
        method: form.id == null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.value),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || '保存できませんでした。もう一度お試しください。')
        return
      }
      setForm(null)
      notifyAnnouncementsChanged()
      await load()
    } catch {
      setError('保存できませんでした。通信状況を確認して、もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: Announcement) => {
    if (!confirm(`「${item.title}」を削除しますか？\n削除すると元に戻せません。`)) return
    const res = await fetch(`/api/announcements/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('削除できませんでした。もう一度お試しください。'); return }
    if (form?.id === item.id) setForm(null)
    notifyAnnouncementsChanged()
    await load()
  }

  const startEdit = (item: Announcement) => {
    setError('')
    setForm({ id: item.id, title: item.title, body: item.body, category: item.category, is_important: item.is_important })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (status === 'loading' || !isMaster) return (
    <div className={common.container}>
      <div className={skStyles.sk} style={{ width: 180, height: 28 }} />
    </div>
  )

  const editingItem = form?.id != null ? items.find(item => item.id === form.id) : undefined

  return (
    <div className={common.container}>
      <div className={common.header}>
        <h1 className={common.title}>📝 お知らせ管理</h1>
        {!form && <button className={common.createBtn} onClick={() => { setError(''); setForm(EMPTY_FORM) }}>＋ 新規作成</button>}
      </div>

      {form && (
        <section className={styles.form} aria-label={form.id == null ? 'お知らせの新規作成' : 'お知らせの編集'}>
          <label className={styles.label}>
            <span>タイトル</span>
            <input
              className={styles.input}
              value={form.title}
              maxLength={ANNOUNCEMENT_TITLE_MAX}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="セットリストにMCスライドを追加できるようになりました"
              autoFocus
            />
          </label>
          <div className={styles.row}>
            <label className={styles.label}>
              <span>種別</span>
              <select
                className={styles.input}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as AnnouncementCategory })}
              >
                {ANNOUNCEMENT_CATEGORIES.map(category => (
                  <option key={category} value={category}>{ANNOUNCEMENT_CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={form.is_important}
                onChange={e => setForm({ ...form, is_important: e.target.checked })}
              />
              <span>重要（一覧ページの上部にバナーで表示）</span>
            </label>
          </div>
          <label className={styles.label}>
            <span>本文（{form.body.length} / {ANNOUNCEMENT_BODY_MAX}）</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={form.body}
              maxLength={ANNOUNCEMENT_BODY_MAX}
              onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="変更点や使い方を書きます。URLは自動でリンクになります。"
            />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => setForm(null)} disabled={saving}>キャンセル</button>
            <button className={styles.secondaryBtn} onClick={() => save('draft')} disabled={saving}>
              {editingItem?.status === 'published' ? '下書きに戻す' : '下書き保存'}
            </button>
            <button className={common.createBtn} onClick={() => save('published')} disabled={saving}>
              {saving ? '保存中...' : editingItem?.status === 'published' ? '更新する' : '公開する'}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className={common.list}>
          {[...Array(3)].map((_, i) => <div key={i} className={skStyles.sk} style={{ width: '100%', height: 88, borderRadius: 10 }} />)}
        </div>
      ) : loadError ? (
        <div role="alert">
          <p className={common.empty} style={{ color: '#ccc', marginBottom: '1rem' }}>お知らせ一覧を読み込めませんでした。通信状況を確認して、もう一度お試しください。</p>
          <button className={common.createBtn} onClick={load}>再読み込み</button>
        </div>
      ) : items.length === 0 ? (
        <p className={common.empty}>お知らせはまだありません。「新規作成」から投稿できます。</p>
      ) : (
        <div className={common.list}>
          {items.map(item => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardMeta}>
                <span className={item.status === 'published' ? styles.published : styles.draft}>
                  {item.status === 'published' ? '公開中' : '下書き'}
                </span>
                <span className={styles.category}>{ANNOUNCEMENT_CATEGORY_LABELS[item.category] ?? 'お知らせ'}</span>
                {item.is_important && <span className={styles.important}>重要</span>}
                <span className={styles.date}>
                  {item.published_at ? `公開: ${formatDateTime(item.published_at)}` : `作成: ${formatDateTime(item.created_at)}`}
                </span>
              </div>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <AnnouncementBody text={item.body} className={styles.cardBody} />
              <div className={styles.cardActions}>
                <button className={styles.secondaryBtn} onClick={() => startEdit(item)}>編集</button>
                <button className={styles.dangerBtn} onClick={() => remove(item)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
