import { describe, expect, it } from 'vitest'
import { histogram } from './histogram'
import { createRaster } from './image'

function img(...px: number[][]) {
  const r = createRaster(px.length, 1)
  px.forEach((p, i) => r.data.set(p, i * 4))
  return r
}

describe('histogram', () => {
  it('per channel counts', () => {
    const h = histogram(img([10, 0, 0, 255], [10, 5, 0, 0], [200, 5, 0, 255]), 'r', 255)
    expect(h.length).toBe(256)
    expect([h[10], h[200], h[0]]).toEqual([2, 1, 0])
    const a = histogram(img([0, 0, 0, 255], [0, 0, 0, 0]), 'a', 255)
    expect([a[255], a[0]]).toEqual([1, 1])
  })
  it('luma composite rounds BT.601', () => {
    const h = histogram(img([255, 0, 0, 255], [0, 255, 0, 255]), 'luma', 255)
    expect(h[76]).toBe(1) // 76.245
    expect(h[150]).toBe(1) // 149.685
  })
  it('GB7 range bins 0..127', () => {
    const h = histogram(img([255, 255, 255, 255], [129, 129, 129, 255], [2, 2, 2, 255]), 'r', 127)
    expect(h.length).toBe(128)
    expect([h[127], h[64], h[1]]).toEqual([1, 1, 1])
  })
  it('input unchanged', () => {
    const i = img([1, 2, 3, 4])
    const c = i.data.slice()
    histogram(i, 'luma', 255)
    expect(i.data).toEqual(c)
  })
})
