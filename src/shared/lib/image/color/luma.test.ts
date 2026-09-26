import { describe, expect, it } from 'vitest'
import { luma } from './luma'

describe('luma (BT.601)', () => {
  it('black and white', () => {
    expect(luma(0, 0, 0)).toBe(0)
    expect(luma(255, 255, 255)).toBeCloseTo(255, 9)
  })
  it('primaries', () => {
    expect(luma(255, 0, 0)).toBeCloseTo(76.245, 9)
    expect(luma(0, 255, 0)).toBeCloseTo(149.685, 9)
    expect(luma(0, 0, 255)).toBeCloseTo(29.07, 9)
  })
  it('grey maps to itself, unrounded', () => {
    for (const v of [1, 64, 127, 200]) expect(luma(v, v, v)).toBeCloseTo(v, 9)
    expect(Number.isInteger(luma(255, 0, 0))).toBe(false)
  })
})
