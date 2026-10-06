import { describe, expect, it } from 'vitest'
import { createRaster } from './image'
import { fromPixels, megapixels, resizeImage, toPixels, validateSize } from './resize'

const orig = { width: 1920, height: 1080 }

describe('resize helpers', () => {
  it('megapixels', () => {
    expect(megapixels(1920, 1080)).toBe('2.07 МП')
  })
  it('px ↔ percent', () => {
    expect(toPixels(50, 'percent', 1920)).toBe(960)
    expect(toPixels(0.01, 'percent', 10)).toBe(1)
    expect(fromPixels(960, 'percent', 1920)).toBe(50)
    expect(toPixels(300, 'px', 1920)).toBe(300)
  })
  it('validation', () => {
    expect(validateSize(800, 600, 'px', orig)).toEqual({})
    expect(validateSize('', 600, 'px', orig).width).toBe('Введите число')
    expect(validateSize(10.5, 600, 'px', orig).width).toMatch(/целое/)
    expect(validateSize(0, 600, 'px', orig).width).toMatch(/От 1/)
    expect(validateSize(50, 2000, 'percent', orig).height).toMatch(/1000/)
    expect(validateSize(10000, 10000, 'px', orig)).toEqual({})
    expect(validateSize(16384, 16384, 'px', orig).total).toMatch(/максимум 100 МП/)
    expect(validateSize(1000, 50, 'percent', orig).width).toMatch(/16384/)
    expect(validateSize(0.001, 50, 'percent', orig).width).toMatch(/меньше 1 px/)
  })
  it('GB7 range result stays on 7-bit grid', () => {
    const img = createRaster(2, 1)
    img.data.set([0, 0, 0, 255, 255, 255, 255, 255])
    const out = resizeImage(img, 5, 1, 'bilinear', 127)
    const grid = new Set(Array.from({ length: 128 }, (_, v) => Math.round((v * 255) / 127)))
    for (let i = 0; i < out.data.length; i += 4) expect(grid.has(out.data[i]!)).toBe(true)
  })
})
