import { describe, expect, it } from 'vitest'
import { createRaster, hasTransparency } from '../image'
import { flattenOnto } from './flatten'

function px(...p: number[][]) {
  const img = createRaster(p.length, 1)
  p.forEach((v, i) => img.data.set(v, i * 4))
  return img
}

describe('flattenOnto', () => {
  it('opaque unchanged, transparent → background', () => {
    const out = flattenOnto(px([10, 20, 30, 255], [99, 99, 99, 0]), { r: 1, g: 2, b: 3 })
    expect(Array.from(out.data)).toEqual([10, 20, 30, 255, 1, 2, 3, 255])
  })
  // denominator 255 is odd, so exact .5 never occurs; near-half pairs pin Math.round
  it('near-half rounding at alpha 128', () => {
    const out = flattenOnto(px([1, 0, 255, 128], [0, 0, 0, 128]), { r: 0, g: 1, b: 0 })
    expect(Array.from(out.data.slice(0, 3))).toEqual([1, 0, 128])
    const out2 = flattenOnto(px([0, 0, 0, 128]), { r: 255, g: 255, b: 255 })
    expect(out2.data[0]).toBe(127)
  })
  it('all alpha 255, new buffer, input unchanged', () => {
    const src = px([1, 2, 3, 4], [5, 6, 7, 200])
    const copy = src.data.slice()
    const out = flattenOnto(src, { r: 255, g: 255, b: 255 })
    expect(hasTransparency(out)).toBe(false)
    expect(out.data).not.toBe(src.data)
    expect([out.width, out.height]).toEqual([2, 1])
    expect(src.data).toEqual(copy)
  })
})
