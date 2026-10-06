import { describe, expect, it } from 'vitest'
import { createRaster } from './image'
import { INTERPOLATORS, resample } from './interpolation'

function row(...px: number[][]) {
  const r = createRaster(px.length, 1)
  px.forEach((p, i) => r.data.set(p, i * 4))
  return r
}
const reds = (img: { data: Uint8ClampedArray }) =>
  Array.from(img.data.filter((_, i) => i % 4 === 0))

describe('interpolation', () => {
  it('registry is extensible and described', () => {
    for (const ip of Object.values(INTERPOLATORS)) {
      expect(ip.name).toBeTruthy()
      expect(ip.description.length).toBeGreaterThan(20)
    }
  })
  it('nearest 2×2 → 4×4 duplicates pixels', () => {
    const src = createRaster(2, 2)
    ;[10, 20, 30, 40].forEach((v, i) => src.data.set([v, 0, 0, 255], i * 4))
    const out = resample(src, 4, 4, 'nearest')
    expect(reds(out)).toEqual([10, 10, 20, 20, 10, 10, 20, 20, 30, 30, 40, 40, 30, 30, 40, 40])
  })
  it('bilinear 2×1 [0,255] → 4×1', () => {
    const out = resample(row([0, 0, 0, 255], [255, 0, 0, 255]), 4, 1, 'bilinear')
    // coords −0.25, 0.25, 0.75, 1.25 → clamp, 63.75, 191.25, clamp
    expect(reds(out)).toEqual([0, 64, 191, 255])
  })
  it('identity at scale 1 for both', () => {
    const src = row([1, 2, 3, 255], [4, 5, 6, 200], [7, 8, 9, 0])
    for (const id of ['nearest', 'bilinear'] as const) {
      const out = resample(src, 3, 1, id)
      expect(Array.from(out.data.slice(0, 8))).toEqual(Array.from(src.data.slice(0, 8)))
      expect(out.data[11]).toBe(0)
    }
  })
  it('downscale bilinear averages', () => {
    const out = resample(
      row([0, 0, 0, 255], [100, 0, 0, 255], [200, 0, 0, 255], [255, 0, 0, 255]),
      2,
      1,
      'bilinear',
    )
    expect(reds(out)).toEqual([50, 228])
  })
  it('premultiplied: opaque red next to transparent stays red', () => {
    const out = resample(row([255, 0, 0, 255], [0, 0, 0, 0]), 4, 1, 'bilinear')
    expect(Array.from(out.data.slice(4, 8))).toEqual([255, 0, 0, 191])
  })
  it('input unchanged', () => {
    const src = row([1, 2, 3, 4], [5, 6, 7, 8])
    const c = src.data.slice()
    resample(src, 5, 3, 'bilinear')
    expect(src.data).toEqual(c)
  })
})
