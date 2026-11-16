import { describe, it, expect } from 'vitest'
import { buildPartLabelMap, lineHasLabelRow, readableTextColor, splitLineSegments, type PartLabelLine } from './partLabels'

type TestLine = PartLabelLine & { id: number }
let nextId = 1
const whole = (text: string, member_ids: number[] = []): TestLine => ({ id: nextId++, text, member_ids })
const chars = (
  parts: { text: string; member_ids?: number[]; up?: number[]; down?: number[] }[],
  member_ids: number[] = []
): TestLine => ({
  id: nextId++,
  text: parts.map(p => p.text).join(''),
  member_ids,
  word_members: parts.flatMap(p => p.text.split('').map(ch => ({
    text: ch,
    member_ids: p.member_ids ?? [],
    ...(p.up ? { harmony_up_ids: p.up } : {}),
    ...(p.down ? { harmony_down_ids: p.down } : {}),
  }))),
})

describe('splitLineSegments', () => {
  it('文字単位の割り当てがない行は、行の担当で1区間になる', () => {
    expect(splitLineSegments(whole('あいう', [1]))).toEqual([{ text: 'あいう', mainIds: [1], upIds: [], downIds: [] }])
  })

  it('担当が同じ連続文字は1区間にまとめ、変わり目で区切る', () => {
    const segs = splitLineSegments(chars([{ text: 'あい', member_ids: [1] }, { text: 'うえ', member_ids: [2] }]))
    expect(segs.map(s => [s.text, s.mainIds])).toEqual([['あい', [1]], ['うえ', [2]]])
  })

  it('文字のメイン担当が空なら行の担当にフォールバックする', () => {
    const segs = splitLineSegments(chars([{ text: 'あい', down: [2] }], [1]))
    expect(segs).toEqual([{ text: 'あい', mainIds: [1], upIds: [], downIds: [2] }])
  })

  it('ハモリの有無が変わるところも区間の切れ目になる', () => {
    const segs = splitLineSegments(chars([{ text: 'あい', member_ids: [1] }, { text: 'うえ', member_ids: [1], down: [2] }]))
    expect(segs.map(s => [s.text, s.downIds])).toEqual([['あい', []], ['うえ', [2]]])
  })

  it('空白は担当の切れ目にせず、直前の区間に含める', () => {
    const line = chars([{ text: 'あい', member_ids: [1] }, { text: '　' }, { text: 'うえ', member_ids: [1] }])
    expect(splitLineSegments(line).map(s => s.text)).toEqual(['あい　うえ'])
  })

  it('メンバーの並び順が違うだけなら同じ担当として扱う', () => {
    const segs = splitLineSegments(chars([{ text: 'あ', member_ids: [1, 2] }, { text: 'い', member_ids: [2, 1] }]))
    expect(segs).toHaveLength(1)
  })
})

describe('buildPartLabelMap', () => {
  it('同じ担当が続く行ではラベルを繰り返さず、変わった行だけに出す', () => {
    const a = whole('1行目', [1])
    const b = whole('2行目', [1])
    const c = whole('3行目', [2])
    const d = whole('4行目', [2])
    const map = buildPartLabelMap([[a, b, c, d]], l => l.id)
    expect([a, b, c, d].map(l => map.get(l.id)![0].showLabel)).toEqual([true, false, true, false])
  })

  it('グループ（スライド）の先頭では、前と同じ担当でも必ずラベルを出す', () => {
    const a = whole('1行目', [1])
    const b = whole('2行目', [1])
    const map = buildPartLabelMap([[a], [b]], l => l.id)
    expect(map.get(a.id)![0].showLabel).toBe(true)
    expect(map.get(b.id)![0].showLabel).toBe(true)
  })

  it('行の途中で担当が変わると、変わった区間にラベルが付く', () => {
    const a = whole('1行目', [1])
    const b = chars([{ text: 'あい', member_ids: [1] }, { text: 'うえ', member_ids: [2] }])
    const map = buildPartLabelMap([[a, b]], l => l.id)
    // 前半は直前の行と同じ担当なのでラベルなし、後半は変わったのでラベルあり
    expect(map.get(b.id)!.map(s => s.showLabel)).toEqual([false, true])
  })

  it('担当が未設定の行は全員（mainIdsが空）として扱い、担当ありの行と区別する', () => {
    const a = whole('担当あり', [1])
    const b = whole('未設定')
    const c = whole('未設定の続き')
    const map = buildPartLabelMap([[a, b, c]], l => l.id)
    expect(map.get(b.id)![0]).toMatchObject({ mainIds: [], showLabel: true })
    expect(map.get(c.id)![0].showLabel).toBe(false)
  })
})

describe('lineHasLabelRow', () => {
  it('スライド先頭の行はラベル行を持つ', () => {
    expect(lineHasLabelRow(whole('あ', [1]), null)).toBe(true)
  })

  it('直前の行と同じ担当ならラベル行を持たない', () => {
    expect(lineHasLabelRow(whole('い', [1]), whole('あ', [1]))).toBe(false)
  })

  it('直前の行の末尾と担当が違えばラベル行を持つ', () => {
    const prev = chars([{ text: 'あい', member_ids: [1] }, { text: 'うえ', member_ids: [2] }])
    expect(lineHasLabelRow(whole('お', [1]), prev)).toBe(true)
    expect(lineHasLabelRow(whole('お', [2]), prev)).toBe(false)
  })

  it('行の途中で担当が変わる行は、直前と同じ担当で始まってもラベル行を持つ', () => {
    const line = chars([{ text: 'あい', member_ids: [1] }, { text: 'うえ', member_ids: [2] }])
    expect(lineHasLabelRow(line, whole('前', [1]))).toBe(true)
  })
})

describe('readableTextColor', () => {
  it('明るい色には濃色、暗い色には白を返す', () => {
    expect(readableTextColor('#7CFC00')).toBe('#111')
    expect(readableTextColor('#FFFFFF')).toBe('#111')
    expect(readableTextColor('#1E90FF')).toBe('#fff')
    expect(readableTextColor('#000')).toBe('#fff')
  })
})
