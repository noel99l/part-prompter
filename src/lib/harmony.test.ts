import { describe, it, expect } from 'vitest'
import { harmonyIds, harmonyBandStyle } from './harmony'

describe('harmonyIds', () => {
  it('新形式の配列をそのまま返す', () => {
    expect(harmonyIds({ harmony_up_ids: [1, 2, 3] }, 'up')).toEqual([1, 2, 3])
    expect(harmonyIds({ harmony_down_ids: [4] }, 'down')).toEqual([4])
  })

  it('旧形式（単一ID）は配列に変換される', () => {
    expect(harmonyIds({ harmony_up_id: 7 }, 'up')).toEqual([7])
    expect(harmonyIds({ harmony_down_id: 8 }, 'down')).toEqual([8])
  })

  it('新形式があれば旧形式より優先する', () => {
    expect(harmonyIds({ harmony_up_ids: [1, 2], harmony_up_id: 9 }, 'up')).toEqual([1, 2])
  })

  it('人数の上限はない', () => {
    expect(harmonyIds({ harmony_up_ids: [1, 2, 3, 4, 5] }, 'up')).toEqual([1, 2, 3, 4, 5])
  })

  it('未設定なら空配列', () => {
    expect(harmonyIds({}, 'up')).toEqual([])
    expect(harmonyIds(undefined, 'down')).toEqual([])
  })
})

describe('harmonyBandStyle', () => {
  it('ハモリなしなら null', () => {
    expect(harmonyBandStyle([], [], '0.07em')).toBeNull()
  })

  it('上ハモのみ: 上端に人数分の高さの帯', () => {
    const style = harmonyBandStyle(['#f00', '#0f0'], [], '0.07em')!
    expect(style.backgroundSize).toBe('100% calc(0.07em * 2)')
    expect(style.backgroundPosition).toBe('left top')
    expect(style.backgroundImage).toContain('#f00')
    expect(style.backgroundImage).toContain('#0f0')
  })

  it('上下両方: 2レイヤーになる', () => {
    const style = harmonyBandStyle(['#f00'], ['#00f', '#0ff', '#fff'], '2px')!
    expect(style.backgroundSize).toBe('100% calc(2px * 1), 100% calc(2px * 3)')
    expect(style.backgroundPosition).toBe('left top, left bottom')
  })
})
