import { describe, expect, it } from 'vitest'
import { createRaster } from './image'
import { samplePixel } from './sample'

describe('samplePixel', () => {
  it('reads RGBA and Lab; null outside', () => {
    const img = createRaster(2, 2)
    img.data.set([255, 0, 0, 200], (1 * 2 + 1) * 4)
    const s = samplePixel(img, 1, 1)!
    expect([s.x, s.y, s.r, s.g, s.b, s.a]).toEqual([1, 1, 255, 0, 0, 200])
    expect(s.lab.L).toBeCloseTo(53.2408, 3)
    expect(samplePixel(img, 2, 0)).toBeNull()
    expect(samplePixel(img, -1, 0)).toBeNull()
  })
})
