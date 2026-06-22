import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getOnboardingStatus, recordOnboardingComplete } from '@/lib/onboarding/service'

// GET /api/onboarding → 表示要否を返す（再表示前の状態確認等に利用）
// 200 { shouldShow, completedAt } / 401 未認証 / 200 { shouldShow:false, error:true }（取得失敗）
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = await getOnboardingStatus(session.user.email)
  return NextResponse.json({
    shouldShow: status.shouldShow,
    completedAt: status.completedAt,
    ...(status.error ? { error: true } : {}),
  })
}

// POST /api/onboarding → 完了/スキップ/再表示完了を記録する
// 200 { ok:true, completedAt } / 401 未認証 / 200 { ok:false }（保存失敗。HTTP は 200 で ok フラグ伝達）
export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await recordOnboardingComplete(session.user.email)
  return NextResponse.json({ ok: result.ok, completedAt: result.completedAt })
}
